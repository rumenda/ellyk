import { describe, expect, it } from "vitest";
import { ADMIN_TRD, admin, as, freshEnrolledStudent, INSTRUCTOR, MANAGER, pay } from "./helpers";

/** A unique 10-minute slot far in the future/past so repeated runs never collide. */
function uniqueStart(direction: 1 | -1) {
  const minutes = 60 * 24 * 30 + Math.floor(Math.random() * 60 * 24 * 300); // 30–330 days away
  return new Date(Math.floor((Date.now() + direction * minutes * 60_000) / 600_000) * 600_000);
}

async function johnSession(direction: 1 | -1 = 1, locCode = "TRD") {
  const { data: ins } = await admin.from("instructors").select("id").eq("employee_number", "EKI-101").single();
  const loc = (await admin.from("locations").select("id").eq("code", locCode).single()).data!.id;
  const m = await as(MANAGER);
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = uniqueStart(direction);
    const { data, error } = await m.from("training_sessions").insert({ location_id: loc, instructor_id: ins!.id, lesson_type: "practical", title: "IT session",
      starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 10 * 60_000).toISOString(), capacity: 2 }).select("id").single();
    if (!error) return data.id;
    if (!/overlap/.test(error.message)) throw error;
  }
  throw new Error("Could not find a free slot");
}

describe("scheduling rules", () => {
  it("blocks training until the minimum payment is made", async () => {
    const f = await freshEnrolledStudent();
    await pay(f.studentNumber, 4000); // activates enrolment and meets the 4,000 gate
    const sid = await johnSession();
    const m = await as(MANAGER);
    const ok = await m.from("session_bookings").insert({ session_id: sid, student_id: f.studentId, enrolment_id: f.enrolmentId, booked_by: (await m.auth.getUser()).data.user!.id });
    expect(ok.error).toBeNull();

    const g = await freshEnrolledStudent();
    await admin.from("enrolments").update({ status: "active" }).eq("id", g.enrolmentId); // simulate active without payment
    const blocked = await m.from("session_bookings").insert({ session_id: sid, student_id: g.studentId, enrolment_id: g.enrolmentId, booked_by: (await m.auth.getUser()).data.user!.id });
    expect(blocked.error?.message).toMatch(/Minimum payment before training/);
  });

  it("prevents double-booking an instructor", async () => {
    const sid = await johnSession();
    const { data: s } = await admin.from("training_sessions").select("*").eq("id", sid).single();
    const m = await as(MANAGER);
    const clash = await m.from("training_sessions").insert({ location_id: s!.location_id, instructor_id: s!.instructor_id, lesson_type: "theory", title: "Clash",
      starts_at: s!.starts_at, ends_at: s!.ends_at, capacity: 5 });
    expect(clash.error?.message).toMatch(/training_sessions_no_instructor_overlap/);
  });

  it("refuses motorcycles that are in maintenance", async () => {
    const f = await freshEnrolledStudent();
    await pay(f.studentNumber, 4000);
    const sid = await johnSession();
    const { data: bike } = await admin.from("vehicles").select("id").eq("asset_number", "EK-M02").single();
    await admin.from("vehicles").update({ status: "maintenance" }).eq("id", bike!.id);
    const m = await as(MANAGER);
    const r = await m.from("session_bookings").insert({ session_id: sid, student_id: f.studentId, enrolment_id: f.enrolmentId, vehicle_id: bike!.id, booked_by: (await m.auth.getUser()).data.user!.id });
    await admin.from("vehicles").update({ status: "available" }).eq("id", bike!.id);
    expect(r.error?.message).toMatch(/not available/);
  });
});

describe("attendance & competencies", () => {
  it("lets the session's instructor mark attendance but not another instructor", async () => {
    const f = await freshEnrolledStudent();
    await pay(f.studentNumber, 4000);
    const s = { id: await johnSession(-1) };
    await admin.from("session_bookings").insert({ session_id: s.id, student_id: f.studentId, enrolment_id: f.enrolmentId });
    const ruth = await as("ruth.akinyi@ellyk.test");
    const denied = await ruth.rpc("record_attendance", { p_session: s!.id, p_entries: [{ student_id: f.studentId, status: "present" }] });
    expect(denied.error?.message).toMatch(/your own sessions/);
    const john = await as(INSTRUCTOR);
    const ok = await john.rpc("record_attendance", { p_session: s!.id, p_entries: [{ student_id: f.studentId, status: "absent", notes: "No show" }] });
    expect(ok.error).toBeNull();
    const { data: notif } = await admin.from("notifications").select("template_key").eq("student_id", f.studentId).eq("template_key", "lesson_missed");
    expect(Array.isArray(notif)).toBe(true);
    const { data: progress } = await admin.from("v_enrolment_progress").select("missed_sessions").eq("enrolment_id", f.enrolmentId).single();
    expect(progress!.missed_sessions).toBe(1);
  });

  it("requires every required competency before training can be signed off", async () => {
    const f = await freshEnrolledStudent();
    await pay(f.studentNumber, 4000);
    const m = await as(MANAGER);
    const early = await m.rpc("mark_training_complete", { p_enrolment: f.enrolmentId });
    expect(early.error?.message).toMatch(/required competencies/);
    const { data: comps } = await admin.from("competencies").select("id").eq("is_active", true).eq("required_for_test", true);
    const r = await m.rpc("assess_competencies", { p_enrolment: f.enrolmentId, p_session: null as unknown as string, p_entries: comps!.map((c) => ({ competency_id: c.id, rating: "competent" })) });
    expect(r.error).toBeNull();
    expect((await m.rpc("mark_training_complete", { p_enrolment: f.enrolmentId })).error).toBeNull();
  });
});

describe("NTSA workflow", () => {
  it("enforces document verification, payment gates and allowed transitions", async () => {
    const f = await freshEnrolledStudent();
    const adm = await as(ADMIN_TRD);
    const { data: np } = await admin.from("ntsa_processes").select("id").eq("enrolment_id", f.enrolmentId).single();
    const skip = await adm.rpc("ntsa_transition", { p_process: np!.id, p_to: "test_booked", p_details: { booking_reference: "X" } });
    expect(skip.error?.message).toMatch(/Cannot move/);
    const noDoc = await adm.rpc("ntsa_transition", { p_process: np!.id, p_to: "ready_for_payment" });
    expect(noDoc.error?.message).toMatch(/Verify the student's identification/);
    await admin.from("student_documents").insert({ student_id: f.studentId, document_type: "national_id", storage_path: `${f.studentId}/it.pdf`, file_name: "id.pdf", mime_type: "application/pdf", size_bytes: 10, status: "verified" });
    expect((await adm.rpc("ntsa_transition", { p_process: np!.id, p_to: "ready_for_payment" })).error).toBeNull();
    const gate = await adm.rpc("ntsa_transition", { p_process: np!.id, p_to: "payment_pending" });
    expect(gate.error?.message).toMatch(/Minimum payment before NTSA/);
    await pay(f.studentNumber, 10000);
    expect((await adm.rpc("ntsa_transition", { p_process: np!.id, p_to: "payment_pending" })).error).toBeNull();
    const { data: events } = await admin.from("ntsa_process_events").select("to_status").eq("process_id", np!.id);
    expect(events!.map((e) => e.to_status)).toEqual(expect.arrayContaining(["documents_pending", "ready_for_payment", "payment_pending"]));
  });
});
