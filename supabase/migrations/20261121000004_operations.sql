-- =============================================================================
-- Operations: NTSA workflow, fleet, training sessions, bookings, attendance,
-- competencies, notifications.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NTSA
-- -----------------------------------------------------------------------------
create type public.ntsa_status as enum (
  'not_started', 'documents_pending', 'ready_for_payment', 'payment_pending',
  'paid_by_school', 'booking_pending', 'test_booked', 'test_scheduled',
  'test_completed', 'passed', 'failed_retest_required', 'completed'
);
create type public.test_result as enum ('pending', 'passed', 'failed', 'absent');

create table public.ntsa_processes (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null unique references public.enrolments (id) on delete restrict,
  student_id uuid not null references public.students (id),
  licence_class_id uuid not null references public.licence_classes (id),
  status public.ntsa_status not null default 'not_started',
  ntsa_amount numeric(12, 2) not null default 0 check (ntsa_amount >= 0),
  responsible_user_id uuid references public.profiles (id),
  booking_reference text,
  booked_at timestamptz,
  test_date timestamptz,
  test_centre text,
  notes text,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ntsa_processes_updated before update on public.ntsa_processes
  for each row execute function private.set_updated_at();
create index ntsa_processes_status_idx on public.ntsa_processes (status, status_changed_at);
create index ntsa_processes_student_idx on public.ntsa_processes (student_id);
create trigger ntsa_processes_audit after insert or update on public.ntsa_processes
  for each row execute function private.audit_row();

create table public.ntsa_process_events (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.ntsa_processes (id) on delete cascade,
  from_status public.ntsa_status,
  to_status public.ntsa_status not null,
  note text,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index ntsa_process_events_idx on public.ntsa_process_events (process_id, created_at);

-- School remittances to NTSA on behalf of a student.
create table public.ntsa_payments (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.ntsa_processes (id),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null,
  payment_reference text not null,
  paid_from text not null default '1000' check (paid_from in ('1000', '1010', '1020')),
  advanced_by_school boolean not null default false,
  override_reason text,
  notes text,
  journal_entry_id uuid references public.journal_entries (id),
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create unique index ntsa_payments_reference_unique on public.ntsa_payments (upper(payment_reference));
create index ntsa_payments_process_idx on public.ntsa_payments (process_id);
create trigger ntsa_payments_immutable before update or delete on public.ntsa_payments
  for each row execute function private.block_mutation();
create trigger ntsa_payments_audit after insert on public.ntsa_payments
  for each row execute function private.audit_row();

create table public.ntsa_test_attempts (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.ntsa_processes (id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0),
  test_date timestamptz not null,
  test_centre text not null,
  result public.test_result not null default 'pending',
  examiner_notes text,
  recorded_by uuid references public.profiles (id),
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (process_id, attempt_number)
);
create trigger ntsa_test_attempts_audit after insert or update on public.ntsa_test_attempts
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Fleet
-- -----------------------------------------------------------------------------
create type public.vehicle_status as enum ('available', 'assigned', 'training', 'maintenance', 'out_of_service');

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  asset_number text not null unique,
  registration text not null unique,
  category public.vehicle_category not null default 'motorcycle',
  make text not null,
  model text not null,
  year smallint check (year between 1980 and 2100),
  engine_cc integer check (engine_cc > 0),
  location_id uuid not null references public.locations (id),
  status public.vehicle_status not null default 'available',
  odometer_km integer not null default 0 check (odometer_km >= 0),
  next_service_km integer,
  next_service_date date,
  insurance_expiry date,
  inspection_expiry date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger vehicles_updated before update on public.vehicles
  for each row execute function private.set_updated_at();
create index vehicles_location_idx on public.vehicles (location_id, status);
create trigger vehicles_audit after insert or update on public.vehicles
  for each row execute function private.audit_row();

alter table public.expenses add constraint expenses_vehicle_fk foreign key (vehicle_id) references public.vehicles (id);

create table public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  maintenance_type text not null check (maintenance_type in ('service', 'repair', 'inspection', 'tyres', 'other')),
  performed_on date not null,
  odometer_km integer,
  description text not null,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  vendor text,
  next_service_date date,
  next_service_km integer,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index vehicle_maintenance_vehicle_idx on public.vehicle_maintenance (vehicle_id, performed_on desc);

create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  filled_on date not null,
  litres numeric(8, 2) not null check (litres > 0),
  cost numeric(12, 2) not null check (cost >= 0),
  odometer_km integer,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index fuel_logs_vehicle_idx on public.fuel_logs (vehicle_id, filled_on desc);

create type public.incident_severity as enum ('minor', 'moderate', 'major');
create type public.incident_status as enum ('open', 'investigating', 'closed');

create table public.vehicle_incidents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles (id),
  session_id uuid,
  student_id uuid references public.students (id),
  instructor_id uuid references public.instructors (id),
  location_id uuid references public.locations (id),
  occurred_at timestamptz not null,
  severity public.incident_severity not null,
  description text not null,
  injuries boolean not null default false,
  police_abstract_ref text,
  status public.incident_status not null default 'open',
  resolution text,
  reported_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger vehicle_incidents_updated before update on public.vehicle_incidents
  for each row execute function private.set_updated_at();
create trigger vehicle_incidents_audit after insert or update on public.vehicle_incidents
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Training sessions & bookings
-- -----------------------------------------------------------------------------
create type public.lesson_type as enum ('theory', 'practical', 'assessment', 'mock_test');
create type public.session_status as enum ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'missed', 'rescheduled');

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id),
  instructor_id uuid not null references public.instructors (id),
  course_id uuid references public.courses (id),
  lesson_type public.lesson_type not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity smallint not null default 1 check (capacity between 1 and 60),
  status public.session_status not null default 'scheduled',
  rescheduled_to uuid references public.training_sessions (id),
  cancellation_reason text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '10 hours'),
  constraint training_sessions_no_instructor_overlap exclude using gist (
    instructor_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelled', 'rescheduled'))
);
create trigger training_sessions_updated before update on public.training_sessions
  for each row execute function private.set_updated_at();
