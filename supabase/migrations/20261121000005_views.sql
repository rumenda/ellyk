-- =============================================================================
-- Derived views. Every balance in the application is computed here from
-- invoice lines, adjustments, allocations, refunds and journal lines.
-- All views use security_invoker so the caller's RLS applies.
-- =============================================================================

alter table public.invoices add column kind text not null default 'enrolment'
  check (kind in ('enrolment', 'additional'));

-- -----------------------------------------------------------------------------
-- Invoice line balances
-- -----------------------------------------------------------------------------
create view public.v_invoice_line_balances with (security_invoker = true) as
select
  il.id as invoice_line_id,
  il.invoice_id,
  i.invoice_number,
  i.kind as invoice_kind,
  i.issue_date,
  i.student_id,
  i.enrolment_id,
  i.location_id,
  il.component,
  il.description,
  il.sort_order,
  il.gross_amount,
  il.tax_amount,
  coalesce(adj.debits, 0)::numeric(12, 2) as debits,
  coalesce(adj.credits, 0)::numeric(12, 2) as credits,
  (il.gross_amount + coalesce(adj.debits, 0) - coalesce(adj.credits, 0))::numeric(12, 2) as amount_due,
  coalesce(al.allocated, 0)::numeric(12, 2) as allocated,
  (il.gross_amount + coalesce(adj.debits, 0) - coalesce(adj.credits, 0) - coalesce(al.allocated, 0))::numeric(12, 2) as outstanding
from public.invoice_lines il
join public.invoices i on i.id = il.invoice_id
left join lateral (
  select sum(fa.amount) filter (where fa.adjustment_type = 'debit_note') as debits,
         sum(fa.amount) filter (where fa.adjustment_type <> 'debit_note') as credits
  from public.financial_adjustments fa where fa.invoice_line_id = il.id
) adj on true
left join lateral (
  select sum(pa.amount) as allocated from public.payment_allocations pa where pa.invoice_line_id = il.id
) al on true;

-- -----------------------------------------------------------------------------
-- Enrolment balances (by component) + payment gates
-- -----------------------------------------------------------------------------
create view public.v_enrolment_balances with (security_invoker = true) as
with lines as (
  select * from public.v_invoice_line_balances where enrolment_id is not null
)
select
  e.id as enrolment_id,
  e.enrolment_number,
  e.student_id,
  e.location_id,
  e.course_id,
  e.status,
  coalesce(sum(l.amount_due), 0)::numeric(12, 2) as total_due,
  coalesce(sum(l.allocated), 0)::numeric(12, 2) as total_paid,
  coalesce(sum(l.outstanding), 0)::numeric(12, 2) as total_outstanding,
  coalesce(sum(l.amount_due) filter (where l.invoice_kind = 'enrolment'), 0)::numeric(12, 2) as plan_due,
  coalesce(sum(l.allocated) filter (where l.invoice_kind = 'enrolment'), 0)::numeric(12, 2) as plan_paid,
  coalesce(sum(l.amount_due) filter (where l.component = 'tuition'), 0)::numeric(12, 2) as tuition_due,
  coalesce(sum(l.allocated) filter (where l.component = 'tuition'), 0)::numeric(12, 2) as tuition_paid,
  coalesce(sum(l.amount_due) filter (where l.component = 'registration'), 0)::numeric(12, 2) as registration_due,
  coalesce(sum(l.allocated) filter (where l.component = 'registration'), 0)::numeric(12, 2) as registration_paid,
  coalesce(sum(l.amount_due) filter (where l.component = 'ntsa'), 0)::numeric(12, 2) as ntsa_due,
  coalesce(sum(l.allocated) filter (where l.component = 'ntsa'), 0)::numeric(12, 2) as ntsa_paid,
  coalesce(sum(l.amount_due) filter (where l.component = 'service_fee'), 0)::numeric(12, 2) as service_fee_due,
  coalesce(sum(l.allocated) filter (where l.component = 'service_fee'), 0)::numeric(12, 2) as service_fee_paid,
  coalesce(sum(l.amount_due) filter (where l.component = 'other'), 0)::numeric(12, 2) as other_due,
  coalesce(sum(l.allocated) filter (where l.component = 'other'), 0)::numeric(12, 2) as other_paid,
  a.deposit_amount,
  pv.min_paid_before_training,
  pv.min_paid_before_ntsa,
  (coalesce(sum(l.allocated) filter (where l.invoice_kind = 'enrolment'), 0) >= coalesce(pv.min_paid_before_training, 0)) as training_gate_met,
  (coalesce(sum(l.allocated) filter (where l.invoice_kind = 'enrolment'), 0) >= coalesce(pv.min_paid_before_ntsa, 0)) as ntsa_gate_met
from public.enrolments e
join public.course_price_versions pv on pv.id = e.price_version_id
left join public.student_course_agreements a on a.enrolment_id = e.id
left join lines l on l.enrolment_id = e.id
group by e.id, a.deposit_amount, pv.min_paid_before_training, pv.min_paid_before_ntsa;

