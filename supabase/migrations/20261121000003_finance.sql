-- =============================================================================
-- Finance: double-entry ledger, invoices, payments, allocations, M-Pesa,
-- refunds, adjustments, expenses, developer service-fee settlements, eTIMS.
--
-- Golden rules
--   * Balances are DERIVED from journal lines / allocations, never stored.
--   * Ledger, payment and allocation rows are append-only; corrections are
--     made with reversing entries.
--   * Only SECURITY DEFINER functions (migration 0006) write these tables.
-- =============================================================================

create type public.account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');

create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{4}$'),
  name text not null,
  account_type public.account_type not null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.chart_of_accounts (code, name, account_type, is_system, description) values
  ('1000', 'M-Pesa Paybill', 'asset', true, 'Funds received through the school M-Pesa Paybill'),
  ('1010', 'Cash on Hand', 'asset', true, 'Physical cash received at locations'),
  ('1020', 'Bank Account', 'asset', true, 'School operating bank account'),
  ('1100', 'Accounts Receivable – Students', 'asset', true, 'Amounts invoiced to students and not yet paid'),
  ('2100', 'NTSA Funds Held (Payable)', 'liability', true, 'NTSA fees collected from students, held until remitted to NTSA'),
  ('2105', 'NTSA Fees Billed – Not Yet Collected', 'liability', true, 'Offsets receivables for the NTSA component until collected'),
  ('2200', 'Developer Service Fees Payable', 'liability', true, 'Platform service fees collected, owed to the platform owner'),
  ('2205', 'Developer Service Fees Billed – Not Yet Collected', 'liability', true, 'Offsets receivables for the service fee until collected'),
  ('2300', 'Unapplied Student Receipts', 'liability', true, 'Payments received but not yet allocated (unmatched or overpaid)'),
  ('2400', 'VAT Output Payable', 'liability', true, 'Output VAT on taxable supplies'),
  ('3000', 'Owner''s Equity', 'equity', true, null),
  ('3100', 'Retained Earnings', 'equity', true, null),
  ('4000', 'Tuition Revenue', 'revenue', true, null),
  ('4010', 'Registration Fee Revenue', 'revenue', true, null),
  ('4020', 'Other Training Revenue', 'revenue', true, null),
  ('5000', 'Instructor Salaries & Wages', 'expense', false, null),
  ('5100', 'Fuel', 'expense', false, null),
  ('5200', 'Vehicle Maintenance & Repairs', 'expense', false, null),
  ('5300', 'Rent & Utilities', 'expense', false, null),
  ('5400', 'Insurance & Licensing', 'expense', false, null),
  ('5500', 'Marketing', 'expense', false, null),
  ('5600', 'M-Pesa & Bank Charges', 'expense', false, null),
  ('5900', 'General & Administrative', 'expense', false, null);

create or replace function private.account_id(p_code text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.chart_of_accounts where code = p_code
$$;

-- -----------------------------------------------------------------------------
-- Fiscal periods
-- -----------------------------------------------------------------------------
create table public.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  check (ends_on >= starts_on),
  exclude using gist (daterange(starts_on, ends_on, '[]') with &&)
);

