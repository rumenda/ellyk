-- =============================================================================
-- Row Level Security for every table, API-column guards, storage buckets,
-- default notification templates, function grants.
-- =============================================================================

-- Reschedule requests raised by instructors.
create table public.session_change_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  reason text not null check (length(trim(reason)) >= 5),
  proposed_starts_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index session_change_requests_status_idx on public.session_change_requests (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Extra helpers
-- -----------------------------------------------------------------------------
-- Finance-sensitive student data: finance, the student, or admins scoped to them (never instructors).
create or replace function private.can_access_student_finance(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_finance()
      or p_student = private.current_student_id()
      or (private.has_role('admin') and private.can_access_student(p_student))
$$;

create or replace function private.can_access_enrolment(p_enrolment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrolments e where e.id = p_enrolment and private.can_access_student(e.student_id))
$$;

create or replace function private.can_access_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.training_sessions s where s.id = p_session and (
      private.is_manager()
      or s.instructor_id = private.current_instructor_id()
      or (private.has_any_role(array['admin', 'accountant']::public.app_role[]) and private.can_access_location(s.location_id))
      or exists (select 1 from public.session_bookings b where b.session_id = s.id and b.student_id = private.current_student_id())
    ))
$$;

-- Students may read the profile of instructors teaching them.
create or replace function private.student_can_see_profile(p_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.instructors i
    where i.user_id = p_profile and (
      exists (select 1 from public.enrolments e where e.assigned_instructor_id = i.id and e.student_id = private.current_student_id())
      or exists (select 1 from public.training_sessions s join public.session_bookings b on b.session_id = s.id
                 where s.instructor_id = i.id and b.student_id = private.current_student_id())
    ))
$$;

create or replace function private.student_booked_on(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.session_bookings b
                 where b.session_id = p_session and b.student_id = private.current_student_id())
$$;

create or replace function private.can_schedule_session(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.training_sessions s where s.id = p_session
    and (private.is_manager() or (private.has_role('admin') and private.can_access_location(s.location_id))))
$$;

create or replace function private.is_api_user()
returns boolean language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

-- Columns listed in TG_ARGV can only be changed by trusted (SECURITY DEFINER) code.
create or replace function private.guard_api_columns()
returns trigger language plpgsql as $$
declare col text;
begin
  if not private.is_api_user() then return new; end if;
  foreach col in array tg_argv loop
    if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
      raise exception using errcode = '42501',
        message = format('"%s" can only be changed through the proper workflow', replace(col, '_', ' '));
    end if;
  end loop;
  return new;
end $$;

create trigger enrolments_guard before update on public.enrolments for each row
  execute function private.guard_api_columns('status', 'student_id', 'course_id', 'price_version_id', 'enrolment_number',
                                              'certificate_number', 'activated_at', 'completed_at');
create trigger students_guard before update on public.students for each row
  execute function private.guard_api_columns('student_number', 'user_id', 'activation_code_hash', 'anonymized_at', 'registered_at');
create trigger ntsa_processes_guard before update on public.ntsa_processes for each row
  execute function private.guard_api_columns('status', 'enrolment_id', 'student_id', 'ntsa_amount', 'booking_reference',
                                              'test_date', 'status_changed_at');
create trigger invoices_guard before update on public.invoices for each row
  execute function private.guard_api_columns('invoice_number', 'student_id', 'enrolment_id', 'subtotal', 'tax_total', 'total',
                                              'journal_entry_id', 'kind', 'issue_date');
create trigger refunds_guard before update on public.refunds for each row
  execute function private.guard_api_columns('status', 'amount', 'student_id', 'journal_entry_id', 'decided_by');
create trigger settlements_guard before update on public.developer_settlements for each row
  execute function private.guard_api_columns('status', 'amount', 'item_count', 'journal_entry_id');
create trigger fiscal_periods_guard before update on public.fiscal_periods for each row
  execute function private.guard_api_columns('status', 'closed_by', 'closed_at', 'starts_on', 'ends_on');
create trigger profiles_guard before update on public.profiles for each row
  execute function private.guard_api_columns('id');

-- (Instructors may only change status/notes on their own sessions.)
create or replace function private.guard_session_instructor_update()
returns trigger language plpgsql as $$
begin
  if private.is_api_user() and not (private.is_manager() or private.has_role('admin')) then
    if (new.starts_at, new.ends_at, new.instructor_id, new.location_id, new.capacity, new.lesson_type)
       is distinct from (old.starts_at, old.ends_at, old.instructor_id, old.location_id, old.capacity, old.lesson_type) then
      raise exception using errcode = '42501', message = 'Instructors can only update the status and notes of their sessions';
    end if;
    if new.status not in ('confirmed', 'in_progress', 'completed', 'missed') then
      raise exception using errcode = '42501', message = 'Instructors cannot cancel or reschedule sessions; submit a reschedule request';
    end if;
  end if;
  return new;
end $$;

create trigger training_sessions_instructor_guard before update on public.training_sessions for each row
  when (pg_trigger_depth() = 0)
  execute function private.guard_session_instructor_update();

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Profiles: students see their instructors
create policy profiles_student_instructor on public.profiles for select to authenticated
  using ((select private.current_student_id()) is not null and private.student_can_see_profile(id));

-- Catalogue ------------------------------------------------------------------
create policy licence_classes_read on public.licence_classes for select to authenticated using (true);
create policy licence_classes_manage on public.licence_classes for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy courses_read on public.courses for select to authenticated using (true);
create policy courses_manage on public.courses for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy course_locations_read on public.course_locations for select to authenticated using (true);
create policy course_locations_manage on public.course_locations for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy price_versions_read on public.course_price_versions for select to authenticated using (true);
create policy price_versions_manage on public.course_price_versions for all to authenticated
  using ((select private.is_finance())) with check ((select private.is_finance()));
create policy price_items_read on public.course_price_items for select to authenticated using (true);
create policy price_items_manage on public.course_price_items for all to authenticated
  using ((select private.is_finance())) with check ((select private.is_finance()));

-- Instructors ----------------------------------------------------------------
create policy instructors_read on public.instructors for select to authenticated
  using ((select private.is_staff()) or ((select private.current_student_id()) is not null and private.student_can_see_profile(user_id)));
create policy instructors_manage on public.instructors for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy instructor_locations_read on public.instructor_locations for select to authenticated using ((select private.is_staff()));
create policy instructor_locations_manage on public.instructor_locations for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));

