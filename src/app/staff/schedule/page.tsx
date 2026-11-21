import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { NewSessionDialog } from "@/components/staff/session-forms";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { buildHref, getCourses, getInstructors, getLocations, locationOptions } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDateShort, formatTime, todayKE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Schedule" };

const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date(iso));
function weekStart(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("manager", "admin", "instructor");
  const sp = await searchParams;
  const view = sp.view === "day" ? "day" : "week";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayKE();
  const from = view === "week" ? weekStart(anchor) : anchor;
  const to = view === "week" ? addDays(from, 6) : anchor;
  const office = hasRole(user, "manager", "admin");
  const supabase = await createClient();
  const [locations, instructors, courses] = await Promise.all([getLocations(), getInstructors(), getCourses()]);

  let q = supabase.from("training_sessions")
    .select("id, title, lesson_type, starts_at, ends_at, status, capacity, location_id, instructor_id, session_bookings(id, status)")
    .gte("starts_at", new Date(`${from}T00:00:00+03:00`).toISOString()).lte("starts_at", new Date(`${to}T23:59:59+03:00`).toISOString())
    .neq("status", "rescheduled").order("starts_at");
  if (sp.location) q = q.eq("location_id", sp.location);
  if (sp.instructor) q = q.eq("instructor_id", sp.instructor);
  if (!office && user.instructorId) q = q.eq("instructor_id", user.instructorId);
  const { data } = await q;
  const sessions = (data ?? []).map((s) => ({ ...s, booked: s.session_bookings.filter((b) => b.status === "booked").length, day: dayOf(s.starts_at) }));
  const insName = (id: string) => instructors.find((i) => i.id === id)?.name ?? "";
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(from, i));
  const step = view === "week" ? 7 : 1;
  const today = todayKE();

  const chip = (s: (typeof sessions)[number], showIns = true) => (
    <Link key={s.id} href={`/staff/schedule/${s.id}`}
      className={cn("block rounded-md border-l-4 bg-surface p-2 text-xs shadow-sm ring-1 ring-border hover:ring-brand-200",
        s.status === "cancelled" ? "border-l-border-strong opacity-60" : s.lesson_type === "theory" ? "border-l-accent-500" : "border-l-brand-500")}>
      <p className="font-semibold tabular">{formatTime(s.starts_at)}–{formatTime(s.ends_at)}</p>
      <p className="truncate">{s.title}</p>
      {showIns && <p className="truncate text-muted">{insName(s.instructor_id)}</p>}
      <p className="mt-0.5 flex items-center gap-1 text-muted"><Users className="size-3" />{s.booked}/{s.capacity}{s.status !== "scheduled" && <span className="ml-auto"><StatusBadge status={s.status} /></span>}</p>
    </Link>
  );

  return (
    <div>
      <PageHeader title="Schedule" description={view === "week" ? `Week of ${formatDateShort(from)}` : formatDateShort(anchor)}
        actions={office && <NewSessionDialog defaultDate={anchor >= today ? anchor : today}
          locations={locations.filter((l) => l.is_active && (hasRole(user, "manager") || user.locationIds.includes(l.id))).map((l) => ({ id: l.id, name: l.name }))}
          instructors={instructors.filter((i) => i.is_active).map((i) => ({ id: i.id, name: i.name, locationIds: i.locationIds }))}
          courses={courses.map((c) => ({ id: c.id, name: c.name }))} />} />
      <LinkTabs active={view} tabs={[
        { key: "week", label: "Week", href: buildHref("/staff/schedule", sp, { view: undefined }) },
        { key: "day", label: "Day (by instructor)", href: buildHref("/staff/schedule", sp, { view: "day" }) },
      ]} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-5">
          <Link aria-label="Previous" href={buildHref("/staff/schedule", sp, { date: addDays(from, -step) })} className={buttonVariants({ variant: "secondary", size: "icon-sm" })}><ChevronLeft /></Link>
          <Link href={buildHref("/staff/schedule", sp, { date: undefined })} className={buttonVariants({ variant: "secondary", size: "sm" })}>Today</Link>
          <Link aria-label="Next" href={buildHref("/staff/schedule", sp, { date: addDays(from, step) })} className={buttonVariants({ variant: "secondary", size: "icon-sm" })}><ChevronRight /></Link>
          <span className="ml-2 text-sm font-medium">{view === "week" ? `${formatDateShort(from)} – ${formatDateShort(to)}` : formatDateShort(anchor)}</span>
        </div>
        {office && <FilterBar className="border-b-0" filters={[
          { name: "location", label: "All locations", options: locationOptions(locations) },
          { name: "instructor", label: "All instructors", options: instructors.map((i) => ({ value: i.id, label: i.name })) },
        ]} />}
      </Card>

      {sessions.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} title="No sessions in this period" description={office ? "Schedule a session to start booking students." : "Sessions assigned to you will appear here."} /></Card>
      ) : view === "week" ? (
        <>
          {/* Desktop week grid */}
          <div className="hidden gap-2 md:grid md:grid-cols-7">
            {days.map((d) => (
              <section key={d} className={cn("min-h-40 rounded-lg bg-surface-muted p-2", d === today && "ring-2 ring-brand-500/40")}>
                <Link href={buildHref("/staff/schedule", sp, { view: "day", date: d })} className="mb-2 block px-1 text-xs font-semibold hover:text-brand-700">{formatDateShort(d)}</Link>
                <div className="space-y-1.5">{sessions.filter((s) => s.day === d).map((s) => chip(s))}</div>
              </section>
            ))}
          </div>
          {/* Mobile agenda */}
          <div className="space-y-4 md:hidden">
            {days.filter((d) => sessions.some((s) => s.day === d)).map((d) => (
              <section key={d}>
                <h2 className="mb-2 text-sm font-semibold text-muted">{d === today ? "Today" : formatDateShort(d)}</h2>
                <Card><ul className="divide-y divide-border">
                  {sessions.filter((s) => s.day === d).map((s) => (
                    <li key={s.id}><Link href={`/staff/schedule/${s.id}`} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-14 shrink-0 text-sm font-semibold tabular">{formatTime(s.starts_at)}</span>
                      <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-sm font-medium">{s.title}</span>
                        <span className="block truncate text-xs text-muted">{insName(s.instructor_id)} · {locName(s.location_id)} · {s.booked}/{s.capacity}</span></span>
                      <StatusBadge status={s.status} />
                    </Link></li>
                  ))}
                </ul></Card>
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...new Set(sessions.map((s) => s.instructor_id))].map((iid) => (
            <section key={iid} className="rounded-lg bg-surface-muted p-2">
              <h2 className="mb-2 px-1 text-sm font-semibold">{insName(iid)}</h2>
              <div className="space-y-1.5">{sessions.filter((s) => s.instructor_id === iid).map((s) => chip(s, false))}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
