/**
 * Safaricom Daraja C2B (Paybill) payload handling.
 *
 * Callbacks are never trusted on arrival alone. The route handler checks:
 *   1. a secret callback token in the URL (registered with Daraja),
 *   2. optional source-IP allow-list,
 *   3. this schema (strict field formats),
 *   4. short code == configured paybill (also re-checked in SQL),
 *   5. idempotency on TransID (unique constraint),
 *   6. replay window on TransTime.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/format";

const amount = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
    ctx.addIssue({ code: "custom", message: "Invalid amount" });
    return z.NEVER;
  }
  return Math.round(n * 100) / 100;
});

export const c2bPayloadSchema = z.object({
  TransactionType: z.string().max(40).optional().default("Pay Bill"),
  TransID: z.string().regex(/^[A-Z0-9]{8,20}$/, "Invalid TransID"),
  TransTime: z.string().regex(/^\d{14}$/, "Invalid TransTime"),
  TransAmount: amount,
  BusinessShortCode: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{5,7}$/)),
  BillRefNumber: z.string().max(40).optional().default(""),
  InvoiceNumber: z.string().max(40).optional().nullable(),
  OrgAccountBalance: z.union([z.string(), z.number()]).optional().nullable(),
  ThirdPartyTransID: z.string().max(60).optional().nullable(),
  MSISDN: z.union([z.string(), z.number()]).transform(String).optional().default(""),
  FirstName: z.string().max(60).optional().nullable(),
  MiddleName: z.string().max(60).optional().nullable(),
  LastName: z.string().max(60).optional().nullable(),
});

export type C2BPayload = z.infer<typeof c2bPayloadSchema>;

/** Daraja TransTime is local Kenyan time "YYYYMMDDHHmmss". */
export function parseTransTime(t: string): Date {
  const iso = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}+03:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid TransTime");
  return d;
}

export function formatTransTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

/**
 * Safaricom now masks (e.g. "2547 ***** 126") or hashes MSISDNs in C2B callbacks.
 * When a full number is present we keep only a masked form plus a SHA-256 of the
 * digits so repeat payers can be matched without storing the number in clear.
 */
export function protectMsisdn(raw: string | undefined | null): { masked: string | null; hash: string | null } {
  if (!raw) return { masked: null, hash: null };
  const normalized = normalizeKenyanPhone(raw);
  if (normalized) {
    const digits = normalized.replace(/\D/g, "");
    return {
      masked: `${digits.slice(0, 6)}***${digits.slice(-3)}`,
      hash: createHash("sha256").update(digits).digest("hex"),
    };
  }
  // Already masked/hashed by Safaricom – keep a short, non-identifying form.
  return { masked: raw.replace(/\s+/g, "").slice(0, 16), hash: null };
}

export function payerDisplayName(p: Pick<C2BPayload, "FirstName" | "LastName">): string | null {
  const first = p.FirstName?.trim();
  const lastInitial = p.LastName?.trim()?.[0];
  if (!first) return null;
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

/** Copy of the payload suitable for long-term audit storage (no full phone / full name). */
export function sanitizePayload(p: C2BPayload) {
  const { masked } = protectMsisdn(p.MSISDN);
  return {
    TransactionType: p.TransactionType,
    TransID: p.TransID,
    TransTime: p.TransTime,
    TransAmount: p.TransAmount,
    BusinessShortCode: p.BusinessShortCode,
    BillRefNumber: p.BillRefNumber,
    InvoiceNumber: p.InvoiceNumber ?? null,
    OrgAccountBalance: p.OrgAccountBalance ?? null,
    ThirdPartyTransID: p.ThirdPartyTransID ?? null,
    MSISDN: masked,
    PayerName: payerDisplayName(p),
  };
}

/** Normalise a typed account reference ("ek 10023" → "EK10023"). */
export function normalizeReference(ref: string | null | undefined): string {
  return (ref ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Replay protection: reject confirmations older than the window or from the future. */
export function isWithinReplayWindow(transTime: Date, now = new Date(), maxAgeHours = 72): boolean {
  const age = now.getTime() - transTime.getTime();
  return age <= maxAgeHours * 3_600_000 && age >= -10 * 60_000;
}

/** Daraja response bodies */
export const C2B_ACCEPT = { ResultCode: "0", ResultDesc: "Accepted" } as const;
export const c2bReject = (code: "C2B00011" | "C2B00012" | "C2B00013" | "C2B00016", desc: string) =>
  ({ ResultCode: code, ResultDesc: desc }) as const;
