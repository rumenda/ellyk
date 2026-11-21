import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { decideRefund, payRefund } from "@/features/payments/actions";
import { formatDate, fullName, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Refunds" };

export default async function RefundsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("refunds").select("*, student:students(id, student_number, first_name, middle_name, last_name), requester:profiles!refunds_requested_by_fkey(full_name)").order("requested_at", { ascending: false }).limit(200);
  return (
    <div>
      <PageHeader title="Refunds" description="Paid out of a student's unapplied credit. Approval requires a second person." />
      <Card>
        {(data ?? []).length === 0 ? <EmptyState title="No refund requests" description="Request refunds from a student's Fees tab when they have credit." /> : (
          <ul className="divide-y divide-border">
            {data!.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0 text-sm">
                  <p className="font-medium"><Money value={r.amount} /> · {r.student && <Link className="hover:underline" href={`/staff/students/${r.student.id}?tab=finance`}>{fullName(r.student)}</Link>}</p>
                  <p className="text-muted">{r.refund_number} · {humanize(r.method)} · {r.reason}</p>
                  <p className="text-xs text-subtle">Requested {formatDate(r.requested_at)} by {r.requester?.full_name}{r.payout_reference ? ` · paid ref ${r.payout_reference}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === "requested" && <>
                    <ActionButton size="sm" action={async () => { "use server"; return decideRefund(r.id, true); }} confirm={{ title: "Approve refund?", description: "You must not approve your own request." }}>Approve</ActionButton>
                    <ActionButton size="sm" variant="secondary" requireReason action={async (n) => { "use server"; return decideRefund(r.id, false, n); }} confirm={{ title: "Reject refund", confirmLabel: "Reject" }}>Reject</ActionButton>
                  </>}
                  {r.status === "approved" && <ActionButton size="sm" requireReason reasonLabel="Payout reference (M-Pesa / bank / cash voucher)" action={async (ref) => { "use server"; return payRefund(r.id, ref ?? ""); }}
                    confirm={{ title: "Mark refund as paid", confirmLabel: "Mark paid" }}>Mark paid</ActionButton>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
