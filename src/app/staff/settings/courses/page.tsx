import type { Metadata } from "next";
import Link from "next/link";
import { CourseDialog } from "@/components/staff/pricing-forms";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { DataTable, MobileRow } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getLocations } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Courses & pricing" };

export default async function CoursesSettings() {
  await requireRole("manager", "accountant");
  const supabase = await createClient();
  const [locations, { data: lcs }, { data: courses }] = await Promise.all([
    getLocations(), supabase.from("licence_classes").select("id, name").order("code"),
    supabase.from("courses").select("*, licence:licence_classes(name), course_locations(location_id), versions:course_price_versions(id, version, status, course_price_items(amount))").order("name"),
  ]);
  const rows = (courses ?? []).map((c) => {
    const active = c.versions.find((v) => v.status === "active");
    return { ...c, activeVersion: active?.version, total: active ? active.course_price_items.reduce((s, i) => s + Number(i.amount), 0) : null, drafts: c.versions.filter((v) => v.status === "draft").length };
  });
  type Row = (typeof rows)[number];
  return (
    <div>
      <PageHeader title="Courses & pricing" breadcrumbs={[{ label: "Settings", href: "/staff/settings" }, { label: "Courses" }]}
        actions={<CourseDialog licenceClasses={(lcs ?? []).map((l) => ({ id: l.id, name: l.name }))} locations={locations.map((l) => ({ id: l.id, name: l.name }))} />} />
      <Card>
        <DataTable<Row> rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/staff/settings/courses/${r.id}`} caption="Courses" empty={<EmptyState title="No courses yet" />}
          columns={[
            { key: "n", header: "Course", cell: (r) => <span>{r.name}<span className="block text-xs font-normal text-muted">{r.code} · {r.licence?.name}</span></span> },
            { key: "d", header: "Lessons", cell: (r) => `${r.theory_sessions} theory · ${r.practical_sessions} practical · ${r.duration_weeks} wks` },
            { key: "p", header: "Current price", cell: (r) => r.total !== null ? <span><Money value={r.total} /> <span className="text-xs text-muted">v{r.activeVersion}</span></span> : <StatusBadge status="pending" label="No price" /> },
            { key: "dr", header: "Drafts", cell: (r) => r.drafts || "—" },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.is_active ? "active" : "closed"} label={r.is_active ? "Open" : "Closed"} /> },
          ]}
          mobile={(r) => <MobileRow title={r.name} subtitle={r.code} right={r.total !== null ? <Money value={r.total} /> : "No price"} />} />
      </Card>
      <p className="mt-3 text-xs text-muted">Need a new licence class (e.g. Class B cars)? Licence classes are reference data – add them via a migration or ask your developer; courses for them are then configured here. <Link href="/staff/settings/competencies" className="underline">Competencies</Link> can be scoped per class.</p>
    </div>
  );
}
