import type { Metadata } from "next";
import { Banknote, CalendarDays, Code2, Hourglass } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { BarChart, HBarChart } from "@/components/ui/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, MobileRow, Pagination } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { buildHref, pageParam } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatKES, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Platform fees" };

interface Summary {
  today: number; week: number; month: number; collected_total: number; charged_total: number; outstanding: number; settled: number;
  in_settlement: number; unsettled: number; paying_students: number; by_location: { label: string; value: number }[];
  by_course: { label: string; value: number }[]; by_month: { month: string; value: number }[];
  settlements: { settlement_number: string; period_end: string; amount: number; item_count: number; status: string; paid_at: string | null; payout_reference: string | null }[];
}

/**
 * Platform owner view: only service-fee data (student numbers, never names,
 * phones, IDs or school finances).
 */
export default async function PlatformPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("platform_owner", "manager", "accountant");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await createClient();
  const [{ data: s }, { data: ledger }] = await Promise.all([
    supabase.rpc("platform_fee_summary"),
    supabase.rpc("platform_fee_ledger", { p_from: sp.from || undefined, p_to: sp.to || undefined, p_limit: 25, p_offset: (page - 1) * 25 }),
  ]);
  const d = s as unknown as Summary;
  const rows = ledger ?? [];
  type Row = (typeof rows)[number];
  return (
    <div>
      <PageHeader title="Platform service fees" description="Fees charged to students on behalf of the system provider. Tracked separately from school revenue." />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected today" value={formatKES(d.today)} icon={CalendarDays} tone="brand" hint={`This week ${formatKES(d.week)}`} />
        <StatCard label="This month" value={formatKES(d.month)} icon={Code2} tone="success" hint={`All time ${formatKES(d.collected_total)}`} />
        <StatCard label="Awaiting settlement" value={formatKES(toNumber(d.unsettled) + toNumber(d.in_settlement))} icon={Hourglass} tone="warning" hint={`${formatKES(d.in_settlement)} in prepared batches`} />
        <StatCard label="Settled to you" value={formatKES(d.settled)} icon={Banknote} hint={`Not yet collected from students: ${formatKES(d.outstanding)}`} />
      </section>
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card><CardHeader title="By month" /><CardBody><BarChart money valueLabel="KES" data={d.by_month.map((m) => ({ label: m.month.slice(5), value: toNumber(m.value) }))} /></CardBody></Card>
        <Card><CardHeader title="By location" /><CardBody><HBarChart money valueLabel="KES" data={d.by_location} /></CardBody></Card>
        <Card><CardHeader title="By course" description={`${d.paying_students} students have paid a service fee`} /><CardBody><HBarChart money valueLabel="KES" data={d.by_course} /></CardBody></Card>
      </div>
      <Card className="mb-5">
        <CardHeader title="Settlement history" />
        <ul className="divide-y divide-border text-sm">{d.settlements.map((x) => (
          <li key={x.settlement_number} className="flex justify-between gap-3 px-5 py-2.5"><span>{x.settlement_number} · {x.item_count} collections to {formatDate(x.period_end)}{x.payout_reference ? ` · ref ${x.payout_reference}` : ""}</span><span className="flex items-center gap-2"><Money value={x.amount} /><StatusBadge status={x.status} /></span></li>
        ))}{d.settlements.length === 0 && <li className="px-5 py-3 text-muted">No settlements yet.</li>}</ul>
      </Card>
      <Card>
        <CardHeader title="Service-fee ledger" description="One line per allocation (reversals are negative)" />
        <FilterBar filters={[{ name: "from", label: "From", type: "date" }, { name: "to", label: "To", type: "date" }]} />
        <DataTable<Row> rows={rows} rowKey={(r) => r.allocation_id} caption="Service fee ledger"
          columns={[
            { key: "d", header: "Collected", cell: (r) => formatDate(r.collected_on) },
            { key: "s", header: "Student no.", cell: (r) => r.student_number },
            { key: "c", header: "Course", cell: (r) => r.course },
            { key: "l", header: "Location", cell: (r) => r.location },
            { key: "b", header: "Settlement", cell: (r) => r.settlement_number ? <span>{r.settlement_number} <StatusBadge status={r.settlement_status} /></span> : <StatusBadge status="pending" label="Unsettled" /> },
            { key: "a", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} /> },
          ]}
          mobile={(r) => <MobileRow title={<Money value={r.amount} />} subtitle={`${r.student_number} · ${formatDate(r.collected_on)}`} right={r.settlement_number ?? "Unsettled"} />} />
        <Pagination page={page} pageSize={25} total={Number(rows[0]?.total_count ?? 0)} hrefFor={(p) => buildHref("/staff/platform", sp, { page: p })} />
      </Card>
    </div>
  );
}