create policy instructor_certs_read on public.instructor_certifications for select to authenticated
  using ((select private.is_office()) or instructor_id = (select private.current_instructor_id()));
create policy instructor_certs_manage on public.instructor_certifications for all to authenticated
  using ((select private.is_manager()) or (select private.has_role('admin')))
  with check ((select private.is_manager()) or (select private.has_role('admin')));

create policy instructor_availability_read on public.instructor_availability for select to authenticated using ((select private.is_staff()));
create policy instructor_availability_manage on public.instructor_availability for all to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id))
         or instructor_id = (select private.current_instructor_id()))
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id))
         or instructor_id = (select private.current_instructor_id()));

create policy instructor_time_off_read on public.instructor_time_off for select to authenticated using ((select private.is_staff()));
create policy instructor_time_off_insert on public.instructor_time_off for insert to authenticated
  with check ((select private.is_manager()) or (select private.has_role('admin'))
              or (instructor_id = (select private.current_instructor_id()) and status = 'pending'));
create policy instructor_time_off_manage on public.instructor_time_off for update to authenticated
  using ((select private.is_manager()) or (select private.has_role('admin')))
  with check ((select private.is_manager()) or (select private.has_role('admin')));

-- CRM --------------------------------------------------------------------------
create policy leads_access on public.leads for all to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin'))
         and (preferred_location_id is null or private.can_access_location(preferred_location_id))))
  with check ((select private.is_manager()) or ((select private.has_role('admin'))
         and (preferred_location_id is null or private.can_access_location(preferred_location_id))));
create policy lead_activities_read on public.lead_activities for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check (created_by = (select auth.uid()) and exists (select 1 from public.leads l where l.id = lead_id));

