import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { Money } from "@/components/money";
import { PrintButton } from "@/components/print-button";
import { Receipt } from "@/components/receipt";
import { StatusBadge } from "@/components/status-badge";
import { MatchPaymentDialog } from "@/components/staff/payment-dialogs";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/states";
import { reversePayment, verifyPayment } from "@/features/payments/actions";
import { loadReceipt } from "@/features/student/receipt";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDateTime, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payment" };

export default async function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("manager", "admin", "accountant");
  const { id } = await params;
  const finance = hasRole(user, "manager", "accountant");
  const supabase = await createClient();
  const { data: p } = await supabase.from("payments")
    .select("*, student:students(id, student_number), mpesa:mpesa_transactions(trans_id, bill_ref_number, msisdn_masked, trans_time, environment, status, business_short_code), recorder:profiles!payments_recorded_by_fkey(full_name), matcher:profiles!payments_matched_by_fkey(full_name)")
    .eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: allocations }, receipt, { data: audit }] = await Promise.all([
    supabase.from("payment_allocations").select("id, amount, allocated_at, reason, reversal_of, line:invoice_lines(component, description, invoice:invoices(invoice_number))").eq("payment_id", id).order("allocated_at"),
    p.student ? loadReceipt(id) : Promise.resolve(null),
    finance ? supabase.from("audit_logs").select("id, occurred_at, action, actor_roles, new_values").eq("entity_type", "payments").eq("entity_id", id).order("occurred_at") : Promise.resolve({ data: [] }),
  ]);
  const ref = p.external_reference ?? p.receipt_number ?? "";

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Payments", href: "/staff/payments" }, { label: ref || "Payment" }]}
        title={<span className="flex flex-wrap items-center gap-2"><Money value={p.amount} /><StatusBadge status={p.status} /></span>}
        description={`${p.source === "mpesa_c2b" ? "M-Pesa Paybill" : humanize(p.source)} · ${formatDateTime(p.received_at)}`}
        actions={<>
          {receipt && <PrintButton label="Print receipt" />}
          {finance && p.status === "unmatched" && <MatchPaymentDialog paymentId={id} amount={p.amount} reference={ref} mode="match" />}
          {finance && p.status === "confirmed" && <MatchPaymentDialog paymentId={id} amount={p.amount} reference={ref} mode="reassign" />}
          {finance && p.status === "pending_verification" && <>
            <ActionButton size="sm" action={async () => { "use server"; return verifyPayment(id, true); }} confirm={{ title: "Verify this payment?", description: "Confirm the money has been received (cash counted / bank statement checked). It will be allocated to the student's fees." }}>Verify</ActionButton>
            <ActionButton size="sm" variant="secondary" requireReason action={async (r) => { "use server"; return verifyPayment(id, false, r); }} confirm={{ title: "Reject this payment", confirmLabel: "Reject" }}>Reject</ActionButton>
          </>}
          {finance && ["confirmed", "unmatched"].includes(p.status) && (
            <ActionButton size="sm" variant="ghost" className="text-danger-700" requireReason action={async (r) => { "use server"; return reversePayment(id, r ?? ""); }}
              confirm={{ title: "Reverse this payment?", description: "Use only when the money was returned or never arrived (e.g. M-Pesa reversal). Allocations are reversed and a reversing journal is posted.", destructive: true, confirmLabel: "Reverse payment" }}>Reverse</ActionButton>
          )}
        </>} />
      {p.status === "unmatched" && <Alert tone="warning" className="mb-4" title="This payment is not linked to a student">The account number used ({p.mpesa?.bill_ref_number || "blank"}) did not match any student. Find the student and match it – the money is already in the Paybill.</Alert>}
      {p.status === "pending_verification" && <Alert tone="info" className="mb-4">Recorded by {p.recorder?.full_name}. A finance user other than the recorder must verify it.</Alert>}

      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Allocation trail" description="Append-only: reversals appear as negative lines" />
            {(allocations ?? []).length === 0 ? <CardBody className="text-sm text-muted">Not allocated{p.status === "confirmed" ? " – held as student credit" : ""}.</CardBody> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted"><th className="px-4 py-2 font-medium sm:px-5">Component</th><th className="px-4 py-2 font-medium">Invoice</th><th className="hidden px-4 py-2 font-medium sm:table-cell">When</th><th className="px-4 py-2 text-right font-medium sm:px-5">Amount</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {allocations!.map((a) => (
                    <tr key={a.id} className={a.amount < 0 ? "text-danger-700" : ""}>
                      <td className="px-4 py-2.5 sm:px-5">{humanize(a.line?.component)}{a.reason && <span className="block text-xs text-muted">{a.reason}</span>}</td>
                      <td className="px-4 tabular">{a.line?.invoice?.invoice_number}</td>
                      <td className="hidden px-4 text-muted sm:table-cell">{formatDateTime(a.allocated_at)}</td>
                      <td className="px-4 text-right sm:px-5"><Money value={a.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {receipt && <Receipt r={receipt} />}
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                {([
                  ["Student", p.student ? <Link key="s" className="text-brand-700 hover:underline" href={`/staff/students/${p.student.id}`}>{p.student.student_number}</Link> : "—"],
                  ["Receipt no.", p.receipt_number], ["M-Pesa code", p.mpesa?.trans_id], ["Account typed", p.mpesa?.bill_ref_number],
                  ["Paybill", p.mpesa?.business_short_code], ["Payer", p.payer_name], ["Payer phone", p.payer_phone_masked ?? p.mpesa?.msisdn_masked],
                  ["Matching", p.matching_method ? humanize(p.matching_method) : null], ["Matched by", p.matcher?.full_name],
                  ["Environment", p.mpesa?.environment ? humanize(p.mpesa.environment) : null], ["Recorded by", p.recorder?.full_name],
                  ["Notes", p.notes], ["Reversal reason", p.reversal_reason],
                ] as [string, React.ReactNode][]).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
                ))}
              </dl>
              {p.mpesa?.environment === "sandbox" && <p className="mt-3 rounded-md bg-accent-100 px-2.5 py-1.5 text-xs text-accent-700">SANDBOX transaction – not real money.</p>}
            </CardBody>
          </Card>
          {finance && (audit ?? []).length > 0 && (
            <Card>
              <CardHeader title="Audit" />
              <ul className="divide-y divide-border text-xs">{audit!.map((a) => <li key={a.id} className="px-4 py-2 sm:px-5"><span className="font-medium">{humanize(a.action.replace(/\./g, " "))}</span><span className="block text-muted">{formatDateTime(a.occurred_at)} · {(a.actor_roles ?? []).join(", ") || "system"}</span></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
