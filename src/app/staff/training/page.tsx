import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { DataTable, MobileRow } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { LinkTabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { buildHref, getLocations, locationOptions } from "@/features/staff/lookups";
import { normalizeProgress } from "@/features/student/queries";
import { hasRole, requireRole } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Training" };

export default async function TrainingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("manager", "admin", "instructor");
  const sp = await searchParams;
  const view = sp.view ?? "all";
  const supabase = await createClient();
  const locations = await getLocations();
  let q = supabase.from("enrolments").select("id, status, location_id, student:students(id, student_number, first_name, middle_name, last_name), course:courses(name), instructor:instructors(profile:profiles(full_name))")
    .in("status", ["active", "training_complete"]);
  if (sp.location) q = q.eq("location_id", sp.location);
  if (sp.mine === "1" && user.instructorId) q = q.eq("assigned_instructor_id", user.instructorId);
  const { data: enrs } = await q.limit(300);
  const ids = (enrs ?? []).map((e) => e.id);
  const { data: progress } = ids.length ? await supabase.from("v_enrolment_progress").select("*").in("enrolment_id", ids) : { data: [] };
  let rows = (enrs ?? []).map((e) => {
    const p = normalizeProgress((progress ?? []).find((x) => x.enrolment_id === e.id) ?? {});
    return { ...e, p, name: e.student ? fullName(e.student) : "" };
  });
  if (view === "ready") rows = rows.filter((r) => r.p.competencies_complete || r.status === "training_complete");
  if (view === "attention") rows = rows.filter((r) => r.p.missed_sessions >= 2 || (r.p.sessions_marked > 3 && r.p.competency_progress_pct < 25));
  rows.sort((a, b) => b.p.competency_progress_pct - a.p.competency_progress_pct);
  type Row = (typeof rows)[number];

  return (
    <div>
      <PageHeader title="Training progress" description="Attendance and competency sign-off for active students" />
      <LinkTabs active={view} tabs={[
        { key: "all", label: "All active", href: buildHref("/staff/training", sp, { view: undefined }) },
        { key: "ready", label: "Ready for test", href: buildHref("/staff/training", sp, { view: "ready" }) },
        { key: "attention", label: "Needs attention", href: buildHref("/staff/training", sp, { view: "attention" }) },
      ]} />
      <Card>
        <FilterBar filters={[
          { name: "location", label: "All locations", options: locationOptions(locations) },
          ...(hasRole(user, "instructor") ? [{ name: "mine", label: "All students", options: [{ value: "1", label: "My students only" }] }] : []),
        ]} />
        <DataTable<Row> rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/staff/training/${r.id}`} caption="Training progress"
          empty={<EmptyState icon={GraduationCap} title="No students in this view" />}
          columns={[
            { key: "n", header: "Student", cell: (r) => <span>{r.name}<span className="block text-xs font-normal text-muted">{r.student?.student_number} · {r.course?.name}</span></span> },
            { key: "i", header: "Instructor", cell: (r) => r.instructor?.profile?.full_name ?? "—" },
            { key: "l", header: "Lessons", cell: (r) => <span className="tabular">{r.p.theory_attended + r.p.practical_attended}/{r.p.theory_required + r.p.practical_required}{r.p.missed_sessions > 0 && <span className="ml-2 text-xs text-danger-700">{r.p.missed_sessions} missed</span>}</span> },
            { key: "c", header: "Skills", cell: (r) => <div className="w-40"><ProgressBar value={r.p.competency_progress_pct} tone="success" label="Skills" /><span className="text-xs text-muted">{r.p.competencies_competent}/{r.p.competencies_required}</span></div> },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]}
          mobile={(r) => <MobileRow title={r.name} subtitle={`${r.p.competencies_competent}/${r.p.competencies_required} skills · ${r.p.theory_attended + r.p.practical_attended} lessons`}
            meta={<ProgressBar value={r.p.competency_progress_pct} tone="success" className="w-32" />} right={<StatusBadge status={r.status} />} />} />
      </Card>
      <p className="mt-3 text-xs text-muted">Competencies are configured in <Link className="underline" href="/staff/settings/competencies">Settings</Link>.</p>
    </div>
  );
}
