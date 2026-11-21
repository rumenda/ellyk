"use server";
import { revalidatePath } from "next/cache";
import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["ntsa_status"];
const refresh = () => revalidatePath("/staff", "layout");

export async function ntsaTransition(processId: string, to: Status, note?: string, details?: Record<string, string>): Promise<ActionResult> {
  if (!(await getSessionUser())) return fail("Please sign in again.");
  const supabase = await createClient();
  const d = { ...(details ?? {}) };
  if (d.test_date && d.test_date.length === 16) d.test_date = new Date(`${d.test_date}:00+03:00`).toISOString();
  const { error } = await supabase.rpc("ntsa_transition", { p_process: processId, p_to: to, p_note: note, p_details: d as unknown as Json });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "NTSA status updated");
}

export async function recordNtsaPayment(processId: string, amount: number, paidOn: string, reference: string, paidFrom: string, override?: string): Promise<ActionResult> {
  if (!(await getSessionUser())) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_ntsa_payment", { p_process: processId, p_amount: Number(amount), p_paid_on: paidOn, p_reference: reference, p_paid_from: paidFrom, p_override_reason: override || undefined });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "NTSA payment recorded and posted");
}

export async function recordTestResult(processId: string, result: "passed" | "failed" | "absent", notes?: string): Promise<ActionResult> {
  if (!(await getSessionUser())) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_test_result", { p_process: processId, p_result: result, p_notes: notes });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Result recorded – student notified");
}

export async function updateNtsaNotes(processId: string, notes: string, responsible?: string): Promise<ActionResult> {
  if (!(await getSessionUser())) return fail("Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("ntsa_processes").update({ notes, ...(responsible ? { responsible_user_id: responsible } : {}) }).eq("id", processId);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Saved");
}
