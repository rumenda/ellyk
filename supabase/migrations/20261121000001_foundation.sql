-- =============================================================================
-- Elly K Driving School — Foundation
-- Extensions, core enums, identity/roles, locations, settings, numbering,
-- audit log and the RLS helper functions used by every later migration.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists citext with schema extensions;

-- Internal helpers live in `private`, which PostgREST does not expose.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'platform_owner', 'manager', 'admin', 'accountant', 'instructor', 'student'
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Today's date in the school's timezone (Africa/Nairobi).
create or replace function private.today_ke()
returns date language sql stable as $$
  select (now() at time zone 'Africa/Nairobi')::date
$$;

-- Normalise Kenyan phone numbers to +2547XXXXXXXX / +2541XXXXXXXX.
-- Returns NULL when the input cannot be a valid Kenyan mobile number.
create or replace function private.normalize_ke_phone(p text)
returns text language plpgsql immutable as $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(p, '[^0-9]', '', 'g');
  if d ~ '^254[17][0-9]{8}$' then return '+' || d; end if;
  if d ~ '^0[17][0-9]{8}$' then return '+254' || substr(d, 2); end if;
  if d ~ '^[17][0-9]{8}$' then return '+254' || d; end if;
  return null;
end $$;

-- -----------------------------------------------------------------------------
-- Identity: profiles + roles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text check (phone is null or phone ~ '^\+254[17][0-9]{8}$'),
  email extensions.citext,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- -----------------------------------------------------------------------------
-- Locations
-- -----------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{2,8}$'),
  name text not null check (length(trim(name)) between 2 and 80),
  address text,
  phone text check (phone is null or phone ~ '^\+254[17][0-9]{8}$'),
  manager_user_id uuid references public.profiles (id),
  -- {"mon":{"open":"07:00","close":"18:00"}, "sun": null, ...}
  opening_hours jsonb not null default '{}'::jsonb,
  capacity integer not null default 40 check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger locations_updated before update on public.locations
  for each row execute function private.set_updated_at();

-- Staff (non-instructor) employment details.
create table public.staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  employee_number text not null unique,
  job_title text,
  hire_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_updated before update on public.staff
  for each row execute function private.set_updated_at();

-- Location scoping for administrators (and any other location-bound staff).
create table public.staff_locations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  primary key (user_id, location_id)
);
create index staff_locations_location_idx on public.staff_locations (location_id);

-- -----------------------------------------------------------------------------
-- School settings (single row) and tax rates
-- -----------------------------------------------------------------------------
create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  rate numeric(6, 4) not null check (rate >= 0 and rate < 1),
  -- eTIMS item tax category letter (A=16% VAT, B, C=0%, D=Exempt, E=8% ...)
  etims_tax_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.school_settings (
  id smallint primary key default 1 check (id = 1),
  legal_name text not null default 'Elly K Driving School',
  trading_name text not null default 'Elly K Driving School',
  kra_pin text check (kra_pin is null or kra_pin ~ '^[AP][0-9]{9}[A-Z]$'),
  postal_address text,
  physical_address text,
  phone text,
  email text,
  website text,
  currency text not null default 'KES' check (currency = 'KES'),
  timezone text not null default 'Africa/Nairobi',
  -- Tax
  vat_registered boolean not null default false,
  prices_tax_inclusive boolean not null default true,
  etims_enabled boolean not null default false,
  -- Fiscal year
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  -- Payments
  paybill_number text,
  paybill_account_hint text not null default 'Use your student number as the account number',
  mpesa_unknown_account_policy text not null default 'accept'
    check (mpesa_unknown_account_policy in ('accept', 'reject')),
  -- Component allocation order for incoming payments (first gets paid first)
  allocation_priority text[] not null default array['registration', 'service_fee', 'tuition', 'ntsa', 'other'],
  default_service_fee numeric(12, 2) not null default 0 check (default_service_fee >= 0),
  payment_due_reminder_days smallint not null default 2,
  -- Training / completion rules
  require_full_payment_for_completion boolean not null default true,
  minimum_student_age smallint not null default 16,
  -- Security / privacy
  require_staff_mfa boolean not null default false,
  data_retention_years smallint not null default 7 check (data_retention_years between 1 and 20),
  terms_version text not null default '2026-01',
  terms_text text not null default 'By accepting, you agree to the course fee breakdown and payment plan shown. Instalments carry no interest. The platform service fee is shown separately and is collected on behalf of the system provider.',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);
