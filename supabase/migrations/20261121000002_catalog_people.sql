-- =============================================================================
-- Catalogue (licence classes, courses, versioned pricing), instructors,
-- CRM (leads), students, enrolments, agreements, payment plans.
-- =============================================================================

create type public.vehicle_category as enum ('motorcycle', 'light_vehicle', 'heavy_vehicle', 'psv', 'other');
create type public.charge_component as enum ('registration', 'tuition', 'ntsa', 'service_fee', 'other');
create type public.price_version_status as enum ('draft', 'active', 'retired');
create type public.instalment_frequency as enum ('weekly', 'fortnightly', 'monthly');
create type public.instalment_mode as enum ('count', 'amount');

-- -----------------------------------------------------------------------------
-- Licence classes and courses
-- -----------------------------------------------------------------------------
create table public.licence_classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  vehicle_category public.vehicle_category not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,16}$'),
  name text not null,
  licence_class_id uuid not null references public.licence_classes (id),
  description text,
  duration_weeks smallint not null check (duration_weeks between 1 and 104),
  theory_sessions smallint not null default 0 check (theory_sessions >= 0),
  practical_sessions smallint not null default 0 check (practical_sessions >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger courses_updated before update on public.courses
  for each row execute function private.set_updated_at();

create table public.course_locations (
  course_id uuid not null references public.courses (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  primary key (course_id, location_id)
);

-- A price version is an immutable fee agreement template once published.
create table public.course_price_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  version integer not null,
  label text not null,
  status public.price_version_status not null default 'draft',
  effective_from date not null default private.today_ke(),
  deposit_amount numeric(12, 2) not null check (deposit_amount >= 0),
  instalment_mode public.instalment_mode not null default 'count',
  instalment_count smallint check (instalment_count between 1 and 52),
  instalment_amount numeric(12, 2) check (instalment_amount > 0),
  instalment_frequency public.instalment_frequency not null default 'weekly',
  min_paid_before_training numeric(12, 2) not null default 0 check (min_paid_before_training >= 0),
  min_paid_before_ntsa numeric(12, 2) not null default 0 check (min_paid_before_ntsa >= 0),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  retired_at timestamptz,
  unique (course_id, version),
  check ((instalment_mode = 'count' and instalment_count is not null)
      or (instalment_mode = 'amount' and instalment_amount is not null))
);
create unique index course_price_versions_one_active
  on public.course_price_versions (course_id) where status = 'active';

create table public.course_price_items (
  id uuid primary key default gen_random_uuid(),
  price_version_id uuid not null references public.course_price_versions (id) on delete cascade,
  component public.charge_component not null,
  label text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  tax_rate_id uuid references public.tax_rates (id),
  sort_order smallint not null default 0
);
create index course_price_items_version_idx on public.course_price_items (price_version_id);
create unique index course_price_items_single_service_fee
  on public.course_price_items (price_version_id) where component = 'service_fee';

-- Published versions are frozen; only draft→active→retired transitions allowed.
create or replace function private.guard_price_version()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Published price versions cannot be deleted'; end if;
    return old;
  end if;
  if old.status <> 'draft' then
    if (to_jsonb(new) - array['status', 'retired_at', 'published_at'])
       is distinct from (to_jsonb(old) - array['status', 'retired_at', 'published_at']) then
      raise exception 'Published price versions are immutable. Create a new version instead.';
    end if;
    if old.status = 'retired' and new.status <> 'retired' then
      raise exception 'Retired price versions cannot be reactivated';
    end if;
  end if;
  if new.status = 'active' and old.status = 'draft' then
    if not exists (select 1 from public.course_price_items where price_version_id = new.id) then
      raise exception 'Add fee items before publishing a price version';
    end if;
    new.published_at := now();
    -- retire the previous active version of this course
    update public.course_price_versions set status = 'retired', retired_at = now()
     where course_id = new.course_id and status = 'active' and id <> new.id;
  end if;
  if new.status = 'retired' and old.status <> 'retired' then new.retired_at := now(); end if;
  return new;
end $$;
create trigger course_price_versions_guard before update or delete on public.course_price_versions
  for each row execute function private.guard_price_version();

create or replace function private.guard_price_items()
returns trigger language plpgsql as $$
declare st public.price_version_status;
begin
  select status into st from public.course_price_versions
   where id = coalesce(new.price_version_id, old.price_version_id);
  if st is distinct from 'draft' then
    raise exception 'Fee items of a published price version cannot be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger course_price_items_guard before insert or update or delete on public.course_price_items
  for each row execute function private.guard_price_items();

create trigger course_price_versions_audit after insert or update on public.course_price_versions
  for each row execute function private.audit_row();
create trigger course_price_items_audit after insert or update or delete on public.course_price_items
  for each row execute function private.audit_row();
create trigger courses_audit after insert or update on public.courses
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Instructors
-- -----------------------------------------------------------------------------
create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete restrict,
  employee_number text not null unique,
  qualifications text,
  driving_licence_classes text[] not null default '{}',
  max_active_students smallint not null default 25 check (max_active_students > 0),
  is_active boolean not null default true,
  hire_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger instructors_updated before update on public.instructors
  for each row execute function private.set_updated_at();

create table public.instructor_locations (
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  primary key (instructor_id, location_id)
);
create index instructor_locations_location_idx on public.instructor_locations (location_id);

create table public.instructor_certifications (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  certification_type text not null,
  certificate_number text,
  issued_on date,
  expires_on date,
  storage_path text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Weekly recurring availability
create table public.instructor_availability (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  location_id uuid not null references public.locations (id),
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index instructor_availability_idx on public.instructor_availability (instructor_id, weekday);

create type public.time_off_status as enum ('pending', 'approved', 'rejected');
create table public.instructor_time_off (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  status public.time_off_status not null default 'approved',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index instructor_time_off_idx on public.instructor_time_off (instructor_id, starts_at);

create or replace function private.current_instructor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.instructors where user_id = auth.uid() and is_active
$$;

-- -----------------------------------------------------------------------------
-- CRM: leads
-- -----------------------------------------------------------------------------
create type public.lead_source as enum ('walk_in', 'phone', 'whatsapp', 'referral', 'social_media', 'agent', 'roadshow', 'website', 'other');
create type public.lead_stage as enum ('new', 'contacted', 'interested', 'follow_up', 'ready_to_enrol', 'converted', 'lost');
create type public.lead_activity_type as enum ('note', 'call', 'whatsapp', 'sms', 'visit', 'stage_change', 'follow_up_set', 'converted');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text not null check (phone ~ '^\+254[17][0-9]{8}$'),
  alt_phone text check (alt_phone is null or alt_phone ~ '^\+254[17][0-9]{8}$'),
  email extensions.citext,
  preferred_location_id uuid references public.locations (id),
  interested_course_id uuid references public.courses (id),
  source public.lead_source not null default 'walk_in',
  referral_name text,
  assigned_to uuid references public.profiles (id),
  stage public.lead_stage not null default 'new',
  follow_up_at timestamptz,
  notes text,
  lost_reason text,
  converted_student_id uuid,
  converted_at timestamptz,
  consent_to_contact boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger leads_updated before update on public.leads
  for each row execute function private.set_updated_at();
create index leads_stage_idx on public.leads (stage, follow_up_at);
create index leads_location_idx on public.leads (preferred_location_id);
create index leads_phone_idx on public.leads (phone);
create index leads_name_trgm on public.leads using gin (full_name extensions.gin_trgm_ops);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  activity_type public.lead_activity_type not null,
  body text,
  from_stage public.lead_stage,
  to_stage public.lead_stage,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

-- Stage changes are logged as activities automatically.
create or replace function private.log_lead_stage()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.lead_activities (lead_id, activity_type, from_stage, to_stage, created_by)
    values (new.id, 'stage_change', old.stage, new.stage, auth.uid());
    if new.stage = 'converted' and new.converted_at is null then new.converted_at := now(); end if;
  end if;
  return new;
end $$;
create trigger leads_stage_log before update on public.leads
  for each row execute function private.log_lead_stage();

-- -----------------------------------------------------------------------------
-- Students
-- -----------------------------------------------------------------------------
create type public.student_status as enum ('applicant', 'active', 'suspended', 'completed', 'withdrawn', 'alumni');
create type public.id_document_type as enum ('national_id', 'passport', 'alien_id', 'birth_certificate');
create type public.gender as enum ('female', 'male', 'other', 'prefer_not_to_say');

create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique,
  user_id uuid unique references public.profiles (id) on delete set null,
  first_name text not null check (length(trim(first_name)) between 1 and 60),
  middle_name text,
  last_name text not null check (length(trim(last_name)) between 1 and 60),
  gender public.gender,
  date_of_birth date,
  id_type public.id_document_type,
  id_number_last4 text check (id_number_last4 is null or length(id_number_last4) <= 4),
  phone text not null check (phone ~ '^\+254[17][0-9]{8}$'),
  alt_phone text check (alt_phone is null or alt_phone ~ '^\+254[17][0-9]{8}$'),
  email extensions.citext,
  residence text,
  emergency_contact_name text,
  emergency_contact_phone text check (emergency_contact_phone is null or emergency_contact_phone ~ '^\+254[17][0-9]{8}$'),
  emergency_contact_relationship text,
  home_location_id uuid not null references public.locations (id),
  status public.student_status not null default 'applicant',
  lead_id uuid references public.leads (id),
  activation_code_hash text,
  activation_expires_at timestamptz,
  registered_at timestamptz not null default now(),
  registered_by uuid references public.profiles (id),
  anonymized_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger students_updated before update on public.students
  for each row execute function private.set_updated_at();
create index students_location_idx on public.students (home_location_id, status);
create index students_phone_idx on public.students (phone);
create index students_name_trgm on public.students
  using gin ((first_name || ' ' || coalesce(middle_name, '') || ' ' || last_name) extensions.gin_trgm_ops);
create trigger students_audit after insert or update on public.students
  for each row execute function private.audit_row();

alter table public.leads add constraint leads_converted_student_fk
  foreign key (converted_student_id) references public.students (id) on delete set null;

-- Full identification numbers are kept apart with stricter access.
create table public.student_identities (
  student_id uuid primary key references public.students (id) on delete cascade,
  id_type public.id_document_type not null,
  id_number text not null check (length(trim(id_number)) between 4 and 30),
  updated_at timestamptz not null default now()
);
create unique index student_identities_unique on public.student_identities (id_type, upper(id_number));

create table public.student_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  consent_type text not null check (consent_type in ('data_processing', 'terms_and_fees', 'sms_notifications', 'marketing')),
  granted boolean not null,
  terms_version text,
  recorded_by uuid references public.profiles (id),
  recorded_at timestamptz not null default now(),
  ip_address text
);
create index student_consents_student_idx on public.student_consents (student_id, consent_type, recorded_at desc);

create type public.document_type as enum ('national_id', 'passport_photo', 'birth_certificate', 'medical_certificate', 'provisional_licence', 'ntsa_document', 'receipt', 'certificate', 'other');
create type public.document_status as enum ('pending', 'verified', 'rejected');

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  document_type public.document_type not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  status public.document_status not null default 'pending',
  rejection_reason text,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz
);
create index student_documents_student_idx on public.student_documents (student_id);
create trigger student_documents_audit after insert or update or delete on public.student_documents
  for each row execute function private.audit_row();

create or replace function private.current_student_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.students where user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Enrolments, agreements, payment plans, instalments
-- -----------------------------------------------------------------------------
create type public.enrolment_status as enum (
  'pending_acceptance', 'awaiting_deposit', 'active', 'training_complete',
  'completed', 'suspended', 'withdrawn', 'cancelled'
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  enrolment_number text not null unique,
  student_id uuid not null references public.students (id) on delete restrict,
  course_id uuid not null references public.courses (id),
  location_id uuid not null references public.locations (id),
  price_version_id uuid not null references public.course_price_versions (id),
  status public.enrolment_status not null default 'pending_acceptance',
  assigned_instructor_id uuid references public.instructors (id),
  start_date date,
  expected_end_date date,
  activated_at timestamptz,
  training_completed_at timestamptz,
  completed_at timestamptz,
  certificate_number text unique,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger enrolments_updated before update on public.enrolments
  for each row execute function private.set_updated_at();
create index enrolments_student_idx on public.enrolments (student_id);
create index enrolments_location_status_idx on public.enrolments (location_id, status);
create index enrolments_instructor_idx on public.enrolments (assigned_instructor_id) where assigned_instructor_id is not null;
create unique index enrolments_one_open_per_course on public.enrolments (student_id, course_id)
  where status in ('pending_acceptance', 'awaiting_deposit', 'active', 'training_complete', 'suspended');
create trigger enrolments_audit after insert or update on public.enrolments
  for each row execute function private.audit_row();

-- Snapshot of exactly what the student accepted. Immutable.
create table public.student_course_agreements (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null unique references public.enrolments (id) on delete restrict,
  price_version_id uuid not null references public.course_price_versions (id),
  fee_snapshot jsonb not null,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  deposit_amount numeric(12, 2) not null check (deposit_amount >= 0),
  service_fee_amount numeric(12, 2) not null default 0,
  ntsa_amount numeric(12, 2) not null default 0,
  terms_version text not null,
  terms_text text not null,
  accepted_via text not null check (accepted_via in ('in_person', 'student_portal')),
  accepted_by uuid references public.profiles (id),
  accepted_at timestamptz not null default now(),
  acceptance_ip text
);

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.enrolments (id) on delete restrict,
  agreement_id uuid not null references public.student_course_agreements (id),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  deposit_amount numeric(12, 2) not null check (deposit_amount >= 0),
  instalment_count smallint not null check (instalment_count >= 0),
  frequency public.instalment_frequency not null,
  first_due_date date not null,
  status text not null default 'active' check (status in ('active', 'superseded', 'cancelled')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create unique index payment_plans_one_active on public.payment_plans (enrolment_id) where status = 'active';

create table public.instalments (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.payment_plans (id) on delete cascade,
  sequence smallint not null check (sequence >= 0), -- 0 = deposit
  label text not null,
  due_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  waived_amount numeric(12, 2) not null default 0 check (waived_amount >= 0),
  created_at timestamptz not null default now(),
  unique (payment_plan_id, sequence),
  check (waived_amount <= amount)
);
create index instalments_due_idx on public.instalments (due_date);

create or replace function private.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% records are immutable', tg_table_name;
end $$;
create trigger agreements_immutable before update or delete on public.student_course_agreements
  for each row execute function private.block_mutation();

-- Instalment amounts/dates are fixed; only waived_amount may change (via finance functions).
create or replace function private.guard_instalment()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Instalments cannot be deleted'; end if;
  if (new.amount, new.due_date, new.sequence, new.payment_plan_id) is distinct from
     (old.amount, old.due_date, old.sequence, old.payment_plan_id) then
    raise exception 'Instalment terms are immutable; revise the payment plan instead';
  end if;
  if current_setting('app.finance_context', true) is distinct from 'on' then
    raise exception 'Instalments may only be waived through a financial adjustment';
  end if;
  return new;
end $$;
create trigger instalments_guard before update or delete on public.instalments
  for each row execute function private.guard_instalment();

-- Instructor ↔ student relationship (assigned instructor, or shares a session).
create or replace function private.instructor_can_see_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrolments e
    where e.student_id = p_student and e.assigned_instructor_id = private.current_instructor_id()
  )
$$;

-- Whether the current user can see a given student's records.
create or replace function private.can_access_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    private.has_any_role(array['manager', 'accountant']::public.app_role[])
    or p_student = private.current_student_id()
    or (private.has_role('admin') and exists (
          select 1 from public.students s
          where s.id = p_student and (
            private.can_access_location(s.home_location_id)
            or exists (select 1 from public.enrolments e where e.student_id = s.id and private.can_access_location(e.location_id))
          )))
    or (private.has_role('instructor') and private.instructor_can_see_student(p_student))
$$;

grant execute on all functions in schema private to authenticated, service_role;
