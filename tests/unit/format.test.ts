import { describe, expect, it } from "vitest";
import { formatKES, formatPhone, maskPhone, normalizeKenyanPhone, percent, relativeDays, todayKE } from "@/lib/format";

describe("Kenyan phone numbers", () => {
  it.each([
    ["0712345678", "+254712345678"], ["0712 345 678", "+254712345678"], ["254712345678", "+254712345678"],
    ["+254 712 345 678", "+254712345678"], ["712345678", "+254712345678"], ["0110123456", "+254110123456"],
  ])("normalises %s", (input, out) => expect(normalizeKenyanPhone(input)).toBe(out));

  it.each(["", "12345", "0812345678", "+255712345678", "07123456789"])("rejects %s", (input) => expect(normalizeKenyanPhone(input)).toBeNull());

  it("formats and masks for display", () => {
    expect(formatPhone("+254712345678")).toBe("0712 345 678");
    expect(maskPhone("+254712345678")).toBe("0712 ••• 678");
  });
});

describe("money & dates", () => {
  it("formats KES without trailing zeros", () => {
    expect(formatKES(12950)).toBe("KES 12,950");
    expect(formatKES("1491.5")).toBe("KES 1,491.5");
    expect(formatKES(null)).toBe("KES 0");
  });
  it("uses Africa/Nairobi for 'today'", () => {
    expect(todayKE(new Date("2026-11-21T21:30:00Z"))).toBe("2026-11-22"); // 00:30 in Nairobi
  });
  it("describes relative days", () => {
    expect(relativeDays("2026-11-24", "2026-11-21")).toBe("in 3 days");
    expect(relativeDays("2026-11-20", "2026-11-21")).toBe("yesterday");
  });
  it("clamps percentages", () => {
    expect(percent(5, 0)).toBe(0);
    expect(percent(150, 100)).toBe(100);
  });
});
