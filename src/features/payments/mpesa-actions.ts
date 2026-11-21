"use server";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { formatTransTime } from "@/lib/mpesa/c2b";
import { registerC2BUrls } from "@/lib/mpesa/daraja";
import { handleConfirmation, mpesaEnv } from "@/lib/mpesa/service";

/**
 * SANDBOX ONLY. Generates a Daraja-shaped C2B confirmation and pushes it
 * through the exact same handler as real callbacks. Disabled in production.
 */
export async function simulateC2B(input: { account: string; amount: number; phone: string; name: string }): Promise<ActionResult<{ status: string; transId: string }>> {
  const user = await getSessionUser();
  if (!hasRole(user, "manager", "accountant", "platform_owner")) return fail("Not allowed");
  if (mpesaEnv() !== "sandbox") return fail("The simulator is disabled in production.");
  const transId = `SBX${Date.now().toString(36).toUpperCase().slice(-7)}`;
  const payload = {
    TransactionType: "Pay Bill", TransID: transId, TransTime: formatTransTime(new Date()), TransAmount: String(input.amount),
    BusinessShortCode: process.env.MPESA_SHORTCODE ?? "600999", BillRefNumber: input.account, InvoiceNumber: "", OrgAccountBalance: "",
    ThirdPartyTransID: "", MSISDN: input.phone, FirstName: input.name || "SANDBOX", MiddleName: "", LastName: "TEST",
  };
  const res = await handleConfirmation(payload, "sandbox-simulator", true, "simulate");
  revalidatePath("/staff", "layout");
  if (res.status !== 200) return fail(String(res.body.ResultDesc ?? "Simulation failed"));
  const status = String(res.body.status ?? "processed");
  return ok({ status, transId }, status === "matched" ? `Sandbox payment ${transId} matched and allocated` : status === "unmatched" ? `Sandbox payment ${transId} recorded as UNMATCHED` : `Result: ${status}`);
}

export async function registerUrls(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!hasRole(user, "manager", "platform_owner")) return fail("Not allowed");
  const r = await registerC2BUrls(process.env.NEXT_PUBLIC_APP_URL ?? "");
  return r.ok ? ok(undefined, r.message) : fail(r.message);
}
