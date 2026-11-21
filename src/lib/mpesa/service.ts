import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  C2B_ACCEPT, c2bPayloadSchema, c2bReject, isWithinReplayWindow, parseTransTime, payerDisplayName, protectMsisdn, sanitizePayload,
} from "./c2b";

export type MpesaEnv = "sandbox" | "production";
export const mpesaEnv = (): MpesaEnv => (process.env.MPESA_ENV === "production" ? "production" : "sandbox");

/** Constant-time comparison of the callback token in the URL. */
export function validCallbackToken(token: string | null): boolean {
  const expected = process.env.MPESA_CALLBACK_TOKEN;
  if (!expected || expected.length < 24 || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function ipAllowed(ip: string): boolean {
  const list = (process.env.MPESA_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(ip);
}

type Endpoint = "validation" | "confirmation" | "simulate";

async function log(endpoint: Endpoint, entry: { ip: string; auth: boolean; transId?: string; amount?: number; result?: string; http: number;
  outcome: "accepted" | "rejected" | "duplicate" | "processed" | "error" | "unauthorized"; error?: string; payload?: unknown }) {
  await createAdminClient().from("mpesa_webhook_logs").insert({
    endpoint, source_ip: entry.ip, auth_ok: entry.auth, trans_id: entry.transId ?? null, amount: entry.amount ?? null,
    result_code: entry.result ?? null, http_status: entry.http, outcome: entry.outcome, error_message: entry.error?.slice(0, 500) ?? null,
    payload: (entry.payload ?? null) as Json,
  });
}

export interface CallbackResult { status: number; body: Record<string, unknown> }

export async function handleValidation(raw: unknown, ip: string, authed: boolean): Promise<CallbackResult> {
  if (!authed) {
    await log("validation", { ip, auth: false, http: 401, outcome: "unauthorized" });
    return { status: 401, body: { ResultCode: "C2B00016", ResultDesc: "Rejected" } };
  }
  const p = c2bPayloadSchema.safeParse(raw);
  if (!p.success) {
    await log("validation", { ip, auth: true, http: 200, outcome: "rejected", result: "C2B00016", error: p.error.issues[0]?.message });
    return { status: 200, body: c2bReject("C2B00016", "Invalid request") };
  }
  const { data } = await createAdminClient().rpc("mpesa_validate_c2b", {
    p_short_code: p.data.BusinessShortCode, p_amount: p.data.TransAmount, p_bill_ref: p.data.BillRefNumber,
  });
  const res = data as { accept: boolean; reason: string | null } | null;
  if (!res?.accept) {
    const code = res?.reason === "unknown_account" ? "C2B00012" : res?.reason === "invalid_amount" ? "C2B00013" : "C2B00016";
    await log("validation", { ip, auth: true, transId: p.data.TransID, amount: p.data.TransAmount, http: 200, outcome: "rejected", result: code, error: res?.reason ?? "rejected", payload: sanitizePayload(p.data) });
    return { status: 200, body: c2bReject(code, "Rejected") };
  }
  await log("validation", { ip, auth: true, transId: p.data.TransID, amount: p.data.TransAmount, http: 200, outcome: "accepted", result: "0" });
  return { status: 200, body: C2B_ACCEPT };
}

/**
 * Confirmation: validated, then recorded idempotently. We always answer 200 to
 * Safaricom for well-formed payloads (to stop retries) – including duplicates –
 * but never create a second payment for the same TransID.
 */
export async function handleConfirmation(raw: unknown, ip: string, authed: boolean, endpoint: Endpoint = "confirmation"): Promise<CallbackResult> {
  if (!authed) {
    await log(endpoint, { ip, auth: false, http: 401, outcome: "unauthorized" });
    return { status: 401, body: { ResultCode: "1", ResultDesc: "Unauthorized" } };
  }
  const p = c2bPayloadSchema.safeParse(raw);
  if (!p.success) {
    await log(endpoint, { ip, auth: true, http: 400, outcome: "rejected", error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    return { status: 400, body: { ResultCode: "1", ResultDesc: "Invalid payload" } };
  }
  const tx = p.data;
  let transTime: Date;
  try { transTime = parseTransTime(tx.TransTime); } catch {
    await log(endpoint, { ip, auth: true, transId: tx.TransID, http: 400, outcome: "rejected", error: "Bad TransTime" });
    return { status: 400, body: { ResultCode: "1", ResultDesc: "Invalid TransTime" } };
  }
  if (!isWithinReplayWindow(transTime)) {
    await log(endpoint, { ip, auth: true, transId: tx.TransID, amount: tx.TransAmount, http: 200, outcome: "rejected", error: "Outside replay window – flagged for manual review", payload: sanitizePayload(tx) });
    return { status: 200, body: C2B_ACCEPT };
  }
  const { masked, hash } = protectMsisdn(tx.MSISDN);
  const { data, error } = await createAdminClient().rpc("mpesa_record_confirmation", {
    p_trans_id: tx.TransID, p_trans_type: tx.TransactionType, p_trans_time: transTime.toISOString(), p_amount: tx.TransAmount,
    p_short_code: tx.BusinessShortCode, p_bill_ref: tx.BillRefNumber, p_msisdn_masked: masked ?? "", p_msisdn_hash: hash ?? "",
    p_payer_name: payerDisplayName(tx) ?? "", p_org_balance: tx.OrgAccountBalance ? Number(tx.OrgAccountBalance) || 0 : 0,
    p_environment: mpesaEnv(), p_raw: sanitizePayload(tx) as unknown as Json,
  });
  if (error) {
    await log(endpoint, { ip, auth: true, transId: tx.TransID, amount: tx.TransAmount, http: 500, outcome: "error", error: error.message, payload: sanitizePayload(tx) });
    // 500 makes Safaricom retry later; idempotency protects us from duplicates.
    return { status: 500, body: { ResultCode: "1", ResultDesc: "Temporary error" } };
  }
  const r = data as { status: string };
  await log(endpoint, { ip, auth: true, transId: tx.TransID, amount: tx.TransAmount, http: 200, outcome: r.status === "duplicate" ? "duplicate" : "processed", result: r.status });
  return { status: 200, body: { ...C2B_ACCEPT, status: endpoint === "simulate" ? r.status : undefined } };
}
