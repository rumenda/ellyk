-- =============================================================================
-- Business functions — operations, dashboards, platform owner, privacy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Training payment gate on bookings (extends prepare_booking from 0004)
-- -----------------------------------------------------------------------------
create or replace function private.check_training_gate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare b public.v_enrolment_balances%rowtype;
begin
  if not new.is_live then return new; end if;
  if tg_op = 'UPDATE' and old.is_live and old.enrolment_id = new.enrolment_id then return new; end if;
  select * into b from public.v_enrolment_balances where enrolment_id = new.enrolment_id;
  if not coalesce(b.training_gate_met, false) then
    if new.override_payment_gate and private.has_any_role(array['manager']::public.app_role[]) then
      perform private.write_audit('booking.payment_gate_override', 'session_bookings', new.session_id::text,
        null, jsonb_build_object('student_id', new.student_id, 'paid', b.plan_paid, 'required', b.min_paid_before_training));
    else
      raise exception 'Minimum payment before training not met (paid %, required %). A manager can override.',
        private.fmt_kes(b.plan_paid), private.fmt_kes(b.min_paid_before_training);
    end if;
  end if;
  return new;
end $$;
create trigger session_bookings_gate before insert or update on public.session_bookings
  for each row execute function private.check_training_gate();

-- Booking notification
create or replace function private.notify_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s public.training_sessions%rowtype; loc text;
begin
  if new.is_live and (tg_op = 'INSERT' or not old.is_live) then
    select * into s from public.training_sessions where id = new.session_id;
    select name into loc from public.locations where id = s.location_id;
    perform private.notify_student(new.student_id, 'lesson_booked',
      jsonb_build_object('lesson', s.title,
        'when', to_char(s.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon, HH24:MI'), 'location', loc),
      '/app/schedule', 'lesson_booked:' || new.id);
  end if;
  return new;
end $$;
create trigger session_bookings_notify after insert or update on public.session_bookings
  for each row execute function private.notify_booking();

-- -----------------------------------------------------------------------------
-- Attendance (bulk, few taps) and competencies
-- -----------------------------------------------------------------------------
create or replace function private.can_manage_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.training_sessions s
    where s.id = p_session and (
      s.instructor_id = private.current_instructor_id()
      or private.is_manager()
      or (private.has_role('admin') and private.can_access_location(s.location_id))
    )
  )
$$;

-- p_entries: [{"student_id":..., "status":"present", "notes":"..."}]
create or replace function public.record_attendance(p_session uuid, p_entries jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s public.training_sessions%rowtype; e jsonb; n int := 0; prev public.attendance_status;
begin
  perform private.require(private.can_manage_session(p_session), 'You can only mark attendance for your own sessions');
  select * into s from public.training_sessions where id = p_session for update;
  if s.status in ('cancelled', 'rescheduled') then raise exception 'This session was %', s.status; end if;
  if s.starts_at > now() + interval '30 minutes' then raise exception 'Attendance can be marked from 30 minutes before the session starts'; end if;

  for e in select * from jsonb_array_elements(p_entries) loop
    if not exists (select 1 from public.session_bookings where session_id = p_session
                   and student_id = (e ->> 'student_id')::uuid and status = 'booked') then
      raise exception 'Student is not booked on this session';
    end if;
    select status into prev from public.attendance where session_id = p_session and student_id = (e ->> 'student_id')::uuid;
    insert into public.attendance (session_id, student_id, status, notes, recorded_by)
    values (p_session, (e ->> 'student_id')::uuid, (e ->> 'status')::public.attendance_status,
            nullif(trim(e ->> 'notes'), ''), auth.uid())
    on conflict (session_id, student_id) do update
      set status = excluded.status, notes = excluded.notes, recorded_by = excluded.recorded_by, recorded_at = now();
    if (e ->> 'status') = 'absent' and prev is distinct from 'absent' then
      perform private.notify_student((e ->> 'student_id')::uuid, 'lesson_missed',
        jsonb_build_object('lesson', s.title, 'when', to_char(s.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon, HH24:MI')),
        '/app/schedule', 'lesson_missed:' || p_session || ':' || (e ->> 'student_id'));
    end if;
    n := n + 1;
  end loop;

  if s.status in ('scheduled', 'confirmed', 'in_progress') and now() >= s.starts_at then
    update public.training_sessions set status = 'completed' where id = p_session;
  end if;
  return n;
end $$;

-- p_entries: [{"competency_id":..., "rating":"competent", "comment":"..."}]
create or replace function public.assess_competencies(p_enrolment uuid, p_session uuid, p_entries jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare e public.enrolments%rowtype; x jsonb; n int := 0;
begin
  select * into e from public.enrolments where id = p_enrolment;
  perform private.require(
    private.is_manager()
    or (private.has_role('instructor') and private.instructor_can_see_student(e.student_id))
    or (private.has_role('admin') and private.can_access_location(e.location_id)),
    'You are not allowed to assess this student');
  if e.status not in ('active', 'training_complete') then raise exception 'Enrolment is not active'; end if;
  for x in select * from jsonb_array_elements(p_entries) loop
    insert into public.competency_assessments (student_id, enrolment_id, competency_id, rating, session_id, comment, assessed_by)
    values (e.student_id, e.id, (x ->> 'competency_id')::uuid, (x ->> 'rating')::public.competency_rating,
            p_session, nullif(trim(x ->> 'comment'), ''), auth.uid());
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.mark_training_complete(p_enrolment uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.enrolments%rowtype; pr public.v_enrolment_progress%rowtype;
begin
  select * into e from public.enrolments where id = p_enrolment for update;
  perform private.require(
    private.is_manager()
    or (private.has_role('instructor') and e.assigned_instructor_id = private.current_instructor_id())
    or (private.has_role('admin') and private.can_access_location(e.location_id)),
    'Not allowed');
  if e.status <> 'active' then raise exception 'Only active enrolments can be marked training complete'; end if;
  select * into pr from public.v_enrolment_progress where enrolment_id = p_enrolment;
  if not pr.competencies_complete then
    raise exception 'All required competencies must be rated Competent or Ready for test (% of % done)',
      pr.competencies_competent, pr.competencies_required;
  end if;
  update public.enrolments set status = 'training_complete', training_completed_at = now() where id = p_enrolment;
  perform private.write_audit('enrolment.training_complete', 'enrolments', p_enrolment::text, null, jsonb_build_object('note', p_note));
end $$;

-- -----------------------------------------------------------------------------
-- NTSA workflow
-- -----------------------------------------------------------------------------
create or replace function private.ntsa_allowed(p_from public.ntsa_status, p_to public.ntsa_status)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('not_started', 'documents_pending'),
    ('documents_pending', 'ready_for_payment'),
    ('ready_for_payment', 'payment_pending'),
    ('payment_pending', 'paid_by_school'),
    ('ready_for_payment', 'paid_by_school'),
    ('paid_by_school', 'booking_pending'),
    ('booking_pending', 'test_booked'),
    ('test_booked', 'test_scheduled'),
    ('test_booked', 'booking_pending'),
    ('test_scheduled', 'booking_pending'),
    ('test_scheduled', 'test_completed'),
    ('test_completed', 'passed'),
    ('test_completed', 'failed_retest_required'),
    ('failed_retest_required', 'booking_pending'),
    ('passed', 'completed')
  )
$$;

-- p_details may contain booking_reference, test_date, test_centre, responsible_user_id
create or replace function public.ntsa_transition(p_process uuid, p_to public.ntsa_status, p_note text default null,
                                                  p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  np public.ntsa_processes%rowtype; e public.enrolments%rowtype; f public.v_ntsa_funds%rowtype;
  b public.v_enrolment_balances%rowtype; attempt int; td timestamptz; centre text;
begin
  select * into np from public.ntsa_processes where id = p_process for update;
  if not found then raise exception 'NTSA record not found'; end if;
  select * into e from public.enrolments where id = np.enrolment_id;
  perform private.require(private.is_manager() or (private.has_role('admin') and private.can_access_location(e.location_id))
                          or (private.has_role('accountant') and p_to in ('paid_by_school', 'payment_pending')),
    'You are not allowed to update this NTSA record');
  if not private.ntsa_allowed(np.status, p_to) then
    raise exception 'Cannot move from "%" to "%"', replace(np.status::text, '_', ' '), replace(p_to::text, '_', ' ');
  end if;

  if p_to = 'ready_for_payment' then
    if not exists (select 1 from public.student_documents where student_id = np.student_id and status = 'verified'
                   and document_type in ('national_id', 'birth_certificate', 'provisional_licence', 'ntsa_document')) then
      raise exception 'Verify the student''s identification document first';
    end if;
  elsif p_to = 'payment_pending' then
    select * into b from public.v_enrolment_balances where enrolment_id = np.enrolment_id;
    if not b.ntsa_gate_met then
      raise exception 'Minimum payment before NTSA not met (paid %, required %)',
        private.fmt_kes(b.plan_paid), private.fmt_kes(b.min_paid_before_ntsa);
    end if;
  elsif p_to = 'paid_by_school' then
    select * into f from public.v_ntsa_funds where process_id = p_process;
    if f.ntsa_remitted < np.ntsa_amount then
      raise exception 'Record the NTSA payment (% of % remitted) first', private.fmt_kes(f.ntsa_remitted), private.fmt_kes(np.ntsa_amount);
    end if;
  elsif p_to = 'booking_pending' and np.status in ('paid_by_school', 'failed_retest_required') then
    if e.status not in ('training_complete', 'completed') and np.status = 'paid_by_school' then
      raise exception 'Training must be marked complete before booking the test';
    end if;
  elsif p_to = 'test_booked' then
    if coalesce(trim(p_details ->> 'booking_reference'), '') = '' then raise exception 'Booking reference is required'; end if;
    update public.ntsa_processes set booking_reference = p_details ->> 'booking_reference', booked_at = now() where id = p_process;
    perform private.notify_student(np.student_id, 'ntsa_booked',
      jsonb_build_object('reference', p_details ->> 'booking_reference'), '/app', 'ntsa_booked:' || p_process || ':' || (p_details ->> 'booking_reference'));
  elsif p_to = 'test_scheduled' then
    td := (p_details ->> 'test_date')::timestamptz; centre := nullif(trim(p_details ->> 'test_centre'), '');
    if td is null or centre is null then raise exception 'Test date and test centre are required'; end if;
    select coalesce(max(attempt_number), 0) + 1 into attempt from public.ntsa_test_attempts where process_id = p_process;
    insert into public.ntsa_test_attempts (process_id, attempt_number, test_date, test_centre) values (p_process, attempt, td, centre);
    update public.ntsa_processes set test_date = td, test_centre = centre where id = p_process;
    perform private.notify_student(np.student_id, 'test_scheduled',
      jsonb_build_object('when', to_char(td at time zone 'Africa/Nairobi', 'Dy DD Mon YYYY, HH24:MI'), 'centre', centre),
      '/app', 'test_scheduled:' || p_process || ':' || attempt);
  end if;

  update public.ntsa_processes
     set status = p_to, status_changed_at = now(),
         responsible_user_id = coalesce(nullif(p_details ->> 'responsible_user_id', '')::uuid, responsible_user_id, auth.uid())
   where id = p_process;
  insert into public.ntsa_process_events (process_id, from_status, to_status, note, actor_id)
  values (p_process, np.status, p_to, p_note, auth.uid());
end $$;

create or replace function public.record_test_result(p_process uuid, p_result public.test_result, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare np public.ntsa_processes%rowtype; att public.ntsa_test_attempts%rowtype; e public.enrolments%rowtype;
begin
  select * into np from public.ntsa_processes where id = p_process for update;
  select * into e from public.enrolments where id = np.enrolment_id;
  perform private.require(private.is_manager() or (private.has_role('admin') and private.can_access_location(e.location_id)),
    'You are not allowed to record test results');
  if np.status not in ('test_scheduled', 'test_completed') then raise exception 'No scheduled test to record a result for'; end if;
  if p_result = 'pending' then raise exception 'Choose a result'; end if;
  select * into att from public.ntsa_test_attempts where process_id = p_process and result = 'pending'
   order by attempt_number desc limit 1;
  if not found then raise exception 'No pending test attempt'; end if;
  update public.ntsa_test_attempts set result = p_result, examiner_notes = p_notes, recorded_by = auth.uid(), recorded_at = now()
   where id = att.id;

  if np.status = 'test_scheduled' then
    perform public.ntsa_transition(p_process, 'test_completed', 'Test attempt ' || att.attempt_number || ' recorded');
  end if;
  perform public.ntsa_transition(p_process,
    case when p_result = 'passed' then 'passed' else 'failed_retest_required' end::public.ntsa_status, p_notes);
  perform private.notify_student(np.student_id, 'test_result',
    jsonb_build_object('result', case p_result when 'passed' then 'PASSED – congratulations!'
                                               when 'absent' then 'marked ABSENT' else 'not passed this time' end,
                       'attempt', att.attempt_number),
    '/app', 'test_result:' || att.id);
end $$;

create or replace function public.record_ntsa_payment(
  p_process uuid, p_amount numeric, p_paid_on date, p_reference text, p_paid_from text default '1000',
  p_override_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare np public.ntsa_processes%rowtype; f public.v_ntsa_funds%rowtype; pid uuid; je uuid; adv boolean := false; loc uuid;
begin
  perform private.require(private.is_finance(), 'Only finance staff can record NTSA payments');
  select * into np from public.ntsa_processes where id = p_process for update;
  if np.status not in ('ready_for_payment', 'payment_pending') then
    raise exception 'NTSA record must be Ready for payment or Payment pending (currently %)', replace(np.status::text, '_', ' ');
  end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'NTSA/eCitizen payment reference is required'; end if;
  if p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  select * into f from public.v_ntsa_funds where process_id = p_process;
  if p_amount > f.ntsa_held then
    if coalesce(length(trim(p_override_reason)), 0) < 5 then
      raise exception 'Only % of NTSA funds are held for this student. Give a reason to advance school funds.', private.fmt_kes(f.ntsa_held);
    end if;
    adv := true;
  end if;
  select location_id into loc from public.enrolments where id = np.enrolment_id;

  insert into public.ntsa_payments (process_id, amount, paid_on, payment_reference, paid_from, advanced_by_school,
                                    override_reason, recorded_by)
  values (p_process, p_amount, p_paid_on, trim(p_reference), p_paid_from, adv, p_override_reason, auth.uid())
  returning id into pid;
  je := private.post_journal(p_paid_on, 'NTSA remittance ' || trim(p_reference), 'ntsa_remittance', pid, loc,
    jsonb_build_array(jsonb_build_object('account', '2100', 'debit', p_amount, 'student_id', np.student_id, 'component', 'ntsa'),
                      jsonb_build_object('account', p_paid_from, 'credit', p_amount, 'student_id', np.student_id)));

  if f.ntsa_remitted + p_amount >= np.ntsa_amount then
    update public.ntsa_processes set status = 'paid_by_school', status_changed_at = now() where id = p_process;
    insert into public.ntsa_process_events (process_id, from_status, to_status, note, actor_id)
    values (p_process, np.status, 'paid_by_school', 'NTSA paid, ref ' || trim(p_reference), auth.uid());
  end if;
  return pid;
end $$;

-- -----------------------------------------------------------------------------
-- Completion
-- -----------------------------------------------------------------------------
create or replace function public.complete_enrolment(p_enrolment uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  e public.enrolments%rowtype; np public.ntsa_processes%rowtype; b public.v_enrolment_balances%rowtype; cert text; cname text;
begin
  select * into e from public.enrolments where id = p_enrolment for update;
  perform private.require(private.is_manager() or (private.has_role('admin') and private.can_access_location(e.location_id)), 'Not allowed');
  if e.status <> 'training_complete' then raise exception 'Training must be complete before the course can be completed'; end if;
  select * into np from public.ntsa_processes where enrolment_id = p_enrolment;
  if np.status not in ('passed', 'completed') then raise exception 'The student must pass the NTSA test first'; end if;
  select * into b from public.v_enrolment_balances where enrolment_id = p_enrolment;
  if (private.settings()).require_full_payment_for_completion and b.total_outstanding > 0 then
    raise exception 'Outstanding balance of % must be cleared before completion', private.fmt_kes(b.total_outstanding);
  end if;

  cert := private.next_document_number('certificate');
  update public.enrolments set status = 'completed', completed_at = now(), certificate_number = cert where id = p_enrolment;
  if np.status = 'passed' then perform public.ntsa_transition(np.id, 'completed', 'Course completed'); end if;
  if not exists (select 1 from public.enrolments where student_id = e.student_id
                 and status in ('pending_acceptance', 'awaiting_deposit', 'active', 'training_complete', 'suspended')) then
    update public.students set status = 'alumni' where id = e.student_id;
  end if;
  select name into cname from public.courses where id = e.course_id;
  perform private.notify_student(e.student_id, 'course_completed', jsonb_build_object('course', cname, 'certificate', cert),
                                 '/app', 'course_completed:' || p_enrolment);
  return cert;
end $$;

create or replace function public.withdraw_enrolment(p_enrolment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.enrolments%rowtype;
begin
  select * into e from public.enrolments where id = p_enrolment for update;
  perform private.require(private.is_manager(), 'Only a manager can withdraw an enrolment');
  if e.status in ('completed', 'withdrawn', 'cancelled') then raise exception 'Enrolment is already closed'; end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'A reason is required'; end if;
  update public.enrolments set status = case when e.status = 'pending_acceptance' then 'cancelled' else 'withdrawn' end::public.enrolment_status,
         withdrawn_at = now(), withdrawal_reason = p_reason where id = p_enrolment;
  update public.session_bookings b set status = 'cancelled'
    from public.training_sessions s where s.id = b.session_id and b.enrolment_id = p_enrolment and s.starts_at > now();
end $$;

-- -----------------------------------------------------------------------------
-- Scheduled notifications (called by the cron route with the service role)
-- -----------------------------------------------------------------------------
create or replace function public.run_scheduled_notifications()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; lessons int := 0; due int := 0; overdue int := 0; tests int := 0;
  days int := (private.settings()).payment_due_reminder_days;
begin
  for r in
    select b.id, b.student_id, s.title, s.starts_at, l.name as loc
    from public.session_bookings b
    join public.training_sessions s on s.id = b.session_id
    join public.locations l on l.id = s.location_id
    where b.is_live and s.status in ('scheduled', 'confirmed') and s.starts_at between now() and now() + interval '24 hours'
  loop
    if private.notify_student(r.student_id, 'lesson_reminder',
         jsonb_build_object('lesson', r.title, 'when', to_char(r.starts_at at time zone 'Africa/Nairobi', 'Dy DD Mon, HH24:MI'), 'location', r.loc),
         '/app/schedule', 'lesson_reminder:' || r.id) is not null then lessons := lessons + 1; end if;
  end loop;

  for r in
    select vi.id, e.student_id, vi.amount_outstanding, vi.due_date, vi.status
    from public.v_instalments vi join public.enrolments e on e.id = vi.enrolment_id
    where vi.amount_outstanding > 0 and e.status in ('awaiting_deposit', 'active', 'training_complete')
      and vi.due_date <= private.today_ke() + days
  loop
    if r.status = 'overdue' then
      if private.notify_student(r.student_id, 'payment_overdue',
           jsonb_build_object('amount', private.fmt_kes(r.amount_outstanding), 'due_date', to_char(r.due_date, 'DD Mon YYYY')),
           '/app/payments', 'payment_overdue:' || r.id || ':' || to_char(private.today_ke(), 'IYYY-IW')) is not null then
        overdue := overdue + 1; end if;
    else
      if private.notify_student(r.student_id, 'payment_due',
           jsonb_build_object('amount', private.fmt_kes(r.amount_outstanding), 'due_date', to_char(r.due_date, 'DD Mon YYYY')),
           '/app/payments', 'payment_due:' || r.id) is not null then due := due + 1; end if;
    end if;
  end loop;

  for r in
    select a.id, np.student_id, a.test_date, a.test_centre
    from public.ntsa_test_attempts a join public.ntsa_processes np on np.id = a.process_id
    where a.result = 'pending' and a.test_date between now() and now() + interval '48 hours'
  loop
    if private.notify_student(r.student_id, 'test_reminder',
         jsonb_build_object('when', to_char(r.test_date at time zone 'Africa/Nairobi', 'Dy DD Mon, HH24:MI'), 'centre', r.test_centre),
         '/app', 'test_reminder:' || r.id) is not null then tests := tests + 1; end if;
  end loop;

  return jsonb_build_object('lesson_reminders', lessons, 'payment_due', due, 'payment_overdue', overdue, 'test_reminders', tests);
end $$;
revoke all on function public.run_scheduled_notifications() from public, anon, authenticated;

-- Announcements fan out to student in-app notifications.
create or replace function private.fanout_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.audience in ('students', 'everyone') then
    for r in select s.id from public.students s
             where s.user_id is not null and s.status in ('applicant', 'active')
               and (new.location_id is null or s.home_location_id = new.location_id) loop
      perform private.notify_student(r.id, 'announcement', jsonb_build_object('title', new.title, 'body', left(new.body, 280)),
                                     '/app/notifications', 'announcement:' || new.id || ':' || r.id);
    end loop;
  end if;
  return new;
end $$;
create trigger announcements_fanout after insert on public.announcements
  for each row execute function private.fanout_announcement();

-- -----------------------------------------------------------------------------
-- Dashboards (aggregates only; explicit role checks)
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_manager(p_location uuid default null, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  f date := coalesce(p_from, date_trunc('month', private.today_ke())::date);
  t date := coalesce(p_to, private.today_ke());
  res jsonb;
begin
  perform private.require(private.is_manager() or private.has_role('admin'), 'Not allowed');
  if p_location is not null then
    perform private.require(private.can_access_location(p_location) or private.is_manager(), 'Not allowed');
  end if;

  with
  enr as (select * from public.enrolments e where (p_location is null or e.location_id = p_location)
          and (private.is_manager() or private.can_access_location(e.location_id))),
  pays as (select p.* from public.payments p where p.status = 'confirmed'
           and (p_location is null or p.location_id = p_location)
           and (private.is_manager() or private.can_access_location(p.location_id))),
  bal as (select b.* from public.v_enrolment_balances b join enr on enr.id = b.enrolment_id),
  inst as (select vi.* from public.v_instalments vi join enr on enr.id = vi.enrolment_id
           where enr.status in ('awaiting_deposit', 'active', 'training_complete')),
  sess as (select s.* from public.training_sessions s where (p_location is null or s.location_id = p_location)
           and (private.is_manager() or private.can_access_location(s.location_id))),
  att as (select a.* from public.attendance a join sess on sess.id = a.session_id
          where (sess.starts_at at time zone 'Africa/Nairobi')::date between f and t),
  ntsa as (select np.* from public.ntsa_processes np join enr on enr.id = np.enrolment_id),
  prog as (select p.* from public.v_enrolment_progress p join enr on enr.id = p.enrolment_id)
  select jsonb_build_object(
    'period', jsonb_build_object('from', f, 'to', t),
    'active_students', (select count(distinct student_id) from enr where status in ('active', 'training_complete')),
    'new_registrations', (select count(*) from public.students s where (s.registered_at at time zone 'Africa/Nairobi')::date between f and t
                            and (p_location is null or s.home_location_id = p_location)
                            and (private.is_manager() or private.can_access_location(s.home_location_id))),
    'enrolments_in_period', (select count(*) from enr where (created_at at time zone 'Africa/Nairobi')::date between f and t
                               and status not in ('cancelled')),
    'collected', (select coalesce(sum(amount), 0) from pays where (received_at at time zone 'Africa/Nairobi')::date between f and t),
    'outstanding', (select coalesce(sum(total_outstanding), 0) from bal where status in ('awaiting_deposit', 'active', 'training_complete', 'suspended')),
    'payments_due_7d', (select coalesce(sum(amount_outstanding), 0) from inst where amount_outstanding > 0 and due_date between private.today_ke() and private.today_ke() + 7),
    'overdue_amount', (select coalesce(sum(amount_outstanding), 0) from inst where status = 'overdue'),
    'overdue_students', (select count(distinct enrolment_id) from inst where status = 'overdue'),
    'lessons_scheduled', (select count(*) from sess where status in ('scheduled', 'confirmed')
                          and (starts_at at time zone 'Africa/Nairobi')::date between private.today_ke() and private.today_ke() + 7),
    'lessons_today', (select count(*) from sess where status not in ('cancelled', 'rescheduled')
                      and (starts_at at time zone 'Africa/Nairobi')::date = private.today_ke()),
    'attendance_rate', (select case when count(*) = 0 then null
                        else round(100.0 * count(*) filter (where status in ('present', 'late')) / count(*)) end from att),
    'ready_for_ntsa', (select count(*) from ntsa where status in ('ready_for_payment', 'payment_pending')),
    'tests_upcoming', (select count(*) from ntsa where status in ('test_booked', 'test_scheduled')
                       and (test_date is null or test_date >= now())),
    'training_completion', (select case when count(*) = 0 then null else round(avg(competency_progress_pct)) end
                            from prog where status in ('active', 'training_complete')),
    'service_fees_collected', (select coalesce(sum(l.amount), 0) from public.v_developer_fee_ledger l
                               where l.collected_on between f and t and (p_location is null or l.location_id = p_location)),
    'pass_rate', (select case when count(*) = 0 then null
                  else round(100.0 * count(*) filter (where a.result = 'passed') / count(*)) end
                  from public.ntsa_test_attempts a join ntsa on ntsa.id = a.process_id
                  where a.result in ('passed', 'failed', 'absent')),
    'enrolments_by_month', (select coalesce(jsonb_agg(x order by x.month), '[]') from (
        select to_char(date_trunc('month', created_at at time zone 'Africa/Nairobi'), 'YYYY-MM') as month, count(*) as value
        from enr where created_at >= date_trunc('month', now()) - interval '5 months' and status <> 'cancelled' group by 1) x),
    'collections_by_week', (select coalesce(jsonb_agg(x order by x.week), '[]') from (
        select to_char(date_trunc('week', received_at at time zone 'Africa/Nairobi'), 'YYYY-MM-DD') as week, sum(amount) as value
        from pays where received_at >= now() - interval '12 weeks' group by 1) x),
    'students_by_location', (select coalesce(jsonb_agg(x order by x.value desc), '[]') from (
        select l.name as label, count(distinct enr.student_id) as value from enr join public.locations l on l.id = enr.location_id
        where enr.status in ('active', 'training_complete', 'awaiting_deposit') group by l.name) x),
    'instructor_workload', (select coalesce(jsonb_agg(x order by x.value desc), '[]') from (
        select p.full_name as label, count(*) as value from sess
        join public.instructors i on i.id = sess.instructor_id join public.profiles p on p.id = i.user_id
        where sess.status not in ('cancelled', 'rescheduled')
          and (sess.starts_at at time zone 'Africa/Nairobi')::date between private.today_ke() - 6 and private.today_ke() + 7
        group by p.full_name) x),
    'payment_ageing', (select jsonb_build_object(
        'current', coalesce(sum(amount_outstanding) filter (where due_date >= private.today_ke()), 0),
        'd1_30', coalesce(sum(amount_outstanding) filter (where due_date between private.today_ke() - 30 and private.today_ke() - 1), 0),
        'd31_60', coalesce(sum(amount_outstanding) filter (where due_date between private.today_ke() - 60 and private.today_ke() - 31), 0),
        'd60_plus', coalesce(sum(amount_outstanding) filter (where due_date < private.today_ke() - 60), 0))
        from inst where amount_outstanding > 0),
    'ntsa_pipeline', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from ntsa group by status) x),
    'lead_pipeline', (select coalesce(jsonb_object_agg(stage, n), '{}') from (
        select stage, count(*) n from public.leads ld
        where (p_location is null or ld.preferred_location_id = p_location) group by stage) x)
  ) into res;
  return res;
end $$;

create or replace function public.dashboard_finance(p_location uuid default null, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  f date := coalesce(p_from, date_trunc('month', private.today_ke())::date);
  t date := coalesce(p_to, private.today_ke());
  res jsonb;
begin
  perform private.require(private.is_finance(), 'Only finance staff can view this dashboard');
  with
  pays as (select * from public.payments p where (p_location is null or p.location_id = p_location)),
  lines as (select jl.*, je.entry_date from public.journal_lines jl join public.journal_entries je on je.id = jl.journal_entry_id
            where (p_location is null or jl.location_id = p_location)),
  acct as (select a.code, coalesce(sum(l.debit), 0) d, coalesce(sum(l.credit), 0) c
           from public.chart_of_accounts a left join lines l on l.account_id = a.id group by a.code),
  inst as (select vi.* from public.v_instalments vi join public.enrolments e on e.id = vi.enrolment_id
           where e.status in ('awaiting_deposit', 'active', 'training_complete') and (p_location is null or e.location_id = p_location))
  select jsonb_build_object(
    'period', jsonb_build_object('from', f, 'to', t),
    'collected', (select coalesce(sum(amount), 0) from pays where status = 'confirmed' and (received_at at time zone 'Africa/Nairobi')::date between f and t),
    'collected_today', (select coalesce(sum(amount), 0) from pays where status in ('confirmed', 'unmatched') and (received_at at time zone 'Africa/Nairobi')::date = private.today_ke()),
    'unmatched_count', (select count(*) from public.payments where status = 'unmatched'),
    'unmatched_amount', (select coalesce(sum(amount), 0) from public.payments where status = 'unmatched'),
    'pending_verification', (select count(*) from pays where status = 'pending_verification'),
    'receivables', (select coalesce(sum(d - c), 0) from acct where code = '1100'),
    'overdue_amount', (select coalesce(sum(amount_outstanding), 0) from inst where status = 'overdue'),
    'overdue_instalments', (select count(*) from inst where status = 'overdue'),
    'ntsa_held', (select coalesce(sum(c - d), 0) from acct where code = '2100'),
    'ntsa_paid', (select coalesce(sum(debit), 0) from lines l join public.chart_of_accounts a on a.id = l.account_id
                  where a.code = '2100' and l.entry_date between f and t),
    'developer_collected', (select coalesce(sum(credit), 0) from lines l join public.chart_of_accounts a on a.id = l.account_id
                            where a.code = '2200' and l.entry_date between f and t),
    'developer_unsettled', (select coalesce(sum(amount), 0) from public.v_developer_fee_ledger where settlement_id is null
                            and (p_location is null or location_id = p_location)),
    'developer_payable', (select coalesce(sum(c - d), 0) from acct where code = '2200'),
    'unapplied_receipts', (select coalesce(sum(c - d), 0) from acct where code = '2300'),
    'revenue', (select coalesce(sum(credit - debit), 0) from lines l join public.chart_of_accounts a on a.id = l.account_id
                where a.account_type = 'revenue' and l.entry_date between f and t),
    'expenses', (select coalesce(sum(debit - credit), 0) from lines l join public.chart_of_accounts a on a.id = l.account_id
                 where a.account_type = 'expense' and l.entry_date between f and t),
    'vat_output', (select coalesce(sum(credit - debit), 0) from lines l join public.chart_of_accounts a on a.id = l.account_id
                   where a.code = '2400' and l.entry_date between f and t),
    'mpesa_today', (select jsonb_build_object(
        'received', count(*), 'matched', count(*) filter (where status = 'matched'),
        'unmatched', count(*) filter (where status = 'unmatched'), 'amount', coalesce(sum(amount), 0))
        from public.mpesa_transactions where (trans_time at time zone 'Africa/Nairobi')::date = private.today_ke()),
    'collections_by_day', (select coalesce(jsonb_agg(x order by x.day), '[]') from (
        select to_char((received_at at time zone 'Africa/Nairobi')::date, 'YYYY-MM-DD') as day, sum(amount) as value
        from pays where status = 'confirmed' and (received_at at time zone 'Africa/Nairobi')::date between greatest(f, t - 30) and t group by 1) x),
    'collections_by_source', (select coalesce(jsonb_agg(x), '[]') from (
        select source as label, sum(amount) as value from pays where status = 'confirmed'
          and (received_at at time zone 'Africa/Nairobi')::date between f and t group by source) x)
  ) into res;
  return res;
end $$;

-- -----------------------------------------------------------------------------
-- Platform owner (service-fee) reporting — minimum necessary data only
-- -----------------------------------------------------------------------------
create or replace function public.platform_fee_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; today date := private.today_ke();
begin
  perform private.require(private.has_role('platform_owner') or private.is_finance(), 'Not allowed');
  select jsonb_build_object(
    'today', (select coalesce(sum(amount), 0) from public.v_developer_fee_ledger where collected_on = today),
    'week', (select coalesce(sum(amount), 0) from public.v_developer_fee_ledger where collected_on >= date_trunc('week', today)::date),
    'month', (select coalesce(sum(amount), 0) from public.v_developer_fee_ledger where collected_on >= date_trunc('month', today)::date),
    'collected_total', (select coalesce(sum(amount), 0) from public.v_developer_fee_ledger),
    'charged_total', (select coalesce(sum(service_fee_due), 0) from public.v_enrolment_balances where status not in ('cancelled')),
    'outstanding', (select coalesce(sum(service_fee_due - service_fee_paid), 0) from public.v_enrolment_balances
                    where status in ('awaiting_deposit', 'active', 'training_complete', 'suspended')),
    'settled', (select coalesce(sum(amount), 0) from public.developer_settlements where status = 'paid'),
    'in_settlement', (select coalesce(sum(amount), 0) from public.developer_settlements where status in ('draft', 'approved')),
    'unsettled', (select coalesce(sum(amount), 0) from public.v_developer_fee_ledger where settlement_id is null),
    'paying_students', (select count(distinct student_id) from public.v_developer_fee_ledger where amount > 0),
    'by_location', (select coalesce(jsonb_agg(x order by x.value desc), '[]') from (
        select l.name as label, sum(d.amount) as value from public.v_developer_fee_ledger d
        join public.locations l on l.id = d.location_id group by l.name) x),
    'by_course', (select coalesce(jsonb_agg(x order by x.value desc), '[]') from (
        select c.name as label, sum(d.amount) as value from public.v_developer_fee_ledger d
        join public.courses c on c.id = d.course_id group by c.name) x),
    'by_month', (select coalesce(jsonb_agg(x order by x.month), '[]') from (
        select to_char(date_trunc('month', collected_on), 'YYYY-MM') as month, sum(amount) as value
        from public.v_developer_fee_ledger where collected_on >= date_trunc('month', today) - interval '5 months' group by 1) x),
    'settlements', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select settlement_number, period_end, amount, item_count, status, created_at, paid_at, payout_reference
        from public.developer_settlements order by created_at desc limit 24) x)
  ) into res;
  return res;
end $$;

create or replace function public.platform_fee_ledger(p_from date default null, p_to date default null,
                                                      p_limit int default 50, p_offset int default 0)
returns table (allocation_id uuid, collected_on date, amount numeric, receipt_number text, student_number text,
               course text, location text, settlement_number text, settlement_status public.settlement_status, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require(private.has_role('platform_owner') or private.is_finance(), 'Not allowed');
  return query
  select d.allocation_id, d.collected_on, d.amount, d.receipt_number, s.student_number, c.name, l.name,
         d.settlement_number, d.settlement_status, count(*) over ()
  from public.v_developer_fee_ledger d
  join public.students s on s.id = d.student_id
  left join public.courses c on c.id = d.course_id
  left join public.locations l on l.id = d.location_id
  where (p_from is null or d.collected_on >= p_from) and (p_to is null or d.collected_on <= p_to)
  order by d.allocated_at desc
  limit least(p_limit, 500) offset p_offset;
end $$;

-- -----------------------------------------------------------------------------
-- Trial balance as of a date
-- -----------------------------------------------------------------------------
create or replace function public.trial_balance(p_as_of date default null, p_location uuid default null)
returns table (code text, name text, account_type public.account_type, debit numeric, credit numeric, balance numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require(private.is_finance(), 'Only finance staff can view the trial balance');
  return query
  select a.code, a.name, a.account_type, coalesce(sum(jl.debit), 0)::numeric, coalesce(sum(jl.credit), 0)::numeric,
    (case when a.account_type in ('asset', 'expense') then coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0)
          else coalesce(sum(jl.credit), 0) - coalesce(sum(jl.debit), 0) end)::numeric
  from public.chart_of_accounts a
  left join (select l.* from public.journal_lines l join public.journal_entries e on e.id = l.journal_entry_id
             where (p_as_of is null or e.entry_date <= p_as_of) and (p_location is null or l.location_id = p_location)) jl
    on jl.account_id = a.id
  group by a.id order by a.code;
end $$;

-- -----------------------------------------------------------------------------
-- Global search (RLS applies: SECURITY INVOKER)
-- -----------------------------------------------------------------------------
create or replace function public.search_global(p_query text)
returns table (kind text, id uuid, title text, subtitle text, href text)
language sql stable security invoker set search_path = '' as $$
  with q as (select trim(p_query) as t, upper(regexp_replace(trim(p_query), '\s', '', 'g')) as u,
                    private.normalize_ke_phone(p_query) as ph)
  (select 'student', s.id, s.first_name || ' ' || s.last_name, s.student_number || ' · ' || s.phone, '/staff/students/' || s.id
   from public.students s, q
   where length(q.t) >= 2 and s.anonymized_at is null and (
     upper(s.student_number) like q.u || '%' or s.phone = q.ph
     or (s.first_name || ' ' || coalesce(s.middle_name, '') || ' ' || s.last_name) operator(extensions.%) q.t
     or (s.first_name || ' ' || s.last_name) ilike '%' || q.t || '%')
   order by (upper(s.student_number) = q.u) desc, s.registered_at desc limit 8)
  union all
  (select 'payment', p.id, coalesce(p.external_reference, p.receipt_number, 'Payment'),
          p.receipt_number || ' · KES ' || to_char(p.amount, 'FM999,999,990'), '/staff/payments/' || p.id
   from public.payments p, q
   where length(q.t) >= 4 and (upper(p.external_reference) = q.u or upper(p.receipt_number) = q.u
                               or upper(p.receipt_number) like '%' || q.u)
   limit 5)
  union all
  (select 'lead', l.id, l.full_name, 'Lead · ' || l.phone, '/staff/admissions/' || l.id
   from public.leads l, q
   where length(q.t) >= 2 and l.stage not in ('converted') and (l.phone = q.ph or l.full_name ilike '%' || q.t || '%')
   limit 5)
$$;

-- -----------------------------------------------------------------------------
-- Privacy: controlled anonymisation (Kenya Data Protection Act)
-- -----------------------------------------------------------------------------
create or replace function public.anonymize_student(p_student uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.v_student_balances%rowtype;
begin
  perform private.require(private.is_manager(), 'Only a manager can anonymise a student record');
  if coalesce(length(trim(p_reason)), 0) < 10 then raise exception 'Record the legal basis / reason for anonymisation'; end if;
  select * into b from public.v_student_balances where student_id = p_student;
  if b.total_outstanding <> 0 or b.credit_balance <> 0 then
    raise exception 'Settle the student''s balance and credit before anonymising';
  end if;
  if exists (select 1 from public.enrolments where student_id = p_student
             and status in ('pending_acceptance', 'awaiting_deposit', 'active', 'training_complete', 'suspended')) then
    raise exception 'Close all open enrolments first';
  end if;
  perform private.write_audit('student.anonymize', 'students', p_student::text, null, jsonb_build_object('reason', p_reason));
  delete from public.student_identities where student_id = p_student;
  delete from public.student_documents where student_id = p_student;
  update public.profiles set is_active = false, full_name = 'Former student', phone = null, email = null
   where id = (select user_id from public.students where id = p_student);
  update public.students set first_name = 'Former', middle_name = null, last_name = 'Student', gender = null,
         date_of_birth = null, id_type = null, id_number_last4 = null, phone = '+254700000000', alt_phone = null,
         email = null, residence = null, emergency_contact_name = null, emergency_contact_phone = null,
         emergency_contact_relationship = null, anonymized_at = now(), activation_code_hash = null
   where id = p_student;
end $$;

-- Staff can reveal a full ID number; every reveal is audited.
create or replace function public.reveal_student_id_number(p_student uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  perform private.require((private.is_manager() or private.has_role('admin')) and private.can_access_student(p_student),
    'You are not allowed to view identification numbers');
  select id_number into v from public.student_identities where student_id = p_student;
  perform private.write_audit('student.id_number_revealed', 'students', p_student::text);
  return v;
end $$;

grant execute on all functions in schema private to authenticated, service_role;