-- Students ---------------------------------------------------------------------
create policy students_read on public.students for select to authenticated using (private.can_access_student(id));
create policy students_update on public.students for update to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_student(id)))
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(home_location_id)));

create policy student_identities_read on public.student_identities for select to authenticated
  using (student_id = (select private.current_student_id()));
create policy student_identities_write on public.student_identities for all to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_student(student_id)))
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_student(student_id)));

create policy student_consents_read on public.student_consents for select to authenticated
  using ((select private.is_office()) and private.can_access_student(student_id) or student_id = (select private.current_student_id()));
create policy student_consents_insert on public.student_consents for insert to authenticated
  with check (((select private.is_office()) and private.can_access_student(student_id)) or student_id = (select private.current_student_id()));

create policy student_documents_read on public.student_documents for select to authenticated
  using (((select private.is_office()) and private.can_access_student(student_id)) or student_id = (select private.current_student_id()));
create policy student_documents_insert on public.student_documents for insert to authenticated
  with check (status = 'pending' and uploaded_by = (select auth.uid()) and (
    ((select private.has_any_role(array['manager', 'admin']::public.app_role[])) and private.can_access_student(student_id))
    or student_id = (select private.current_student_id())));
create policy student_documents_verify on public.student_documents for update to authenticated
  using ((select private.has_any_role(array['manager', 'admin']::public.app_role[])) and private.can_access_student(student_id))
  with check ((select private.has_any_role(array['manager', 'admin']::public.app_role[])) and private.can_access_student(student_id));
create policy student_documents_delete on public.student_documents for delete to authenticated
  using ((select private.is_manager()) or (student_id = (select private.current_student_id()) and status = 'pending'));

-- Enrolments -------------------------------------------------------------------
create policy enrolments_read on public.enrolments for select to authenticated using (private.can_access_student(student_id));
create policy enrolments_update on public.enrolments for update to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id)))
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id)));

create policy agreements_read on public.student_course_agreements for select to authenticated
  using (exists (select 1 from public.enrolments e where e.id = enrolment_id and private.can_access_student_finance(e.student_id)));
create policy payment_plans_read on public.payment_plans for select to authenticated
  using (exists (select 1 from public.enrolments e where e.id = enrolment_id and private.can_access_student_finance(e.student_id)));
create policy instalments_read on public.instalments for select to authenticated
  using (exists (select 1 from public.payment_plans pp join public.enrolments e on e.id = pp.enrolment_id
                 where pp.id = payment_plan_id and private.can_access_student_finance(e.student_id)));

-- Finance ----------------------------------------------------------------------
create policy coa_read on public.chart_of_accounts for select to authenticated using ((select private.is_finance()));
create policy coa_manage on public.chart_of_accounts for insert to authenticated
  with check ((select private.is_finance()) and not is_system);
create policy coa_update on public.chart_of_accounts for update to authenticated
  using ((select private.is_finance()) and not is_system) with check ((select private.is_finance()) and not is_system);

create policy fiscal_periods_read on public.fiscal_periods for select to authenticated using ((select private.is_finance()));
create policy fiscal_periods_insert on public.fiscal_periods for insert to authenticated
  with check ((select private.is_finance()) and status = 'open');

create policy journal_entries_read on public.journal_entries for select to authenticated using ((select private.is_finance()));
create policy journal_lines_read on public.journal_lines for select to authenticated using ((select private.is_finance()));

create policy invoices_read on public.invoices for select to authenticated using (private.can_access_student_finance(student_id));
create policy invoice_lines_read on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and private.can_access_student_finance(i.student_id)));
create policy etims_read on public.etims_submissions for select to authenticated using ((select private.is_finance()));

create policy payments_read on public.payments for select to authenticated
  using ((select private.is_finance()) or (student_id is not null and private.can_access_student_finance(student_id)));
create policy payment_allocations_read on public.payment_allocations for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id
                 and ((select private.is_finance()) or (p.student_id is not null and private.can_access_student_finance(p.student_id)))));

