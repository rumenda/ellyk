import { describe, expect, it } from "vitest";
import { addPeriod, buildSchedule, fillInstalments, ScheduleError, scheduleTotal } from "@/lib/finance/schedule";

describe("buildSchedule", () => {
  it("splits the balance into equal whole-shilling instalments with the remainder last", () => {
    const rows = buildSchedule({ total: 12950, deposit: 4000, mode: "count", count: 6, frequency: "weekly", depositDueDate: "2026-11-07" });
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ sequence: 0, label: "Deposit", due_date: "2026-11-07", amount: 4000 });
    expect(rows.slice(1, 6).every((r) => r.amount === 1491)).toBe(true);
    expect(rows[6]!.amount).toBe(1495);
    expect(scheduleTotal(rows)).toBe(12950);
  });

  it("charges no interest: the schedule always sums exactly to the total", () => {
    for (const [total, deposit, count] of [[13950, 4000, 6], [10001, 0, 7], [999.99, 100, 3], [50000, 12345, 52]] as const) {
      const rows = buildSchedule({ total, deposit, mode: "count", count, frequency: "weekly", depositDueDate: "2026-01-01" });
      expect(scheduleTotal(rows)).toBeCloseTo(total, 2);
    }
  });

  it("uses consecutive sequences from 0 and ascending weekly due dates", () => {
    const rows = buildSchedule({ total: 9000, deposit: 3000, mode: "count", count: 3, frequency: "weekly", depositDueDate: "2026-12-28" });
    expect(rows.map((r) => r.sequence)).toEqual([0, 1, 2, 3]);
    expect(rows.map((r) => r.due_date)).toEqual(["2026-12-28", "2027-01-04", "2027-01-11", "2027-01-18"]);
  });

  it("supports a fixed instalment amount with the final instalment taking the remainder", () => {
    const rows = buildSchedule({ total: 10000, deposit: 2500, mode: "amount", amount: 2000, frequency: "fortnightly", depositDueDate: "2026-03-01" });
    expect(rows.slice(1).map((r) => r.amount)).toEqual([2000, 2000, 2000, 1500]);
    expect(rows[2]!.due_date).toBe("2026-03-29");
  });

  it("starts at sequence 0 with the first instalment when there is no deposit", () => {
    const rows = buildSchedule({ total: 3000, deposit: 0, mode: "count", count: 3, frequency: "weekly", depositDueDate: "2026-05-01" });
    expect(rows[0]!.sequence).toBe(0);
    expect(rows[0]!.label).toBe("Instalment 1 of 3");
    expect(rows[0]!.due_date).toBe("2026-05-08");
  });

  it("returns just the deposit when it covers the whole fee", () => {
    expect(buildSchedule({ total: 5000, deposit: 5000, mode: "count", count: 4, frequency: "weekly", depositDueDate: "2026-05-01" })).toHaveLength(1);
  });

  it("rejects impossible inputs", () => {
    const base = { total: 1000, deposit: 0, mode: "count" as const, count: 2, frequency: "weekly" as const, depositDueDate: "2026-01-01" };
    expect(() => buildSchedule({ ...base, deposit: 2000 })).toThrow(ScheduleError);
    expect(() => buildSchedule({ ...base, total: 0 })).toThrow(ScheduleError);
    expect(() => buildSchedule({ ...base, count: 0 })).toThrow(ScheduleError);
    expect(() => buildSchedule({ ...base, mode: "amount", amount: 1 })).toThrow(/too small/);
    expect(() => buildSchedule({ ...base, firstInstalmentDate: "2025-12-01" })).toThrow(/before the deposit/);
  });
});

describe("addPeriod", () => {
  it("clamps monthly dates to the end of shorter months", () => {
    expect(addPeriod("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(addPeriod("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(addPeriod("2026-01-31", "monthly", 2)).toBe("2026-03-31");
  });
});

describe("fillInstalments (mirror of v_instalments)", () => {
  const plan = [{ amount: 4000 }, { amount: 1491 }, { amount: 1491 }, { amount: 1495 }];
  it("fills instalments oldest first", () => {
    expect(fillInstalments(plan, 5000)).toEqual([
      { paid: 4000, outstanding: 0 }, { paid: 1000, outstanding: 491 }, { paid: 0, outstanding: 1491 }, { paid: 0, outstanding: 1495 },
    ]);
  });
  it("treats waived amounts as not owed", () => {
    expect(fillInstalments([{ amount: 1000, waived_amount: 400 }, { amount: 1000 }], 700)).toEqual([{ paid: 600, outstanding: 0 }, { paid: 100, outstanding: 900 }]);
  });
  it("calculates outstanding balance after overpayment as zero", () => {
    const r = fillInstalments(plan, 99999);
    expect(r.reduce((s, x) => s + x.outstanding, 0)).toBe(0);
  });
});
