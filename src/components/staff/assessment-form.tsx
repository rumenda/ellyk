"use client";
import { useState } from "react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assessCompetencies } from "@/features/schedule/actions";
import { cn } from "@/lib/utils";

const RATINGS = [
  { v: "needs_improvement", label: "Needs work", short: "1", on: "bg-danger-600 text-white" },
  { v: "developing", label: "Developing", short: "2", on: "bg-accent-500 text-text" },
  { v: "competent", label: "Competent", short: "3", on: "bg-success-600 text-white" },
  { v: "ready_for_test", label: "Test ready", short: "4", on: "bg-brand-700 text-white" },
];

export function AssessmentForm({ enrolmentId, sessionId, items, readOnly }: {
  enrolmentId: string; sessionId: string | null; readOnly?: boolean;
  items: { id: string; name: string; category: string; rating: string; comment: string | null }[];
}) {
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const { run, pending } = useAction(assessCompetencies, { onSuccess: () => { setRatings({}); setComments({}); } });
  const changed = Object.keys(ratings).length;
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <div>
      {cats.map((c) => (
        <section key={c}>
          <h3 className="bg-surface-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted sm:px-5">{c}</h3>
          <ul className="divide-y divide-border">
            {items.filter((i) => i.category === c).map((i) => {
              const cur = ratings[i.id] ?? i.rating;
              return (
                <li key={i.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0"><p className="text-sm font-medium">{i.name}</p>{i.comment && <p className="text-xs text-muted">Last note: {i.comment}</p>}</div>
                    <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={i.name}>
                      {RATINGS.map((r) => (
                        <button key={r.v} type="button" role="radio" aria-checked={cur === r.v} disabled={readOnly}
                          onClick={() => setRatings((x) => ({ ...x, [i.id]: r.v }))}
                          className={cn("h-10 rounded-md border px-1.5 text-[11px] font-semibold md:min-w-[84px]", cur === r.v ? `${r.on} border-transparent` : "border-border-strong text-muted hover:bg-surface-muted",
                            ratings[i.id] && cur === r.v && "ring-2 ring-offset-1 ring-brand-500")}>{r.label}</button>
                      ))}
                    </div>
                  </div>
                  {ratings[i.id] && <Input className="mt-2 h-10" placeholder="Feedback for the student (optional)" value={comments[i.id] ?? ""} onChange={(e) => setComments((x) => ({ ...x, [i.id]: e.target.value }))} aria-label={`Comment on ${i.name}`} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!readOnly && (
        <div className="sticky bottom-16 flex justify-end border-t border-border bg-surface px-4 py-3 sm:px-5 lg:bottom-0">
          <Button loading={pending} disabled={changed === 0} onClick={() => run(enrolmentId, sessionId, Object.entries(ratings).map(([competency_id, rating]) => ({ competency_id, rating, comment: comments[competency_id] || undefined })))}>
            Save {changed || ""} rating{changed === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </div>
  );
}