create policy mpesa_transactions_read on public.mpesa_transactions for select to authenticated using ((select private.is_finance()));
create policy mpesa_webhook_logs_read on public.mpesa_webhook_logs for select to authenticated
  using ((select private.has_any_role(array['manager', 'accountant', 'platform_owner']::public.app_role[])));

create policy adjustments_read on public.financial_adjustments for select to authenticated
  using (private.can_access_student_finance(student_id));
create policy refunds_read on public.refunds for select to authenticated using (private.can_access_student_finance(student_id));

create policy expense_categories_read on public.expense_categories for select to authenticated using ((select private.is_office()));
create policy expense_categories_manage on public.expense_categories for all to authenticated
  using ((select private.is_finance())) with check ((select private.is_finance()));
create policy expenses_read on public.expenses for select to authenticated using ((select private.is_finance()));

create policy dev_settlements_read on public.developer_settlements for select to authenticated
  using ((select private.has_any_role(array['manager', 'accountant', 'platform_owner']::public.app_role[])));
create policy dev_settlement_items_read on public.developer_settlement_items for select to authenticated
  using ((select private.has_any_role(array['manager', 'accountant', 'platform_owner']::public.app_role[])));

-- NTSA -------------------------------------------------------------------------
create policy ntsa_processes_read on public.ntsa_processes for select to authenticated using (private.can_access_student(student_id));
create policy ntsa_processes_update on public.ntsa_processes for update to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_student(student_id)))
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_student(student_id)));
create policy ntsa_events_read on public.ntsa_process_events for select to authenticated
  using (exists (select 1 from public.ntsa_processes np where np.id = process_id and private.can_access_student(np.student_id)));
create policy ntsa_payments_read on public.ntsa_payments for select to authenticated
  using (exists (select 1 from public.ntsa_processes np where np.id = process_id and private.can_access_student_finance(np.student_id)));
create policy ntsa_attempts_read on public.ntsa_test_attempts for select to authenticated
  using (exists (select 1 from public.ntsa_processes np where np.id = process_id and private.can_access_student(np.student_id)));

-- Fleet ------------------------------------------------------------------------
create policy vehicles_read on public.vehicles for select to authenticated using ((select private.is_staff()));
create policy vehicles_manage on public.vehicles for all to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id)))
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id)));
create policy maintenance_read on public.vehicle_maintenance for select to authenticated using ((select private.is_staff()));
create policy maintenance_write on public.vehicle_maintenance for insert to authenticated
  with check ((select private.has_any_role(array['manager', 'admin']::public.app_role[])) and recorded_by = (select auth.uid()));
create policy fuel_read on public.fuel_logs for select to authenticated using ((select private.is_staff()));
create policy fuel_write on public.fuel_logs for insert to authenticated
  with check ((select private.is_staff()) and recorded_by = (select auth.uid()));
create policy incidents_read on public.vehicle_incidents for select to authenticated
  using ((select private.is_office()) or reported_by = (select auth.uid()));
create policy incidents_insert on public.vehicle_incidents for insert to authenticated
  with check ((select private.is_staff()) and reported_by = (select auth.uid()));
create policy incidents_update on public.vehicle_incidents for update to authenticated
  using ((select private.has_any_role(array['manager', 'admin']::public.app_role[])))
  with check ((select private.has_any_role(array['manager', 'admin']::public.app_role[])));

-- Training ---------------------------------------------------------------------
create policy sessions_read on public.training_sessions for select to authenticated
  using ((select private.is_manager()) or instructor_id = (select private.current_instructor_id())
         or ((select private.has_any_role(array['admin', 'accountant']::public.app_role[])) and private.can_access_location(location_id))
         or private.student_booked_on(id));
create policy sessions_insert on public.training_sessions for insert to authenticated
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id)));
create policy sessions_update on public.training_sessions for update to authenticated
  using ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id))
         or instructor_id = (select private.current_instructor_id()))
  with check ((select private.is_manager()) or ((select private.has_role('admin')) and private.can_access_location(location_id))
         or instructor_id = (select private.current_instructor_id()));

create policy bookings_read on public.session_bookings for select to authenticated
  using (student_id = (select private.current_student_id()) or private.can_access_session(session_id));
