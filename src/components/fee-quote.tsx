import { Money } from "@/components/money";
import { Card } from "@/components/ui/card";
import { COMPONENT_LABELS, type Component } from "@/lib/finance/allocation";
import type { ScheduleRow } from "@/lib/finance/schedule";
import { formatDateShort, humanize } from "@/lib/format";

export interface Quote {
  price_version_id: string; label: string; version: number; total: number; tax_total: number; deposit: number;
  service_fee: number; ntsa: number; tax_inclusive: boolean; instalment_mode: "count" | "amount";
  instalment_count: number | null; instalment_amount: number | null; frequency: "weekly" | "fortnightly" | "monthly";
  min_paid_before_training: number; min_paid_before_ntsa: number;
  items: { component: Component; label: string; net: number; tax: number; gross: number; tax_rate: number }[];
}

/** Transparent fee quotation: every component, the deposit and the full schedule. */
export function FeeQuote({ quote, schedule }: { quote: Quote; schedule: ScheduleRow[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Fees</h2>
        <ul className="divide-y divide-border text-sm">
          {quote.items.map((i) => (
            <li key={i.component + i.label} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <span>
                {COMPONENT_LABELS[i.component]}
                {i.component === "service_fee" && <span className="block text-xs text-muted">Belongs to the system provider, not the school.</span>}
                {i.component === "ntsa" && <span className="block text-xs text-muted">Paid by the school to NTSA on your behalf.</span>}
                {i.tax > 0 && <span className="block text-xs text-muted">Includes VAT <Money value={i.tax} /></span>}
              </span>
              <Money value={i.gross} />
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-border px-4 py-3 text-base font-semibold"><span>Total</span><Money value={quote.total} /></div>
      </Card>
      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Payment plan ({humanize(quote.frequency)}, no interest)</h2>
        <ol className="divide-y divide-border text-sm">
          {schedule.map((r) => (
            <li key={r.sequence} className="flex justify-between gap-3 px-4 py-2.5">
              <span>{r.label}<span className="block text-xs text-muted">Due {formatDateShort(r.due_date)}</span></span>
              <Money value={r.amount} className={r.sequence === 0 ? "font-semibold" : ""} />
            </li>
          ))}
        </ol>
        <div className="space-y-1 border-t border-border px-4 py-3 text-xs text-muted">
          <p>Lessons start once you have paid at least <Money value={quote.min_paid_before_training} />.</p>
          <p>NTSA booking needs at least <Money value={quote.min_paid_before_ntsa} /> paid.</p>
        </div>
      </Card>
    </div>
  );
}