-- -----------------------------------------------------------------------------
-- Journal
-- -----------------------------------------------------------------------------
create type public.journal_source as enum (
  'invoice', 'payment', 'allocation', 'allocation_reversal', 'payment_reversal',
  'adjustment', 'refund', 'ntsa_remittance', 'developer_settlement', 'expense', 'manual'
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number text not null unique,
  entry_date date not null,
  description text not null,
  source_type public.journal_source not null,
  source_id uuid,
  location_id uuid references public.locations (id),
  reversal_of uuid references public.journal_entries (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index journal_entries_date_idx on public.journal_entries (entry_date);
create index journal_entries_source_idx on public.journal_entries (source_type, source_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete restrict,
  account_id uuid not null references public.chart_of_accounts (id),
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  student_id uuid references public.students (id),
  location_id uuid references public.locations (id),
  component public.charge_component,
  memo text,
  check ((debit = 0) <> (credit = 0))
);
create index journal_lines_entry_idx on public.journal_lines (journal_entry_id);
create index journal_lines_account_idx on public.journal_lines (account_id);
create index journal_lines_student_idx on public.journal_lines (student_id) where student_id is not null;

create trigger journal_entries_immutable before update or delete on public.journal_entries
  for each row execute function private.block_mutation();
create trigger journal_lines_immutable before update or delete on public.journal_lines
  for each row execute function private.block_mutation();

-- Every journal entry must balance at commit time.
create or replace function private.check_journal_balanced()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d numeric; c numeric; n int;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*) into d, c, n
    from public.journal_lines where journal_entry_id = new.journal_entry_id;
  if n < 2 or d <> c then
    raise exception 'Journal entry % is unbalanced (debits %, credits %)', new.journal_entry_id, d, c;
  end if;
  return null;
end $$;
create constraint trigger journal_lines_balanced after insert on public.journal_lines
  deferrable initially deferred for each row execute function private.check_journal_balanced();

-- Block postings into closed periods.
create or replace function private.check_period_open()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.fiscal_periods
             where status = 'closed' and new.entry_date between starts_on and ends_on) then
    raise exception 'The fiscal period containing % is closed', new.entry_date;
  end if;
  return new;
end $$;
create trigger journal_entries_period before insert on public.journal_entries
  for each row execute function private.check_period_open();

