# Finance

## Chart of accounts (system accounts)

| Code | Account | Type | Meaning |
| --- | --- | --- | --- |
| 1000 | M-Pesa Paybill | Asset | Paybill funds |
| 1010 | Cash on Hand | Asset | Cash at locations |
| 1020 | Bank Account | Asset | Operating bank |
| 1100 | Accounts Receivable – Students | Asset | Invoiced, unpaid |
| 2100 | NTSA Funds Held (Payable) | Liability | NTSA money **collected** from students, not yet paid to NTSA |
| 2105 | NTSA Fees Billed – Not Yet Collected | Liability | Offsets the NTSA part of receivables until collected |
| 2200 | Developer Service Fees Payable | Liability | Service fees **collected**, owed to the platform owner |
| 2205 | Developer Service Fees Billed – Not Yet Collected | Liability | Offsets the service-fee part of receivables until collected |
| 2300 | Unapplied Student Receipts | Liability | Unmatched payments and student credit |
| 2400 | VAT Output Payable | Liability | VAT on taxable school fees |
| 4000 / 4010 / 4020 | Tuition / Registration / Other revenue | Revenue | **School income only** |
| 5xxx | Expenses | Expense | Configurable categories |

**Separation of funds:** NTSA fees and the platform service fee never touch school revenue. Their balances (2100, 2200) are exactly what the school is holding for NTSA and what it owes the platform.

## Postings

| Event | Journal |
| --- | --- |
| Fee agreement accepted (invoice) | Dr 1100 total · Cr 4000/4010/4020 net · Cr 2400 VAT · Cr 2105 NTSA · Cr 2205 service fee |
| M-Pesa / cash / bank receipt | Dr 1000/1010/1020 · Cr 2300 |
| Allocation to fees | Dr 2300 · Cr 1100 (per component) **and** for NTSA: Dr 2105 · Cr 2100; for service fee: Dr 2205 · Cr 2200 |
| Unmatched receipt assigned to a student | Dr 2300 (unidentified) · Cr 2300 (student), a sub-ledger move |
| Allocation reversal | Mirror of the allocation |
| Payment reversal | Reverse allocations, then Dr 2300 · Cr cash account |
| Credit note / waiver / write-off | Dr revenue (or 2105/2205) + Dr 2400 (tax portion) · Cr 1100 |
| Debit note | Reverse of the above |
| Refund paid | Dr 2300 · Cr cash account |
| NTSA remittance | Dr 2100 · Cr cash account |
| Developer settlement paid | Dr 2200 · Cr bank/M-Pesa |
| Expense | Dr expense account · Cr cash account |

Every entry is checked to balance at commit. Entries and lines can't be edited or deleted.

## Fee agreements and versioned pricing

- A course has **price versions** (draft → active → retired). Publishing a new version retires the old one. Published versions and their items are frozen.
- Enrolments point at the version active when they were created. On acceptance, `student_course_agreements` stores an immutable **snapshot** of the quote (items, tax, deposit, plan, terms text and version, who accepted, how, from which IP).
- The quote, including tax, is computed in SQL (`quote_price_version`). The TS schedule builder proposes instalments, and `accept_enrolment_agreement` **re-validates** them: sequences from 0, ascending dates, positive amounts, first row equals the deposit, and the total equals the quote exactly. No interest is ever added.

## Allocation waterfall

`private.apply_student_credit(student)` runs after every matched or confirmed payment, adjustment and new invoice:

1. Lock the student row (serialises concurrent callbacks).
2. Available = unallocated confirmed receipts − approved/paid refunds.
3. Open invoice lines are ordered by invoice date, then the configurable component priority (default: registration → service fee → tuition → NTSA → other), then line order.
4. Payments are consumed oldest first. One balanced journal is posted per run, and append-only allocation rows are inserted.
5. Enrolments awaiting deposit are activated once the plan's paid amount reaches the deposit.

Overpayments stay as credit (account 2300) and are refundable. The UI preview (`src/lib/finance/allocation.ts`) mirrors this, and an integration test asserts parity.

## Instalment status

Derived in `v_instalments` by filling instalments (deposit first) with the total allocated to the enrolment's plan invoice: `paid`, `partially_paid`, `due` (within 3 days), `overdue`, `upcoming`, `waived`, `adjusted`. Waivers are credit notes that also record `waived_amount` on the instalment.

## Payment gates

Each price version sets `min_paid_before_training` (enforced when booking a session; a manager can override with an audit entry) and `min_paid_before_ntsa` (enforced before NTSA payment processing).

## Developer service fee

Charged as its own invoice line (no school VAT), allocated like any other line, and visible in:

- `v_developer_fee_ledger`: each collection and reversal, its receipt, student number, course, location and settlement batch
- `platform_fee_summary()`: today, week, month, charged, collected, outstanding, settled, unsettled, by location, by course, settlement history

Finance prepares a **settlement batch** (all unsettled collections up to a date, including negative reversals), approves it and marks it paid with a reference, which posts Dr 2200 / Cr bank. Each collection can be in only one live batch. Cancelling a batch returns its items to the pool.

## Tax and eTIMS

- `school_settings`: KRA PIN, VAT registration, tax-inclusive pricing, fiscal year start, eTIMS toggle. `tax_rates` holds rates with eTIMS tax-type codes.
- Invoice lines store net, tax rate, tax and gross. Pass-through components (NTSA, service fee) never carry school VAT.
- **eTIMS:** when enabled, invoices are queued in `etims_submissions` with status `pending`. No KRA integration is bundled. An adapter (OSCU/VSCU via a certified provider) should process the queue and set `submitted` **only on KRA confirmation**, storing the control-unit invoice number and signature. Receipts say "Not a tax invoice" unless the school is VAT-registered.

## Reports

`/staff/reports`: student register, enrolments, location comparison, admissions conversion, attendance, instructor workload, training completion and test readiness, NTSA pipeline and pass rate, collections, collections by location/course/component, outstanding balances, payment ageing, developer-fee report, NTSA payable, monthly financial summary (income statement), tax summary, daily M-Pesa reconciliation, expenses, and the trial balance. All support CSV export (UTF-8 BOM for Excel, formula-injection safe).

## Period closing

Create periods in Finance → Periods. Closing a period (after its end date) blocks any journal dated inside it, including reversals, which then have to be dated in an open period.
