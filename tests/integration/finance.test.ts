import { describe, expect, it } from "vitest";
import { planAllocation } from "@/lib/finance/allocation";
import { fillInstalments } from "@/lib/finance/schedule";
import { ACCOUNTANT, ADMIN_TRD, admin, as, freshEnrolledStudent, ledgerBalanced, lineBalances, MANAGER, pay, transId } from "./helpers";

describe("enrolment acceptance", () => {
  it("creates agreement snapshot, plan, invoice, NTSA process and a balanced journal", async () => {
    const f = await freshEnrolledStudent();
    const [agreement, plan, invoice, ntsa, enr] = await Promise.all([
      admin.from("student_course_agreements").select("*").eq("enrolment_id", f.enrolmentId).single(),
      admin.from("payment_plans").select("*, instalments(*)").eq("enrolment_id", f.enrolmentId).single(),
      admin.from("invoices").select("*, invoice_lines(*), journal_entry_id").eq("enrolment_id", f.enrolmentId).single(),
      admin.from("ntsa_processes").select("*").eq("enrolment_id", f.enrolmentId).single(),
      admin.from("enrolments").select("status").eq("id", f.enrolmentId).single(),
    ]);
    expect(Number(agreement.data!.total_amount)).toBe(f.quote.total);
    expect(Number(agreement.data!.service_fee_amount)).toBe(500);
    expect(plan.data!.instalments.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0)).toBe(f.quote.total);
    expect(Number(invoice.data!.total)).toBe(f.quote.total);
    expect(invoice.data!.invoice_lines.map((l: { component: string }) => l.component).sort()).toEqual(["ntsa", "registration", "service_fee", "tuition"]);
    expect(ntsa.data!.status).toBe("documents_pending");
    expect(Number(ntsa.data!.ntsa_amount)).toBe(1450);
    expect(enr.data!.status).toBe("awaiting_deposit");
    const { data: lines } = await admin.from("journal_lines").select("debit, credit, account:chart_of_accounts(code)").eq("journal_entry_id", invoice.data!.journal_entry_id!);
    const by = (code: string, k: "debit" | "credit") => (lines ?? []).filter((l) => l.account!.code === code).reduce((s, l) => s + Number(l[k]), 0);
    expect(by("1100", "debit")).toBe(f.quote.total);
    expect(by("2105", "credit")).toBe(1450); // NTSA billed (not school revenue)
    expect(by("2205", "credit")).toBe(500); // developer fee billed (not school revenue)
    expect(by("4000", "credit") + by("4010", "credit")).toBe(f.quote.total - 1950);
  });

  it("refuses schedules that do not sum to the agreed total", async () => {
    const m = await as(MANAGER);
    const f = await freshEnrolledStudent();
    const { data: enr2, error } = await m.rpc("create_enrolment", { p_student: f.studentId, p_course: (await admin.from("courses").select("id").eq("code", "MC-PRO").single()).data!.id, p_location: f.locationId });
    expect(error).toBeNull();
    const bad = await m.rpc("accept_enrolment_agreement", { p_enrolment: enr2 as unknown as string, p_schedule: [{ sequence: 0, label: "Deposit", due_date: "2026-11-21", amount: 4000 }], p_accepted_via: "in_person" });
    expect(bad.error?.message).toMatch(/does not match agreement total/);
  });
});

