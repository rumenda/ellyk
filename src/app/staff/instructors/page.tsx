import type { Metadata } from "next";
import { IdCard } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, MobileRow } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { decideTimeOff } from "@/features/ops/actions";
import { getInstructors, getLocations } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Instructors" };

export default async function InstructorsPage() {
  await requireRole("manager", "admin");
  const supabase = await createClient();
  const weekAgo = new Date(nowMs() - 7 * 86_400_000).toISOString();
  const weekAhead = new Date(nowMs() + 7 * 86_400_000).toISOString();
  const [instructors, locations, { data: enrs }, { data: sessions }, { data: leave }, { data: certs }] = await Promise.all([
    getInstructors(), getLocations(),
    supabase.from("enrolments").select("assigned_instructor_id").in("status", ["active", "training_complete"]),
    supabase.from("training_sessions").select("instructor_id, starts_at, ends_at").gte("starts_at", weekAgo).lte("starts_at", weekAhead).not("status", "in", "(cancelled,rescheduled)"),
    supabase.from("instructor_time_off").select("id, instructor_id, starts_at, ends_at, reason, status").eq("status", "pending"),
    supabase.from("instructor_certifications").select("instructor_id, certification_type, expires_on").lte("expires_on", new Date(nowMs() + 45 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  const rows = instructors.map((i) => ({
    ...i,
    students: (enrs ?? []).filter((e) => e.assigned_instructor_id === i.id).length,
    hours: Math.round((sessions ?? []).filter((s) => s.instructor_id === i.id).reduce((h, s) => h + (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 3_600_000, 0)),
    locs: i.locationIds.map((l) => locations.find((x) => x.id === l)?.name).filter(Boolean).join(", "),
    expiring: (certs ?? []).filter((c) => c.instructor_id === i.id),
  }));
  type Row = (typeof rows)[number];
  return (
    <div>
      <PageHeader title="Instructors" description="Workload over the last and next 7 days. Instructor accounts are created in Settings → Users." />
      {(leave ?? []).length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Leave requests" />
          <ul className="divide-y divide-border text-sm">
            {leave!.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                <span>{instructors.find((i) => i.id === l.instructor_id)?.name} · {formatDate(l.starts_at)} – {formatDate(l.ends_at)}<span className="block text-xs text-muted">{l.reason}</span></span>
                <span className="flex gap-2">
                  <ActionButton size="sm" action={async () => { "use server"; return decideTimeOff(l.id, true); }}>Approve</ActionButton>
                  <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return decideTimeOff(l.id, false); }}>Decline</ActionButton>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <DataTable<Row> rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/staff/instructors/${r.id}`} caption="Instructors" empty={<EmptyState icon={IdCard} title="No instructors yet" />}
          columns={[
            { key: "n", header: "Instructor", cell: (r) => <span>{r.name}<span className="block text-xs font-normal text-muted">{r.employee_number} · {formatPhone(r.profile?.phone)}</span></span> },
            { key: "l", header: "Locations", cell: (r) => r.locs || "—" },
            { key: "s", header: "Active students", align: "right", cell: (r) => r.students },
            { key: "h", header: "Teaching hours (±7d)", align: "right", cell: (r) => r.hours },
            { key: "c", header: "Certification", cell: (r) => r.expiring.length ? <StatusBadge status="due" label={`Expires ${formatDate(r.expiring[0]!.expires_on)}`} /> : <StatusBadge status="verified" label="Valid" /> },
            { key: "a", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "withdrawn"} label={r.is_active ? "Active" : "Inactive"} /> },
          ]}
          mobile={(r) => <MobileRow title={r.name} subtitle={r.locs} right={<span className="text-sm"><b>{r.students}</b> students<span className="block text-xs text-muted">{r.hours} h</span></span>} />} />
      </Card>
    </div>
  );
}