-- Helper: create a journal entry from a JSON array of lines.
-- lines: [{"account":"1000","debit":100,"credit":0,"student_id":..,"component":..,"memo":..}]
create or replace function private.post_journal(
  p_date date, p_description text, p_source public.journal_source, p_source_id uuid,
  p_location uuid, p_lines jsonb, p_reversal_of uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare je uuid; l jsonb;
begin
  insert into public.journal_entries (entry_number, entry_date, description, source_type, source_id,
                                      location_id, reversal_of, created_by)
  values (private.next_document_number('journal'), p_date, p_description, p_source, p_source_id,
          p_location, p_reversal_of, auth.uid())
  returning id into je;

  for l in select * from jsonb_array_elements(p_lines) loop
    if coalesce((l ->> 'debit')::numeric, 0) = 0 and coalesce((l ->> 'credit')::numeric, 0) = 0 then
      continue; -- skip zero lines
    end if;
    insert into public.journal_lines (journal_entry_id, account_id, debit, credit, student_id,
                                      location_id, component, memo)
    values (je, private.account_id(l ->> 'account'),
            coalesce((l ->> 'debit')::numeric, 0), coalesce((l ->> 'credit')::numeric, 0),
            nullif(l ->> 'student_id', '')::uuid, coalesce(nullif(l ->> 'location_id', '')::uuid, p_location),
            nullif(l ->> 'component', '')::public.charge_component, l ->> 'memo');
  end loop;
  return je;
end $$;

-- -----------------------------------------------------------------------------
-- Invoices
-- -----------------------------------------------------------------------------
create type public.etims_status as enum ('not_applicable', 'pending', 'submitted', 'failed');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  student_id uuid not null references public.students (id),
  enrolment_id uuid references public.enrolments (id),
  location_id uuid not null references public.locations (id),
  issue_date date not null default private.today_ke(),
  description text,
  subtotal numeric(12, 2) not null,
  tax_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null check (total >= 0),
  tax_inclusive boolean not null,
  etims_status public.etims_status not null default 'not_applicable',
  journal_entry_id uuid references public.journal_entries (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index invoices_student_idx on public.invoices (student_id);
create index invoices_enrolment_idx on public.invoices (enrolment_id);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  component public.charge_component not null,
  description text not null,
  net_amount numeric(12, 2) not null check (net_amount >= 0),
  tax_rate_id uuid references public.tax_rates (id),
  tax_rate numeric(6, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  gross_amount numeric(12, 2) not null check (gross_amount >= 0),
  sort_order smallint not null default 0,
  check (gross_amount = net_amount + tax_amount)
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

create trigger invoices_immutable before delete on public.invoices
  for each row execute function private.block_mutation();
create trigger invoice_lines_immutable before update or delete on public.invoice_lines
  for each row execute function private.block_mutation();

-- eTIMS abstraction: submissions are recorded per invoice; an adapter in the app
-- submits them. Nothing is marked submitted unless the provider confirms it.
create table public.etims_submissions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  provider text not null,
  status public.etims_status not null default 'pending',
  control_unit_invoice_number text,
  receipt_signature text,
  response_summary jsonb,
  error_message text,
  attempts integer not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index etims_submissions_invoice_idx on public.etims_submissions (invoice_id);

-- -----------------------------------------------------------------------------
-- M-Pesa
-- -----------------------------------------------------------------------------
create type public.mpesa_tx_status as enum ('received', 'matched', 'unmatched', 'rejected');

create table public.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  trans_id text not null unique,                -- M-Pesa receipt, e.g. SKL4ABCD12
  transaction_type text,
  trans_time timestamptz not null,
  amount numeric(12, 2) not null check (amount > 0),
  business_short_code text not null,
  bill_ref_number text,
  normalized_reference text,
  msisdn_masked text,                           -- never store the full MSISDN in clear
  msisdn_hash text,                             -- sha256 for matching repeat payers
  payer_name text,
  org_account_balance numeric(14, 2),
  environment text not null check (environment in ('sandbox', 'production')),
  status public.mpesa_tx_status not null default 'received',
  raw_payload jsonb not null,                   -- sanitised copy of the callback body
  received_at timestamptz not null default now()
);
create index mpesa_transactions_ref_idx on public.mpesa_transactions (normalized_reference);
create index mpesa_transactions_status_idx on public.mpesa_transactions (status, received_at desc);

create table public.mpesa_webhook_logs (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  endpoint text not null check (endpoint in ('validation', 'confirmation', 'simulate', 'register')),
  source_ip text,
  auth_ok boolean not null,
  trans_id text,
  amount numeric(12, 2),
  result_code text,
  http_status smallint not null,
  outcome text not null check (outcome in ('accepted', 'rejected', 'duplicate', 'processed', 'error', 'unauthorized')),
  error_message text,
  payload jsonb
);
create index mpesa_webhook_logs_time_idx on public.mpesa_webhook_logs (received_at desc);
create index mpesa_webhook_logs_trans_idx on public.mpesa_webhook_logs (trans_id);

-- -----------------------------------------------------------------------------
-- Payments and allocations
-- -----------------------------------------------------------------------------
create type public.payment_source as enum ('mpesa_c2b', 'cash', 'bank_transfer', 'other');
create type public.payment_status as enum ('pending_verification', 'unmatched', 'confirmed', 'reversed', 'rejected');
create type public.matching_method as enum ('account_reference', 'phone', 'manual', 'direct');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique,
  source public.payment_source not null,
  status public.payment_status not null,
  amount numeric(12, 2) not null check (amount > 0),
  received_at timestamptz not null,
  student_id uuid references public.students (id),
  location_id uuid references public.locations (id),
  mpesa_transaction_id uuid unique references public.mpesa_transactions (id),
  external_reference text,
  payer_name text,
  payer_phone_masked text,
  notes text,
  matching_method public.matching_method,
  matched_by uuid references public.profiles (id),
  matched_at timestamptz,
  recorded_by uuid references public.profiles (id),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  reversed_by uuid references public.profiles (id),
  reversed_at timestamptz,
  reversal_reason text,
  journal_entry_id uuid references public.journal_entries (id),
  created_at timestamptz not null default now()
);
create index payments_student_idx on public.payments (student_id, received_at desc);
create index payments_status_idx on public.payments (status, received_at desc);
create index payments_received_idx on public.payments (received_at desc);
create index payments_ext_ref_idx on public.payments (upper(external_reference));
create unique index payments_ext_ref_unique on public.payments (source, upper(external_reference))
  where external_reference is not null and status <> 'rejected';

create trigger payments_no_delete before delete on public.payments
  for each row execute function private.block_mutation();
create trigger payments_audit after insert or update on public.payments
  for each row execute function private.audit_row();

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  invoice_line_id uuid not null references public.invoice_lines (id),
  amount numeric(12, 2) not null check (amount <> 0),   -- negative = reversal
  reversal_of uuid references public.payment_allocations (id),
  reason text,
  journal_entry_id uuid references public.journal_entries (id),
  allocated_by uuid references public.profiles (id),
  allocated_at timestamptz not null default now()
);
create index payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index payment_allocations_line_idx on public.payment_allocations (invoice_line_id);
create unique index payment_allocations_single_reversal on public.payment_allocations (reversal_of) where reversal_of is not null;

