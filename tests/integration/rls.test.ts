import { describe, expect, it } from "vitest";
import { ACCOUNTANT, ADMIN_KTG, ADMIN_TRD, admin, anon, as, freshEnrolledStudent, INSTRUCTOR, locationId, MANAGER, PLATFORM } from "./helpers";

const studentEmail = async (number: string) => `${number.toLowerCase()}@students.ellyk.local`;

describe("Row Level Security", () => {
  it("anonymous visitors can read nothing", async () => {
    for (const t of ["students", "payments", "journal_lines", "leads", "audit_logs", "locations"] as const) {
      const { data } = await anon.from(t).select("*").limit(1);
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("a student sees only their own records", async () => {
    const me = await as(await studentEmail("EK00004"));
    const { data: students } = await me.from("students").select("student_number");
    expect(students!.map((s) => s.student_number)).toEqual(["EK00004"]);
    const { data: pays } = await me.from("payments").select("student_id");
    const { data: own } = await admin.from("students").select("id").eq("student_number", "EK00004").single();
    expect(pays!.length).toBeGreaterThan(0);
    expect(pays!.every((p) => p.student_id === own!.id)).toBe(true);
    for (const t of ["journal_lines", "leads", "audit_logs", "mpesa_transactions", "developer_settlements", "expenses", "student_identities"] as const) {
      const { data } = await me.from(t).select("*").limit(5);
      if (t === "student_identities") expect((data ?? []).every((r) => (r as { student_id: string }).student_id === own!.id)).toBe(true);
      else expect(data ?? []).toHaveLength(0);
    }
  });

  it("a student cannot read another student's documents or balances", async () => {
    const me = await as(await studentEmail("EK00004"));
    const { data: other } = await admin.from("students").select("id").eq("student_number", "EK00001").single();
    const [{ data: docs }, { data: bal }] = await Promise.all([
      me.from("student_documents").select("id").eq("student_id", other!.id),
      me.from("v_student_balances").select("*").eq("student_id", other!.id),
    ]);
    expect(docs).toHaveLength(0);
    expect(bal).toHaveLength(0);
  });

  it("an instructor sees operational data but no finance", async () => {
    const ins = await as(INSTRUCTOR);
    const [{ data: pays }, { data: journals }, { data: invoices }, { data: ids }, { data: students }] = await Promise.all([
      ins.from("payments").select("id").limit(5), ins.from("journal_entries").select("id").limit(5), ins.from("invoices").select("id").limit(5),
      ins.from("student_identities").select("student_id").limit(5), ins.from("students").select("id").limit(100),
    ]);
    expect(pays).toHaveLength(0);
    expect(journals).toHaveLength(0);
    expect(invoices).toHaveLength(0);
    expect(ids).toHaveLength(0);
    expect(students!.length).toBeGreaterThan(0);
    const { data: total } = await admin.from("students").select("id");
    expect(students!.length).toBeLessThan(total!.length);
  });

  it("location-scoped administrators only see their locations", async () => {
    const ktg = await as(ADMIN_KTG);
    const ktgId = await locationId("KTG");
    const { data } = await ktg.from("students").select("home_location_id");
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((s) => s.home_location_id === ktgId)).toBe(true);
    const trd = await freshEnrolledStudent("TRD");
    const denied = await ktg.rpc("create_enrolment", { p_student: trd.studentId, p_course: (await admin.from("courses").select("id").eq("code", "MC-A2").single()).data!.id, p_location: await locationId("TRD") });
    expect(denied.error?.message).toMatch(/not allowed/);
  });

  it("the platform owner sees service-fee data but no confidential school data", async () => {
    const p = await as(PLATFORM);
    const [{ data: students }, { data: pays }, { data: journals }, summary, { data: settlements }] = await Promise.all([
      p.from("students").select("id").limit(5), p.from("payments").select("id").limit(5), p.from("journal_lines").select("id").limit(5),
      p.rpc("platform_fee_summary"), p.from("developer_settlements").select("id"),
    ]);
    expect(students).toHaveLength(0);
    expect(pays).toHaveLength(0);
    expect(journals).toHaveLength(0);
    expect(summary.error).toBeNull();
    expect(settlements!.length).toBeGreaterThan(0);
    const dash = await p.rpc("dashboard_finance", {});
    expect(dash.error?.message).toMatch(/Only finance staff/);
  });

  it("the accountant cannot register students; the admin cannot post adjustments", async () => {
    const acct = await as(ACCOUNTANT);
    const r = await acct.rpc("register_student", { p: { first_name: "X", last_name: "Y", phone: "0712000000", home_location_id: await locationId("TRD"), consent_data_processing: true } });
    expect(r.error?.message).toMatch(/not allowed/);
    const adm = await as(ADMIN_TRD);
    const { data: line } = await admin.from("invoice_lines").select("id").limit(1).single();
    const adj = await adm.rpc("create_adjustment", { p_invoice_line: line!.id, p_type: "credit_note", p_amount: 1, p_reason: "test reason" });
    expect(adj.error?.message).toMatch(/Only finance staff/);
  });

  it("ledger, payments and audit rows cannot be written or changed directly", async () => {
    const m = await as(MANAGER);
    const ins = await m.from("payments").insert({ source: "cash", status: "confirmed", amount: 100, received_at: new Date().toISOString() });
    expect(ins.error).not.toBeNull();
    const { data: je } = await admin.from("journal_entries").select("id").limit(1).single();
    const upd = await admin.from("journal_entries").update({ description: "tamper" }).eq("id", je!.id);
    expect(upd.error?.message).toMatch(/immutable/);
    const { data: log } = await admin.from("audit_logs").select("id").limit(1).single();
    const del = await admin.from("audit_logs").delete().eq("id", log!.id);
    expect(del.error?.message).toMatch(/immutable/);
  });

  it("workflow columns cannot be changed by direct API updates", async () => {
    const f = await freshEnrolledStudent();
    const m = await as(MANAGER);
    const r = await m.from("enrolments").update({ status: "completed" }).eq("id", f.enrolmentId);
    expect(r.error?.message).toMatch(/proper workflow/);
    const n = await m.from("ntsa_processes").update({ status: "passed" }).eq("enrolment_id", f.enrolmentId);
    expect(n.error?.message).toMatch(/proper workflow/);
  });

  it("published prices are immutable", async () => {
    const { data: pv } = await admin.from("course_price_versions").select("id").eq("status", "active").limit(1).single();
    const acct = await as(ACCOUNTANT);
    const r = await acct.from("course_price_versions").update({ deposit_amount: 1 }).eq("id", pv!.id);
    expect(r.error?.message).toMatch(/immutable/);
    const { data: item } = await admin.from("course_price_items").select("id").eq("price_version_id", pv!.id).limit(1).single();
    const i = await acct.from("course_price_items").update({ amount: 1 }).eq("id", item!.id);
    expect(i.error?.message).toMatch(/cannot be changed/);
  });

  it("service-only functions are not callable by signed-in users", async () => {
    const m = await as(MANAGER);
    const r = await m.rpc("mpesa_record_confirmation", { p_trans_id: "XYZ12345678", p_trans_type: "Pay Bill", p_trans_time: new Date().toISOString(), p_amount: 1, p_short_code: "600999", p_bill_ref: "", p_msisdn_masked: "", p_msisdn_hash: "", p_payer_name: "", p_org_balance: 0, p_environment: "sandbox", p_raw: {} });
    expect(r.error).not.toBeNull();
    const l = await m.rpc("resolve_login_email", { p_identifier: "EK00001" });
    expect(l.error).not.toBeNull();
  });
});
