import { describe, expect, it } from "vitest";
import { formatTransTime } from "@/lib/mpesa/c2b";
import { handleConfirmation, handleValidation, validCallbackToken } from "@/lib/mpesa/service";
import { admin, freshEnrolledStudent, transId } from "./helpers";

const body = (ref: string, id = transId(), when = new Date()) => ({
  TransactionType: "Pay Bill", TransID: id, TransTime: formatTransTime(when), TransAmount: "4000.00", BusinessShortCode: process.env.MPESA_SHORTCODE ?? "600999",
  BillRefNumber: ref, InvoiceNumber: "", OrgAccountBalance: "", ThirdPartyTransID: "", MSISDN: "254708374149", FirstName: "JANE", MiddleName: "", LastName: "DOE",
});

describe("M-Pesa callback handling", () => {
  it("checks the callback token in constant time", () => {
    expect(validCallbackToken(process.env.MPESA_CALLBACK_TOKEN!)).toBe(true);
    expect(validCallbackToken("wrong")).toBe(false);
    expect(validCallbackToken(null)).toBe(false);
  });

  it("rejects unauthenticated confirmations and logs them", async () => {
    const id = transId();
    const r = await handleConfirmation(body("EK00004", id), "203.0.113.9", false);
    expect(r.status).toBe(401);
    const { data } = await admin.from("payments").select("id").eq("external_reference", id);
    expect(data).toHaveLength(0);
    const { data: log } = await admin.from("mpesa_webhook_logs").select("outcome").eq("source_ip", "203.0.113.9").order("received_at", { ascending: false }).limit(1).single();
    expect(log!.outcome).toBe("unauthorized");
  });

  it("rejects malformed payloads with 400", async () => {
    expect((await handleConfirmation({ TransID: "bad id!" }, "127.0.0.1", true)).status).toBe(400);
  });

  it("processes a valid confirmation once and acknowledges duplicates", async () => {
    const f = await freshEnrolledStudent();
    const id = transId();
    const first = await handleConfirmation(body(f.studentNumber, id), "127.0.0.1", true);
    const again = await handleConfirmation(body(f.studentNumber, id), "127.0.0.1", true);
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    const { data } = await admin.from("payments").select("status, payer_phone_masked").eq("external_reference", id);
    expect(data).toHaveLength(1);
    expect(data![0]!.status).toBe("confirmed");
    expect(data![0]!.payer_phone_masked).not.toContain("708374149");
    const { data: tx } = await admin.from("mpesa_transactions").select("raw_payload").eq("trans_id", id).single();
    expect(JSON.stringify(tx!.raw_payload)).not.toContain("254708374149");
  });

  it("does not record stale (replayed) confirmations automatically", async () => {
    const id = transId();
    const r = await handleConfirmation(body("EK00004", id, new Date(Date.now() - 10 * 86_400_000)), "127.0.0.1", true);
    expect(r.status).toBe(200);
    const { data } = await admin.from("payments").select("id").eq("external_reference", id);
    expect(data).toHaveLength(0);
  });

  it("validation accepts known and (by default) unknown accounts, rejects wrong shortcodes", async () => {
    expect((await handleValidation(body("EK00004"), "127.0.0.1", true)).body.ResultCode).toBe("0");
    expect((await handleValidation(body("NOBODY"), "127.0.0.1", true)).body.ResultCode).toBe("0");
    expect((await handleValidation({ ...body("EK00004"), BusinessShortCode: "111111" }, "127.0.0.1", true)).body.ResultCode).toBe("C2B00016");
  });
});
