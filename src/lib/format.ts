/**
 * Formatting helpers for Kenya: KES currency, Africa/Nairobi dates, +254 phones.
 * Pure functions – safe on server and client.
 */

export const TIMEZONE = "Africa/Nairobi";

const kesFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  currencyDisplay: "code",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "KES 12,950" – trims ".00", keeps real cents. */
export function formatKES(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return kesFormatter.format(n).replace(/ /g, " ");
}

/** Compact amount for charts: 12.9K, 1.2M */
export function formatKESCompact(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (Math.abs(n) >= 1_000_000) return `${trimZero((n / 1_000_000).toFixed(1))}M`;
  if (Math.abs(n) >= 1_000) return `${trimZero((n / 1_000).toFixed(1))}K`;
  return String(Math.round(n));
}

function trimZero(s: string) {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Round to cents avoiding float drift. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const dateFmt = new Intl.DateTimeFormat("en-KE", { timeZone: TIMEZONE, day: "numeric", month: "short", year: "numeric" });
const dateShortFmt = new Intl.DateTimeFormat("en-KE", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-KE", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat("en-KE", {
  timeZone: TIMEZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});

/** Parse "YYYY-MM-DD" as a calendar date (no timezone shift) or an ISO timestamp. */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00+03:00`);
  return new Date(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFmt.format(toDate(value));
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateShortFmt.format(toDate(value));
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return timeFmt.format(toDate(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTimeFmt.format(toDate(value));
}

/** Today's calendar date in Nairobi as YYYY-MM-DD. */
export function todayKE(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Relative description for due dates: "today", "in 3 days", "5 days ago". */
export function relativeDays(date: string, today: string = todayKE()): string {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

/**
 * Normalise a Kenyan mobile number to E.164 (+2547XXXXXXXX / +2541XXXXXXXX).
 * Returns null if it is not a valid Kenyan mobile number. Mirrors
 * private.normalize_ke_phone() in the database.
 */
export function normalizeKenyanPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = input.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(d)) return `+${d}`;
  if (/^0[17]\d{8}$/.test(d)) return `+254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `+254${d}`;
  return null;
}

/** "+254712345678" → "0712 345 678" */
export function formatPhone(phone: string | null | undefined): string {
  const p = normalizeKenyanPhone(phone ?? "");
  if (!p) return phone ?? "—";
  const local = `0${p.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** "+254712345678" → "0712 ••• 678" */
export function maskPhone(phone: string | null | undefined): string {
  const p = normalizeKenyanPhone(phone ?? "");
  if (!p) return "—";
  const local = `0${p.slice(4)}`;
  return `${local.slice(0, 4)} ••• ${local.slice(7)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "pending_acceptance" → "Pending acceptance" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fullName(p: { first_name: string; middle_name?: string | null; last_name: string }): string {
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
}

export function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
