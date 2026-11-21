"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, friendlyDbError, ok, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { addPeriod } from "@/lib/finance/schedule";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

async function user() {
  const u = await getSessionUser();
  if (!u) throw new Error("Not signed in");
  return u;
}
const ts = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).toISOString();
const refresh = () => revalidatePath("/staff", "layout");

const sessionSchema = z.object({
  location_id: z.uuid("Choose a location"),
  instructor_id: z.uuid("Choose an instructor"),
  course_id: z.string().optional(),
  lesson_type: z.enum(["theory", "practical", "assessment", "mock_test"]),
  title: z.string().trim().min(3, "Give the session a title").max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Start time"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "End time"),
  capacity: z.coerce.number().int().min(1).max(60),
  repeat_weeks: z.coerce.number().int().min(0).max(12).default(0),
  notes: z.string().max(500).optional(),
}).refine((v) => v.end > v.start, { path: ["end"], message: "End must be after start" });

export async function createSessions(input: z.input<typeof sessionSchema>): Promise<ActionResult<{ id: string; created: number; skipped: string[] }>> {
  const u = await user();
  const p = sessionSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const d = p.data;
  const supabase = await createClient();
  let firstId = "", created = 0;
  const skipped: string[] = [];
  for (let w = 0; w <= d.repeat_weeks; w++) {
    const date = w === 0 ? d.date : addPeriod(d.date, "weekly", w);
    const { data, error } = await supabase.from("training_sessions").insert({
      location_id: d.location_id, instructor_id: d.instructor_id, course_id: d.course_id || null, lesson_type: d.lesson_type,
      title: d.title, starts_at: ts(date, d.start), ends_at: ts(date, d.end), capacity: d.capacity, notes: d.notes || null, created_by: u.id,
    }).select("id").single();
    if (error) {
      if (w === 0) return fail(friendlyDbError(error));
      skipped.push(`${date}: ${friendlyDbError(error)}`);
      continue;
    }
    if (!firstId) firstId = data.id;
    created++;
  }
  refresh();
  return ok({ id: firstId, created, skipped }, created > 1 ? `${created} sessions scheduled${skipped.length ? `, ${skipped.length} skipped (conflicts)` : ""}` : "Session scheduled");
}

export async function setSessionStatus(id: string, status: "confirmed" | "in_progress" | "completed" | "missed" | "cancelled", reason?: string): Promise<ActionResult> {
  await user();
  if (status === "cancelled" && (!reason || reason.trim().length < 3)) return fail("Give a reason for cancelling.");
  const supabase = await createClient();
  const { error } = await supabase.from("training_sessions").update({ status, cancellation_reason: status === "cancelled" ? reason : null }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, `Session ${status.replace("_", " ")}`);
}

/** Move a session: create the new one, carry bookings across, mark the old one rescheduled. */
export async function rescheduleSession(id: string, date: string, start: string, end: string): Promise<ActionResult<{ id: string }>> {
  const u = await user();
  if (!hasRole(u, "manager", "admin")) return fail("Only office staff can reschedule. Instructors can submit a request.");
  if (end <= start) return fail("End must be after start.");
  const supabase = await createClient();
  const { data: s } = await supabase.from("training_sessions").select("*").eq("id", id).single();
  if (!s) return fail("Session not found");
  const { data: bookings } = await supabase.from("session_bookings").select("student_id, enrolment_id, vehicle_id").eq("session_id", id).eq("status", "booked");
  // Free the old slot first so the student/vehicle constraints don't block the move.
  const { error: e1 } = await supabase.from("training_sessions").update({ status: "rescheduled" }).eq("id", id);
  if (e1) return fail(friendlyDbError(e1));
  const { data: n, error } = await supabase.from("training_sessions").insert({
    location_id: s.location_id, instructor_id: s.instructor_id, course_id: s.course_id, lesson_type: s.lesson_type, title: s.title,
    capacity: s.capacity, notes: s.notes, starts_at: ts(date, start), ends_at: ts(date, end), created_by: u.id,
  }).select("id").single();
  if (error) {
    await supabase.from("training_sessions").update({ status: s.status }).eq("id", id);
    return fail(friendlyDbError(error));
  }
  await supabase.from("training_sessions").update({ rescheduled_to: n.id }).eq("id", id);
  const problems: string[] = [];
  for (const b of bookings ?? []) {
    const { error: be } = await supabase.from("session_bookings").insert({ session_id: n.id, student_id: b.student_id, enrolment_id: b.enrolment_id, vehicle_id: b.vehicle_id, booked_by: u.id });
    if (be) problems.push(friendlyDbError(be));
  }
  refresh();
  return ok({ id: n.id }, problems.length ? `Rescheduled. ${problems.length} booking(s) need attention: ${problems[0]}` : "Session rescheduled – students notified");
}