create index training_sessions_time_idx on public.training_sessions (starts_at);
create index training_sessions_location_idx on public.training_sessions (location_id, starts_at);
create index training_sessions_instructor_idx on public.training_sessions (instructor_id, starts_at);

alter table public.vehicle_incidents add constraint vehicle_incidents_session_fk
  foreign key (session_id) references public.training_sessions (id);

-- Instructor must be active, assigned to the location and not on leave.
create or replace function private.validate_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('cancelled', 'rescheduled') then return new; end if;
  if tg_op = 'UPDATE' and (new.starts_at, new.ends_at, new.instructor_id, new.location_id)
       is not distinct from (old.starts_at, old.ends_at, old.instructor_id, old.location_id) then
    return new;
  end if;
  if not exists (select 1 from public.instructors where id = new.instructor_id and is_active) then
    raise exception 'The selected instructor is not active';
  end if;
  if not exists (select 1 from public.instructor_locations
                 where instructor_id = new.instructor_id and location_id = new.location_id) then
    raise exception 'The instructor is not assigned to this location';
  end if;
  if exists (select 1 from public.instructor_time_off
             where instructor_id = new.instructor_id and status = 'approved'
               and tstzrange(starts_at, ends_at) && tstzrange(new.starts_at, new.ends_at)) then
    raise exception 'The instructor is on leave during this time';
  end if;
  return new;
end $$;
create trigger training_sessions_validate before insert or update on public.training_sessions
  for each row execute function private.validate_session();

create table public.session_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id),
  enrolment_id uuid not null references public.enrolments (id),
  vehicle_id uuid references public.vehicles (id),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  -- denormalised from the session so exclusion constraints can work
  time_range tstzrange not null default 'empty',
  is_live boolean not null default true,
  override_payment_gate boolean not null default false,
  booked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (session_id, student_id),
  constraint session_bookings_no_student_overlap exclude using gist (
    student_id with =, time_range with &&
  ) where (is_live),
  constraint session_bookings_no_vehicle_overlap exclude using gist (
    vehicle_id with =, time_range with &&
  ) where (is_live and vehicle_id is not null)
);
create index session_bookings_student_idx on public.session_bookings (student_id);
create index session_bookings_session_idx on public.session_bookings (session_id);

create or replace function private.prepare_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.training_sessions%rowtype;
  e public.enrolments%rowtype;
  v public.vehicles%rowtype;
  live_count int;
