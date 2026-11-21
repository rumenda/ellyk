-- =============================================================================
-- Business functions — finance.
-- All multi-step financial operations happen here, inside one transaction,
-- with explicit authorisation checks (these functions are SECURITY DEFINER).
-- =============================================================================

create or replace function private.require(p_ok boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception using errcode = '42501', message = p_message;
  end if;
end $$;

create or replace function private.settings()
returns public.school_settings language sql stable security definer set search_path = '' as $$
  select * from public.school_settings where id = 1
$$;

-- -----------------------------------------------------------------------------
-- Notifications (used by many functions below)
-- -----------------------------------------------------------------------------
create or replace function private.render_template(p_text text, p_vars jsonb)
returns text language plpgsql immutable as $$
declare k text; r text := p_text;
begin
  if p_vars is null then return r; end if;
  for k in select jsonb_object_keys(p_vars) loop
    r := replace(r, '{{' || k || '}}', coalesce(p_vars ->> k, ''));
  end loop;
  return regexp_replace(r, '\{\{[a-z_]+\}\}', '', 'g');
end $$;

create or replace function private.notify_user(
  p_user uuid, p_student uuid, p_key text, p_vars jsonb, p_link text default null, p_dedupe text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  t public.notification_templates%rowtype;
  n_id uuid;
  pref public.notification_preferences%rowtype;
  ch public.notification_channel;
begin
  if p_user is null then return null; end if;
  select * into t from public.notification_templates where key = p_key and channel = 'in_app' and is_active;
  if not found then return null; end if;

  insert into public.notifications (user_id, student_id, template_key, title, body, link, dedupe_key)
  values (p_user, p_student, p_key, private.render_template(t.title, p_vars),
          private.render_template(t.body, p_vars), p_link, p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into n_id;
  if n_id is null then return null; end if;

  select * into pref from public.notification_preferences where user_id = p_user;
  for ch in select channel from public.notification_templates
             where key = p_key and channel <> 'in_app' and is_active loop
    if (ch = 'sms' and coalesce(pref.sms, true)) or (ch = 'email' and coalesce(pref.email, true))
       or (ch = 'push' and coalesce(pref.push, true)) then
      insert into public.notification_deliveries (notification_id, channel) values (n_id, ch);
    end if;
  end loop;
  return n_id;
end $$;

create or replace function private.notify_student(
  p_student uuid, p_key text, p_vars jsonb, p_link text default null, p_dedupe text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid; fname text;
begin
  select user_id, first_name into u, fname from public.students where id = p_student;
  return private.notify_user(u, p_student, p_key, jsonb_build_object('first_name', fname) || coalesce(p_vars, '{}'),
                             p_link, p_dedupe);
end $$;

create or replace function private.fmt_kes(p numeric)
returns text language sql immutable as $$
  select 'KES ' || to_char(coalesce(p, 0), 'FM999,999,999,990')
$$;

-- -----------------------------------------------------------------------------
-- Quote: fee breakdown for a price version (tax computed here only)
-- -----------------------------------------------------------------------------
create or replace function public.quote_price_version(p_price_version uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  pv public.course_price_versions%rowtype;
  s public.school_settings%rowtype := private.settings();
  items jsonb := '[]'::jsonb;
  r record;
  rate numeric; net numeric; tax numeric; gross numeric;
  total numeric := 0; svc numeric := 0; ntsa numeric := 0; tax_total numeric := 0;
begin
  select * into pv from public.course_price_versions where id = p_price_version;
  if not found then raise exception 'Price version not found'; end if;

  for r in
    select pi.*, tr.rate as tr_rate
    from public.course_price_items pi
    left join public.tax_rates tr on tr.id = pi.tax_rate_id and tr.is_active
    where pi.price_version_id = p_price_version
    order by pi.sort_order, pi.component
  loop
    -- Pass-through components (NTSA, service fee) never attract school VAT.
    rate := case when s.vat_registered and r.component not in ('ntsa', 'service_fee')
                 then coalesce(r.tr_rate, 0) else 0 end;
    if s.prices_tax_inclusive then
      gross := r.amount;
      net := round(r.amount / (1 + rate), 2);
      tax := gross - net;
    else
      net := r.amount;
      tax := round(r.amount * rate, 2);
      gross := net + tax;
    end if;
    total := total + gross;
    tax_total := tax_total + tax;
    if r.component = 'service_fee' then svc := svc + gross; end if;
    if r.component = 'ntsa' then ntsa := ntsa + gross; end if;
    items := items || jsonb_build_object(
      'component', r.component, 'label', r.label, 'net', net, 'tax', tax, 'gross', gross,
      'tax_rate', rate, 'tax_rate_id', case when rate > 0 then r.tax_rate_id end, 'sort_order', r.sort_order);
  end loop;

  return jsonb_build_object(
    'price_version_id', pv.id, 'course_id', pv.course_id, 'version', pv.version, 'label', pv.label,
    'items', items, 'total', total, 'tax_total', tax_total, 'deposit', least(pv.deposit_amount, total),
    'service_fee', svc, 'ntsa', ntsa, 'tax_inclusive', s.prices_tax_inclusive,
    'instalment_mode', pv.instalment_mode, 'instalment_count', pv.instalment_count,
    'instalment_amount', pv.instalment_amount, 'frequency', pv.instalment_frequency,
    'min_paid_before_training', pv.min_paid_before_training,
    'min_paid_before_ntsa', pv.min_paid_before_ntsa);
end $$;

-- -----------------------------------------------------------------------------
-- Students
-- -----------------------------------------------------------------------------
create or replace function public.register_student(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.school_settings%rowtype := private.settings();
  sid uuid;
  loc uuid := (p ->> 'home_location_id')::uuid;
  dob date := nullif(p ->> 'date_of_birth', '')::date;
  ph text := private.normalize_ke_phone(p ->> 'phone');
  idn text := nullif(trim(p ->> 'id_number'), '');
  c jsonb;
begin
  perform private.require(private.is_manager() or (private.has_role('admin') and private.can_access_location(loc)),
    'You are not allowed to register students at this location');
  if ph is null then raise exception 'Enter a valid Kenyan mobile number, e.g. 0712 345 678'; end if;
  if dob is not null and dob > (private.today_ke() - make_interval(years => s.minimum_student_age)) then
    raise exception 'Student must be at least % years old', s.minimum_student_age;
  end if;
  if not coalesce((p ->> 'consent_data_processing')::boolean, false) then
    raise exception 'Consent to process personal data is required to register a student';
  end if;

  insert into public.students (
    student_number, first_name, middle_name, last_name, gender, date_of_birth, id_type, id_number_last4,
    phone, alt_phone, email, residence, emergency_contact_name, emergency_contact_phone,
    emergency_contact_relationship, home_location_id, lead_id, registered_by)
  values (
    private.next_document_number('student'), trim(p ->> 'first_name'), nullif(trim(p ->> 'middle_name'), ''),
    trim(p ->> 'last_name'), nullif(p ->> 'gender', '')::public.gender, dob,
    nullif(p ->> 'id_type', '')::public.id_document_type, case when idn is not null then right(idn, 4) end,
    ph, private.normalize_ke_phone(p ->> 'alt_phone'), nullif(trim(p ->> 'email'), ''),
    nullif(trim(p ->> 'residence'), ''), nullif(trim(p ->> 'emergency_contact_name'), ''),
    private.normalize_ke_phone(p ->> 'emergency_contact_phone'),
    nullif(trim(p ->> 'emergency_contact_relationship'), ''), loc,
    nullif(p ->> 'lead_id', '')::uuid, auth.uid())
  returning id into sid;

  if idn is not null then
    insert into public.student_identities (student_id, id_type, id_number)
    values (sid, coalesce(nullif(p ->> 'id_type', '')::public.id_document_type, 'national_id'), upper(idn));
  end if;

  insert into public.student_consents (student_id, consent_type, granted, terms_version, recorded_by, ip_address)
  values (sid, 'data_processing', true, s.terms_version, auth.uid(), p ->> 'ip');
  if p ? 'consent_sms' then
    insert into public.student_consents (student_id, consent_type, granted, terms_version, recorded_by, ip_address)
    values (sid, 'sms_notifications', coalesce((p ->> 'consent_sms')::boolean, false), s.terms_version, auth.uid(), p ->> 'ip');
  end if;

  if nullif(p ->> 'lead_id', '') is not null then
    update public.leads set stage = 'converted', converted_student_id = sid, converted_at = now()
     where id = (p ->> 'lead_id')::uuid;
    insert into public.lead_activities (lead_id, activity_type, body, created_by)
    values ((p ->> 'lead_id')::uuid, 'converted', 'Registered as student', auth.uid());
  end if;
  return sid;
end $$;

-- 6-digit activation code for the student portal, shown once to staff.
create or replace function public.issue_student_activation_code(p_student uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  perform private.require(private.is_office() and private.can_access_student(p_student),
    'You are not allowed to manage this student''s portal access');
  update public.students
     set activation_code_hash = extensions.crypt(code, extensions.gen_salt('bf', 8)),
         activation_expires_at = now() + interval '14 days'
   where id = p_student and user_id is null;
  if not found then raise exception 'This student already has an active portal account'; end if;
  perform private.write_audit('student.activation_code_issued', 'students', p_student::text);
  return code;
end $$;

-- Used by the activation server action (service role only).
create or replace function public.verify_student_activation(p_student_number text, p_phone text, p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare st public.students%rowtype;
begin
  select * into st from public.students
   where upper(student_number) = upper(trim(p_student_number))
     and phone = private.normalize_ke_phone(p_phone)
     and user_id is null and anonymized_at is null;
  if not found or st.activation_code_hash is null or st.activation_expires_at < now()
     or st.activation_code_hash <> extensions.crypt(p_code, st.activation_code_hash) then
    return null;
  end if;
  return st.id;
end $$;

create or replace function public.link_student_account(p_student uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.students set user_id = p_user, activation_code_hash = null, activation_expires_at = null
   where id = p_student and user_id is null;
  if not found then raise exception 'Student account already linked'; end if;
  insert into public.user_roles (user_id, role) values (p_user, 'student') on conflict do nothing;
  insert into public.notification_preferences (user_id) values (p_user) on conflict do nothing;
end $$;

-- Login identifier → auth email (service role only). Accepts email, phone or student number.
create or replace function public.resolve_login_email(p_identifier text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare i text := trim(p_identifier); ph text; e text;
begin
  if i like '%@%' then return lower(i); end if;
  ph := private.normalize_ke_phone(i);
  if ph is not null then
    select u.email into e from public.profiles p join auth.users u on u.id = p.id
     where p.phone = ph and p.is_active order by p.created_at limit 1;
    if e is null then
      select u.email into e from public.students s join auth.users u on u.id = s.user_id where s.phone = ph limit 1;
    end if;
    return e;
  end if;
  select u.email into e from public.students s join auth.users u on u.id = s.user_id
   where upper(s.student_number) = upper(regexp_replace(i, '\s', '', 'g'));
  return e;
end $$;

-- -----------------------------------------------------------------------------
-- Enrolment
-- -----------------------------------------------------------------------------
create or replace function public.create_enrolment(
  p_student uuid, p_course uuid, p_location uuid, p_start_date date default null,
  p_instructor uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare pv uuid; c public.courses%rowtype; eid uuid;
begin
  perform private.require(private.is_manager() or (private.has_role('admin') and private.can_access_location(p_location)),
    'You are not allowed to enrol students at this location');
  select * into c from public.courses where id = p_course and is_active;
  if not found then raise exception 'This course is not available'; end if;
  if not exists (select 1 from public.course_locations where course_id = p_course and location_id = p_location) then
    raise exception 'This course is not offered at the selected location';
  end if;
  select id into pv from public.course_price_versions where course_id = p_course and status = 'active';
  if pv is null then raise exception 'This course has no active price. Publish a price version first.'; end if;
  if exists (select 1 from public.students where id = p_student and status in ('withdrawn', 'suspended')) then
    raise exception 'The student''s record is withdrawn or suspended';
  end if;

  insert into public.enrolments (enrolment_number, student_id, course_id, location_id, price_version_id,
                                 start_date, expected_end_date, assigned_instructor_id, created_by)
  values (private.next_document_number('enrolment'), p_student, p_course, p_location, pv,
          p_start_date, p_start_date + (c.duration_weeks * 7), p_instructor, auth.uid())
  returning id into eid;
  return eid;
end $$;

-- Whether all fees and plan details were accepted; creates plan, invoice, journal.
-- p_schedule: [{"sequence":0,"label":"Deposit","due_date":"2026-11-21","amount":5000}, ...]
create or replace function public.accept_enrolment_agreement(
  p_enrolment uuid, p_schedule jsonb, p_accepted_via text, p_ip text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.enrolments%rowtype;
  s public.school_settings%rowtype := private.settings();
  q jsonb;
  agreement_id uuid; plan_id uuid; inv_id uuid; je uuid;
  it jsonb; sched_total numeric := 0; n int := 0; prev date := null; deposit_row jsonb;
  lines jsonb := '[]'::jsonb; tax_total numeric := 0; subtotal numeric := 0;
  lic uuid; ntsa_amt numeric;
begin
  select * into e from public.enrolments where id = p_enrolment for update;
  if not found then raise exception 'Enrolment not found'; end if;
  perform private.require(
    (p_accepted_via = 'in_person' and (private.is_manager() or (private.has_role('admin') and private.can_access_location(e.location_id))))
    or (p_accepted_via = 'student_portal' and e.student_id = private.current_student_id()),
    'You are not allowed to accept this agreement');
  if e.status <> 'pending_acceptance' then
    raise exception 'This enrolment has already been accepted (status: %)', e.status;
  end if;

  q := public.quote_price_version(e.price_version_id);

  -- Validate the schedule against the quote: it must exactly cover the total.
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) = 0 then
    raise exception 'A payment schedule is required';
  end if;
  for it in select * from jsonb_array_elements(p_schedule) order by (value ->> 'sequence')::int loop
    if (it ->> 'sequence')::int <> n then raise exception 'Schedule sequence must be consecutive from 0'; end if;
    if (it ->> 'amount')::numeric <= 0 then raise exception 'Instalment amounts must be positive'; end if;
    if prev is not null and (it ->> 'due_date')::date < prev then raise exception 'Instalment due dates must be in order'; end if;
    prev := (it ->> 'due_date')::date;
    sched_total := sched_total + (it ->> 'amount')::numeric;
    n := n + 1;
  end loop;
  if sched_total <> (q ->> 'total')::numeric then
    raise exception 'Schedule total % does not match agreement total %', sched_total, q ->> 'total';
  end if;
  select value into deposit_row from jsonb_array_elements(p_schedule) where (value ->> 'sequence')::int = 0;
  if (q ->> 'deposit')::numeric > 0 and (deposit_row ->> 'amount')::numeric <> (q ->> 'deposit')::numeric then
    raise exception 'The first instalment must equal the required deposit';
  end if;

  insert into public.student_course_agreements (enrolment_id, price_version_id, fee_snapshot, total_amount,
    deposit_amount, service_fee_amount, ntsa_amount, terms_version, terms_text, accepted_via, accepted_by, acceptance_ip)
  values (e.id, e.price_version_id, q, (q ->> 'total')::numeric, (q ->> 'deposit')::numeric,
          (q ->> 'service_fee')::numeric, (q ->> 'ntsa')::numeric, s.terms_version, s.terms_text,
          p_accepted_via, auth.uid(), p_ip)
  returning id into agreement_id;

  insert into public.payment_plans (enrolment_id, agreement_id, total_amount, deposit_amount, instalment_count,
                                    frequency, first_due_date, created_by)
  values (e.id, agreement_id, (q ->> 'total')::numeric, (q ->> 'deposit')::numeric, n - 1,
          (q ->> 'frequency')::public.instalment_frequency, (deposit_row ->> 'due_date')::date, auth.uid())
  returning id into plan_id;

  insert into public.instalments (payment_plan_id, sequence, label, due_date, amount)
  select plan_id, (v ->> 'sequence')::int, v ->> 'label', (v ->> 'due_date')::date, (v ->> 'amount')::numeric
  from jsonb_array_elements(p_schedule) v;

  -- Invoice
  for it in select * from jsonb_array_elements(q -> 'items') loop
    subtotal := subtotal + (it ->> 'net')::numeric;
    tax_total := tax_total + (it ->> 'tax')::numeric;
  end loop;

  insert into public.invoices (invoice_number, student_id, enrolment_id, location_id, description, subtotal,
                               tax_total, total, tax_inclusive, etims_status, kind, created_by)
  values (private.next_document_number('invoice'), e.student_id, e.id, e.location_id,
          'Course fees – ' || (select name from public.courses where id = e.course_id),
          subtotal, tax_total, (q ->> 'total')::numeric, s.prices_tax_inclusive,
          case when s.etims_enabled and s.vat_registered then 'pending' else 'not_applicable' end::public.etims_status,
          'enrolment', auth.uid())
  returning id into inv_id;

  insert into public.invoice_lines (invoice_id, component, description, net_amount, tax_rate_id, tax_rate,
                                    tax_amount, gross_amount, sort_order)
  select inv_id, (v ->> 'component')::public.charge_component, v ->> 'label', (v ->> 'net')::numeric,
         nullif(v ->> 'tax_rate_id', '')::uuid, (v ->> 'tax_rate')::numeric, (v ->> 'tax')::numeric,
         (v ->> 'gross')::numeric, coalesce((v ->> 'sort_order')::int, 0)
  from jsonb_array_elements(q -> 'items') v
  where (v ->> 'gross')::numeric > 0;

  -- Journal: Dr AR / Cr revenue, VAT, NTSA billed, developer fee billed
  for it in select * from jsonb_array_elements(q -> 'items') where (value ->> 'gross')::numeric > 0 loop
    lines := lines || jsonb_build_object('account', '1100', 'debit', it ->> 'gross', 'student_id', e.student_id,
                                         'component', it ->> 'component', 'memo', it ->> 'label');
    lines := lines || jsonb_build_object(
      'account', case it ->> 'component'
                   when 'tuition' then '4000' when 'registration' then '4010'
                   when 'ntsa' then '2105' when 'service_fee' then '2205' else '4020' end,
      'credit', it ->> 'net', 'student_id', e.student_id, 'component', it ->> 'component', 'memo', it ->> 'label');
    if (it ->> 'tax')::numeric > 0 then
      lines := lines || jsonb_build_object('account', '2400', 'credit', it ->> 'tax', 'student_id', e.student_id,
                                           'component', it ->> 'component', 'memo', 'VAT on ' || (it ->> 'label'));
    end if;
  end loop;
  je := private.post_journal(private.today_ke(), 'Invoice for enrolment ' || e.enrolment_number, 'invoice', inv_id,
                             e.location_id, lines);
  update public.invoices set journal_entry_id = je where id = inv_id;

  if s.etims_enabled and s.vat_registered then
    insert into public.etims_submissions (invoice_id, provider, status) values (inv_id, 'pending_adapter', 'pending');
  end if;

  -- NTSA process
  select licence_class_id into lic from public.courses where id = e.course_id;
  ntsa_amt := (q ->> 'ntsa')::numeric;
  insert into public.ntsa_processes (enrolment_id, student_id, licence_class_id, ntsa_amount, status)
  values (e.id, e.student_id, lic, ntsa_amt, 'documents_pending');
  insert into public.ntsa_process_events (process_id, to_status, note, actor_id)
  select id, 'documents_pending', 'Process opened on enrolment acceptance', auth.uid()
    from public.ntsa_processes where enrolment_id = e.id;

  insert into public.student_consents (student_id, consent_type, granted, terms_version, recorded_by, ip_address)
  values (e.student_id, 'terms_and_fees', true, s.terms_version, auth.uid(), p_ip);

  update public.enrolments
     set status = case when (q ->> 'deposit')::numeric > 0 then 'awaiting_deposit' else 'active' end::public.enrolment_status,
         activated_at = case when (q ->> 'deposit')::numeric > 0 then null else now() end
   where id = e.id;

  perform private.apply_student_credit(e.student_id);
  perform private.refresh_enrolment_status(e.id);

  perform private.notify_student(e.student_id, 'enrolment_accepted',
    jsonb_build_object('total', private.fmt_kes((q ->> 'total')::numeric),
                       'deposit', private.fmt_kes((q ->> 'deposit')::numeric),
                       'student_number', (select student_number from public.students where id = e.student_id)),
    '/app/payments', 'enrolment_accepted:' || e.id);

  return jsonb_build_object('agreement_id', agreement_id, 'invoice_id', inv_id, 'payment_plan_id', plan_id);
end $$;

-- Activate an enrolment once the deposit is covered.
create or replace function private.refresh_enrolment_status(p_enrolment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.enrolments%rowtype; b public.v_enrolment_balances%rowtype; cname text;
begin
  select * into e from public.enrolments where id = p_enrolment;
  if e.status <> 'awaiting_deposit' then return; end if;
  select * into b from public.v_enrolment_balances where enrolment_id = p_enrolment;
  if b.plan_paid >= coalesce(b.deposit_amount, 0) then
    update public.enrolments set status = 'active', activated_at = now() where id = p_enrolment;
    update public.students set status = 'active' where id = e.student_id and status = 'applicant';
    select name into cname from public.courses where id = e.course_id;
    perform private.notify_student(e.student_id, 'enrolment_activated', jsonb_build_object('course', cname),
                                   '/app', 'enrolment_activated:' || p_enrolment);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Allocation waterfall: apply a student's unapplied credit to open invoice lines
-- (oldest invoice first, then by configured component priority).
-- -----------------------------------------------------------------------------
create or replace function private.apply_student_credit(p_student uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  prio text[] := (private.settings()).allocation_priority;
  available numeric;
  applied numeric := 0;
  ln record; pay record;
  need numeric; amt numeric;
  plan jsonb := '[]'::jsonb;   -- [{payment_id, line_id, component, amount}]
  pay_left jsonb := '{}'::jsonb;
  jl jsonb := '[]'::jsonb;
  je uuid; loc uuid; p jsonb; enr uuid;
  receipt_lines text := '';
begin
  -- Serialise all allocation work for one student.
  perform 1 from public.students where id = p_student for update;

  select credit_balance into available from public.v_student_credit where student_id = p_student;
  if coalesce(available, 0) <= 0 then return 0; end if;

  for pay in
    select pb.payment_id, pb.unallocated from public.v_payment_balances pb
    join public.payments py on py.id = pb.payment_id
    where pb.student_id = p_student and pb.status = 'confirmed' and pb.unallocated > 0
    order by py.received_at, py.created_at
  loop
    pay_left := pay_left || jsonb_build_object(pay.payment_id::text, pay.unallocated);
  end loop;

  for ln in
    select lb.* from public.v_invoice_line_balances lb
    where lb.student_id = p_student and lb.outstanding > 0
    order by lb.issue_date, lb.invoice_number,
             coalesce(array_position(prio, lb.component::text), 99), lb.sort_order
  loop
    exit when available <= 0;
    need := least(ln.outstanding, available);
    for pay in select key::uuid as payment_id, value::numeric as left_amt from jsonb_each_text(pay_left)
               where value::numeric > 0 loop
      exit when need <= 0;
      amt := least(need, pay.left_amt);
      plan := plan || jsonb_build_object('payment_id', pay.payment_id, 'line_id', ln.invoice_line_id,
                                         'component', ln.component, 'amount', amt, 'location_id', ln.location_id,
                                         'enrolment_id', ln.enrolment_id);
      pay_left := jsonb_set(pay_left, array[pay.payment_id::text], to_jsonb(pay.left_amt - amt));
      need := need - amt; available := available - amt; applied := applied + amt;
    end loop;
  end loop;

  if applied = 0 then return 0; end if;

  -- One balanced journal for the whole run.
  for p in select * from jsonb_array_elements(plan) loop
    loc := coalesce(loc, (p ->> 'location_id')::uuid);
    jl := jl || jsonb_build_object('account', '2300', 'debit', p ->> 'amount', 'student_id', p_student,
                                   'component', p ->> 'component', 'memo', 'Applied receipt');
    jl := jl || jsonb_build_object('account', '1100', 'credit', p ->> 'amount', 'student_id', p_student,
                                   'component', p ->> 'component');
    if p ->> 'component' = 'ntsa' then
      jl := jl || jsonb_build_object('account', '2105', 'debit', p ->> 'amount', 'student_id', p_student, 'component', 'ntsa',
                                     'memo', 'NTSA component collected')
               || jsonb_build_object('account', '2100', 'credit', p ->> 'amount', 'student_id', p_student, 'component', 'ntsa');
    elsif p ->> 'component' = 'service_fee' then
      jl := jl || jsonb_build_object('account', '2205', 'debit', p ->> 'amount', 'student_id', p_student, 'component', 'service_fee',
                                     'memo', 'Developer service fee collected')
               || jsonb_build_object('account', '2200', 'credit', p ->> 'amount', 'student_id', p_student, 'component', 'service_fee');
    end if;
  end loop;
  je := private.post_journal(private.today_ke(), 'Payment allocation', 'allocation', null, loc, jl);

  for p in select * from jsonb_array_elements(plan) loop
    insert into public.payment_allocations (payment_id, invoice_line_id, amount, journal_entry_id, allocated_by)
    values ((p ->> 'payment_id')::uuid, (p ->> 'line_id')::uuid, (p ->> 'amount')::numeric, je, auth.uid());
  end loop;

  for enr in select distinct (v ->> 'enrolment_id')::uuid from jsonb_array_elements(plan) v
             where v ->> 'enrolment_id' is not null loop
    perform private.refresh_enrolment_status(enr);
  end loop;
  return applied;
end $$;

-- -----------------------------------------------------------------------------
-- Payment intake
-- -----------------------------------------------------------------------------
create or replace function private.find_student_by_reference(p_ref text)
returns uuid language sql stable security definer set search_path = '' as $$
  with r as (select upper(regexp_replace(coalesce(p_ref, ''), '[^A-Za-z0-9]', '', 'g')) as ref)
  select coalesce(
    (select s.id from public.students s, r where upper(s.student_number) = r.ref and s.anonymized_at is null),
    (select e.student_id from public.enrolments e, r
      where upper(regexp_replace(e.enrolment_number, '[^A-Za-z0-9]', '', 'g')) = r.ref)
  )
$$;

-- Post receipt of funds: Dr cash-type account / Cr 2300 unapplied receipts.
create or replace function private.post_receipt(p_payment uuid, p_cash_account text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare py public.payments%rowtype; je uuid;
begin
  select * into py from public.payments where id = p_payment;
  je := private.post_journal((py.received_at at time zone 'Africa/Nairobi')::date,
    'Receipt ' || coalesce(py.external_reference, py.receipt_number, py.id::text), 'payment', py.id, py.location_id,
    jsonb_build_array(
      jsonb_build_object('account', p_cash_account, 'debit', py.amount, 'student_id', py.student_id),
      jsonb_build_object('account', '2300', 'credit', py.amount, 'student_id', py.student_id)));
  update public.payments set journal_entry_id = je where id = p_payment;
  return je;
end $$;

create or replace function private.after_payment_matched(p_payment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare py public.payments%rowtype; bal numeric;
begin
  select * into py from public.payments where id = p_payment;
  perform private.apply_student_credit(py.student_id);
  select total_outstanding into bal from public.v_student_balances where student_id = py.student_id;
  perform private.notify_student(py.student_id, 'payment_received',
    jsonb_build_object('amount', private.fmt_kes(py.amount), 'receipt_number', py.receipt_number,
                       'reference', coalesce(py.external_reference, ''), 'balance', private.fmt_kes(bal)),
    '/app/payments', 'payment_received:' || py.id);
end $$;

-- M-Pesa C2B validation (service role). Returns {"accept": bool, "reason": text}.
create or replace function public.mpesa_validate_c2b(p_short_code text, p_amount numeric, p_bill_ref text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.school_settings%rowtype := private.settings();
begin
  if s.paybill_number is not null and p_short_code is distinct from s.paybill_number then
    return jsonb_build_object('accept', false, 'reason', 'shortcode_mismatch');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('accept', false, 'reason', 'invalid_amount');
  end if;
  if private.find_student_by_reference(p_bill_ref) is null and s.mpesa_unknown_account_policy = 'reject' then
    return jsonb_build_object('accept', false, 'reason', 'unknown_account');
  end if;
  return jsonb_build_object('accept', true, 'reason', null);
end $$;

-- M-Pesa C2B confirmation (service role). Idempotent on TransID.
create or replace function public.mpesa_record_confirmation(
  p_trans_id text, p_trans_type text, p_trans_time timestamptz, p_amount numeric, p_short_code text,
  p_bill_ref text, p_msisdn_masked text, p_msisdn_hash text, p_payer_name text, p_org_balance numeric,
  p_environment text, p_raw jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.school_settings%rowtype := private.settings();
  tx_id uuid; pay_id uuid; sid uuid; method public.matching_method; loc uuid;
begin
  if p_trans_id is null or p_trans_id !~ '^[A-Z0-9]{8,20}$' then
    raise exception 'Invalid M-Pesa transaction id';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid amount'; end if;
  if s.paybill_number is not null and p_short_code is distinct from s.paybill_number then
    raise exception 'Short code % does not match the configured paybill', p_short_code;
  end if;

  insert into public.mpesa_transactions (trans_id, transaction_type, trans_time, amount, business_short_code,
    bill_ref_number, normalized_reference, msisdn_masked, msisdn_hash, payer_name, org_account_balance,
    environment, raw_payload)
  values (p_trans_id, p_trans_type, p_trans_time, p_amount, p_short_code, p_bill_ref,
          upper(regexp_replace(coalesce(p_bill_ref, ''), '[^A-Za-z0-9]', '', 'g')),
          p_msisdn_masked, p_msisdn_hash, p_payer_name, p_org_balance, p_environment, coalesce(p_raw, '{}'))
  on conflict (trans_id) do nothing
  returning id into tx_id;

  if tx_id is null then
    select payment_id_lookup.id into pay_id from public.payments payment_id_lookup
     join public.mpesa_transactions t on t.id = payment_id_lookup.mpesa_transaction_id where t.trans_id = p_trans_id;
    return jsonb_build_object('status', 'duplicate', 'payment_id', pay_id);
  end if;

  -- 1) account reference; 2) payer phone hash matching exactly one student.
  sid := private.find_student_by_reference(p_bill_ref);
  if sid is not null then
    method := 'account_reference';
  elsif p_msisdn_hash is not null then
    select min(st.id::text)::uuid into sid from public.students st
     where encode(extensions.digest(regexp_replace(st.phone, '[^0-9]', '', 'g'), 'sha256'), 'hex') = p_msisdn_hash
     having count(*) = 1;
    if sid is not null then method := 'phone'; end if;
  end if;
  if sid is not null then select home_location_id into loc from public.students where id = sid; end if;

  insert into public.payments (receipt_number, source, status, amount, received_at, student_id, location_id,
    mpesa_transaction_id, external_reference, payer_name, payer_phone_masked, matching_method, matched_at)
  values (case when sid is not null then private.next_document_number('receipt') end,
          'mpesa_c2b', case when sid is not null then 'confirmed' else 'unmatched' end::public.payment_status,
          p_amount, p_trans_time, sid, loc, tx_id, p_trans_id, p_payer_name, p_msisdn_masked,
          method, case when sid is not null then now() end)
  returning id into pay_id;

  perform private.post_receipt(pay_id, '1000');
  update public.mpesa_transactions set status = case when sid is not null then 'matched' else 'unmatched' end::public.mpesa_tx_status
   where id = tx_id;

  if sid is not null then
    perform private.after_payment_matched(pay_id);
  end if;
  return jsonb_build_object('status', case when sid is not null then 'matched' else 'unmatched' end,
                            'payment_id', pay_id, 'student_id', sid);
end $$;

-- Assign an unmatched payment to a student (finance only).
create or replace function public.match_payment(p_payment uuid, p_student uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare py public.payments%rowtype;
begin
  perform private.require(private.is_finance(), 'Only finance staff can reconcile payments');
  if coalesce(length(trim(p_note)), 0) < 3 then raise exception 'Add a short note explaining the match'; end if;
  select * into py from public.payments where id = p_payment for update;
  if py.status <> 'unmatched' then raise exception 'Only unmatched payments can be assigned'; end if;
  if not exists (select 1 from public.students where id = p_student and anonymized_at is null) then
    raise exception 'Student not found';
  end if;

  update public.payments
     set student_id = p_student, status = 'confirmed', matching_method = 'manual', matched_by = auth.uid(),
         matched_at = now(), receipt_number = private.next_document_number('receipt'),
         location_id = (select home_location_id from public.students where id = p_student),
         notes = concat_ws(E'\n', notes, 'Matched: ' || p_note)
   where id = p_payment;
  update public.mpesa_transactions set status = 'matched' where id = py.mpesa_transaction_id;
  -- Move the unapplied receipt from "unidentified" to the student in the sub-ledger.
  perform private.post_journal(private.today_ke(), 'Unmatched receipt assigned: ' || coalesce(py.external_reference, ''),
    'manual', p_payment, (select home_location_id from public.students where id = p_student),
    jsonb_build_array(
      jsonb_build_object('account', '2300', 'debit', py.amount, 'memo', 'Unidentified receipt'),
      jsonb_build_object('account', '2300', 'credit', py.amount, 'student_id', p_student, 'memo', 'Assigned to student')));
  perform private.write_audit('payment.matched', 'payments', p_payment::text,
    jsonb_build_object('student_id', null), jsonb_build_object('student_id', p_student, 'note', p_note));
  perform private.after_payment_matched(p_payment);
end $$;

-- Cash / bank payment entered by office staff. Finance-entered payments are
-- confirmed immediately; admin-entered ones wait for verification.
create or replace function public.record_manual_payment(
  p_student uuid, p_amount numeric, p_source public.payment_source, p_reference text,
  p_received_at timestamptz, p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare pay_id uuid; fin boolean := private.is_finance(); loc uuid;
begin
  perform private.require(fin or (private.has_role('admin') and private.can_access_student(p_student)),
    'You are not allowed to record payments for this student');
  if p_source not in ('cash', 'bank_transfer', 'other') then raise exception 'Use M-Pesa callbacks for M-Pesa payments'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if p_received_at > now() + interval '5 minutes' then raise exception 'Payment date cannot be in the future'; end if;
  if p_source = 'bank_transfer' and coalesce(trim(p_reference), '') = '' then
    raise exception 'A bank reference is required for bank transfers';
  end if;
  select home_location_id into loc from public.students where id = p_student;

  insert into public.payments (receipt_number, source, status, amount, received_at, student_id, location_id,
    external_reference, notes, matching_method, recorded_by, verified_by, verified_at, matched_at)
  values (case when fin then private.next_document_number('receipt') end, p_source,
          case when fin then 'confirmed' else 'pending_verification' end::public.payment_status,
          p_amount, p_received_at, p_student, loc, nullif(trim(p_reference), ''), p_notes, 'direct', auth.uid(),
          case when fin then auth.uid() end, case when fin then now() end, now())
  returning id into pay_id;

  if fin then
    perform private.post_receipt(pay_id, case p_source when 'cash' then '1010' else '1020' end);
    perform private.after_payment_matched(pay_id);
  end if;
  return pay_id;
end $$;

create or replace function public.verify_payment(p_payment uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare py public.payments%rowtype;
begin
  perform private.require(private.is_finance(), 'Only finance staff can verify payments');
  select * into py from public.payments where id = p_payment for update;
  if py.status <> 'pending_verification' then raise exception 'This payment is not awaiting verification'; end if;
  if py.recorded_by = auth.uid() then raise exception 'A payment must be verified by someone other than the person who recorded it'; end if;
  if p_approve then
    update public.payments set status = 'confirmed', verified_by = auth.uid(), verified_at = now(),
           receipt_number = private.next_document_number('receipt'),
           notes = concat_ws(E'\n', notes, nullif('Verified: ' || coalesce(p_note, ''), 'Verified: '))
     where id = p_payment;
    perform private.post_receipt(p_payment, case py.source when 'cash' then '1010' else '1020' end);
    perform private.after_payment_matched(p_payment);
  else
    if coalesce(length(trim(p_note)), 0) < 3 then raise exception 'Give a reason for rejecting the payment'; end if;
    update public.payments set status = 'rejected', verified_by = auth.uid(), verified_at = now(),
           notes = concat_ws(E'\n', notes, 'Rejected: ' || p_note)
     where id = p_payment;
  end if;
end $$;

-- Reverse every live allocation of a payment (returns funds to unapplied).
create or replace function private.reverse_payment_allocations(p_payment uuid, p_reason text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare a record; jl jsonb := '[]'::jsonb; je uuid; total numeric := 0; sid uuid; loc uuid;
begin
  select student_id, location_id into sid, loc from public.payments where id = p_payment;
  for a in
    select pa.*, il.component from public.payment_allocations pa
    join public.invoice_lines il on il.id = pa.invoice_line_id
    where pa.payment_id = p_payment and pa.amount > 0
      and not exists (select 1 from public.payment_allocations r where r.reversal_of = pa.id)
  loop
    jl := jl || jsonb_build_object('account', '1100', 'debit', a.amount, 'student_id', sid, 'component', a.component, 'memo', 'Allocation reversed')
             || jsonb_build_object('account', '2300', 'credit', a.amount, 'student_id', sid, 'component', a.component);
    if a.component = 'ntsa' then
      jl := jl || jsonb_build_object('account', '2100', 'debit', a.amount, 'student_id', sid, 'component', 'ntsa')
               || jsonb_build_object('account', '2105', 'credit', a.amount, 'student_id', sid, 'component', 'ntsa');
    elsif a.component = 'service_fee' then
      jl := jl || jsonb_build_object('account', '2200', 'debit', a.amount, 'student_id', sid, 'component', 'service_fee')
               || jsonb_build_object('account', '2205', 'credit', a.amount, 'student_id', sid, 'component', 'service_fee');
    end if;
    total := total + a.amount;
  end loop;
  if total = 0 then return 0; end if;
  je := private.post_journal(private.today_ke(), 'Allocation reversal: ' || p_reason, 'allocation_reversal', p_payment, loc, jl);
  insert into public.payment_allocations (payment_id, invoice_line_id, amount, reversal_of, reason, journal_entry_id, allocated_by)
  select pa.payment_id, pa.invoice_line_id, -pa.amount, pa.id, p_reason, je, auth.uid()
  from public.payment_allocations pa
  where pa.payment_id = p_payment and pa.amount > 0
    and not exists (select 1 from public.payment_allocations r where r.reversal_of = pa.id);
  return total;
end $$;

-- Move a confirmed payment to the correct student (wrong account number used).
create or replace function public.reassign_payment(p_payment uuid, p_student uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare py public.payments%rowtype; old_credit numeric;
begin
  perform private.require(private.is_finance(), 'Only finance staff can reassign payments');
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'A reason is required'; end if;
  select * into py from public.payments where id = p_payment for update;
  if py.status <> 'confirmed' then raise exception 'Only confirmed payments can be reassigned'; end if;
  if py.student_id = p_student then raise exception 'The payment already belongs to this student'; end if;
  perform 1 from public.students where id in (py.student_id, p_student) order by id for update;

  perform private.reverse_payment_allocations(p_payment, 'Reassigned: ' || p_reason);
  update public.payments set student_id = p_student, matching_method = 'manual', matched_by = auth.uid(), matched_at = now(),
         location_id = (select home_location_id from public.students where id = p_student),
         notes = concat_ws(E'\n', notes, 'Reassigned: ' || p_reason)
   where id = p_payment;
  -- Move the unapplied liability between students in the sub-ledger.
  perform private.post_journal(private.today_ke(), 'Payment reassigned: ' || p_reason, 'manual', p_payment, py.location_id,
    jsonb_build_array(
      jsonb_build_object('account', '2300', 'debit', py.amount, 'student_id', py.student_id, 'memo', 'Reassigned out'),
      jsonb_build_object('account', '2300', 'credit', py.amount, 'student_id', p_student, 'memo', 'Reassigned in')));

  select credit_balance into old_credit from public.v_student_credit where student_id = py.student_id;
  if old_credit < 0 then
    raise exception 'Cannot reassign: the original student has refunds that depend on this payment';
  end if;
  perform private.apply_student_credit(py.student_id);
  perform private.after_payment_matched(p_payment);
end $$;

-- Reverse a payment entirely (e.g. M-Pesa reversal by Safaricom, bounced bank transfer).
create or replace function public.reverse_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare py public.payments%rowtype; credit numeric;
begin
  perform private.require(private.is_finance(), 'Only finance staff can reverse payments');
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'A reason is required'; end if;
  select * into py from public.payments where id = p_payment for update;
  if py.status not in ('confirmed', 'unmatched') then raise exception 'This payment cannot be reversed'; end if;
  if py.student_id is not null then perform 1 from public.students where id = py.student_id for update; end if;

  perform private.reverse_payment_allocations(p_payment, p_reason);
  perform private.post_journal(private.today_ke(), 'Payment reversed: ' || p_reason, 'payment_reversal', p_payment, py.location_id,
    jsonb_build_array(
      jsonb_build_object('account', '2300', 'debit', py.amount, 'student_id', py.student_id),
      jsonb_build_object('account', case py.source when 'mpesa_c2b' then '1000' when 'cash' then '1010' else '1020' end,
                         'credit', py.amount, 'student_id', py.student_id)));
  update public.payments set status = 'reversed', reversed_by = auth.uid(), reversed_at = now(), reversal_reason = p_reason
   where id = p_payment;
  if py.mpesa_transaction_id is not null then
    update public.mpesa_transactions set status = 'rejected' where id = py.mpesa_transaction_id;
  end if;
  if py.student_id is not null then
    select credit_balance into credit from public.v_student_credit where student_id = py.student_id;
    if credit < 0 then raise exception 'Cannot reverse: refunds already committed exceed remaining credit'; end if;
    perform private.apply_student_credit(py.student_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Adjustments
-- -----------------------------------------------------------------------------
create or replace function public.create_adjustment(
  p_invoice_line uuid, p_type public.adjustment_type, p_amount numeric, p_reason text, p_instalment uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  lb public.v_invoice_line_balances%rowtype;
  il public.invoice_lines%rowtype;
  adj_id uuid; je uuid; tax_part numeric := 0; net_part numeric; acct text; jl jsonb; inst public.v_instalments%rowtype;
begin
  perform private.require(private.is_finance(), 'Only finance staff can post adjustments');
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  select * into il from public.invoice_lines where id = p_invoice_line;
  select * into lb from public.v_invoice_line_balances where invoice_line_id = p_invoice_line;
  if not found then raise exception 'Invoice line not found'; end if;
  perform 1 from public.students where id = lb.student_id for update;
  if p_type <> 'debit_note' and p_amount > lb.outstanding then
    raise exception 'Credit (%) exceeds the unpaid amount on this line (%). Reverse an allocation first.', p_amount, lb.outstanding;
  end if;

  if il.gross_amount > 0 and il.tax_amount > 0 then
    tax_part := round(p_amount * il.tax_amount / il.gross_amount, 2);
  end if;
  net_part := p_amount - tax_part;
  acct := case il.component when 'tuition' then '4000' when 'registration' then '4010'
                            when 'ntsa' then '2105' when 'service_fee' then '2205' else '4020' end;

  insert into public.financial_adjustments (adjustment_number, adjustment_type, student_id, invoice_line_id,
                                            instalment_id, amount, reason, created_by)
  values (private.next_document_number('adjustment'), p_type, lb.student_id, p_invoice_line, p_instalment,
          p_amount, p_reason, auth.uid())
  returning id into adj_id;

  if p_type = 'debit_note' then
    jl := jsonb_build_array(
      jsonb_build_object('account', '1100', 'debit', p_amount, 'student_id', lb.student_id, 'component', il.component),
      jsonb_build_object('account', acct, 'credit', net_part, 'student_id', lb.student_id, 'component', il.component),
      jsonb_build_object('account', '2400', 'credit', tax_part, 'student_id', lb.student_id, 'component', il.component));
  else
    jl := jsonb_build_array(
      jsonb_build_object('account', acct, 'debit', net_part, 'student_id', lb.student_id, 'component', il.component),
      jsonb_build_object('account', '2400', 'debit', tax_part, 'student_id', lb.student_id, 'component', il.component),
      jsonb_build_object('account', '1100', 'credit', p_amount, 'student_id', lb.student_id, 'component', il.component));
  end if;
  je := private.post_journal(private.today_ke(), initcap(replace(p_type::text, '_', ' ')) || ': ' || p_reason,
                             'adjustment', adj_id, lb.location_id, jl);

  if p_instalment is not null then
    select * into inst from public.v_instalments where id = p_instalment;
    if p_amount > inst.amount_outstanding then
      raise exception 'Waiver exceeds the outstanding amount of this instalment (%)', inst.amount_outstanding;
    end if;
    perform set_config('app.finance_context', 'on', true);
    update public.instalments set waived_amount = waived_amount + p_amount where id = p_instalment;
    perform set_config('app.finance_context', 'off', true);
  end if;

  if p_type = 'debit_note' then perform private.apply_student_credit(lb.student_id); end if;
  return adj_id;
end $$;

-- Waive (all or part of) an instalment; credit is taken from the tuition line.
create or replace function public.waive_instalment(p_instalment uuid, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare line_id uuid; enr uuid;
begin
  select pp.enrolment_id into enr from public.instalments i join public.payment_plans pp on pp.id = i.payment_plan_id
   where i.id = p_instalment;
  select lb.invoice_line_id into line_id from public.v_invoice_line_balances lb
   where lb.enrolment_id = enr and lb.invoice_kind = 'enrolment' and lb.outstanding >= p_amount
   order by (lb.component = 'tuition') desc, lb.outstanding desc limit 1;
  if line_id is null then raise exception 'No fee line has enough unpaid balance for this waiver'; end if;
  return public.create_adjustment(line_id, 'waiver', p_amount, p_reason, p_instalment);
end $$;

-- -----------------------------------------------------------------------------
-- Refunds (from student credit)
-- -----------------------------------------------------------------------------
create or replace function public.request_refund(p_student uuid, p_amount numeric, p_reason text, p_method text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare credit numeric; rid uuid;
begin
  perform private.require(private.is_office() and private.can_access_student(p_student), 'Not allowed');
  select credit_balance into credit from public.v_student_credit where student_id = p_student;
  if p_amount > coalesce(credit, 0) then
    raise exception 'Refund exceeds the student''s available credit (%)', private.fmt_kes(credit);
  end if;
  insert into public.refunds (refund_number, student_id, amount, reason, method, requested_by)
  values (private.next_document_number('refund'), p_student, p_amount, p_reason, p_method, auth.uid())
  returning id into rid;
  return rid;
end $$;

create or replace function public.decide_refund(p_refund uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.refunds%rowtype; credit numeric;
begin
  perform private.require(private.is_finance(), 'Only finance staff can approve refunds');
  select * into r from public.refunds where id = p_refund for update;
  if r.status <> 'requested' then raise exception 'Refund already decided'; end if;
  if r.requested_by = auth.uid() then raise exception 'Refunds must be approved by someone other than the requester'; end if;
  perform 1 from public.students where id = r.student_id for update;
  if p_approve then
    select credit_balance into credit from public.v_student_credit where student_id = r.student_id;
    if r.amount > credit then raise exception 'Student credit (%) is no longer sufficient', private.fmt_kes(credit); end if;
  end if;
  update public.refunds set status = case when p_approve then 'approved' else 'rejected' end::public.refund_status,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = p_refund;
end $$;

create or replace function public.mark_refund_paid(p_refund uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.refunds%rowtype; je uuid; loc uuid;
begin
  perform private.require(private.is_finance(), 'Only finance staff can pay refunds');
  select * into r from public.refunds where id = p_refund for update;
  if r.status <> 'approved' then raise exception 'Only approved refunds can be paid'; end if;
  if coalesce(trim(p_reference), '') = '' then raise exception 'Payout reference is required'; end if;
  select home_location_id into loc from public.students where id = r.student_id;
  je := private.post_journal(private.today_ke(), 'Refund ' || r.refund_number, 'refund', r.id, loc,
    jsonb_build_array(
      jsonb_build_object('account', '2300', 'debit', r.amount, 'student_id', r.student_id),
      jsonb_build_object('account', case r.method when 'mpesa' then '1000' when 'cash' then '1010' else '1020' end,
                         'credit', r.amount, 'student_id', r.student_id)));
  update public.refunds set status = 'paid', paid_at = now(), payout_reference = p_reference, journal_entry_id = je
   where id = p_refund;
end $$;

-- -----------------------------------------------------------------------------
-- Expenses
-- -----------------------------------------------------------------------------
create or replace function public.record_expense(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare eid uuid; je uuid; acct text; amt numeric := (p ->> 'amount')::numeric;
begin
  perform private.require(private.is_finance(), 'Only finance staff can record expenses');
  if amt is null or amt <= 0 then raise exception 'Amount must be greater than zero'; end if;
  select a.code into acct from public.expense_categories c join public.chart_of_accounts a on a.id = c.account_id
   where c.id = (p ->> 'category_id')::uuid;
  if acct is null then raise exception 'Choose an expense category'; end if;

  insert into public.expenses (expense_number, expense_date, category_id, location_id, vehicle_id, vendor, description,
                               amount, tax_amount, paid_from, reference, recorded_by)
  values (private.next_document_number('expense'), (p ->> 'expense_date')::date, (p ->> 'category_id')::uuid,
          nullif(p ->> 'location_id', '')::uuid, nullif(p ->> 'vehicle_id', '')::uuid, nullif(p ->> 'vendor', ''),
          p ->> 'description', amt, coalesce((p ->> 'tax_amount')::numeric, 0), coalesce(p ->> 'paid_from', '1000'),
          nullif(p ->> 'reference', ''), auth.uid())
  returning id into eid;

  je := private.post_journal((p ->> 'expense_date')::date, 'Expense: ' || (p ->> 'description'), 'expense', eid,
    nullif(p ->> 'location_id', '')::uuid,
    jsonb_build_array(jsonb_build_object('account', acct, 'debit', amt),
                      jsonb_build_object('account', coalesce(p ->> 'paid_from', '1000'), 'credit', amt)));
  return eid;
end $$;

-- -----------------------------------------------------------------------------
-- Developer settlements
-- -----------------------------------------------------------------------------
create or replace function public.create_developer_settlement(p_period_end date, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid; total numeric; cnt int;
begin
  perform private.require(private.is_finance(), 'Only finance staff can prepare settlements');
  if p_period_end > private.today_ke() then raise exception 'Period end cannot be in the future'; end if;
  insert into public.developer_settlements (settlement_number, period_end, amount, created_by, notes)
  values (private.next_document_number('settlement'), p_period_end, 0, auth.uid(), p_notes)
  returning id into sid;

  insert into public.developer_settlement_items (settlement_id, allocation_id, amount)
  select sid, l.allocation_id, l.amount from public.v_developer_fee_ledger l
  where l.settlement_id is null and l.collected_on <= p_period_end;

  select coalesce(sum(amount), 0), count(*) into total, cnt from public.developer_settlement_items where settlement_id = sid;
  if cnt = 0 then raise exception 'There are no unsettled service fees up to %', p_period_end; end if;
  update public.developer_settlements set amount = total, item_count = cnt where id = sid;
  return sid;
end $$;

create or replace function public.update_developer_settlement(
  p_settlement uuid, p_action text, p_reference text default null, p_method text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare d public.developer_settlements%rowtype; je uuid;
begin
  perform private.require(private.is_finance(), 'Only finance staff can update settlements');
  select * into d from public.developer_settlements where id = p_settlement for update;
  if p_action = 'approve' and d.status = 'draft' then
    update public.developer_settlements set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = d.id;
  elsif p_action = 'cancel' and d.status in ('draft', 'approved') then
    update public.developer_settlements set status = 'cancelled' where id = d.id;
  elsif p_action = 'pay' and d.status = 'approved' then
    if coalesce(trim(p_reference), '') = '' then raise exception 'Payout reference is required'; end if;
    je := private.post_journal(private.today_ke(), 'Developer fee settlement ' || d.settlement_number,
      'developer_settlement', d.id, null,
      jsonb_build_array(jsonb_build_object('account', '2200', 'debit', d.amount, 'component', 'service_fee'),
                        jsonb_build_object('account', case coalesce(p_method, 'bank_transfer') when 'mpesa' then '1000' else '1020' end,
                                           'credit', d.amount)));
    update public.developer_settlements set status = 'paid', paid_at = now(), payout_reference = p_reference,
           payout_method = coalesce(p_method, 'bank_transfer'), journal_entry_id = je where id = d.id;
  else
    raise exception 'Cannot % a settlement that is %', p_action, d.status;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Fiscal periods
-- -----------------------------------------------------------------------------
create or replace function public.close_fiscal_period(p_period uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require(private.is_finance(), 'Only finance staff can close periods');
  update public.fiscal_periods set status = 'closed', closed_by = auth.uid(), closed_at = now()
   where id = p_period and status = 'open';
  if not found then raise exception 'Period is already closed'; end if;
  perform private.write_audit('fiscal_period.close', 'fiscal_periods', p_period::text);
end $$;

grant execute on all functions in schema private to authenticated, service_role;
