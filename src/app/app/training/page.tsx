import type { Metadata } from "next";
import { CheckCircle2, MessageSquareQuote, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { getCompetencies, getLessons, getStudentOverview } from "@/features/student/queries";
import { requireStudent } from "@/lib/auth/session";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Training" };

const LEVEL: Record<string, number> = { not_assessed: 0, needs_improvement: 1, developing: 2, competent: 3, ready_for_test: 4 };

export default async function TrainingPage() {
  const user = await requireStudent();
  const o = await getStudentOverview(user.studentId);
  if (!o.current || !o.progress) {
    return <Card><EmptyState title="Training hasn't started" description="Your lessons and skills progress will show here once your course is active." /></Card>;
  }
  const p = o.progress;
  const [comps, past] = await Promise.all([getCompetencies(o.current.id), getLessons(user.studentId, "past", 40)]);
  const lessonsDone = p.theory_attended + p.practical_attended;
  const lessonsTotal = p.theory_required + p.practical_required;
  const feedback = [
    ...comps.filter((c) => c.comment).map((c) => ({ when: c.assessed_at!, text: c.comment!, about: c.name })),
    ...past.filter((l) => l.attendance_notes).map((l) => ({ when: l.starts_at, text: l.attendance_notes!, about: l.title })),
  ].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 5);
  const groups = [...new Set(comps.map((c) => c.category))];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Training</h1>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Lessons attended</p>
          <p className="mt-1 text-2xl font-semibold tabular">{lessonsDone}<span className="text-base text-muted">/{lessonsTotal}</span></p>
          <ProgressBar value={p.attendance_progress_pct} className="mt-2" label="Lessons attended" />
          <p className="mt-2 text-xs text-muted">{Math.max(0, lessonsTotal - lessonsDone)} remaining</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Skills signed off</p>
          <p className="mt-1 text-2xl font-semibold tabular">{p.competencies_competent}<span className="text-base text-muted">/{p.competencies_required}</span></p>
          <ProgressBar value={p.competency_progress_pct} className="mt-2" tone="success" label="Skills signed off" />
          <p className="mt-2 text-xs text-muted">{p.missed_sessions} missed lesson{p.missed_sessions === 1 ? "" : "s"}</p>
        </Card>
      </div>

      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Riding skills</h2>
        {groups.map((g) => (
          <div key={g}>
            <p className="bg-surface-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g}</p>
            <ul className="divide-y divide-border">
              {comps.filter((c) => c.category === g).map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{c.name}</p>
                    <StatusBadge status={c.rating} />
                  </div>
                  <div className="mt-2 flex gap-1" aria-hidden>
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={cn("h-1.5 flex-1 rounded-full", LEVEL[c.rating]! >= n ? (LEVEL[c.rating]! >= 3 ? "bg-success-600" : "bg-accent-500") : "bg-surface-muted")} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Instructor feedback</h2>
        {feedback.length === 0 ? <p className="px-4 py-4 text-sm text-muted">Feedback from your instructor will appear here after your lessons.</p> : (
          <ul className="divide-y divide-border">
            {feedback.map((f, i) => (
              <li key={i} className="flex gap-3 px-4 py-3">
                <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-brand-600" />
                <div><p className="text-sm">{f.text}</p><p className="mt-0.5 text-xs text-muted">{f.about} · {formatDateShort(f.when)}</p></div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Attendance history</h2>
        {past.length === 0 ? <p className="px-4 py-4 text-sm text-muted">No completed lessons yet.</p> : (
          <ul className="divide-y divide-border">
            {past.slice(0, 15).map((l) => (
              <li key={l.booking_id} className="flex items-center gap-3 px-4 py-2.5">
                {l.attendance === "present" || l.attendance === "late" ? <CheckCircle2 className="size-5 text-success-600" /> : l.attendance ? <XCircle className="size-5 text-danger-600" /> : <span className="size-5 rounded-full border-2 border-border" />}
                <div className="min-w-0 flex-1"><p className="truncate text-sm">{l.title}</p><p className="text-xs text-muted">{formatDateShort(l.starts_at)}</p></div>
                {l.attendance && <StatusBadge status={l.attendance} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
