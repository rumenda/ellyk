import { Badge, type Tone } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

const MAP: Record<string, Tone> = {
  // enrolment / student
  pending_acceptance: "warning", awaiting_deposit: "warning", active: "success", training_complete: "brand",
  completed: "brand", suspended: "danger", withdrawn: "neutral", cancelled: "neutral", applicant: "info", alumni: "brand",
  // instalments
  upcoming: "neutral", due: "warning", partially_paid: "info", paid: "success", overdue: "danger", waived: "neutral", adjusted: "info",
  // payments
  pending_verification: "warning", unmatched: "danger", confirmed: "success", reversed: "neutral", rejected: "neutral",
  matched: "success", received: "info",
  // ntsa
  not_started: "neutral", documents_pending: "warning", ready_for_payment: "info", payment_pending: "warning",
  paid_by_school: "brand", booking_pending: "warning", test_booked: "info", test_scheduled: "info", test_completed: "info",
  passed: "success", failed_retest_required: "danger", failed: "danger", absent: "danger", pending: "warning",
  // sessions / attendance
  scheduled: "neutral", confirmed_session: "info", in_progress: "info", missed: "danger", rescheduled: "neutral",
  present: "success", late: "warning", excused: "neutral",
  // leads
  new: "info", contacted: "neutral", interested: "brand", follow_up: "warning", ready_to_enrol: "success", converted: "success", lost: "neutral",
  // fleet
  available: "success", assigned: "info", training: "brand", maintenance: "warning", out_of_service: "danger",
  // misc
  draft: "neutral", approved: "info", requested: "warning", open: "warning", investigating: "info", closed: "neutral",
  verified: "success", retired: "neutral", declined: "neutral",
  // competencies
  not_assessed: "neutral", needs_improvement: "danger", developing: "warning", competent: "success", ready_for_test: "brand",
};

const LABELS: Record<string, string> = {
  paid_by_school: "NTSA paid", failed_retest_required: "Retest required", ready_for_test: "Ready for test",
  pending_verification: "Awaiting verification", mpesa_c2b: "M-Pesa", bank_transfer: "Bank transfer",
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <Badge>—</Badge>;
  return <Badge tone={MAP[status] ?? "neutral"} dot>{label ?? LABELS[status] ?? humanize(status)}</Badge>;
}

export function statusLabel(status: string) {
  return LABELS[status] ?? humanize(status);
}
