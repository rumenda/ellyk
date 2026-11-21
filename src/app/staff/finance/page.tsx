import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Banknote, Building2, Code2, Landmark, Receipt, Scale, Wallet } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { BarChart, HBarChart } from "@/components/ui/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Alert, ErrorState } from "@/components/ui/states";
import { getLocations, locationOptions } from "@/features/staff/lookups";
import { formatDate, formatKES, humanize, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Finance" };

interface Fin {
  period: { from: string; to: string }; collected: number; collected_today: number; unmatched_count: number; unmatched_amount: number;
  pending_verification: number; receivables: number; overdue_amount: number; overdue_instalments: number; ntsa_held: number; ntsa_paid: number;
  developer_collected: number; developer_unsettled: number; developer_payable: number; unapplied_receipts: number; revenue: number; expenses: number;
  vat_output: number; mpesa_today: { received: number; matched: number; unmatched: number; amount: number };
  collections_by_day: { day: string; value: number }[]; collections_by_source: { label: string; value: number }[];
}

export default async function FinanceOverview({ searchParams }: { searchParams: Promise<{ location?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [locations, { data, error }, etims] = await Promise.all([
    getLocations(),
    supabase.rpc("dashboard_finance", { p_location: sp.location || undefined, p_from: sp.from || undefined, p_to: sp.to || undefined }),
    supabase.from("etims_submissions").select("id", { count: "exact", head: true }).in("status", ["pending", "failed"]),
  ]);
  const d = data as unknown as Fin | null;
  return (
    <div>
      <PageHeader title="Finance" description={d ? `${formatDate(d.period.from)} – ${formatDate(d.period.to)}` : undefined}
        actions={<a href={`/api/reports/collections.csv?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][])}`} className="text-sm font-medium text-brand-700 hover:underline">Export collections (CSV)</a>} />
      <Card className="mb-5"><FilterBar className="border-b-0" filters={[
        { name: "location", label: "All locations", options: locationOptions(locations) },
        { name: "from", label: "From", type: "date" }, { name: "to", label: "To", type: "date" },
      ]} /></Card>
      {error || !d ? <Card><ErrorState /></Card> : (
        <div className="space-y-5">
          {(d.unmatched_count > 0 || d.pending_verification > 0) && (
            <Alert tone="warning" title="Reconciliation needed" icon={AlertTriangle}>
              {d.unmatched_count > 0 && <p><Link className="font-semibold underline" href="/staff/payments?tab=unmatched">{d.unmatched_count} unmatched M-Pesa payment{d.unmatched_count > 1 ? "s" : ""}</Link> totalling {formatKES(d.unmatched_amount)}.</p>}
              {d.pending_verification > 0 && <p><Link className="font-semibold underline" href="/staff/payments?tab=pending">{d.pending_verification} cash/bank payment{d.pending_verification > 1 ? "s" : ""}</Link> awaiting verification.</p>}
            </Alert>
          )}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Collected (period)" value={formatKES(d.collected)} icon={Wallet} tone="success" hint={`Today: ${formatKES(d.collected_today)}`} />
            <StatCard label="Student receivables" value={formatKES(d.receivables)} icon={Scale} hint={`${formatKES(d.overdue_amount)} overdue (${d.overdue_instalments} instalments)`} href="/staff/reports/outstanding" />
            <StatCard label="School revenue (period)" value={formatKES(d.revenue)} icon={Building2} tone="brand" hint={`Expenses ${formatKES(d.expenses)}`} />
            <StatCard label="Unapplied receipts" value={formatKES(d.unapplied_receipts)} icon={Receipt} hint="Unmatched + student credit" />
            <StatCard label="NTSA funds held" value={formatKES(d.ntsa_held)} icon={Landmark} tone="warning" hint={`Paid to NTSA in period: ${formatKES(d.ntsa_paid)}`} href="/staff/ntsa" />
            <StatCard label="Developer fees collected" value={formatKES(d.developer_collected)} icon={Code2} hint={`Owed to platform: ${formatKES(d.developer_payable)}`} href="/staff/finance/settlements" />
            <StatCard label="Developer fees unsettled" value={formatKES(d.developer_unsettled)} icon={Banknote} hint="Not yet in a settlement batch" href="/staff/finance/settlements" />
            <StatCard label="M-Pesa today" value={`${d.mpesa_today.matched}/${d.mpesa_today.received} matched`} icon={Wallet} tone={d.mpesa_today.unmatched ? "danger" : "neutral"} hint={formatKES(d.mpesa_today.amount)} />
          </section>
          <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
            <Card className="lg:col-span-2"><CardHeader title="Daily collections" /><CardBody>
              <BarChart money valueLabel="KES" data={d.collections_by_day.map((x) => ({ label: x.day.slice(8), value: toNumber(x.value) }))} />
            </CardBody></Card>
            <Card><CardHeader title="By payment method" /><CardBody>
              <HBarChart money valueLabel="KES" data={d.collections_by_source.map((x) => ({ label: x.label === "mpesa_c2b" ? "M-Pesa" : humanize(x.label), value: toNumber(x.value) }))} />
            </CardBody></Card>
          </div>
          <Card>
            <CardHeader title="Fund separation" description="Money in the Paybill is not all school income" />
            <CardBody className="grid gap-4 text-sm sm:grid-cols-4">
              <div><p className="text-muted">School revenue (period)</p><p className="text-lg font-semibold"><Money value={d.revenue} /></p></div>
              <div><p className="text-muted">NTSA funds held for students</p><p className="text-lg font-semibold"><Money value={d.ntsa_held} /></p></div>
              <div><p className="text-muted">Owed to platform developer</p><p className="text-lg font-semibold"><Money value={d.developer_payable} /></p></div>
              <div><p className="text-muted">VAT output (period)</p><p className="text-lg font-semibold"><Money value={d.vat_output} /></p></div>
            </CardBody>
          </Card>
          <p className="text-xs text-muted">eTIMS: {etims.count ?? 0} invoice(s) pending submission. Submissions are only marked complete when the eTIMS provider confirms them – see docs/FINANCE.md.</p>
        </div>
      )}
    </div>
  );
}