describe("M-Pesa confirmation & allocation", () => {
  it("allocates the deposit in priority order and activates the enrolment", async () => {
    const f = await freshEnrolledStudent();
    const res = await pay(f.studentNumber, 4000);
    expect((res.data as { status: string }).status).toBe("matched");
    const b = await lineBalances(f.enrolmentId);
    expect(b.registration!.paid).toBe(1500);
    expect(b.service_fee!.paid).toBe(500);
    expect(b.tuition!.paid).toBe(2000);
    expect(b.ntsa!.paid).toBe(0);
    const { data: e } = await admin.from("enrolments").select("status").eq("id", f.enrolmentId).single();
    expect(e!.status).toBe("active");
  });

  it("matches the TypeScript allocation preview exactly (parity)", async () => {
    const f = await freshEnrolledStudent();
    const { data: open } = await admin.from("v_invoice_line_balances").select("invoice_line_id, component, outstanding, issue_date, invoice_number, sort_order").eq("enrolment_id", f.enrolmentId);
    const preview = planAllocation(6200, (open ?? []).map((l) => ({ id: l.invoice_line_id!, component: l.component!, outstanding: Number(l.outstanding), issueDate: l.issue_date!, invoiceNumber: l.invoice_number!, sortOrder: l.sort_order! })));
    await pay(f.studentNumber, 6200);
    const { data: allocs } = await admin.from("payment_allocations").select("invoice_line_id, amount, payment:payments!inner(student_id)").eq("payment.student_id", f.studentId);
    expect(allocs!.map((a) => [a.invoice_line_id, Number(a.amount)]).sort()).toEqual(preview.lines.map((l) => [l.lineId, l.amount]).sort());
  });

  it("is idempotent: a replayed callback never creates a second payment", async () => {
    const f = await freshEnrolledStudent();
    const id = transId();
    const first = await pay(f.studentNumber, 1000, id);
    const second = await pay(f.studentNumber, 1000, id);
    expect((first.data as { status: string }).status).toBe("matched");
    expect((second.data as { status: string }).status).toBe("duplicate");
    const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("external_reference", id);
    expect(count).toBe(1);
  });

  it("rejects callbacks for a different shortcode", async () => {
    const res = await admin.rpc("mpesa_record_confirmation", { p_trans_id: transId(), p_trans_type: "Pay Bill", p_trans_time: new Date().toISOString(), p_amount: 100,
      p_short_code: "123456", p_bill_ref: "EK00001", p_msisdn_masked: "", p_msisdn_hash: "", p_payer_name: "", p_org_balance: 0, p_environment: "sandbox", p_raw: {} });
    expect(res.error?.message).toMatch(/does not match the configured paybill/);
  });

  it("keeps overpayments as credit and derives instalment status from allocations", async () => {
    const f = await freshEnrolledStudent();
    await pay(f.studentNumber, f.quote.total + 750);
    const [{ data: credit }, { data: inst }, { data: bal }] = await Promise.all([
      admin.from("v_student_credit").select("credit_balance").eq("student_id", f.studentId).single(),
      admin.from("v_instalments").select("status, amount_outstanding").eq("enrolment_id", f.enrolmentId),
      admin.from("v_enrolment_balances").select("total_outstanding, ntsa_paid, service_fee_paid").eq("enrolment_id", f.enrolmentId).single(),
    ]);
    expect(Number(credit!.credit_balance)).toBe(750);
    expect(inst!.every((i) => i.status === "paid")).toBe(true);
    expect(Number(bal!.total_outstanding)).toBe(0);
    expect(Number(bal!.ntsa_paid)).toBe(1450);
    expect(Number(bal!.service_fee_paid)).toBe(500);
  });

  it("partial payment fills instalments oldest-first (matches fillInstalments)", async () => {
    const f = await freshEnrolledStudent();
    await pay(f.studentNumber, 5000);
    const { data } = await admin.from("v_instalments").select("sequence, amount, amount_paid").eq("enrolment_id", f.enrolmentId).order("sequence");
    const expected = fillInstalments(f.schedule.map((r) => ({ amount: r.amount })), 5000);
    expect(data!.map((r) => Number(r.amount_paid))).toEqual(expected.map((e) => e.paid));
  });
});

describe("reconciliation", () => {
  it("queues unknown account numbers and lets finance match them", async () => {
    const f = await freshEnrolledStudent();
    const res = await pay("WRONGREF", 4000);
    const payment = res.data as { status: string; payment_id: string };
    expect(payment.status).toBe("unmatched");
    const adminC = await as(ADMIN_TRD);
    const denied = await adminC.rpc("match_payment", { p_payment: payment.payment_id, p_student: f.studentId, p_note: "trying" });
    expect(denied.error?.message).toMatch(/Only finance staff/);
    const acct = await as(ACCOUNTANT);
    const okRes = await acct.rpc("match_payment", { p_payment: payment.payment_id, p_student: f.studentId, p_note: "Student showed SMS" });
    expect(okRes.error).toBeNull();
    const { data: p } = await admin.from("payments").select("status, receipt_number, matching_method").eq("id", payment.payment_id).single();
    expect(p).toMatchObject({ status: "confirmed", matching_method: "manual" });
    expect(p!.receipt_number).toMatch(/^RCT-/);
    expect((await lineBalances(f.enrolmentId)).registration!.paid).toBe(1500);
  });

  it("reverses a payment with append-only negative allocations", async () => {
    const f = await freshEnrolledStudent();
    const payment = (await pay(f.studentNumber, 4000)).data as { payment_id: string };
    const acct = await as(ACCOUNTANT);
    expect((await acct.rpc("reverse_payment", { p_payment: payment.payment_id, p_reason: "Safaricom reversal request" })).error).toBeNull();
    const { data: allocs } = await admin.from("payment_allocations").select("amount").eq("payment_id", payment.payment_id);
    expect(allocs!.reduce((s, a) => s + Number(a.amount), 0)).toBe(0);
    expect(allocs!.some((a) => Number(a.amount) < 0)).toBe(true);
    expect((await lineBalances(f.enrolmentId)).registration!.paid).toBe(0);
  });

  it("requires a second person to verify admin-recorded cash", async () => {
    const f = await freshEnrolledStudent();
    const m = await as(MANAGER);
    const adminC = await as(ADMIN_TRD);
    const { data: pid } = await adminC.rpc("record_manual_payment", { p_student: f.studentId, p_amount: 500, p_source: "cash", p_reference: `CB-${Date.now()}`, p_received_at: new Date().toISOString() });
    const { data: before } = await admin.from("payments").select("status").eq("id", pid as unknown as string).single();
    expect(before!.status).toBe("pending_verification");
    expect((await m.rpc("verify_payment", { p_payment: pid as unknown as string, p_approve: true })).error).toBeNull();
    expect((await lineBalances(f.enrolmentId)).registration!.paid).toBe(500);
  });
});

