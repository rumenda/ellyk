import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, ChevronRight, Clock, FileText, MapPin, Phone, Receipt, User, Wallet } from "lucide-react";
import { Money } from "@/components/money";
import { NTSA_STUDENT_TEXT, NtsaSteps } from "@/components/ntsa-steps";
import { StatusBadge } from "@/components/status-badge";
import { PayInstructions } from "@/components/student/pay-instructions";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Alert, EmptyState } from "@/components/ui/states";
import { getStudentOverview } from "@/features/student/queries";
import { requireStudent } from "@/lib/auth/session";
import { formatDate, formatDateShort, formatKES, formatTime, percent, relativeDays, toNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "numeric" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function StudentHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireStudent();
  const { welcome } = await searchParams;
  const o = await getStudentOverview(user.studentId);
  const { student, current, balance, nextInstalment, progress, ntsa, nextLessons, settings } = o;
  const next = nextLessons[0];

  const total = toNumber(balance?.total_due);
  const paid = toNumber(balance?.total_paid);
  const outstanding = toNumber(balance?.total_outstanding);
  const trainingPct = progress ? Math.round((progress.attendance_progress_pct + progress.competency_progress_pct) / 2) : 0;

  // The single most important thing for the student to do next.
  let action: { tone: "warning" | "danger" | "info" | "success"; title: string; body: string; href?: string; cta?: string } | null = null;
  if (current?.status === "pending_acceptance") {
    action = { tone: "warning", title: "Review and accept your fee plan", body: "See every fee before you start. No hidden charges, no interest.", href: `/app/agreement/${current.id}`, cta: "Review fees" };
  } else if (current?.status === "awaiting_deposit") {
    action = { tone: "warning", title: "Pay your deposit to start training", body: `Deposit of ${formatKES(balance?.deposit_amount)} unlocks your lessons.` };
  } else if (nextInstalment?.status === "overdue") {
    action = { tone: "danger", title: "Instalment overdue", body: `${formatKES(nextInstalment.amount_outstanding)} was due ${relativeDays(nextInstalment.due_date)}. Pay to keep your training on track.` };
  } else if (ntsa?.status === "test_scheduled" && ntsa.test_date) {
    action = { tone: "info", title: `NTSA test ${formatDateShort(ntsa.test_date)}`, body: `${formatTime(ntsa.test_date)} at ${ntsa.test_centre}. Carry your ID.` };
  } else if (current?.status === "completed") {
    action = { tone: "success", title: "Course completed 🎉", body: `Certificate ${current.certificate_number}. Congratulations!` };
  }

  return (
    <div className="space-y-4">
      {welcome && <Alert tone="success" title="Your account is ready">Welcome to Elly K! Install the app from your browser menu for quick access.</Alert>}

      <section>
        <p className="text-sm text-muted">{greeting()},</p>
        <h1 className="text-2xl font-semibold tracking-tight">{student.first_name}</h1>
        {current ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{current.course?.name}</span>
            <span className="flex items-center gap-1"><MapPin className="size-3.5" />{current.location?.name}</span>
          </p>
        ) : null}
      </section>

      {!current && (
        <Card><EmptyState icon={FileText} title="You're registered – no course yet" description="Visit or call the office to choose your course and payment plan. It will appear here." /></Card>
      )}

      {action && (
        <Alert tone={action.tone} title={action.title} icon={action.tone === "danger" ? AlertTriangle : undefined}>
          <p>{action.body}</p>
          {action.href && <Link href={action.href} className="mt-2 inline-flex items-center gap-1 font-semibold underline">{action.cta}<ArrowRight className="size-3.5" /></Link>}
        </Alert>
      )}

      {current && (
        <>
          {/* Next lesson */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted"><CalendarDays className="size-4" />Next lesson</h2>
              <Link href="/app/schedule" className="text-sm font-medium text-brand-700">All lessons</Link>
            </div>
            {next ? (
              <div className="px-4 pb-4 pt-2">
                <p className="text-lg font-semibold">{next.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[15px]"><Clock className="size-4 text-brand-600" />
                  {formatDateShort(next.starts_at)} · {formatTime(next.starts_at)}–{formatTime(next.ends_at)}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" />{next.location}</p>
                {next.instructor && <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><User className="size-4" />{next.instructor}</p>}
              </div>
            ) : (
              <p className="px-4 pb-4 pt-2 text-sm text-muted">
                {current.status === "awaiting_deposit" ? "Lessons are booked once your deposit is received." : "No lessons booked yet. The office will schedule your training and it will appear here."}
              </p>
            )}
          </Card>

          {/* Payments */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted"><Wallet className="size-4" />Fees</h2>
              <Link href="/app/payments" className="text-sm font-medium text-brand-700">Details</Link>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <ProgressRing value={percent(paid, total)} size={104} stroke={11} label={`${percent(paid, total)}% of fees paid`}>
                <div><p className="text-xl font-semibold tabular">{percent(paid, total)}%</p><p className="text-[11px] text-muted">paid</p></div>
              </ProgressRing>
              <dl className="flex-1 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-muted">Balance</dt><dd><Money value={outstanding} strong className="text-lg" /></dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Paid</dt><dd><Money value={paid} /></dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Total</dt><dd><Money value={total} /></dd></div>
              </dl>
            </div>
            {nextInstalment && (
              <div className="mt-3 flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5 text-sm">
                <span>Next: <Money value={nextInstalment.amount_outstanding} strong /> {nextInstalment.status === "overdue" ? "overdue" : `due ${formatDateShort(nextInstalment.due_date)}`}</span>
                <StatusBadge status={nextInstalment.status} />
              </div>
            )}
            {outstanding > 0 && (
              <div className="mt-3">
                <PayInstructions paybill={settings?.paybill_number ?? null} account={student.student_number} amount={toNumber(nextInstalment?.amount_outstanding) || outstanding} />
              </div>
            )}
          </Card>

          {/* Training progress */}
          <Link href="/app/training" className="block">
            <Card className="p-4 transition-colors hover:border-brand-200">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted">Training progress</h2>
                <ChevronRight className="size-4 text-subtle" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular">{trainingPct}%</p>
              <ProgressBar value={trainingPct} className="mt-2" label="Training progress" />
              {progress && (
                <p className="mt-2 text-sm text-muted">
                  {progress.theory_attended + progress.practical_attended} of {progress.theory_required + progress.practical_required} lessons ·{" "}
                  {progress.competencies_competent} of {progress.competencies_required} skills signed off
                </p>
              )}
            </Card>
          </Link>

          {/* NTSA */}
          {ntsa && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted">NTSA licence progress</h2>
                <StatusBadge status={ntsa.status} />
              </div>
              <div className="mt-4"><NtsaSteps status={ntsa.status} /></div>
              <p className="mt-3 text-sm">{NTSA_STUDENT_TEXT[ntsa.status]}</p>
              {ntsa.test_date && <p className="mt-1 text-sm text-muted">Test: {formatDate(ntsa.test_date)} {formatTime(ntsa.test_date)} · {ntsa.test_centre}</p>}
            </Card>
          )}
        </>
      )}

      {o.announcement && (
        <Card className="border-accent-400/50 bg-accent-100/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Announcement</p>
          <p className="mt-1 font-semibold">{o.announcement.title}</p>
          <p className="mt-1 text-sm text-muted">{o.announcement.body}</p>
        </Card>
      )}

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-4 gap-2">
        {[
          { href: "/app/payments", label: "Pay fees", icon: Wallet },
          { href: "/app/schedule", label: "Schedule", icon: CalendarDays },
          { href: "/app/payments#receipts", label: "Receipts", icon: Receipt },
          { href: `tel:${current?.location?.phone ?? settings?.phone ?? ""}`, label: "Call school", icon: Phone },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface p-3 text-center text-xs font-medium hover:border-brand-200">
            <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="size-5" /></span>{label}
          </Link>
        ))}
      </section>
      {current?.status === "pending_acceptance" && (
        <Link href={`/app/agreement/${current.id}`} className={buttonVariants({ size: "lg", className: "w-full" })}>Review & accept fee plan</Link>
      )}
    </div>
  );
}
