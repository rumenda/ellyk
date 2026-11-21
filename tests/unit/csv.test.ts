import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({}));
import { toCsv } from "@/features/reports/definitions";

describe("CSV export", () => {
  it("escapes quotes/commas and neutralises spreadsheet formulas", () => {
    const csv = toCsv({ columns: [{ key: "a", label: "Name" }, { key: "b", label: "Amount" }], rows: [{ a: '=HYPERLINK("x")', b: -1500 }, { a: 'Doe, "J"', b: 2 }], totals: { b: 3 } });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("-1500");
    expect(csv).toContain(`"Doe, ""J"""`);
  });
});
