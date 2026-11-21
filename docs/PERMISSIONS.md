# Permissions

Enforced in three layers: **RLS** (rows), **SECURITY DEFINER functions** (explicit role checks for every business action), and **server-side page guards** (`requireRole`). Hiding a menu item is never the control.

Helper functions (in `private`): `has_role`, `has_any_role`, `is_manager`, `is_finance` (manager or accountant), `is_office`, `is_staff`, `can_access_location`, `can_access_student`, `can_access_student_finance`, `instructor_can_see_student`, `can_manage_session`, `current_student_id`, `current_instructor_id`.

## Matrix

| Data / action | Student | Instructor | Admin (own locations) | Accountant | Manager | Platform owner |
| --- | --- | --- | --- | --- | --- | --- |
| Own profile, course, schedule, progress | ✅ own | – | – | – | – | – |
| Own fees, receipts, NTSA status | ✅ own | ❌ | – | – | – | – |
| Student records | own | assigned/booked | ✅ | ✅ (read) | ✅ | ❌ |
| Full ID number | own | ❌ | reveal (audited) | ❌ | reveal (audited) | ❌ |
| Register / enrol / accept fees in person | – | ❌ | ✅ | ❌ | ✅ | ❌ |
| Accept own fee plan in app | ✅ | – | – | – | – | – |
| Documents (upload / verify) | upload own | ❌ | ✅ | read | ✅ | ❌ |
| Leads (CRM) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Sessions: schedule / reschedule / cancel | ❌ | request change | ✅ | ❌ | ✅ | ❌ |
| Attendance | read own | own sessions | ✅ | ❌ | ✅ | ❌ |
| Competency assessment | read own | assigned/booked | ✅ | ❌ | ✅ | ❌ |
| Payments (view) | own | ❌ | own locations | ✅ | ✅ | ❌ |
| Record cash/bank payment | ❌ | ❌ | ✅ (needs verification) | ✅ | ✅ | ❌ |
| Verify / match / reassign / reverse payments | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Adjustments, waivers, refunds approval | ❌ | ❌ | request refund | ✅ | ✅ | ❌ |
| Journal, trial balance, expenses, periods | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| NTSA workflow transitions | – | ❌ | ✅ | payment steps | ✅ | ❌ |
| Record NTSA payment | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Developer-fee summary and ledger (student numbers only) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Prepare / approve / pay settlements | ❌ | ❌ | ❌ | ✅ | ✅ | read |
| M-Pesa callback logs / integration health | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Audit log | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Pricing (draft / publish) | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Courses, locations, competencies, templates, users | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Manager override of training payment gate | ❌ | ❌ | ❌ | ❌ | ✅ (audited) | ❌ |
| Withdraw enrolment, anonymise student | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### Platform owner isolation

The platform owner sees only aggregate and service-fee data via `platform_fee_summary()` / `platform_fee_ledger()`. These return student **numbers**, never names, phones or IDs. If the school wants them to see more, a manager grants an extra school role, and the grant is audited.

### Segregation of duties

- Cash or bank entries by an administrator are `pending_verification` until a *different* finance user verifies them.
- Refunds must be approved by someone other than the requester.
- Role grants and revocations are always written to the audit log. Managers can't remove their own manager role.

### MFA

Staff can enrol a TOTP authenticator at `/staff/account`. With **Settings → Require two-step verification** on, staff without a factor are sent to enrol, and staff with a factor must reach `aal2` before any staff page loads.