-- -----------------------------------------------------------------------------
-- Instalment statuses, derived by filling instalments in order with plan_paid
-- -----------------------------------------------------------------------------
create view public.v_instalments with (security_invoker = true) as
with base as (
  select
    i.*,
    pp.enrolment_id,
    (i.amount - i.waived_amount)::numeric(12, 2) as effective_amount,
    coalesce(sum(i.amount - i.waived_amount) over (
      partition by i.payment_plan_id order by i.sequence
      rows between unbounded preceding and 1 preceding), 0) as cum_before,
    coalesce(eb.plan_paid, 0) as plan_paid
  from public.instalments i
  join public.payment_plans pp on pp.id = i.payment_plan_id and pp.status = 'active'
  left join public.v_enrolment_balances eb on eb.enrolment_id = pp.enrolment_id
), calc as (
  select b.*,
    greatest(0, least(b.effective_amount, b.plan_paid - b.cum_before))::numeric(12, 2) as amount_paid
  from base b
)
select
  c.id, c.payment_plan_id, c.enrolment_id, c.sequence, c.label, c.due_date,
  c.amount, c.waived_amount, c.effective_amount, c.amount_paid,
  (c.effective_amount - c.amount_paid)::numeric(12, 2) as amount_outstanding,
  case
    when c.waived_amount >= c.amount then 'waived'
    when c.amount_paid >= c.effective_amount and c.waived_amount > 0 then 'adjusted'
    when c.amount_paid >= c.effective_amount then 'paid'
    when c.due_date < private.today_ke() then 'overdue'
    when c.amount_paid > 0 then 'partially_paid'
    when c.due_date <= private.today_ke() + 3 then 'due'
    else 'upcoming'
  end as status
from calc c;

-- -----------------------------------------------------------------------------
-- Payment remaining (unallocated) and student credit
-- -----------------------------------------------------------------------------
create view public.v_payment_balances with (security_invoker = true) as
select
  p.id as payment_id,
  p.student_id,
  p.status,
  p.amount,
  coalesce(sum(pa.amount), 0)::numeric(12, 2) as allocated,
  (p.amount - coalesce(sum(pa.amount), 0))::numeric(12, 2) as unallocated
from public.payments p
left join public.payment_allocations pa on pa.payment_id = p.id
group by p.id;

create view public.v_student_credit with (security_invoker = true) as
select
  s.id as student_id,
  coalesce(pb.unallocated, 0)::numeric(12, 2) as unallocated_receipts,
  coalesce(r.refunded, 0)::numeric(12, 2) as refunds_committed,
  (coalesce(pb.unallocated, 0) - coalesce(r.refunded, 0))::numeric(12, 2) as credit_balance
from public.students s
left join lateral (
  select sum(unallocated) as unallocated from public.v_payment_balances
  where student_id = s.id and status = 'confirmed'
) pb on true
left join lateral (
  select sum(amount) as refunded from public.refunds
  where student_id = s.id and status in ('approved', 'paid')
) r on true;

-- -----------------------------------------------------------------------------
-- Student balance summary (all enrolments)
-- -----------------------------------------------------------------------------
create view public.v_student_balances with (security_invoker = true) as
select
  s.id as student_id,
  s.student_number,
  s.home_location_id,
  coalesce(sum(eb.total_due), 0)::numeric(12, 2) as total_due,
  coalesce(sum(eb.total_paid), 0)::numeric(12, 2) as total_paid,
  coalesce(sum(eb.total_outstanding), 0)::numeric(12, 2) as total_outstanding,
  coalesce(max(sc.credit_balance), 0)::numeric(12, 2) as credit_balance
from public.students s
left join public.v_enrolment_balances eb on eb.student_id = s.id
left join public.v_student_credit sc on sc.student_id = s.id
group by s.id;

-- -----------------------------------------------------------------------------
-- NTSA funds per process
-- -----------------------------------------------------------------------------
create view public.v_ntsa_funds with (security_invoker = true) as
select
  np.id as process_id,
  np.enrolment_id,
  np.student_id,
  np.status,
  np.ntsa_amount,
  coalesce(eb.ntsa_due, 0)::numeric(12, 2) as ntsa_billed,
  coalesce(eb.ntsa_paid, 0)::numeric(12, 2) as ntsa_collected,
  coalesce(rem.remitted, 0)::numeric(12, 2) as ntsa_remitted,
  (coalesce(eb.ntsa_paid, 0) - coalesce(rem.remitted, 0))::numeric(12, 2) as ntsa_held,
  (coalesce(eb.ntsa_due, 0) - coalesce(eb.ntsa_paid, 0))::numeric(12, 2) as ntsa_uncollected
from public.ntsa_processes np
left join public.v_enrolment_balances eb on eb.enrolment_id = np.enrolment_id
left join lateral (
  select sum(amount) as remitted from public.ntsa_payments where process_id = np.id
) rem on true;

