import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Info, Receipt as ReceiptIcon } from "lucide-react";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { PayInstructions } from "@/components/student/pay-instructions";
import { Card } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { getFeeLines, getStudentOverview, getStudentPayments } from "@/features/student/queries";
import { requireStudent } from "@/lib/auth/session";
import { COMPONENT_LABELS, COMPONENT_SHORT, type Component } from "@/lib/finance/allocation";
import { formatDate, formatDateShort, percent, relativeDays, toNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

const EXPLAIN: Partial<Record<Component, string>> = {
  ntsa: "Paid by the school to NTSA for your provisional licence, test booking and licence.",
  service_fee: "Charged by the system provider that runs this app. Shown separately so you know exactly where it goes.",
  registration: "One-off fee to open your student file.",
};

export default async function PaymentsPage() {
  const user = await requireStudent();
  const o = await getStudentOverview(user.studentId);
  const { current, balance, instalments, nextInstalment, settings, student } = o;
  const [lines, payments] = await Promise.all([
    current ? getFeeLines(current.id) : Promise.resolve([]),
    getStudentPayments(user.studentId),
  ]);
  const total = toNumber(balance?.total_due);
  const paid = toNumber(balance?.total_paid);
  const outstanding = toNumber(balance?.total_outstanding);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Payments</h1>

      {!current ? (
        <Card><EmptyState title="No fees yet" description="Once you enrol on a course, your fee breakdown and payment plan will appear here." /></Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <ProgressRing value={percent(paid, total)} size={116} stroke={12} label={`${percent(paid, total)}% paid`}>
                <div><p className="text-xs text-muted">Balance</p><p className="text-base font-semibold tabular"><Money value={outstanding} /></p></div>
              </ProgressRing>
              <dl className="flex-1 space-y-2 text-sm">
                <div><dt className="text-muted">Total fees</dt><dd className="text-base font-semibold"><Money value={total} /></dd></div>
                <div><dt className="text-muted">Paid so far</dt><dd className="text-base font-semibold text-success-700"><Money value={paid} /></dd></div>
              </dl>
            </div>
            {nextInstalment ? (
              <div className={`mt-4 rounded-md px-3 py-3 ${nextInstalment.status === "overdue" ? "bg-danger-50" : "bg-surface-muted"}`}>
                <p className="text-xs font-medium text-muted">Next payment</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="text-lg font-semibold"><Money value={nextInstalment.amount_outstanding} /></p>
                  <StatusBadge status={nextInstalment.status} />
                </div>
                <p className="text-sm text-muted">Due {formatDate(nextInstalment.due_date)} ({relativeDays(nextInstalment.due_date)})</p>
              </div>
            ) : outstanding <= 0 && total > 0 ? (
              <p className="mt-4 rounded-md bg-success-50 px-3 py-3 text-sm font-medium text-success-700">All fees paid. Thank you!</p>
            ) : null}
            {outstanding > 0 && (
              <div className="mt-4"><PayInstructions paybill={settings?.paybill_number ?? null} account={student.student_number}
                amount={toNumber(nextInstalment?.amount_outstanding) || outstanding} /></div>
            )}
          </Card>

          <Card>
            <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Fee breakdown</h2>
            <ul className="divide-y divide-border">
              {lines.map((l) => {
                const c = l.component as Component;
                return (
                  <li key={l.invoice_line_id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{COMPONENT_LABELS[c]}</p>
                        {EXPLAIN[c] && <p className="mt-0.5 flex gap-1 text-xs text-muted"><Info className="mt-0.5 size-3 shrink-0" />{EXPLAIN[c]}</p>}
                      </div>
                      <Money value={l.amount_due} strong />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <ProgressBar value={percent(toNumber(l.allocated), toNumber(l.amount_due))} className="h-1.5" tone={toNumber(l.outstanding) <= 0 ? "success" : "brand"} label={`${COMPONENT_SHORT[c]} paid`} />
                      <span className="shrink-0 text-xs text-muted">{toNumber(l.outstanding) <= 0 ? "Paid" : <><Money value={l.outstanding} /> left</>}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between border-t border-border px-4 py-3 font-semibold"><span>Total</span><Money value={total} /></div>
            <p className="border-t border-border px-4 py-3 text-xs text-muted">No interest is charged on instalments. There are no other fees.</p>
          </Card>

          {instalments.length > 0 && (
            <Card>
              <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Payment plan</h2>
              <ol className="divide-y divide-border">
                {instalments.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{i.label}</p>
                      <p className="text-xs text-muted">Due {formatDateShort(i.due_date)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Money value={i.amount - i.waived_amount} className="text-sm font-semibold" />
                      <StatusBadge status={i.status} />
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}

      <Card id="receipts">
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <EmptyState icon={ReceiptIcon} title="No payments yet" description="When you pay through M-Pesa, your receipt appears here within a few minutes." />
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id}>
                <Link href={`/app/receipts/${p.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-muted">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-50 text-success-700"><ReceiptIcon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold"><Money value={p.amount} /></p>
                    <p className="truncate text-xs text-muted">{formatDate(p.received_at)} · {p.source === "mpesa_c2b" ? "M-Pesa" : p.source.replace("_", " ")} {p.external_reference ? `· ${p.external_reference}` : ""}</p>
                  </div>
                  {p.status !== "confirmed" && <StatusBadge status={p.status} />}
                  <ChevronRight className="size-4 text-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
