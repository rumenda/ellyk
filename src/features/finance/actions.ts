"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, friendlyDbError, ok, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

async function finance() {
  const u = await getSessionUser();
  if (!u || !hasRole(u, "manager", "accountant")) throw new Error("Not allowed");
  return u;
}
const refresh = () => revalidatePath("/staff", "layout");

const expenseSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  category_id: z.uuid("Choose a category"),
  location_id: z.string().optional(),
  vehicle_id: z.string().optional(),
  vendor: z.string().trim().max(120).optional(),
  description: z.string().trim().min(3, "Describe the expense").max(200),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paid_from: z.enum(["1000", "1010", "1020"]),
  reference: z.string().trim().max(60).optional(),
});

export async function recordExpense(input: z.input<typeof expenseSchema>): Promise<ActionResult> {
  await finance();
  const p = expenseSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_expense", { p: p.data as unknown as Json });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Expense recorded and posted to the ledger");
}

export async function createSettlement(periodEnd: string, notes?: string): Promise<ActionResult> {
  await finance();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_developer_settlement", { p_period_end: periodEnd, p_notes: notes });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Settlement batch prepared");
}

export async function settlementAction(id: string, action: "approve" | "pay" | "cancel", reference?: string, method?: string): Promise<ActionResult> {
  await finance();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_developer_settlement", { p_settlement: id, p_action: action, p_reference: reference, p_method: method });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, action === "pay" ? "Settlement paid and posted" : action === "approve" ? "Settlement approved" : "Settlement cancelled");
}

export async function createPeriod(name: string, starts: string, ends: string): Promise<ActionResult> {
  await finance();
  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_periods").insert({ name, starts_on: starts, ends_on: ends });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Period created");
}

export async function closePeriod(id: string): Promise<ActionResult> {
  await finance();
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_fiscal_period", { p_period: id });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Period closed – no further postings allowed in it");
}
