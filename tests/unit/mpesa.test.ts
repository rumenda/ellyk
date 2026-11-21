import { describe, expect, it } from "vitest";
import { c2bPayloadSchema, formatTransTime, isWithinReplayWindow, normalizeReference, parseTransTime, protectMsisdn, sanitizePayload } from "@/lib/mpesa/c2b";

const payload = {
  TransactionType: "Pay Bill", TransID: "SKL7ABC123", TransTime: "20261121143005", TransAmount: "1,491.00",
  BusinessShortCode: "600999", BillRefNumber: "ek 00004", InvoiceNumber: "", OrgAccountBalance: "50000.00",
  ThirdPartyTransID: "", MSISDN: "254712345678", FirstName: "MERCY", MiddleName: "", LastName: "ODHIAMBO",
};

describe("C2B payload validation", () => {
  it("parses a Daraja confirmation", () => {
    const p = c2bPayloadSchema.parse(payload);
    expect(p.TransAmount).toBe(1491);
    expect(p.BusinessShortCode).toBe("600999");
  });
  it("rejects malformed transaction ids, amounts and times", () => {
    expect(c2bPayloadSchema.safeParse({ ...payload, TransID: "x;drop" }).success).toBe(false);
    expect(c2bPayloadSchema.safeParse({ ...payload, TransAmount: "-5" }).success).toBe(false);
    expect(c2bPayloadSchema.safeParse({ ...payload, TransAmount: "abc" }).success).toBe(false);
    expect(c2bPayloadSchema.safeParse({ ...payload, TransTime: "2026-11-21" }).success).toBe(false);
  });
  it("interprets TransTime as Nairobi time and round-trips it", () => {
    const d = parseTransTime("20261121143005");
    expect(d.toISOString()).toBe("2026-11-21T11:30:05.000Z");
    expect(formatTransTime(d)).toBe("20261121143005");
  });
});

describe("privacy", () => {
  it("never keeps the full phone number; hashes it for repeat-payer matching", () => {
    const { masked, hash } = protectMsisdn("254712345678");
    expect(masked).toBe("254712***678");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(protectMsisdn("2547 ***** 678").hash).toBeNull();
  });
  it("sanitises stored payloads (masked phone, first name + initial)", () => {
    const s = sanitizePayload(c2bPayloadSchema.parse(payload));
    expect(JSON.stringify(s)).not.toContain("254712345678");
    expect(s.PayerName).toBe("MERCY O.");
  });
});

describe("matching & replay protection", () => {
  it("normalises typed account references", () => {
    expect(normalizeReference(" ek-00004 ")).toBe("EK00004");
  });
  it("accepts recent callbacks and rejects stale or future ones", () => {
    const now = new Date("2026-11-21T12:00:00Z");
    expect(isWithinReplayWindow(new Date("2026-11-21T11:00:00Z"), now)).toBe(true);
    expect(isWithinReplayWindow(new Date("2026-11-15T11:00:00Z"), now)).toBe(false);
    expect(isWithinReplayWindow(new Date("2026-11-21T13:00:00Z"), now)).toBe(false);
  });
});
