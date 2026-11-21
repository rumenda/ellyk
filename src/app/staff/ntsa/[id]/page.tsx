import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { Money } from "@/components/money";
import { NtsaSteps } from "@/components/ntsa-steps";
import { StatusBadge } from "@/components/status-badge";
import { NtsaPaymentDialog, TestResultDialog, TransitionDialog } from "@/components/staff/ntsa-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/states";
import { ntsaTransition } from "@/features/ntsa/actions";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDate, formatDateTime, fullName, humanize, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "NTSA record" };

export default async function NtsaRecord({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("manager", "admin", "accountant");
  const { id } = await params;
  const supabase = await createClient();
  const { data: np } = await supabase.from("ntsa_processes").select("*, student:students(id, student_number, first_name, middle_name, last_name), enrolment:enrolments(id, status, enrolment_number), licence:licence_classes(name)").eq("id", id).maybeSingle();
  if (!np) notFound();
  const [{ data: f }, { data: events }, { data: attempts }, { data: payments }, { data: bal }, { data: docs }] = await Promise.all([
    supabase.from("v_ntsa_funds").select("*").eq("process_id", id).maybeSingle(),
    supabase.from("ntsa_process_events").select("*, actor:profiles(full_name)").eq("process_id", id).order("created_at", { ascending: false }),
    supabase.from("ntsa_test_attempts").select("*").eq("process_id", id).order("attempt_number"),
    supabase.from("ntsa_payments").select("*").eq("process_id", id).order("paid_on"),
    supabase.from("v_enrolment_balances").select("plan_paid, min_paid_before_ntsa, ntsa_gate_met").eq("enrolment_id", np.enrolment_id).maybeSingle(),
    supabase.from("student_documents").select("document_type, status").eq("student_id", np.student_id),
  ]);
  const office = hasRole(user, "manager", "admin");
  const finance = hasRole(user, "manager", "accountant");
  const s = np.status;
  const held = toNumber(f?.ntsa_held);
  const due = Math.max(0, toNumber(np.ntsa_amount) - toNumber(f?.ntsa_remitted));
  const verifiedId = (docs ?? []).some((d) => d.status === "verified");
  const act = (to: Parameters<typeof ntsaTransition>[1], label: string) => (
    <ActionButton size="sm" action={async () => { "use server"; return ntsaTransition(id, to); }}>{label}</ActionButton>
  );

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "NTSA", href: "/staff/ntsa" }, { label: np.student ? fullName(np.student) : "Record" }]}
        title={<span className="flex flex-wrap items-center gap-2">{np.student ? fullName(np.student) : ""}<StatusBadge status={s} /></span>}
        description={<><Link className="hover:underline" href={`/staff/students/${np.student_id}`}>{np.student?.student_number}</Link> · {np.licence?.name} · {np.enrolment?.enrolment_number}</>} />
      <Card className="mb-5 p-4 sm:p-5"><NtsaSteps status={s} /></Card>

      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Next step" />
            <CardBody className="space-y-3">
              {s === "documents_pending" && (verifiedId
                ? (office && act("ready_for_payment", "Documents verified – ready for payment"))
                : <Alert tone="warning">Verify the student&apos;s ID document on their <Link className="underline" href={`/staff/students/${np.student_id}?tab=documents`}>Documents tab</Link> first.</Alert>)}
              {s === "ready_for_payment" && (<>
                {!bal?.ntsa_gate_met && <Alert tone="warning">Student has paid <Money value={bal?.plan_paid} /> of the <Money value={bal?.min_paid_before_ntsa} /> required before NTSA processing.</Alert>}
                <div className="flex flex-wrap gap-2">{(office || finance) && bal?.ntsa_gate_met && act("payment_pending", "Send to finance for payment")}
                  {finance && <NtsaPaymentDialog processId={id} due={due} held={held} />}</div>
              </>)}
              {s === "payment_pending" && (finance ? <NtsaPaymentDialog processId={id} due={due} held={held} /> : <p className="text-sm text-muted">Waiting for finance to record the NTSA payment.</p>)}
              {s === "paid_by_school" && office && (np.enrolment?.status === "training_complete" || np.enrolment?.status === "completed"
                ? act("booking_pending", "Ready to book test")
                : <Alert tone="info">NTSA paid. Training must be marked complete before booking the test.</Alert>)}
              {s === "booking_pending" && office && <TransitionDialog processId={id} to="test_booked" label="Record test booking" fields={["booking_reference"]} />}
              {s === "test_booked" && office && <div className="flex gap-2"><TransitionDialog processId={id} to="test_scheduled" label="Set test date" fields={["test_date", "test_centre"]} />
                <TransitionDialog processId={id} to="booking_pending" label="Booking cancelled" variant="secondary" /></div>}
              {(s === "test_scheduled" || s === "test_completed") && office && <div className="flex gap-2"><TestResultDialog processId={id} />
                {s === "test_scheduled" && <TransitionDialog processId={id} to="booking_pending" label="Test postponed" variant="secondary" />}</div>}
              {s === "failed_retest_required" && office && act("booking_pending", "Book a retest")}
              {s === "passed" && <p className="text-sm">Passed. Complete the course from the <Link className="font-medium text-brand-700 underline" href={`/staff/students/${np.student_id}`}>student record</Link> to issue the certificate.</p>}
              {s === "completed" && <p className="text-sm text-success-700">Process complete.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Test attempts" />
            {(attempts ?? []).length === 0 ? <CardBody className="text-sm text-muted">No tests scheduled yet.</CardBody> : (
              <ul className="divide-y divide-border text-sm">{attempts!.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 px-4 py-3 sm:px-5"><span>Attempt {a.attempt_number} · {formatDateTime(a.test_date)}<span className="block text-xs text-muted">{a.test_centre}{a.examiner_notes ? ` · ${a.examiner_notes}` : ""}</span></span><StatusBadge status={a.result} /></li>
              ))}</ul>
            )}
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="divide-y divide-border text-sm">{(events ?? []).map((e) => (
              <li key={e.id} className="px-4 py-2.5 sm:px-5"><span className="font-medium">{humanize(e.from_status ?? "")}{e.from_status ? " → " : ""}{humanize(e.to_status)}</span>
                {e.note && <span className="block text-muted">{e.note}</span>}<span className="block text-xs text-subtle">{formatDateTime(e.created_at)} · {e.actor?.full_name ?? "System"}</span></li>
            ))}</ol>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="NTSA funds" description="Held on behalf of the student" />
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">NTSA amount (agreed)</dt><dd><Money value={np.ntsa_amount} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted">Collected from student</dt><dd><Money value={f?.ntsa_collected} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted">Paid to NTSA</dt><dd><Money value={f?.ntsa_remitted} /></dd></div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Held now</dt><dd><Money value={held} /></dd></div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payments to NTSA" />
            {(payments ?? []).length === 0 ? <CardBody className="text-sm text-muted">None recorded.</CardBody> : (
              <ul className="divide-y divide-border text-sm">{payments!.map((p) => (
                <li key={p.id} className="px-4 py-2.5 sm:px-5"><Money value={p.amount} strong /> · <span className="font-mono text-xs">{p.payment_reference}</span>
                  <span className="block text-xs text-muted">{formatDate(p.paid_on)}{p.advanced_by_school ? ` · advanced by school: ${p.override_reason}` : ""}</span></li>
              ))}</ul>
            )}
          </Card>
          <Card><CardHeader title="Booking" /><CardBody className="space-y-1 text-sm">
            <p><span className="text-muted">Reference:</span> {np.booking_reference ?? "—"}</p>
            <p><span className="text-muted">Test:</span> {np.test_date ? `${formatDateTime(np.test_date)} · ${np.test_centre}` : "—"}</p>
          </CardBody></Card>
        </div>
      </div>
    </div>
  );
}
