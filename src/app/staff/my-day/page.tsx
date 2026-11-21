import type { Metadata } from "next";
import Link from "next/link";
import { AlertOctagon, Bike, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { IncidentDialog } from "@/components/staff/incident-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { formatDateShort, formatTime, todayKE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "My day" };

export default async function MyDayPage() {
  const user = await requireRole("instructor");
  const supabase = await createClient();
  const today = todayKE();
  const start = new Date(`${today}T00:00:00+03:00`).toISOString();
  const weekEnd = new Date(Date.parse(start) + 7 * 86_400_000).toISOString();
  const [{ data: sessions }, { count: students }, { data: unmarked }, { data: vehicles }] = await Promise.all([
    supabase.from("training_sessions").select("id, title, lesson_type, starts_at, ends_at, status, capacity, location:locations(name), session_bookings(id, status, vehicle:vehicles(registration))")
      .eq("instructor_id", user.instructorId!).gte("starts_at", start).lt("starts_at", weekEnd).not("status", "in", "(cancelled,rescheduled)").order("starts_at"),
    supabase.from("enrolments").select("id", { count: "exact", head: true }).eq("assigned_instructor_id", user.instructorId!).in("status", ["active", "training_complete"]),
    supabase.from("training_sessions").select("id, title, starts_at, attendance(id), session_bookings(id)").eq("instructor_id", user.instructorId!)
      .lt("starts_at", new Date().toISOString()).gte("starts_at", new Date(nowMs() - 14 * 86_400_000).toISOString()).not("status", "in", "(cancelled,rescheduled)"),
    supabase.from("vehicles").select("id, registration, make, model, location_id").eq("is_active", true),
  ]);
  const todays = (sessions ?? []).filter((s) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date(s.starts_at)) === today);
  const upcoming = (sessions ?? []).filter((s) => !todays.includes(s)).slice(0, 8);
  const pendingAttendance = (unmarked ?? []).filter((s) => s.session_bookings.length > 0 && s.attendance.length < s.session_bookings.length);

  const row = (s: (typeof todays)[number]) => {
    const n = s.session_bookings.filter((b) => b.status === "booked").length;
    return (
      <li key={s.id}>
        <Link href={`/staff/schedule/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-muted sm:px-5">
          <div className="w-16 shrink-0"><p className="text-sm font-semibold tabular">{formatTime(s.starts_at)}</p><p className="text-xs text-muted tabular">{formatTime(s.ends_at)}</p></div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-medium">{s.title}</p>
            <p className="flex flex-wrap gap-x-3 text-xs text-muted"><span className="flex items-center gap-1"><MapPin className="size-3" />{s.location?.name}</span>
              <span className="flex items-center gap-1"><Users className="size-3" />{n}/{s.capacity}</span>
              {s.session_bookings.some((b) => b.vehicle) && <span className="flex items-center gap-1"><Bike className="size-3" />{s.session_bookings.filter((b) => b.vehicle).map((b) => b.vehicle!.registration).join(", ")}</span>}</p>
          </div>
          {s.status !== "scheduled" && <StatusBadge status={s.status} />}
          <ChevronRight className="size-4 text-subtle" />
        </Link>
      </li>
    );
  };

  return (
    <div>
      <PageHeader title={`Hello, ${user.fullName.split(" ")[0]}`} description={formatDateShort(today)}
        actions={<IncidentDialog vehicles={(vehicles ?? []).map((v) => ({ id: v.id, label: `${v.registration} · ${v.make} ${v.model}` }))} />} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Today" value={todays.length} icon={Clock} tone="brand" />
        <StatCard label="My students" value={students ?? 0} icon={Users} href="/staff/students" />
        <StatCard label="To mark" value={pendingAttendance.length} icon={AlertOctagon} tone={pendingAttendance.length ? "warning" : "neutral"} />
      </div>
      {pendingAttendance.length > 0 && (
        <Card className="mb-5 border-warning-600/30">
          <CardHeader title="Attendance not yet marked" description="Sessions from the last two weeks" />
          <ul className="divide-y divide-border">
            {pendingAttendance.map((s) => <li key={s.id}><Link href={`/staff/schedule/${s.id}`} className="flex justify-between px-4 py-3 text-sm sm:px-5"><span>{s.title}</span><span className="text-muted">{formatDateShort(s.starts_at)} {formatTime(s.starts_at)}</span></Link></li>)}
          </ul>
        </Card>
      )}
      <Card className="mb-5">
        <CardHeader title="Today's sessions" />
        {todays.length ? <ul className="divide-y divide-border">{todays.map(row)}</ul> : <EmptyState title="No sessions today" description="Enjoy the break – upcoming sessions are below." />}
      </Card>
      <Card>
        <CardHeader title="Coming up this week" />
        {upcoming.length ? <ul className="divide-y divide-border">{upcoming.map((s) => (
          <li key={s.id}><Link href={`/staff/schedule/${s.id}`} className="flex justify-between gap-3 px-4 py-3 text-sm sm:px-5"><span className="truncate">{s.title}</span><span className="shrink-0 text-muted">{formatDateShort(s.starts_at)} {formatTime(s.starts_at)}</span></Link></li>
        ))}</ul> : <p className="px-5 py-4 text-sm text-muted">Nothing else scheduled this week.</p>}
      </Card>
    </div>
  );
}