export async function addBooking(sessionId: string, enrolmentId: string, vehicleId: string | null, overrideGate = false): Promise<ActionResult> {
  const u = await user();
  const supabase = await createClient();
  const { data: e } = await supabase.from("enrolments").select("student_id").eq("id", enrolmentId).single();
  if (!e) return fail("Enrolment not found");
  const { error } = await supabase.from("session_bookings").upsert({
    session_id: sessionId, student_id: e.student_id, enrolment_id: enrolmentId, vehicle_id: vehicleId || null, booked_by: u.id,
    status: "booked", override_payment_gate: overrideGate,
  }, { onConflict: "session_id,student_id" });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Student booked");
}

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  await user();
  const supabase = await createClient();
  const { error } = await supabase.from("session_bookings").update({ status: "cancelled" }).eq("id", bookingId);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Booking cancelled");
}

export async function recordAttendance(sessionId: string, entries: { student_id: string; status: string; notes?: string }[]): Promise<ActionResult> {
  await user();
  if (entries.length === 0) return fail("Mark at least one student.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_attendance", { p_session: sessionId, p_entries: entries as unknown as Json });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, `Attendance saved for ${data} student${data === 1 ? "" : "s"}`);
}

export async function assessCompetencies(enrolmentId: string, sessionId: string | null, entries: { competency_id: string; rating: string; comment?: string }[]): Promise<ActionResult> {
  await user();
  if (entries.length === 0) return fail("Change at least one rating.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("assess_competencies", { p_enrolment: enrolmentId, p_session: sessionId as unknown as string, p_entries: entries as unknown as Json });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Assessment saved");
}

export async function requestSessionChange(sessionId: string, reason: string, proposed?: string): Promise<ActionResult> {
  const u = await user();
  const supabase = await createClient();
  const { error } = await supabase.from("session_change_requests").insert({
    session_id: sessionId, requested_by: u.id, reason, proposed_starts_at: proposed ? new Date(`${proposed}:00+03:00`).toISOString() : null,
  });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Request sent to the office");
}

export async function decideSessionChange(requestId: string, approve: boolean, note?: string): Promise<ActionResult> {
  const u = await user();
  const supabase = await createClient();
  const { error } = await supabase.from("session_change_requests").update({
    status: approve ? "approved" : "declined", decided_by: u.id, decided_at: new Date().toISOString(), decision_note: note ?? null,
  }).eq("id", requestId);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, approve ? "Approved – reschedule the session to apply it" : "Request declined");
}

export async function reportIncident(input: { vehicle_id?: string; session_id?: string; student_id?: string; location_id?: string; occurred_at: string; severity: "minor" | "moderate" | "major"; description: string; injuries: boolean }): Promise<ActionResult> {
  const u = await user();
  if (input.description.trim().length < 10) return fail("Describe what happened (at least 10 characters).");
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_incidents").insert({
    vehicle_id: input.vehicle_id || null, session_id: input.session_id || null, student_id: input.student_id || null,
    location_id: input.location_id || null, occurred_at: new Date(input.occurred_at).toISOString(), severity: input.severity,
    description: input.description.trim(), injuries: input.injuries, reported_by: u.id, instructor_id: u.instructorId,
  });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Incident reported – the office has been informed");
}
