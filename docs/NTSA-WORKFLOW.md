# NTSA workflow

The school handles NTSA steps (provisional licence, payments, test booking) **outside** this system, on eCitizen/NTSA. No NTSA API integration exists. This system provides an auditable operational workflow to record, verify and track each step.

Each enrolment gets an `ntsa_processes` record when the fee agreement is accepted, carrying the agreed NTSA amount.

## States and transitions

```
not_started → documents_pending → ready_for_payment → payment_pending → paid_by_school
                                          └──────────(direct)──────────────┘
paid_by_school → booking_pending → test_booked → test_scheduled → test_completed → passed → completed
                       ▲              │               │                 └→ failed_retest_required ─┐
                       └──────────────┴───────────────┴──────────────────────────────────────────────┘
```

Transitions are enforced by `ntsa_transition()`. Every change writes an `ntsa_process_events` row (from, to, note, actor, time) and an audit entry.

| Step | Guard |
| --- | --- |
| → ready_for_payment | A verified ID document (national ID / birth certificate / PDL / NTSA document) |
| → payment_pending | Student has paid at least the price version's `min_paid_before_ntsa` |
| → paid_by_school | NTSA payments recorded ≥ agreed NTSA amount (set automatically by `record_ntsa_payment`) |
| record NTSA payment | Finance only. eCitizen reference required (unique). Amount above funds held needs a written reason (`advanced_by_school`). Posts Dr 2100 / Cr cash. |
| paid_by_school → booking_pending | Training marked complete (all required competencies at Competent or above) |
| → test_booked | Booking reference required; student notified |
| → test_scheduled | Test date/time and centre required; creates a numbered test attempt; student notified, with a reminder 48h before |
| record result | `passed` / `failed` / `absent`; student notified. A failure moves to retest, which loops back to booking. |
| passed → completed | Via **Complete course** (requires an NTSA pass and, by policy, a cleared balance). Issues a certificate number, and the student becomes alumni. |

## Funds

`v_ntsa_funds` shows per student: NTSA billed, collected (allocations to the NTSA line), paid to NTSA, and **held** (collected − paid). In aggregate, ledger account 2100 is the NTSA money the school holds for students.

## Manager views

**NTSA** queue tabs: Documents, Awaiting NTSA payment, Awaiting booking, Tests scheduled, Failed/retest, Passed. Cards show students awaiting payment, awaiting booking, tests this week, and cases stuck more than 14 days. Reports → *NTSA pipeline & test performance* lists days-in-stage and the pass rate.
