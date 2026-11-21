"use client";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordAttendance } from "@/features/schedule/actions";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { v: "present", label: "Present", cls: "bg-success-600 text-white" },
  { v: "late", label: "Late", cls: "bg-accent-500 text-text" },
  { v: "absent", label: "Absent", cls: "bg-danger-600 text-white" },
  { v: "excused", label: "Excused", cls: "bg-text text-white" },
] as const;

/** One-tap-per-student attendance with an "everyone present" shortcut. */
export function AttendanceSheet({ sessionId, students, canMark }: {
  sessionId: string; students: { id: string; name: string; number: string; status: string | null; notes: string | null; vehicle: string | null }[]; canMark: boolean;
}) {
  const [marks, setMarks] = useState<Record<string, string>>(Object.fromEntries(students.filter((s) => s.status).map((s) => [s.id, s.status!])));
  const [notes, setNotes] = useState<Record<string, string>>(Object.fromEntries(students.map((s) => [s.id, s.notes ?? ""])));
  const { run, pending } = useAction(recordAttendance);
  const marked = Object.keys(marks).length;
  return (
    <div>
      <ul className="divide-y divide-border">
        {students.map((s) => (
          <li key={s.id} className="px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{s.number}{s.vehicle ? ` · ${s.vehicle}` : ""}</p></div>
              <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                {OPTIONS.map((o) => (
                  <button key={o.v} type="button" role="radio" aria-checked={marks[s.id] === o.v} disabled={!canMark}
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: o.v }))}
                    className={cn("h-11 rounded-md border px-2 text-xs font-semibold transition-colors sm:min-w-[72px]",
                      marks[s.id] === o.v ? `${o.cls} border-transparent` : "border-border-strong bg-surface text-muted hover:bg-surface-muted")}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {canMark && (marks[s.id] && marks[s.id] !== "present" || notes[s.id]) && (
              <Input className="mt-2 h-10" placeholder="Note (optional) – visible to the student" value={notes[s.id]} aria-label={`Note for ${s.name}`}
                onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))} />
            )}
          </li>
        ))}
      </ul>
      {canMark && (
        <div className="sticky bottom-16 flex flex-col gap-2 border-t border-border bg-surface px-4 py-3 sm:flex-row sm:justify-between sm:px-5 lg:bottom-0">
          <Button type="button" variant="secondary" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, marks[s.id] ?? "present"])))}>
            <CheckCheck />Mark rest present
          </Button>
          <Button type="button" loading={pending} disabled={marked === 0}
            onClick={() => run(sessionId, Object.entries(marks).map(([student_id, status]) => ({ student_id, status, notes: notes[student_id] || undefined })))}>
            Save attendance ({marked}/{students.length})
          </Button>
        </div>
      )}
    </div>
  );
}