insert into public.school_settings (id) values (1);
create trigger school_settings_updated before update on public.school_settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Document numbering (receipts, invoices, students …)
-- -----------------------------------------------------------------------------
create table public.document_sequences (
  key text primary key,
  prefix text not null,
  padding smallint not null default 6 check (padding between 3 and 10),
  include_year boolean not null default true,
  current_year smallint,
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now()
);

insert into public.document_sequences (key, prefix, padding, include_year) values
  ('student', 'EK', 5, false),
  ('enrolment', 'ENR', 5, true),
  ('invoice', 'INV', 6, true),
  ('receipt', 'RCT', 6, true),
  ('adjustment', 'ADJ', 5, true),
  ('refund', 'RFD', 5, true),
  ('journal', 'JE', 7, true),
  ('expense', 'EXP', 5, true),
  ('settlement', 'DST', 4, true),
  ('certificate', 'CERT', 5, true);

-- Row-locking (gap-free within a transaction) document number generator.
create or replace function private.next_document_number(p_key text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  s public.document_sequences%rowtype;
  yr smallint := extract(year from (now() at time zone 'Africa/Nairobi'))::smallint;
  v bigint;
begin
  select * into s from public.document_sequences where key = p_key for update;
  if not found then
    raise exception 'Unknown document sequence %', p_key;
  end if;
  if s.include_year and coalesce(s.current_year, 0) <> yr then
    s.next_value := 1;
  end if;
  v := s.next_value;
  update public.document_sequences
     set next_value = v + 1, current_year = yr, updated_at = now()
   where key = p_key;
  if s.include_year then
    return s.prefix || '-' || yr || '-' || lpad(v::text, s.padding, '0');
  end if;
  return s.prefix || lpad(v::text, s.padding, '0');
end $$;

-- -----------------------------------------------------------------------------
-- Role / scope helper functions for RLS (SECURITY DEFINER to avoid recursion)
-- -----------------------------------------------------------------------------
create or replace function private.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.is_active
    where ur.user_id = auth.uid() and ur.role = r
  )
$$;

create or replace function private.has_any_role(rs public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and p.is_active
    where ur.user_id = auth.uid() and ur.role = any (rs)
  )
$$;

create or replace function private.is_manager()
returns boolean language sql stable as $$ select private.has_role('manager') $$;

-- Finance = manager or accountant
create or replace function private.is_finance()
returns boolean language sql stable as $$
  select private.has_any_role(array['manager', 'accountant']::public.app_role[])
$$;

-- Office staff = manager, admin, accountant (not instructors)
create or replace function private.is_office()
returns boolean language sql stable as $$
  select private.has_any_role(array['manager', 'admin', 'accountant']::public.app_role[])
$$;

create or replace function private.is_staff()
returns boolean language sql stable as $$
  select private.has_any_role(array['manager', 'admin', 'accountant', 'instructor']::public.app_role[])
$$;