create policy bookings_write on public.session_bookings for insert to authenticated
  with check (booked_by = (select auth.uid()) and private.can_schedule_session(session_id));
create policy bookings_update on public.session_bookings for update to authenticated
  using (private.can_schedule_session(session_id)) with check (private.can_schedule_session(session_id));

create policy change_requests_read on public.session_change_requests for select to authenticated
  using (requested_by = (select auth.uid()) or (select private.has_any_role(array['manager', 'admin']::public.app_role[])));
create policy change_requests_insert on public.session_change_requests for insert to authenticated
  with check (requested_by = (select auth.uid()) and status = 'pending' and private.can_manage_session(session_id));
create policy change_requests_decide on public.session_change_requests for update to authenticated
  using ((select private.has_any_role(array['manager', 'admin']::public.app_role[])))
  with check ((select private.has_any_role(array['manager', 'admin']::public.app_role[])));

create policy attendance_read on public.attendance for select to authenticated
  using (private.can_access_student(student_id) or private.can_manage_session(session_id));

create policy competencies_read on public.competencies for select to authenticated using (true);
create policy competencies_manage on public.competencies for all to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy assessments_read on public.competency_assessments for select to authenticated using (private.can_access_student(student_id));

-- Notifications ----------------------------------------------------------------
create policy templates_read on public.notification_templates for select to authenticated using ((select private.is_office()));
create policy templates_manage on public.notification_templates for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy deliveries_read on public.notification_deliveries for select to authenticated
  using ((select private.has_any_role(array['manager', 'platform_owner']::public.app_role[])));
create policy prefs_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy announcements_read on public.announcements for select to authenticated
  using (published_at <= now() and (expires_at is null or expires_at > now())
         and (audience = 'everyone' or (audience = 'students' and ((select private.current_student_id()) is not null or (select private.is_staff())))
              or (audience = 'staff' and (select private.is_staff()))));
create policy announcements_manage on public.announcements for all to authenticated
  using ((select private.has_any_role(array['manager', 'admin']::public.app_role[])))
  with check ((select private.has_any_role(array['manager', 'admin']::public.app_role[])));

-- -----------------------------------------------------------------------------
-- Notifications: block notification content edits (only read_at may change)
-- -----------------------------------------------------------------------------
create trigger notifications_guard before update on public.notifications for each row
  execute function private.guard_api_columns('user_id', 'title', 'body', 'link', 'template_key', 'student_id', 'dedupe_key');

-- -----------------------------------------------------------------------------
-- Function grants: nothing is callable by anon; service-only functions are
-- revoked from authenticated.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.rate_limit_hit(text, integer, integer) from authenticated;
revoke execute on function public.verify_student_activation(text, text, text) from authenticated;
revoke execute on function public.link_student_account(uuid, uuid) from authenticated;
revoke execute on function public.resolve_login_email(text) from authenticated;
revoke execute on function public.mpesa_validate_c2b(text, numeric, text) from authenticated;
revoke execute on function public.mpesa_record_confirmation(text, text, timestamptz, numeric, text, text, text, text, text, numeric, text, jsonb) from authenticated;
revoke execute on function public.run_scheduled_notifications() from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Views: nobody anonymous
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Storage: private buckets, served only through short-lived signed URLs
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('student-documents', 'student-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('staff-documents', 'staff-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('finance-documents', 'finance-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- student-documents/<student_id>/<uuid>.<ext>
create policy student_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'student-documents' and (
    ((select private.is_office()) and private.can_access_student(((storage.foldername(name))[1])::uuid))
    or ((storage.foldername(name))[1])::uuid = (select private.current_student_id())));
create policy student_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'student-documents' and (
    ((select private.has_any_role(array['manager', 'admin']::public.app_role[])) and private.can_access_student(((storage.foldername(name))[1])::uuid))
    or ((storage.foldername(name))[1])::uuid = (select private.current_student_id())));
create policy student_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'student-documents' and (select private.is_manager()));

create policy staff_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'staff-documents' and (select private.is_office()));
create policy staff_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-documents' and (select private.has_any_role(array['manager', 'admin']::public.app_role[])));

