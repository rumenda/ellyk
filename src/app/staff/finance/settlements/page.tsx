import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { Money } from "@/components/money";
import { SettlementDialog } from "@/components/staff/finance-forms";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { settlementAction } from "@/features/finance/actions";
import { formatDate, formatKES, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Developer settlements" };

export default async function SettlementsPage() {
  const supabase = await createClient();
  const [{ data: summary }, { data: list }] = await Promise.all([
    supabase.rpc("platform_fee_summary"),
    supabase.from("developer_settlements").select("*").order("created_at", { ascending: false }),
  ]);
  const s = (summary ?? {}) as Record<string, number>;
  return (
    <div>
      <PageHeader title="Developer service-fee settlements" description="The service fee belongs to the platform owner. Reconcile and settle it here without changing its ownership." actions={<SettlementDialog />} />
      <Card className="mb-5">
        <CardBody className="grid gap-4 text-sm sm:grid-cols-4">
          <div><p className="text-muted">Charged to students</p><p className="text-lg font-semibold">{formatKES(s.charged_total)}</p></div>
          <div><p className="text-muted">Collected</p><p className="text-lg font-semibold">{formatKES(s.collected_total)}</p></div>
          <div><p className="text-muted">Unsettled (not batched)</p><p className="text-lg font-semibold">{formatKES(s.unsettled)}</p></div>
          <div><p className="text-muted">Settled to date</p><p className="text-lg font-semibold">{formatKES(s.settled)}</p></div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Settlement batches" />
        {(list ?? []).length === 0 ? <EmptyState title="No settlements yet" /> : (
          <ul className="divide-y divide-border">
            {list!.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="text-sm">
                  <p className="font-medium">{d.settlement_number} · <Money value={d.amount} /></p>
                  <p className="text-muted">{d.item_count} collections up to {formatDate(d.period_end)}{d.payout_reference ? ` · paid ref ${d.payout_reference}` : ""}{d.paid_at ? ` on ${formatDate(d.paid_at)}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  {d.status === "draft" && <ActionButton size="sm" action={async () => { "use server"; return settlementAction(d.id, "approve"); }}>Approve</ActionButton>}
                  {d.status === "approved" && <ActionButton size="sm" requireReason reasonLabel="Payout reference" action={async (r) => { "use server"; return settlementAction(d.id, "pay", r, "bank_transfer"); }}
                    confirm={{ title: `Pay ${formatKES(toNumber(d.amount))} to the platform owner`, description: "Posts Dr Developer Fees Payable / Cr Bank.", confirmLabel: "Mark paid" }}>Mark paid</ActionButton>}
                  {["draft", "approved"].includes(d.status) && <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return settlementAction(d.id, "cancel"); }} confirm={{ title: "Cancel this batch?", description: "Its collections return to the unsettled pool." }}>Cancel</ActionButton>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