create trigger payment_allocations_immutable before update or delete on public.payment_allocations
  for each row execute function private.block_mutation();
create trigger payment_allocations_audit after insert on public.payment_allocations
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Adjustments (credit / debit notes, waivers, write-offs)
-- -----------------------------------------------------------------------------
create type public.adjustment_type as enum ('credit_note', 'waiver', 'write_off', 'debit_note');

create table public.financial_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_number text not null unique,
  adjustment_type public.adjustment_type not null,
  student_id uuid not null references public.students (id),
  invoice_line_id uuid not null references public.invoice_lines (id),
  instalment_id uuid references public.instalments (id),
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) >= 5),
  journal_entry_id uuid references public.journal_entries (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index financial_adjustments_line_idx on public.financial_adjustments (invoice_line_id);
create index financial_adjustments_student_idx on public.financial_adjustments (student_id);
create trigger financial_adjustments_immutable before update or delete on public.financial_adjustments
  for each row execute function private.block_mutation();
create trigger financial_adjustments_audit after insert on public.financial_adjustments
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Refunds (paid out of a student's unapplied credit)
-- -----------------------------------------------------------------------------
create type public.refund_status as enum ('requested', 'approved', 'rejected', 'paid');

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  refund_number text not null unique,
  student_id uuid not null references public.students (id),
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  method text not null check (method in ('mpesa', 'cash', 'bank_transfer')),
  status public.refund_status not null default 'requested',
  requested_by uuid references public.profiles (id),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  paid_at timestamptz,
  payout_reference text,
  journal_entry_id uuid references public.journal_entries (id)
);
create index refunds_student_idx on public.refunds (student_id);
create trigger refunds_audit after insert or update on public.refunds
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Expenses
-- -----------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_id uuid not null references public.chart_of_accounts (id),
  is_active boolean not null default true
);
insert into public.expense_categories (name, account_id)
select v.name, (select id from public.chart_of_accounts where code = v.code)
from (values ('Instructor wages', '5000'), ('Fuel', '5100'), ('Maintenance & repairs', '5200'),
             ('Rent & utilities', '5300'), ('Insurance & licensing', '5400'), ('Marketing', '5500'),
             ('M-Pesa & bank charges', '5600'), ('General & administrative', '5900')) as v(name, code);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  expense_date date not null,
  category_id uuid not null references public.expense_categories (id),
  location_id uuid references public.locations (id),
  vehicle_id uuid,
  vendor text,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  paid_from text not null default '1000' check (paid_from in ('1000', '1010', '1020')),
  reference text,
  receipt_storage_path text,
  journal_entry_id uuid references public.journal_entries (id),
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (expense_date);
create trigger expenses_immutable before update or delete on public.expenses
  for each row execute function private.block_mutation();
create trigger expenses_audit after insert on public.expenses
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Developer / platform service-fee settlements
-- -----------------------------------------------------------------------------
create type public.settlement_status as enum ('draft', 'approved', 'paid', 'cancelled');

create table public.developer_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_number text not null unique,
  period_end date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  item_count integer not null default 0,
  status public.settlement_status not null default 'draft',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  paid_at timestamptz,
  payout_method text,
  payout_reference text,
  journal_entry_id uuid references public.journal_entries (id),
  notes text
);
create trigger developer_settlements_audit after insert or update on public.developer_settlements
  for each row execute function private.audit_row();

-- Each service-fee allocation (including reversals) belongs to at most one live batch.
create table public.developer_settlement_items (
  settlement_id uuid not null references public.developer_settlements (id) on delete cascade,
  allocation_id uuid not null references public.payment_allocations (id),
  amount numeric(12, 2) not null,
  primary key (settlement_id, allocation_id)
);
create index developer_settlement_items_alloc_idx on public.developer_settlement_items (allocation_id);

grant execute on all functions in schema private to authenticated, service_role;
