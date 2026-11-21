"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, friendlyDbError, ok, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

async function signedIn() {
  const u = await getSessionUser();
  if (!u) throw new Error("Not signed in");
  return u;
}
const refresh = () => { revalidatePath("/staff", "layout"); };

const manualSchema = z.object({
  student_id: z.uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero").max(1_000_000),
  source: z.enum(["cash", "bank_transfer", "other"]),
  reference: z.string().trim().max(60).optional(),
  received_at: z.string().min(10, "Enter the date received"),
  notes: z.string().trim().max(500).optional(),
});

export async function recordManualPayment(input: z.input<typeof manualSchema>): Promise<ActionResult<{ id: string }>> {
  await signedIn();
  const p = manualSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const supabase = await createClient();
  const receivedAt = p.data.received_at.length === 10 ? new Date(`${p.data.received_at}T${new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour12: false })}+03:00`) : new Date(p.data.received_at);
  const { data, error } = await supabase.rpc("record_manual_payment", {
    p_student: p.data.student_id, p_amount: p.data.amount, p_source: p.data.source, p_reference: p.data.reference ?? "",
    p_received_at: (receivedAt > new Date() ? new Date() : receivedAt).toISOString(), p_notes: p.data.notes,
  });
  if (error) return fail(friendlyDbError(error));
  refresh();
  const u = await getSessionUser();
  return ok({ id: data as unknown as string }, hasRole(u, "manager", "accountant") ? "Payment recorded and allocated" : "Payment recorded – awaiting verification by finance");
}

export async function verifyPayment(paymentId: string, approve: boolean, note?: string): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_payment", { p_payment: paymentId, p_approve: approve, p_note: note });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, approve ? "Payment verified and allocated" : "Payment rejected");
}

export async function matchPayment(paymentId: string, studentId: string, note: string): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("match_payment", { p_payment: paymentId, p_student: studentId, p_note: note });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Payment matched and allocated");
}

export async function reassignPayment(paymentId: string, studentId: string, reason: string): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reassign_payment", { p_payment: paymentId, p_student: studentId, p_reason: reason });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Payment moved to the correct student");
}

export async function reversePayment(paymentId: string, reason: string): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_payment", { p_payment: paymentId, p_reason: reason });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Payment reversed");
}

/** Student lookup for matching dialogs (RLS-scoped). */
export async function findStudents(query: string): Promise<{ id: string; label: string }[]> {
  await signedIn();
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_global", { p_query: q });
  return (data ?? []).filter((h) => h.kind === "student").map((h) => ({ id: h.id, label: `${h.title} · ${h.subtitle}` }));
}

export async function createAdjustment(input: { invoice_line_id: string; type: "credit_note" | "waiver" | "write_off" | "debit_note"; amount: number; reason: string }): Promise<ActionResult> {
  await signedIn();
  if (!input.reason || input.reason.trim().length < 5) return fail("Give a reason (at least 5 characters).");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_adjustment", { p_invoice_line: input.invoice_line_id, p_type: input.type, p_amount: Number(input.amount), p_reason: input.reason });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Adjustment posted");
}

export async function waiveInstalment(instalmentId: string, amount: number, reason: string): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("waive_instalment", { p_instalment: instalmentId, p_amount: Number(amount), p_reason: reason });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Instalment waived");
}

export async function requestRefund(studentId: string, amount: number, reason: string, method: "mpesa" | "cash" | "bank_transfer"): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_refund", { p_student: studentId, p_amount: Number(amount), p_reason: reason, p_method: method });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Refund requested – finance will review it");
}

export async function decideRefund(refundId: string, approve: boolean, note?: string): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_refund", { p_refund: refundId, p_approve: approve, p_note: note ?? "" });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, approve ? "Refund approved" : "Refund rejected");
}

export async function payRefund(refundId: string, reference: string): Promise<ActionResult> {
  await signedIn();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_refund_paid", { p_refund: refundId, p_reference: reference });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Refund marked as paid");
}