begin
  select * into s from public.training_sessions where id = new.session_id;
  new.time_range := tstzrange(s.starts_at, s.ends_at);
  new.is_live := new.status = 'booked' and s.status not in ('cancelled', 'rescheduled');

  if tg_op = 'UPDATE' and not new.is_live then return new; end if;
  if not new.is_live then return new; end if;

  select * into e from public.enrolments where id = new.enrolment_id;
  if e.student_id <> new.student_id then raise exception 'Enrolment does not belong to this student'; end if;
  if e.status not in ('active', 'training_complete') then
    raise exception 'Only students with an active enrolment can be booked (current status: %)', e.status;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into live_count from public.session_bookings where session_id = new.session_id and is_live;
    if live_count >= s.capacity then raise exception 'This session is full (capacity %)', s.capacity; end if;
  end if;

  if new.vehicle_id is not null then
    select * into v from public.vehicles where id = new.vehicle_id;
    if not v.is_active or v.status in ('maintenance', 'out_of_service') then
      raise exception 'Motorcycle % is not available (%)', v.registration, v.status;
    end if;
    if v.location_id <> s.location_id then
      raise exception 'Motorcycle % is based at a different location', v.registration;
    end if;
    if v.insurance_expiry is not null and v.insurance_expiry < (s.starts_at at time zone 'Africa/Nairobi')::date then
      raise exception 'Motorcycle % insurance expires before this session', v.registration;
    end if;
    if v.inspection_expiry is not null and v.inspection_expiry < (s.starts_at at time zone 'Africa/Nairobi')::date then
      raise exception 'Motorcycle % inspection expires before this session', v.registration;
    end if;
  end if;
  return new;
end $$;
create trigger session_bookings_prepare before insert or update on public.session_bookings
  for each row execute function private.prepare_booking();

-- Keep booking ranges in sync when sessions move or are cancelled.
create or replace function private.sync_bookings_from_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.starts_at, new.ends_at, new.status) is distinct from (old.starts_at, old.ends_at, old.status) then
    update public.session_bookings
       set time_range = tstzrange(new.starts_at, new.ends_at),
           is_live = (status = 'booked' and new.status not in ('cancelled', 'rescheduled'))
     where session_id = new.id;
  end if;
  return new;
end $$;
create trigger training_sessions_sync after update on public.training_sessions
  for each row execute function private.sync_bookings_from_session();

-- -----------------------------------------------------------------------------
-- Attendance
-- -----------------------------------------------------------------------------
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused', 'rescheduled');

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id),
  status public.attendance_status not null,
  notes text,
  recorded_by uuid references public.profiles (id),
  recorded_at timestamptz not null default now(),
  unique (session_id, student_id)
);
create index attendance_student_idx on public.attendance (student_id);
create trigger attendance_audit after insert or update on public.attendance
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Competencies
-- -----------------------------------------------------------------------------
create type public.competency_rating as enum ('not_assessed', 'needs_improvement', 'developing', 'competent', 'ready_for_test');

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  licence_class_id uuid references public.licence_classes (id),  -- null = applies to all
  code text not null unique,
  name text not null,
  description text,
  category text not null default 'General',
  sort_order smallint not null default 0,
  required_for_test boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.competency_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  enrolment_id uuid not null references public.enrolments (id),
  competency_id uuid not null references public.competencies (id),
  rating public.competency_rating not null,
  session_id uuid references public.training_sessions (id),
  comment text,
  assessed_by uuid references public.profiles (id),
  assessed_at timestamptz not null default now()
);
create index competency_assessments_idx on public.competency_assessments (enrolment_id, competency_id, assessed_at desc);
create trigger competency_assessments_immutable before update or delete on public.competency_assessments
  for each row execute function private.block_mutation();

-- Instructor can see students assigned to them or booked into their sessions.
create or replace function private.instructor_can_see_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrolments e
    where e.student_id = p_student and e.assigned_instructor_id = private.current_instructor_id()
  ) or exists (
    select 1 from public.session_bookings b
    join public.training_sessions s on s.id = b.session_id
    where b.student_id = p_student and s.instructor_id = private.current_instructor_id()
  )
$$;

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create type public.notification_channel as enum ('in_app', 'sms', 'email', 'push');

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  channel public.notification_channel not null,
  title text not null,
  body text not null,
  description text,
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (key, channel)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  template_key text not null,
  title text not null,
  body text not null,
  link text,
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create type public.delivery_status as enum ('queued', 'sent', 'failed', 'skipped', 'sandbox');

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel public.notification_channel not null,
  status public.delivery_status not null default 'queued',
  provider text,
  provider_message_id text,
  error_message text,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_deliveries_queue_idx on public.notification_deliveries (status, created_at) where status = 'queued';

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sms boolean not null default true,
  email boolean not null default true,
  push boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'students' check (audience in ('students', 'staff', 'everyone')),
  location_id uuid references public.locations (id),
  is_important boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index announcements_published_idx on public.announcements (published_at desc);

grant execute on all functions in schema private to authenticated, service_role;
