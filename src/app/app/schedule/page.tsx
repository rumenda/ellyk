import type { Metadata } from "next";
import Link from "next/link";
import { Bike, Clock, MapPin, User } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { getLessons, type LessonRow } from "@/features/student/queries";
import { requireStudent } from "@/lib/auth/session";
import { formatDateShort, formatTime, todayKE } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Schedule" };

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date(iso));
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireStudent();
  const tab = (await searchParams).tab === "past" ? "past" : "upcoming";
  const lessons = await getLessons(user.studentId, tab, 60);
  const groups = new Map<string, LessonRow[]>();
  for (const l of lessons) groups.set(dayKey(l.starts_at), [...(groups.get(dayKey(l.starts_at)) ?? []), l]);
  const today = todayKE();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Schedule</h1>
      <div className="grid grid-cols-2 rounded-lg bg-surface-muted p-1" role="tablist">
        {(["upcoming", "past"] as const).map((t) => (
          <Link key={t} href={t === "past" ? "/app/schedule?tab=past" : "/app/schedule"} role="tab" aria-selected={tab === t}
            className={cn("rounded-md py-2 text-center text-sm font-medium capitalize", tab === t ? "bg-surface shadow-sm" : "text-muted")}>{t}</Link>
        ))}
      </div>
      {lessons.length === 0 ? (
        <Card><EmptyState title={tab === "upcoming" ? "No lessons scheduled yet" : "No past lessons"}
          description={tab === "upcoming" ? "Once the office schedules your training, your upcoming lessons will appear here." : "Lessons you attend will be listed here."} /></Card>
      ) : (
        [...groups.entries()].map(([day, items], gi) => (
          <section key={day}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{day === today ? "Today" : formatDateShort(day)}</h2>
            <ul className="space-y-2">
              {items.map((l, i) => {
                const highlight = tab === "upcoming" && gi === 0 && i === 0;
                return (
                  <li key={l.booking_id}>
                    <Card className={cn("p-4", highlight && "border-brand-500 ring-2 ring-brand-500/20")}>
                      {highlight && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Next lesson</p>}
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{l.title}</p>
                        {tab === "past" ? <StatusBadge status={l.attendance ?? "pending"} label={l.attendance ? undefined : "Not marked"} /> : l.status !== "scheduled" && <StatusBadge status={l.status} />}
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-muted">
                        <p className="flex items-center gap-2 text-text"><Clock className="size-4 text-brand-600" />{formatTime(l.starts_at)} – {formatTime(l.ends_at)}</p>
                        <p className="flex items-center gap-2"><MapPin className="size-4" />{l.location}{l.location_address ? ` · ${l.location_address}` : ""}</p>
                        {l.instructor && <p className="flex items-center gap-2"><User className="size-4" />{l.instructor}</p>}
                        {l.vehicle && <p className="flex items-center gap-2"><Bike className="size-4" />{l.vehicle}</p>}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
