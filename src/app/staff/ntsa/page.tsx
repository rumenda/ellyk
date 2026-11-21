import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { DataTable, MobileRow } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { LinkTabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { buildHref, getLocations, locationOptions } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatDateTime, fullName, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "NTSA" };
type S = Database["public"]["Enums"]["ntsa_status"];
const QUEUES: Record<string, { label: string; statuses: S[] }> = {
  documents: { label: "Documents", statuses: ["not_started", "documents_pending"] },
  payment: { label: "Awaiting NTSA payment", statuses: ["ready_for_payment", "payment_pending"] },
  booking: { label: "Awaiting booking", statuses: ["paid_by_school", "booking_pending", "test_booked"] },
  tests: { label: "Tests scheduled", statuses: ["test_scheduled", "test_completed"] },
  retest: { label: "Failed / retest", statuses: ["failed_retest_required"] },
  done: { label: "Passed & completed", statuses: ["passed", "completed"] },
};

export default async function NtsaQueue({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("manager", "admin", "accountant");
  const sp = await searchParams;
  const queue = sp.queue && QUEUES[sp.queue] ? sp.queue : "payment";
  const supabase = await createClient();
  const locations = await getLocations();
  const [{ data: all }, { data: funds }] = await Promise.all([
    supabase.from("ntsa_processes").select("id, status, status_changed_at, test_date, test_centre, booking_reference, ntsa_amount, student:students(student_number, first_name, middle_name, last_name), enrolment:enrolments!inner(location_id, status), responsible:profiles(full_name)"),
    supabase.from("v_ntsa_funds").select("process_id, ntsa_collected, ntsa_remitted, ntsa_held"),
  ]);
  const rows = (all ?? []).filter((r) => !sp.location || r.enrolment?.location_id === sp.location).map((r) => {
    const f = (funds ?? []).find((x) => x.process_id === r.id);
    const days = Math.floor((nowMs() - Date.parse(r.status_changed_at)) / 86_400_000);
    return { ...r, held: toNumber(f?.ntsa_held), collected: toNumber(f?.ntsa_collected), remitted: toNumber(f?.ntsa_remitted), days, name: r.student ? fullName(r.student) : "" };
  });
  const count = (k: string) => rows.filter((r) => QUEUES[k]!.statuses.includes(r.status)).length;
  const shown = rows.filter((r) => QUEUES[queue]!.statuses.includes(r.status)).sort((a, b) => b.days - a.days);
  const weekAhead = nowMs() + 7 * 86_400_000;
  type Row = (typeof shown)[number];

  return (
    <div>
      <PageHeader title="NTSA work queue" description="Track documents, NTSA payments made by the school, bookings, tests and results. NTSA actions are performed on eCitizen/NTSA and recorded here." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Awaiting NTSA payment" value={count("payment")} tone="warning" href={buildHref("/staff/ntsa", sp, { queue: "payment" })} />
        <StatCard label="Awaiting booking" value={count("booking")} href={buildHref("/staff/ntsa", sp, { queue: "booking" })} />
        <StatCard label="Tests this week" value={rows.filter((r) => r.status === "test_scheduled" && r.test_date && Date.parse(r.test_date) <= weekAhead && Date.parse(r.test_date) >= nowMs() - 86_400_000).length} tone="brand" href={buildHref("/staff/ntsa", sp, { queue: "tests" })} />
        <StatCard label="Stuck > 14 days" value={rows.filter((r) => r.days > 14 && !["passed", "completed"].includes(r.status)).length} tone="danger" />
      </div>
      <LinkTabs active={queue} tabs={Object.entries(QUEUES).map(([k, q]) => ({ key: k, label: q.label, href: buildHref("/staff/ntsa", sp, { queue: k }), count: count(k) }))} />
      <Card>
        <FilterBar filters={[{ name: "location", label: "All locations", options: locationOptions(locations) }]} />
        <DataTable<Row> rows={shown} rowKey={(r) => r.id} rowHref={(r) => `/staff/ntsa/${r.id}`} caption="NTSA queue"
          empty={<EmptyState icon={ClipboardCheck} title="Nobody in this queue" />}
          columns={[
            { key: "n", header: "Student", cell: (r) => <span>{r.name}<span className="block text-xs font-normal text-muted">{r.student?.student_number}</span></span> },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "f", header: "NTSA funds", cell: (r) => <span className="text-xs"><Money value={r.collected} /> collected · <Money value={r.remitted} /> paid<span className="block text-muted">of <Money value={r.ntsa_amount} /></span></span> },
            { key: "t", header: "Test", cell: (r) => r.test_date ? <span className="text-xs">{formatDateTime(r.test_date)}<span className="block text-muted">{r.test_centre}</span></span> : <span className="text-muted">—</span> },
            { key: "d", header: "In status", cell: (r) => <span className={r.days > 14 ? "font-medium text-danger-700" : ""}>{r.days}d<span className="block text-xs text-muted">since {formatDate(r.status_changed_at)}</span></span> },
          ]}
          mobile={(r) => <MobileRow title={r.name} subtitle={`${r.student?.student_number} · ${r.days} days in status`} right={<StatusBadge status={r.status} />} />} />
      </Card>
    </div>
  );
}
