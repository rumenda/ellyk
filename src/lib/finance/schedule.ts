/**
 * Instalment schedule builder (no interest).
 *
 * The database (accept_enrolment_agreement) re-validates every invariant:
 * consecutive sequences from 0, ascending due dates, positive amounts, first row
 * equal to the deposit, and the schedule summing exactly to the agreement total.
 */

export type Frequency = "weekly" | "fortnightly" | "monthly";
export type InstalmentMode = "count" | "amount";

export interface ScheduleInput {
  total: number;
  deposit: number;
  mode: InstalmentMode;
  /** Number of instalments after the deposit (mode = "count"). */
  count?: number | null;
  /** Fixed instalment amount (mode = "amount"); the last one takes the remainder. */
  amount?: number | null;
  frequency: Frequency;
  /** Deposit due date, YYYY-MM-DD. */
  depositDueDate: string;
  /** First instalment due date; defaults to one period after the deposit. */
  firstInstalmentDate?: string | null;
}

export interface ScheduleRow {
  sequence: number;
  label: string;
  due_date: string;
  amount: number;
}

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;

export function addPeriod(date: string, frequency: Frequency, times = 1): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (frequency === "monthly") {
    const target = new Date(Date.UTC(y, m - 1 + times, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, lastDay));
    return target.toISOString().slice(0, 10);
  }
  const days = (frequency === "weekly" ? 7 : 14) * times;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export class ScheduleError extends Error {}

export function buildSchedule(input: ScheduleInput): ScheduleRow[] {
  const totalC = toCents(input.total);
  const depositC = toCents(input.deposit);
  if (totalC <= 0) throw new ScheduleError("Total must be greater than zero");
  if (depositC < 0) throw new ScheduleError("Deposit cannot be negative");
  if (depositC > totalC) throw new ScheduleError("Deposit cannot exceed the total");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.depositDueDate)) throw new ScheduleError("Invalid deposit due date");

  const rows: ScheduleRow[] = [];
  if (depositC > 0) {
    rows.push({ sequence: 0, label: "Deposit", due_date: input.depositDueDate, amount: fromCents(depositC) });
  }

  const balanceC = totalC - depositC;
  if (balanceC === 0) return rows;

  const amounts: number[] = [];
  if (input.mode === "count") {
    const n = input.count ?? 0;
    if (!Number.isInteger(n) || n < 1) throw new ScheduleError("Number of instalments must be at least 1");
    // Whole shillings per instalment; the final instalment absorbs the remainder.
    const base = Math.floor(balanceC / n / 100) * 100;
    if (base <= 0) {
      amounts.push(balanceC);
    } else {
      for (let i = 0; i < n - 1; i++) amounts.push(base);
      amounts.push(balanceC - base * (n - 1));
    }
  } else {
    const perC = toCents(input.amount ?? 0);
    if (perC <= 0) throw new ScheduleError("Instalment amount must be greater than zero");
    const n = Math.ceil(balanceC / perC);
    if (n > 104) throw new ScheduleError("Instalment amount is too small (more than 104 instalments)");
    for (let i = 0; i < n - 1; i++) amounts.push(perC);
    amounts.push(balanceC - perC * (n - 1));
  }

  const first = input.firstInstalmentDate ?? addPeriod(input.depositDueDate, input.frequency);
  if (first < input.depositDueDate) throw new ScheduleError("First instalment cannot be due before the deposit");
  const offset = rows.length;
  amounts.forEach((c, i) => {
    rows.push({
      sequence: offset + i,
      label: `Instalment ${i + 1} of ${amounts.length}`,
      due_date: addPeriod(first, input.frequency, i),
      amount: fromCents(c),
    });
  });
  return rows;
}

export function scheduleTotal(rows: ScheduleRow[]): number {
  return fromCents(rows.reduce((s, r) => s + toCents(r.amount), 0));
}

/**
 * Derive how much of each instalment is paid by filling instalments in order.
 * Mirrors the public.v_instalments view (used for previews and tests).
 */
export function fillInstalments(
  rows: { amount: number; waived_amount?: number }[],
  paid: number,
): { paid: number; outstanding: number }[] {
  let remaining = toCents(paid);
  return rows.map((r) => {
    const eff = toCents(r.amount) - toCents(r.waived_amount ?? 0);
    const p = Math.max(0, Math.min(eff, remaining));
    remaining -= p;
    return { paid: fromCents(p), outstanding: fromCents(eff - p) };
  });
}
