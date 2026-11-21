import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityForm, LocationsForm, TimeOffDialog } from "@/components/staff/ops-forms";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { getLocations } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDate, formatDateShort, formatPhone, formatTime, fullName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Instructor" };

export default async function InstructorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("manager", "admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data: ins } = await supabase.from("instructors").select("*, profile:profiles(full_name, phone, email), instructor_locations(location_id)").eq("id", id).maybeSingle();
  if (!ins) notFound();
  const since = new Date(nowMs() - 30 * 86_400_000).toISOString();
  const [locations, { data: avail }, { data: leave }, { data: certs }, { data: students }, { data: sessions }, { data: att }] = await Promise.all([
    getLocations(),
    supabase.from("instructor_availability").select("*").eq("instructor_id", id),
    supabase.from("instructor_time_off").select("*").eq("instructor_id", id).order("starts_at", { ascending: false }).limit(10),
    supabase.from("instructor_certifications").select("*").eq("instructor_id", id),
    supabase.from("enrolments").select("id, status, student:students(id, student_number, first_name, middle_name, last_name)").eq("assigned_instructor_id", id).in("status", ["active", "training_complete"]),
    supabase.from("training_sessions").select("id, title, starts_at, status").eq("instructor_id", id).gte("starts_at", new Date().toISOString()).not("status", "in", "(cancelled,rescheduled)").order("starts_at").limit(8),
    supabase.from("attendance").select("status, session:training_sessions!inner(instructor_id, starts_at)").eq("session.instructor_id", id).gte("session.starts_at", since),
  ]);
  const marked = att ?? [];
  const rate = marked.length ? Math.round((marked.filter((a) => a.status === "present" || a.status === "late").length / marked.length) * 100) : null;
  const myLocs = locations.filter((l) => ins.instructor_locations.some((x) => x.location_id === l.id)).map((l) => ({ id: l.id, name: l.name }));
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Instructors", href: "/staff/instructors" }, { label: ins.profile?.full_name ?? "" }]}
        title={<span className="flex items-center gap-2">{ins.profile?.full_name}<StatusBadge status={ins.is_active ? "active" : "withdrawn"} label={ins.is_active ? "Active" : "Inactive"} /></span>}
        description={`${ins.employee_number} · ${formatPhone(ins.profile?.phone)} · ${ins.profile?.email ?? ""}`} actions={<TimeOffDialog instructorId={id} />} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Active students" value={(students ?? []).length} hint={`Max ${ins.max_active_students}`} />
        <StatCard label="Upcoming sessions" value={(sessions ?? []).length} />
        <StatCard label="Attendance (30 days)" value={rate === null ? "—" : `${rate}%`} hint={`${marked.length} marks`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-2">
          <Card><CardHeader title="Assigned students" />
            <ul className="divide-y divide-border text-sm">{(students ?? []).map((e) => e.student && (
              <li key={e.id}><Link href={`/staff/training/${e.id}`} className="flex justify-between px-4 py-2.5 hover:bg-surface-muted/60 sm:px-5"><span>{fullName(e.student)} <span className="text-muted">· {e.student.student_number}</span></span><StatusBadge status={e.status} /></Link></li>
            ))}{(students ?? []).length === 0 && <li className="px-5 py-3 text-muted">No students assigned.</li>}</ul>
          </Card>
          <Card><CardHeader title="Upcoming sessions" />
            <ul className="divide-y divide-border text-sm">{(sessions ?? []).map((s) => (
              <li key={s.id}><Link href={`/staff/schedule/${s.id}`} className="flex justify-between px-4 py-2.5 hover:bg-surface-muted/60 sm:px-5"><span>{s.title}</span><span className="text-muted">{formatDateShort(s.starts_at)} {formatTime(s.starts_at)}</span></Link></li>
            ))}</ul>
          </Card>
        </div>
        <div className="space-y-5">
          <Card><CardHeader title="Weekly availability" /><CardBody>{myLocs.length ? <AvailabilityForm instructorId={id} locations={myLocs} current={avail ?? []} /> : <p className="text-sm text-muted">Assign a location first.</p>}</CardBody></Card>
          {hasRole(user, "manager") && <Card><CardHeader title="Locations" /><CardBody><LocationsForm instructorId={id} locations={locations.map((l) => ({ id: l.id, name: l.name }))} current={ins.instructor_locations.map((l) => l.location_id)} /></CardBody></Card>}
          <Card><CardHeader title="Certifications" />
            <ul className="divide-y divide-border text-sm">{(certs ?? []).map((c) => (
              <li key={c.id} className="px-4 py-2.5 sm:px-5"><p className="font-medium">{c.certification_type}</p><p className="text-xs text-muted">{c.certificate_number} · expires {formatDate(c.expires_on)}</p></li>
            ))}</ul>
            {ins.qualifications && <CardBody className="border-t border-border text-sm text-muted">{ins.qualifications}</CardBody>}
          </Card>
          <Card><CardHeader title="Leave" />
            <ul className="divide-y divide-border text-sm">{(leave ?? []).map((l) => (
              <li key={l.id} className="flex justify-between gap-2 px-4 py-2.5 sm:px-5"><span>{formatDate(l.starts_at)} – {formatDate(l.ends_at)}<span className="block text-xs text-muted">{l.reason}</span></span><StatusBadge status={l.status} /></li>
            ))}{(leave ?? []).length === 0 && <li className="px-5 py-3 text-muted">None recorded.</li>}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