create policy finance_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'finance-documents' and (select private.is_finance()));
create policy finance_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'finance-documents' and (select private.is_finance()));

-- -----------------------------------------------------------------------------
-- Default notification templates (editable in Settings → Notifications)
-- -----------------------------------------------------------------------------
insert into public.notification_templates (key, channel, title, body, description) values
  ('enrolment_accepted', 'in_app', 'Welcome to Elly K!', 'Your fee plan is confirmed. Total {{total}}, deposit {{deposit}}. Pay via M-Pesa Paybill using account {{student_number}}.', 'Sent when a student accepts their fee agreement'),
  ('enrolment_accepted', 'sms', 'Welcome', 'Elly K: Hi {{first_name}}, your plan is confirmed. Total {{total}}, deposit {{deposit}}. Paybill account: {{student_number}}.', null),
  ('enrolment_activated', 'in_app', 'Your training is unlocked', 'Deposit received – your {{course}} course is now active. Your lessons will appear in Schedule.', 'Sent when the deposit is covered'),
  ('payment_received', 'in_app', 'Payment received', 'We received {{amount}} (receipt {{receipt_number}}). Remaining balance: {{balance}}.', 'Sent when a payment is matched'),
  ('payment_received', 'sms', 'Payment received', 'Elly K: {{amount}} received, receipt {{receipt_number}}. Balance {{balance}}. Thank you!', null),
  ('payment_received', 'push', 'Payment received', '{{amount}} received. Balance {{balance}}.', null),
  ('payment_due', 'in_app', 'Payment due soon', 'Your instalment of {{amount}} is due on {{due_date}}.', 'Reminder before an instalment is due'),
  ('payment_due', 'sms', 'Payment due', 'Elly K: Hi {{first_name}}, your instalment of {{amount}} is due on {{due_date}}. No interest is charged.', null),
  ('payment_overdue', 'in_app', 'Payment overdue', 'Your instalment of {{amount}} was due on {{due_date}}. Please pay to keep your training on track.', 'Weekly reminder for overdue instalments'),
  ('payment_overdue', 'sms', 'Payment overdue', 'Elly K: {{amount}} was due on {{due_date}}. Please pay via Paybill to continue training.', null),
  ('lesson_booked', 'in_app', 'Lesson booked', '{{lesson}} on {{when}} at {{location}}.', 'Sent when a student is booked on a session'),
  ('lesson_reminder', 'in_app', 'Lesson tomorrow', 'Reminder: {{lesson}} on {{when}} at {{location}}. Bring your helmet and ID.', 'Sent 24h before a lesson'),
  ('lesson_reminder', 'sms', 'Lesson reminder', 'Elly K: {{lesson}} on {{when}} at {{location}}. See you there!', null),
  ('lesson_reminder', 'push', 'Lesson reminder', '{{lesson}} · {{when}}', null),
  ('lesson_missed', 'in_app', 'You missed a lesson', 'You were marked absent for {{lesson}} on {{when}}. Contact the office to reschedule.', 'Sent when marked absent'),
  ('ntsa_booked', 'in_app', 'NTSA test booked', 'Your NTSA test has been booked (ref {{reference}}). We will confirm the date and centre.', null),
  ('test_scheduled', 'in_app', 'Test date confirmed', 'Your NTSA test is on {{when}} at {{centre}}.', null),
  ('test_scheduled', 'sms', 'Test date', 'Elly K: Your NTSA test is on {{when}} at {{centre}}. Good luck!', null),
  ('test_reminder', 'in_app', 'Test in 2 days', 'Your NTSA test is on {{when}} at {{centre}}. Carry your ID and provisional licence.', null),
  ('test_result', 'in_app', 'Test result', 'Your NTSA test (attempt {{attempt}}): {{result}}', null),
  ('course_completed', 'in_app', 'Course completed 🎉', 'Congratulations! You have completed {{course}}. Certificate {{certificate}}.', null),
  ('announcement', 'in_app', '{{title}}', '{{body}}', 'School announcements')
on conflict do nothing;