-- -----------------------------------------------------------------------------
-- Developer service-fee ledger (one row per service-fee allocation)
-- -----------------------------------------------------------------------------
create view public.v_developer_fee_ledger with (security_invoker = true) as
select
  pa.id as allocation_id,
  pa.payment_id,
  p.receipt_number,
  pa.amount,
  pa.allocated_at,
  (pa.allocated_at at time zone 'Africa/Nairobi')::date as collected_on,
  pa.reversal_of is not null or pa.amount < 0 as is_reversal,
  i.student_id,
  i.enrolment_id,
  i.location_id,
  e.course_id,
  st.settlement_id,
  ds.settlement_number,
  ds.status as settlement_status
from public.payment_allocations pa
join public.invoice_lines il on il.id = pa.invoice_line_id and il.component = 'service_fee'
join public.invoices i on i.id = il.invoice_id
join public.payments p on p.id = pa.payment_id
left join public.enrolments e on e.id = i.enrolment_id
left join lateral (
  select dsi.settlement_id from public.developer_settlement_items dsi
  join public.developer_settlements d on d.id = dsi.settlement_id and d.status <> 'cancelled'
  where dsi.allocation_id = pa.id limit 1
) st on true
left join public.developer_settlements ds on ds.id = st.settlement_id;

-- -----------------------------------------------------------------------------
-- Account balances (trial balance, all time)
-- -----------------------------------------------------------------------------
create view public.v_account_balances with (security_invoker = true) as
select
  a.id as account_id, a.code, a.name, a.account_type,
  coalesce(sum(jl.debit), 0)::numeric(14, 2) as total_debit,
  coalesce(sum(jl.credit), 0)::numeric(14, 2) as total_credit,
  case when a.account_type in ('asset', 'expense')
       then coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0)
       else coalesce(sum(jl.credit), 0) - coalesce(sum(jl.debit), 0)
  end::numeric(14, 2) as balance
from public.chart_of_accounts a
left join public.journal_lines jl on jl.account_id = a.id
group by a.id;

-- -----------------------------------------------------------------------------
-- Training progress per enrolment
-- -----------------------------------------------------------------------------
create view public.v_competency_latest with (security_invoker = true) as
select distinct on (ca.enrolment_id, ca.competency_id)
  ca.enrolment_id, ca.student_id, ca.competency_id, ca.rating, ca.comment, ca.assessed_at, ca.assessed_by, ca.session_id
from public.competency_assessments ca
order by ca.enrolment_id, ca.competency_id, ca.assessed_at desc;

create view public.v_enrolment_progress with (security_invoker = true) as
select
  e.id as enrolment_id,
  e.student_id,
  e.location_id,
  e.status,
  c.theory_sessions as theory_required,
  c.practical_sessions as practical_required,
  coalesce(att.theory_attended, 0)::int as theory_attended,
  coalesce(att.practical_attended, 0)::int as practical_attended,
  coalesce(att.missed, 0)::int as missed_sessions,
  coalesce(att.total_marked, 0)::int as sessions_marked,
  coalesce(comp.required_total, 0)::int as competencies_required,
  coalesce(comp.competent_count, 0)::int as competencies_competent,
  coalesce(comp.ready_count, 0)::int as competencies_ready,
  case when (c.theory_sessions + c.practical_sessions) = 0 then 0
       else least(100, round(100.0 * (coalesce(att.theory_attended, 0) + coalesce(att.practical_attended, 0))
                              / (c.theory_sessions + c.practical_sessions)))
  end::int as attendance_progress_pct,
  case when coalesce(comp.required_total, 0) = 0 then 0
       else round(100.0 * coalesce(comp.competent_count, 0) / comp.required_total)
  end::int as competency_progress_pct,
  (coalesce(comp.required_total, 0) > 0 and coalesce(comp.competent_count, 0) = comp.required_total) as competencies_complete
from public.enrolments e
join public.courses c on c.id = e.course_id
left join lateral (
  select
    count(*) filter (where s.lesson_type = 'theory' and a.status in ('present', 'late')) as theory_attended,
    count(*) filter (where s.lesson_type <> 'theory' and a.status in ('present', 'late')) as practical_attended,
    count(*) filter (where a.status = 'absent') as missed,
    count(*) as total_marked
  from public.attendance a
  join public.training_sessions s on s.id = a.session_id
  join public.session_bookings b on b.session_id = s.id and b.student_id = a.student_id and b.enrolment_id = e.id
) att on true
left join lateral (
  select
    count(*) as required_total,
    count(*) filter (where cl.rating in ('competent', 'ready_for_test')) as competent_count,
    count(*) filter (where cl.rating = 'ready_for_test') as ready_count
  from public.competencies k
  left join public.v_competency_latest cl on cl.competency_id = k.id and cl.enrolment_id = e.id
  where k.is_active and k.required_for_test
    and (k.licence_class_id is null or k.licence_class_id = c.licence_class_id)
) comp on true;