-- Whether the current user may see records belonging to a location.
create or replace function private.can_access_location(loc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    private.has_any_role(array['manager', 'accountant']::public.app_role[])
    or exists (
      select 1 from public.staff_locations sl
      where sl.user_id = auth.uid() and sl.location_id = loc
        and private.has_role('admin')
    )
$$;

-- -----------------------------------------------------------------------------
-- Audit log (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_roles text[],
  action text not null,
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_time_idx on public.audit_logs (occurred_at desc);

create or replace function private.block_audit_mutation()
returns trigger language plpgsql as $$
begin
  if current_setting('app.allow_audit_purge', true) = 'on' and tg_op = 'DELETE' then
    return old;
  end if;
  raise exception 'Audit log entries are immutable';
end $$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.block_audit_mutation();

-- Request metadata forwarded by PostgREST (best effort).
create or replace function private.request_header(name text)
returns text language plpgsql stable as $$
declare h json;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  return h ->> name;
end $$;

create or replace function private.actor_roles()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(role::text order by role), '{}') from public.user_roles where user_id = auth.uid()
$$;

-- Fields never written into the audit log in clear text.
create or replace function private.redact(j jsonb)
returns jsonb language sql immutable as $$
  select case when j is null then null else
    j - array['activation_code_hash', 'id_number', 'raw_payload', 'p256dh', 'auth']
      || case when j ? 'id_number' then jsonb_build_object('id_number', '[redacted]') else '{}'::jsonb end
  end
$$;

create or replace function private.write_audit(
  p_action text, p_entity_type text, p_entity_id text,
  p_old jsonb default null, p_new jsonb default null, p_meta jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, actor_roles, action, entity_type, entity_id,
                                 old_values, new_values, ip_address, user_agent, metadata)
  values (auth.uid(), private.actor_roles(), p_action, p_entity_type, p_entity_id,
          private.redact(p_old), private.redact(p_new),
          coalesce(split_part(private.request_header('x-forwarded-for'), ',', 1),
                   private.request_header('x-real-ip')),
          left(private.request_header('user-agent'), 300),
          coalesce(p_meta, '{}'::jsonb));
end $$;

-- Generic row-level audit trigger. Only changed columns are stored for updates.
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o jsonb; n jsonb; k text; o2 jsonb := '{}'; n2 jsonb := '{}';
begin
  if tg_op = 'INSERT' then
    perform private.write_audit(lower(tg_table_name) || '.create', tg_table_name, (to_jsonb(new) ->> 'id'), null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    o := to_jsonb(old); n := to_jsonb(new);
    for k in select jsonb_object_keys(n) loop
      if k <> 'updated_at' and (o -> k) is distinct from (n -> k) then
        o2 := o2 || jsonb_build_object(k, o -> k);
        n2 := n2 || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if n2 <> '{}'::jsonb then
      perform private.write_audit(lower(tg_table_name) || '.update', tg_table_name, (n ->> 'id'), o2, n2);
    end if;
    return new;
  else
    perform private.write_audit(lower(tg_table_name) || '.delete', tg_table_name, (to_jsonb(old) ->> 'id'), to_jsonb(old), null);
    return old;
  end if;
end $$;

-- Role changes are always audited.
create or replace function private.audit_user_roles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('permission.grant', 'user_roles', new.user_id::text, null,
      jsonb_build_object('role', new.role));
    return new;
  else
    perform private.write_audit('permission.revoke', 'user_roles', old.user_id::text,
      jsonb_build_object('role', old.role), null);
    return old;
  end if;
end $$;
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function private.audit_user_roles();

create trigger school_settings_audit after update on public.school_settings
  for each row execute function private.audit_row();
create trigger tax_rates_audit after insert or update or delete on public.tax_rates
  for each row execute function private.audit_row();
create trigger locations_audit after insert or update on public.locations
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- DB-backed rate limiter (works across serverless instances)
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c integer;
begin
  insert into private.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into c;
  delete from private.rate_limits where window_start < now() - interval '1 day';
  return c <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- RLS for foundation tables
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.locations enable row level security;
alter table public.staff enable row level security;
alter table public.staff_locations enable row level security;
alter table public.tax_rates enable row level security;
alter table public.school_settings enable row level security;
alter table public.document_sequences enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_manager_update on public.profiles for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_office()));
create policy user_roles_manage on public.user_roles for all to authenticated
  using ((select private.is_manager()) and role <> 'platform_owner')
  with check ((select private.is_manager()) and role <> 'platform_owner');

create policy locations_read on public.locations for select to authenticated using (true);
create policy locations_manage on public.locations for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy staff_read on public.staff for select to authenticated using ((select private.is_office()));
create policy staff_manage on public.staff for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy staff_locations_read on public.staff_locations for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_office()));
create policy staff_locations_manage on public.staff_locations for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy tax_rates_read on public.tax_rates for select to authenticated using ((select private.is_office()));
create policy tax_rates_manage on public.tax_rates for all to authenticated
  using ((select private.is_finance())) with check ((select private.is_finance()));

-- Everyone signed in may read school settings (students need the paybill number).
create policy school_settings_read on public.school_settings for select to authenticated using (true);
create policy school_settings_update on public.school_settings for update to authenticated
  using ((select private.is_manager()) or (select private.has_role('accountant')))
  with check ((select private.is_manager()) or (select private.has_role('accountant')));

create policy document_sequences_read on public.document_sequences for select to authenticated
  using ((select private.is_office()));
create policy document_sequences_update on public.document_sequences for update to authenticated
  using ((select private.is_finance())) with check ((select private.is_finance()));

create policy audit_logs_read on public.audit_logs for select to authenticated
  using ((select private.has_any_role(array['manager', 'accountant', 'platform_owner']::public.app_role[])));
-- No insert/update/delete policies: entries are written only by SECURITY DEFINER code.

grant execute on all functions in schema private to authenticated, service_role;
