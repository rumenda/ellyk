/**
 * Payment allocation preview.
 *
 * The authoritative allocation runs inside Postgres (private.apply_student_credit)
 * under a row lock. This pure mirror is used to show finance staff what a
 * payment *will* do before they confirm a manual match, and is kept in parity
 * with the SQL by the integration test suite.
 */

export type Component = "registration" | "tuition" | "ntsa" | "service_fee" | "other";

export const DEFAULT_PRIORITY: Component[] = ["registration", "service_fee", "tuition", "ntsa", "other"];

export interface OpenLine {
  id: string;
  component: Component;
  outstanding: number;
  /** Invoice ordering: older invoices are paid first. */
  issueDate: string;
  invoiceNumber: string;
  sortOrder: number;
}

export interface AllocationLine {
  lineId: string;
  component: Component;
  amount: number;
}

export interface AllocationPlan {
  lines: AllocationLine[];
  allocated: number;
  /** Amount left as student credit (overpayment). */
  unapplied: number;
}

const c = (n: number) => Math.round(n * 100);

export function planAllocation(
  amount: number,
  openLines: OpenLine[],
  priority: Component[] = DEFAULT_PRIORITY,
): AllocationPlan {
  if (amount <= 0) return { lines: [], allocated: 0, unapplied: 0 };
  const rank = (comp: Component) => {
    const i = priority.indexOf(comp);
    return i === -1 ? 99 : i;
  };
  const ordered = [...openLines]
    .filter((l) => l.outstanding > 0)
    .sort(
      (a, b) =>
        a.issueDate.localeCompare(b.issueDate) ||
        a.invoiceNumber.localeCompare(b.invoiceNumber) ||
        rank(a.component) - rank(b.component) ||
        a.sortOrder - b.sortOrder,
    );

  let left = c(amount);
  const lines: AllocationLine[] = [];
  for (const l of ordered) {
    if (left <= 0) break;
    const take = Math.min(left, c(l.outstanding));
    if (take > 0) {
      lines.push({ lineId: l.id, component: l.component, amount: take / 100 });
      left -= take;
    }
  }
  const allocated = c(amount) - left;
  return { lines, allocated: allocated / 100, unapplied: left / 100 };
}

/** Sum an allocation plan by component (for "this payment covers…" summaries). */
export function summarizeByComponent(lines: AllocationLine[]): Record<Component, number> {
  const out: Record<Component, number> = { registration: 0, tuition: 0, ntsa: 0, service_fee: 0, other: 0 };
  for (const l of lines) out[l.component] = (c(out[l.component]) + c(l.amount)) / 100;
  return out;
}

export const COMPONENT_LABELS: Record<Component, string> = {
  registration: "Registration fee",
  tuition: "Tuition",
  ntsa: "NTSA fees (paid to NTSA on your behalf)",
  service_fee: "Platform service fee",
  other: "Other charges",
};

export const COMPONENT_SHORT: Record<Component, string> = {
  registration: "Registration",
  tuition: "Tuition",
  ntsa: "NTSA",
  service_fee: "Service fee",
  other: "Other",
};
