import { BrandMark } from "@/components/brand";
import { Money } from "@/components/money";
import { COMPONENT_LABELS, type Component } from "@/lib/finance/allocation";
import { formatDateTime, humanize } from "@/lib/format";

export interface ReceiptData {
  receipt_number: string | null;
  amount: number;
  received_at: string;
  source: string;
  external_reference: string | null;
  status: string;
  student: { student_number: string; name: string };
  allocations: { component: Component; description: string; amount: number }[];
  balanceAfter: number | null;
  school: { legal_name: string; kra_pin: string | null; physical_address: string | null; phone: string | null; vat_registered: boolean };
}

/** Printable receipt. Shows exactly how the payment was allocated. */
export function Receipt({ r }: { r: ReceiptData }) {
  const allocated = r.allocations.reduce((s, a) => s + a.amount, 0);
  const credit = Math.round((r.amount - allocated) * 100) / 100;
  return (
    <article className="mx-auto max-w-md rounded-lg border border-border bg-surface p-5 shadow-card print:border-0 print:shadow-none" aria-label="Receipt">
      <header className="flex items-start justify-between gap-3 border-b border-dashed border-border pb-4">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div>
            <p className="font-semibold leading-tight">{r.school.legal_name}</p>
            {r.school.physical_address && <p className="text-xs text-muted">{r.school.physical_address}</p>}
            {r.school.kra_pin && <p className="text-xs text-muted">KRA PIN: {r.school.kra_pin}</p>}
          </div>
        </div>
        <p className="text-right text-xs font-semibold uppercase tracking-wide text-muted">Official<br />receipt</p>
      </header>
      {r.status === "reversed" && <p className="mt-3 rounded-md bg-danger-50 px-3 py-2 text-center text-sm font-semibold text-danger-700">REVERSED – this payment was cancelled</p>}
      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted">Receipt no.</dt><dd className="text-right font-medium tabular">{r.receipt_number ?? "—"}</dd>
        <dt className="text-muted">Date</dt><dd className="text-right">{formatDateTime(r.received_at)}</dd>
        <dt className="text-muted">Student</dt><dd className="text-right">{r.student.name}<br /><span className="text-xs text-muted">{r.student.student_number}</span></dd>
        <dt className="text-muted">Method</dt><dd className="text-right">{r.source === "mpesa_c2b" ? "M-Pesa Paybill" : humanize(r.source)}</dd>
        {r.external_reference && <><dt className="text-muted">Reference</dt><dd className="text-right font-mono text-[13px]">{r.external_reference}</dd></>}
      </dl>
      <div className="mt-4 rounded-md bg-surface-muted p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Allocated to</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {r.allocations.map((a, i) => (
            <li key={i} className="flex justify-between gap-3"><span>{COMPONENT_LABELS[a.component] ?? a.description}</span><Money value={a.amount} /></li>
          ))}
          {credit > 0 && <li className="flex justify-between gap-3"><span>Held as credit on your account</span><Money value={credit} /></li>}
          {r.allocations.length === 0 && credit <= 0 && <li className="text-muted">Not yet allocated</li>}
        </ul>
      </div>
      <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-border pt-3">
        <span className="font-semibold">Amount received</span>
        <Money value={r.amount} strong className="text-xl" />
      </div>
      {r.balanceAfter !== null && <p className="mt-1 text-right text-sm text-muted">Current balance: <Money value={r.balanceAfter} /></p>}
      <footer className="mt-4 text-center text-[11px] text-muted">
        {r.school.vat_registered ? "Tax details appear on your tax invoice." : "Not a tax invoice."} Thank you for training with us.
      </footer>
    </article>
  );
}
