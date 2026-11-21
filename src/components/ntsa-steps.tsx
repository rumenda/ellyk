import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Documents", statuses: ["not_started", "documents_pending"] },
  { label: "NTSA payment", statuses: ["ready_for_payment", "payment_pending"] },
  { label: "Test booking", statuses: ["paid_by_school", "booking_pending", "test_booked"] },
  { label: "Test", statuses: ["test_scheduled", "test_completed", "failed_retest_required"] },
  { label: "Passed", statuses: ["passed", "completed"] },
];

export function ntsaStepIndex(status: string | null | undefined) {
  const i = STEPS.findIndex((s) => s.statuses.includes(status ?? ""));
  return i === -1 ? 0 : i;
}

/** Student-friendly description of each NTSA status. */
export const NTSA_STUDENT_TEXT: Record<string, string> = {
  not_started: "We'll start your NTSA process once you enrol.",
  documents_pending: "Bring your ID (or birth certificate) to the office so we can verify it.",
  ready_for_payment: "Your documents are verified. The school will pay your NTSA fees once your NTSA amount is covered.",
  payment_pending: "The school is paying your NTSA fees.",
  paid_by_school: "NTSA fees paid. We'll book your test when your training is complete.",
  booking_pending: "We're booking your NTSA test.",
  test_booked: "Your test is booked. We'll confirm the date and centre.",
  test_scheduled: "Your test date is set – practise and arrive early with your ID.",
  test_completed: "Test done – waiting for the result.",
  passed: "You passed! 🎉 Collect your certificate from the office.",
  failed_retest_required: "Not this time – we'll book a retest. Keep practising with your instructor.",
  completed: "All done. Congratulations, rider!",
};

export function NtsaSteps({ status, compact }: { status: string | null | undefined; compact?: boolean }) {
  const current = ntsaStepIndex(status);
  const done = status === "passed" || status === "completed";
  return (
    <ol className="flex items-start" aria-label="NTSA progress">
      {STEPS.map((s, i) => {
        const complete = i < current || (done && i === current);
        const active = i === current && !done;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && <span className={cn("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", i <= current ? "bg-brand-500" : "bg-border")} aria-hidden />}
            <span className={cn("relative z-10 grid size-7 place-items-center rounded-full border-2 text-xs font-semibold",
              complete ? "border-brand-500 bg-brand-500 text-white" : active ? "border-brand-500 bg-surface text-brand-700" : "border-border bg-surface text-subtle")}>
              {complete ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            {!compact && <span className={cn("mt-1.5 text-[11px] leading-tight", active ? "font-semibold text-text" : "text-muted")}>{s.label}</span>}
          </li>
        );
      })}
    </ol>
  );
}
