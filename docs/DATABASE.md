# Database

PostgreSQL 17 on Supabase. Everything is defined in `supabase/migrations`. Money is `numeric(12,2)` KES. Times are `timestamptz`, and "today" means `Africa/Nairobi` (`private.today_ke()`).

## Schemas

- `public`: tables, views and the RPC functions the app calls
- `private`: helper functions (RLS helpers, journal posting, numbering, notifications, rate limiter). Not exposed by the API.

## Entity overview

```
locations ─┬─ staff_locations ── profiles ── user_roles
           ├─ instructor_locations ── instructors ── instructor_{availability,time_off,certifications}
           ├─ vehicles ── vehicle_maintenance / fuel_logs / vehicle_incidents
           └─ training_sessions ── session_bookings ── attendance

licence_classes ── courses ── course_locations
                        └── course_price_versions ── course_price_items   (versioned, frozen once published)

leads ── lead_activities
  └─(converted)─ students ── student_identities (full ID, restricted)
                    ├── student_consents, student_documents (private storage)
                    └── enrolments ── student_course_agreements (immutable snapshot)
                              ├── payment_plans ── instalments
                              ├── invoices ── invoice_lines ──┐
                              ├── ntsa_processes ── ntsa_process_events / ntsa_test_attempts / ntsa_payments
                              └── competency_assessments (append-only history)

mpesa_transactions ── payments ── payment_allocations ──┘ (→ invoice_lines)
                                       └── developer_settlement_items ── developer_settlements
financial_adjustments (→ invoice_lines, optional instalment)
refunds, expenses ── expense_categories
chart_of_accounts ── journal_entries ── journal_lines        fiscal_periods
notification_templates, notifications ── notification_deliveries, push_subscriptions, announcements
audit_logs, mpesa_webhook_logs, document_sequences, school_settings, tax_rates, etims_submissions
```

### Notes against the original brief

- **`users/roles` → `profiles` + `user_roles`** (many roles per user; the platform owner can be granted a school role explicitly).
- **`motorcycles` → `vehicles`** with a `category` (motorcycle now, cars and PSV later) so new licence classes don't need a rebuild.
- **`developer_fee_ledger` is a view** (`v_developer_fee_ledger`) over service-fee allocations plus settlement items, so there's no duplicated table to drift. Each allocation can belong to only one live settlement batch.
- **`student_competencies` → `competency_assessments`** (full history) plus the `v_competency_latest` view.
- **`session_students` → `session_bookings`**, with denormalised `time_range`/`is_live` so exclusion constraints can block student and motorcycle double-booking.
- **Tax settings** live in `school_settings` (VAT registration, inclusive or exclusive pricing, eTIMS toggle) plus `tax_rates`.

## Key constraints and triggers

| Rule | Mechanism |
| --- | --- |
| Instructor can't be double-booked | `EXCLUDE USING gist (instructor_id =, tstzrange &&)` on live sessions |
| Student / motorcycle can't be double-booked | Exclusion constraints on `session_bookings` |
| Instructor active, assigned to location, not on leave | `validate_session` trigger |
| Motorcycle available, at the right location, insured and inspected | `prepare_booking` trigger |
| Minimum payment before training | `check_training_gate` trigger (manager override is audited) |
| Journal entries balance | Deferred constraint trigger `check_journal_balanced` |
| No postings in closed periods | `check_period_open` trigger |
| Ledger, allocations, agreements, adjustments, expenses immutable | `block_mutation` triggers |
| Published prices immutable; one active version per course | `guard_price_version`, `guard_price_items`, partial unique index |
| Status and amount columns only change via workflows | `guard_api_columns` (blocks the `authenticated` role) |
| One open enrolment per course per student | Partial unique index |
| M-Pesa idempotency | `mpesa_transactions.trans_id` unique, `payments.mpesa_transaction_id` unique |
| Audit log append-only | Trigger blocks update and delete |

## Derived views (all `security_invoker`)

| View | Answers |
| --- | --- |
| `v_invoice_line_balances` | Per fee line: due (after credit/debit notes), allocated, outstanding |
| `v_enrolment_balances` | Per enrolment: totals and each component; payment-gate flags |
| `v_instalments` | Instalment paid/outstanding/status, derived by filling instalments in order |
| `v_payment_balances`, `v_student_credit` | Unallocated receipts and student credit (minus committed refunds) |
| `v_student_balances` | Student-level totals |
| `v_ntsa_funds` | NTSA billed, collected, paid to NTSA, held |
| `v_developer_fee_ledger` | Service-fee collections and settlement status |
| `v_account_balances` | Trial balance (all time); `trial_balance(as_of)` for a date |
| `v_enrolment_progress`, `v_competency_latest` | Attendance and competency progress |

## Numbering

`document_sequences` with row-locking `private.next_document_number(key)`: students `EK00001` (short, easy to type as an M-Pesa account), `ENR-2026-00001`, `INV-2026-000001`, `RCT-2026-000001`, `JE-2026-0000001` and so on. Prefixes are editable in Settings, and numbers reset yearly where the year is included.
