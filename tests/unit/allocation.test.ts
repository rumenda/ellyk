import { describe, expect, it } from "vitest";
import { planAllocation, summarizeByComponent, type OpenLine } from "@/lib/finance/allocation";

const lines: OpenLine[] = [
  { id: "tuition", component: "tuition", outstanding: 9500, issueDate: "2026-11-01", invoiceNumber: "INV-1", sortOrder: 2 },
  { id: "ntsa", component: "ntsa", outstanding: 1450, issueDate: "2026-11-01", invoiceNumber: "INV-1", sortOrder: 3 },
  { id: "reg", component: "registration", outstanding: 1500, issueDate: "2026-11-01", invoiceNumber: "INV-1", sortOrder: 1 },
  { id: "svc", component: "service_fee", outstanding: 500, issueDate: "2026-11-01", invoiceNumber: "INV-1", sortOrder: 4 },
];

describe("planAllocation", () => {
  it("pays registration, then the service fee, then tuition, then NTSA (default order)", () => {
    const p = planAllocation(4000, lines);
    expect(p.lines).toEqual([
      { lineId: "reg", component: "registration", amount: 1500 },
      { lineId: "svc", component: "service_fee", amount: 500 },
      { lineId: "tuition", component: "tuition", amount: 2000 },
    ]);
    expect(p.unapplied).toBe(0);
  });

  it("keeps any overpayment as unapplied student credit", () => {
    const p = planAllocation(15000, lines);
    expect(p.allocated).toBe(12950);
    expect(p.unapplied).toBe(2050);
    expect(summarizeByComponent(p.lines)).toEqual({ registration: 1500, service_fee: 500, tuition: 9500, ntsa: 1450, other: 0 });
  });

  it("honours a custom priority (e.g. NTSA first)", () => {
    const p = planAllocation(2000, lines, ["ntsa", "registration", "service_fee", "tuition", "other"]);
    expect(p.lines[0]).toEqual({ lineId: "ntsa", component: "ntsa", amount: 1450 });
    expect(p.lines[1]).toEqual({ lineId: "reg", component: "registration", amount: 550 });
  });

  it("pays older invoices before newer ones regardless of component", () => {
    const p = planAllocation(1000, [...lines, { id: "old", component: "other", outstanding: 800, issueDate: "2026-10-01", invoiceNumber: "INV-0", sortOrder: 1 }]);
    expect(p.lines[0]).toEqual({ lineId: "old", component: "other", amount: 800 });
  });

  it("handles cents without float drift and ignores settled lines", () => {
    const p = planAllocation(0.3, [{ id: "a", component: "tuition", outstanding: 0.1, issueDate: "2026-01-01", invoiceNumber: "I", sortOrder: 1 },
      { id: "b", component: "ntsa", outstanding: 0.2, issueDate: "2026-01-01", invoiceNumber: "I", sortOrder: 2 },
      { id: "z", component: "other", outstanding: 0, issueDate: "2026-01-01", invoiceNumber: "I", sortOrder: 3 }]);
    expect(p.lines.map((l) => l.amount)).toEqual([0.1, 0.2]);
    expect(p.unapplied).toBe(0);
  });

  it("allocates nothing for non-positive amounts", () => {
    expect(planAllocation(0, lines).lines).toHaveLength(0);
    expect(planAllocation(-50, lines).allocated).toBe(0);
  });
});
