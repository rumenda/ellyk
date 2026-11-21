import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { buildSchedule } from "@/lib/finance/schedule";
import { todayKE } from "@/lib/format";

config({ path: ".env.local", quiet: true });
export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const PASSWORD = "EllyK-Demo-2026!";
export type DB = SupabaseClient<Database>;

export const admin: DB = createClient<Database>(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
export const anon: DB = createClient<Database>(URL, ANON, { auth: { persistSession: false } });

const cache = new Map<string, DB>();
/** Integration tests run against the seeded local database (pnpm db:reset && pnpm seed). */
export async function as(email: string): Promise<DB> {
  if (cache.has(email)) return cache.get(email)!;
  const c = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email} – did you run the seed? ${error.message}`);
  cache.set(email, c);
  return c;
}

export const MANAGER = "manager@ellyk.test";
export const ADMIN_TRD = "admin@ellyk.test";
export const ADMIN_KTG = "admin.ktg@ellyk.test";
export const ACCOUNTANT = "accounts@ellyk.test";
export const INSTRUCTOR = "john.mwangi@ellyk.test";
export const PLATFORM = "platform@ellyk.test";

export async function locationId(code: string) {
  return (await admin.from("locations").select("id").eq("code", code).single()).data!.id;
}
export async function courseId(code = "MC-A2") {
  return (await admin.from("courses").select("id").eq("code", code).single()).data!.id;
}

let n = 0;
export function uniquePhone() {
  n++;
  return `+2547${String(Date.now()).slice(-6)}${String(n).padStart(2, "0")}`.slice(0, 13);
}
export function transId() {
  n++;
  return `IT${Date.now().toString(36).toUpperCase()}${n}`.replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

/** Register + enrol + accept a fresh student at a location (as the manager). */
export async function freshEnrolledStudent(locCode = "TRD", depositDue = todayKE()) {
  const m = await as(MANAGER);
  const loc = await locationId(locCode);
  const { data: sid, error } = await m.rpc("register_student", { p: {
    first_name: "Test", last_name: `Fixture${Date.now() % 100000}`, phone: uniquePhone(), date_of_birth: "2000-01-01",
    home_location_id: loc, consent_data_processing: true, emergency_contact_name: "Kin Fixture", emergency_contact_phone: "+254700999111",
  } as unknown as Json });
  if (error) throw error;
  const studentId = sid as unknown as string;
  const { data: eid, error: e2 } = await m.rpc("create_enrolment", { p_student: studentId, p_course: await courseId(), p_location: loc, p_start_date: depositDue });
  if (e2) throw e2;
  const enrolmentId = eid as unknown as string;
  const { data: enr } = await admin.from("enrolments").select("price_version_id").eq("id", enrolmentId).single();
  const { data: q } = await m.rpc("quote_price_version", { p_price_version: enr!.price_version_id });
  const quote = q as unknown as { total: number; deposit: number; instalment_count: number; frequency: "weekly" };
  const schedule = buildSchedule({ total: quote.total, deposit: quote.deposit, mode: "count", count: quote.instalment_count, frequency: quote.frequency, depositDueDate: depositDue });
  const acc = await m.rpc("accept_enrolment_agreement", { p_enrolment: enrolmentId, p_schedule: schedule as unknown as Json, p_accepted_via: "in_person" });
  if (acc.error) throw acc.error;
  const { data: s } = await admin.from("students").select("student_number, phone").eq("id", studentId).single();
  return { studentId, enrolmentId, studentNumber: s!.student_number, phone: s!.phone, quote, schedule, locationId: loc };
}

export async function pay(ref: string, amount: number, id = transId(), when = new Date()) {
  return admin.rpc("mpesa_record_confirmation", {
    p_trans_id: id, p_trans_type: "Pay Bill", p_trans_time: when.toISOString(), p_amount: amount, p_short_code: process.env.MPESA_SHORTCODE ?? "600999",
    p_bill_ref: ref, p_msisdn_masked: "254700***000", p_msisdn_hash: "", p_payer_name: "TEST", p_org_balance: 0, p_environment: "sandbox", p_raw: { test: true },
  });
}

export async function lineBalances(enrolmentId: string) {
  const { data } = await admin.from("v_invoice_line_balances").select("component, amount_due, allocated, outstanding").eq("enrolment_id", enrolmentId);
  return Object.fromEntries((data ?? []).map((l) => [l.component!, { due: Number(l.amount_due), paid: Number(l.allocated), left: Number(l.outstanding) }]));
}

export async function ledgerBalanced() {
  // Aggregated server-side (avoids the 1,000-row page limit).
  const { data } = await admin.from("v_account_balances").select("total_debit, total_credit");
  const d = (data ?? []).reduce((s, l) => s + Number(l.total_debit), 0);
  const c = (data ?? []).reduce((s, l) => s + Number(l.total_credit), 0);
  return Math.abs(d - c) < 0.005;
}