describe("adjustments, NTSA funds and developer fees", () => {
  it("waives an instalment via a credit note and posts a balanced journal", async () => {
    const f = await freshEnrolledStudent();
    const { data: inst } = await admin.from("v_instalments").select("id").eq("enrolment_id", f.enrolmentId).eq("sequence", 6).single();
    const acct = await as(ACCOUNTANT);
    expect((await acct.rpc("waive_instalment", { p_instalment: inst!.id!, p_amount: 1000, p_reason: "Bursary for top student" })).error).toBeNull();
    const { data: after } = await admin.from("v_instalments").select("effective_amount, waived_amount").eq("id", inst!.id!).single();
    expect(Number(after!.waived_amount)).toBe(1000);
    const { data: bal } = await admin.from("v_enrolment_balances").select("total_due").eq("enrolment_id", f.enrolmentId).single();
    expect(Number(bal!.total_due)).toBe(f.quote.total - 1000);
    expect(await ledgerBalanced()).toBe(true);
  });

  it("tracks NTSA funds held = collected − paid to NTSA", async () => {
    const f = await freshEnrolledStudent();
    await pay(f.studentNumber, f.quote.total);
    const { data: np } = await admin.from("ntsa_processes").select("id").eq("enrolment_id", f.enrolmentId).single();
    let { data: funds } = await admin.from("v_ntsa_funds").select("*").eq("process_id", np!.id).single();
    expect(Number(funds!.ntsa_held)).toBe(1450);
    await admin.from("ntsa_processes").update({ status: "ready_for_payment" }).eq("id", np!.id);
    const acct = await as(ACCOUNTANT);
    const r = await acct.rpc("record_ntsa_payment", { p_process: np!.id, p_amount: 1450, p_paid_on: new Date().toISOString().slice(0, 10), p_reference: `ECZ-IT-${Date.now()}` });
    expect(r.error).toBeNull();
    ({ data: funds } = await admin.from("v_ntsa_funds").select("*").eq("process_id", np!.id).single());
    expect(Number(funds!.ntsa_held)).toBe(0);
    expect(funds!.status).toBe("paid_by_school");
  });

  it("refuses to pay NTSA beyond funds held without a reason", async () => {
    const f = await freshEnrolledStudent();
    const { data: np } = await admin.from("ntsa_processes").select("id").eq("enrolment_id", f.enrolmentId).single();
    await admin.from("ntsa_processes").update({ status: "ready_for_payment" }).eq("id", np!.id);
    const acct = await as(ACCOUNTANT);
    const r = await acct.rpc("record_ntsa_payment", { p_process: np!.id, p_amount: 1450, p_paid_on: new Date().toISOString().slice(0, 10), p_reference: `ECZ-IT2-${Date.now()}` });
    expect(r.error?.message).toMatch(/Give a reason to advance school funds/);
  });

  it("records the developer service fee separately and settles it exactly once", async () => {
    const f = await freshEnrolledStudent();
    const payment = (await pay(f.studentNumber, 4000)).data as { payment_id: string };
    const { data: led } = await admin.from("v_developer_fee_ledger").select("amount, settlement_id").eq("payment_id", payment.payment_id);
    expect(led).toEqual([{ amount: 500, settlement_id: null }]);
    const acct = await as(ACCOUNTANT);
    const { data: sid, error } = await acct.rpc("create_developer_settlement", { p_period_end: new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10) });
    expect(error).toBeNull();
    const { data: again } = await admin.from("v_developer_fee_ledger").select("settlement_id").eq("payment_id", payment.payment_id).single();
    expect(again!.settlement_id).toBe(sid);
    const second = await acct.rpc("create_developer_settlement", { p_period_end: new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10) });
    expect(second.error?.message).toMatch(/no unsettled service fees/);
  });

  it("keeps the whole ledger balanced", async () => {
    expect(await ledgerBalanced()).toBe(true);
  });
});
