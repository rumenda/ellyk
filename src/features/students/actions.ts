"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { fail, friendlyDbError, ok, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { buildSchedule, ScheduleError, type ScheduleRow } from "@/lib/finance/schedule";
import { todayKE } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { Quote } from "@/components/fee-quote";
import { enrolSchema, studentSchema, type EnrolInput, type StudentInput } from "./schemas";

async function office() {
  const user = await getSessionUser();
  if (!user || !hasRole(user, "manager", "admin")) throw new Error("Not allowed");
  return user;
}

async function ip() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0] ?? null;
}

/** Quote + schedule preview for a course (used by the wizard and enrol dialog). */
export async function previewQuote(courseId: string, depositDue: string): Promise<ActionResult<{ quote: Quote; schedule: ScheduleRow[] }>> {
  await office();
  const supabase = await createClient();
  const { data: pv } = await supabase.from("course_price_versions").select("id").eq("course_id", courseId).eq("status", "active").maybeSingle();
  if (!pv) return fail("This course has no active price yet. Publish a price version in Settings → Courses & pricing.");
  const { data, error } = await supabase.rpc("quote_price_version", { p_price_version: pv.id });
  if (error || !data) return fail(friendlyDbError(error));
  const quote = data as unknown as Quote;
  try {
    const schedule = buildSchedule({ total: quote.total, deposit: quote.deposit, mode: quote.instalment_mode, count: quote.instalment_count,
      amount: quote.instalment_amount, frequency: quote.frequency, depositDueDate: depositDue || todayKE() });
    return ok({ quote, schedule });
  } catch (e) {
    return fail(e instanceof ScheduleError ? e.message : "Couldn't build the payment plan");
  }
}

async function acceptInternal(enrolmentId: string, depositDue: string) {
  const supabase = await createClient();
  const { data: enr } = await supabase.from("enrolments").select("price_version_id").eq("id", enrolmentId).single();
  if (!enr) throw new ScheduleError("Enrolment not found");
  const { data, error } = await supabase.rpc("quote_price_version", { p_price_version: enr.price_version_id });
  if (error) throw new ScheduleError(friendlyDbError(error));
  const q = data as unknown as Quote;
  const schedule = buildSchedule({ total: q.total, deposit: q.deposit, mode: q.instalment_mode, count: q.instalment_count,
    amount: q.instalment_amount, frequency: q.frequency, depositDueDate: depositDue });
  const res = await supabase.rpc("accept_enrolment_agreement", {
    p_enrolment: enrolmentId, p_schedule: schedule as unknown as Json, p_accepted_via: "in_person", p_ip: (await ip()) ?? undefined,
  });
  if (res.error) throw new ScheduleError(friendlyDbError(res.error));
}

/** Registration wizard submit: student (+ optional enrolment and in-person acceptance) in one go. */
export async function registerStudentWizard(student: StudentInput, enrol: EnrolInput | null): Promise<ActionResult<{ id: string; warning?: string }>> {
  await office();
  const s = studentSchema.safeParse(student);
  if (!s.success) return fail("Please fix the highlighted fields.", zodFieldErrors(s.error.issues));
  const e = enrol ? enrolSchema.safeParse(enrol) : null;
  if (e && !e.success) return fail("Please fix the course details.", zodFieldErrors(e.error.issues));

  const supabase = await createClient();
  const { data: sid, error } = await supabase.rpc("register_student", { p: { ...s.data, ip: await ip() } as unknown as Json });
  if (error || !sid) return fail(friendlyDbError(error));
  const studentId = sid as unknown as string;

  let warning: string | undefined;
  if (e?.success) {
    const { data: eid, error: ee } = await supabase.rpc("create_enrolment", {
      p_student: studentId, p_course: e.data.course_id, p_location: e.data.location_id, p_start_date: e.data.start_date,
      p_instructor: e.data.instructor_id || undefined,
    });
    if (ee) warning = `Student registered, but enrolment failed: ${friendlyDbError(ee)}`;
    else if (e.data.accept_now) {
      try { await acceptInternal(eid as unknown as string, e.data.deposit_due ?? todayKE()); }
      catch (err) { warning = `Enrolled, but the fee plan was not accepted: ${(err as Error).message}`; }
    }
  }
  revalidatePath("/staff/students");
  return ok({ id: studentId, warning }, "Student registered");
}

export async function updateStudent(id: string, fields: Partial<StudentInput>): Promise<ActionResult> {
  await office();
  const partial = studentSchema.partial().omit({ consent_data_processing: true, id_number: true, id_type: true }).safeParse(fields);
  if (!partial.success) return fail("Please fix the highlighted fields.", zodFieldErrors(partial.error.issues));
  const { normalizeKenyanPhone } = await import("@/lib/format");
  const d = partial.data;
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({
    ...(d.first_name !== undefined && { first_name: d.first_name }),
    ...(d.middle_name !== undefined && { middle_name: d.middle_name || null }),
    ...(d.last_name !== undefined && { last_name: d.last_name }),
    ...(d.date_of_birth !== undefined && { date_of_birth: d.date_of_birth }),
    ...(d.phone !== undefined && { phone: normalizeKenyanPhone(d.phone)! }),
    ...(d.alt_phone !== undefined && { alt_phone: normalizeKenyanPhone(d.alt_phone ?? "") }),
    ...(d.email !== undefined && { email: d.email || null }),
    ...(d.residence !== undefined && { residence: d.residence || null }),
    ...(d.emergency_contact_name !== undefined && { emergency_contact_name: d.emergency_contact_name }),
    ...(d.emergency_contact_phone !== undefined && { emergency_contact_phone: normalizeKenyanPhone(d.emergency_contact_phone) }),
    ...(d.emergency_contact_relationship !== undefined && { emergency_contact_relationship: d.emergency_contact_relationship }),
    ...(d.home_location_id !== undefined && { home_location_id: d.home_location_id }),
  }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/staff/students/${id}`);
  return ok(undefined, "Student details updated");
}

export async function setStudentStatus(id: string, status: "active" | "suspended", reason?: string): Promise<ActionResult> {
  await office();
  if (status === "suspended" && (!reason || reason.trim().length < 5)) return fail("Give a reason for suspending the student.");
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ status }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/staff/students/${id}`);
  return ok(undefined, status === "suspended" ? "Student suspended" : "Student reactivated");
}

export async function createEnrolment(studentId: string, input: EnrolInput): Promise<ActionResult> {
  await office();
  const e = enrolSchema.safeParse(input);
  if (!e.success) return fail("Please fix the highlighted fields.", zodFieldErrors(e.error.issues));
  const supabase = await createClient();
  const { data: eid, error } = await supabase.rpc("create_enrolment", {
    p_student: studentId, p_course: e.data.course_id, p_location: e.data.location_id, p_start_date: e.data.start_date,
    p_instructor: e.data.instructor_id || undefined,
  });
  if (error) return fail(friendlyDbError(error));
  if (e.data.accept_now) {
    try { await acceptInternal(eid as unknown as string, e.data.deposit_due ?? todayKE()); }
    catch (err) { return fail(`Enrolled, but the fee plan was not accepted: ${(err as Error).message}`); }
  }
  revalidatePath(`/staff/students/${studentId}`);
  return ok(undefined, e.data.accept_now ? "Enrolled and fee plan accepted" : "Enrolment created – awaiting fee acceptance");
}

export async function acceptAgreementInPerson(enrolmentId: string, depositDue: string): Promise<ActionResult> {
  await office();
  try { await acceptInternal(enrolmentId, depositDue || todayKE()); }
  catch (err) { return fail((err as Error).message); }
  revalidatePath("/staff/students", "layout");
  return ok(undefined, "Fee plan accepted. Invoice and payment plan created.");
}

export async function assignInstructor(enrolmentId: string, instructorId: string | null): Promise<ActionResult> {
  await office();
  const supabase = await createClient();
  const { data, error } = await supabase.from("enrolments").update({ assigned_instructor_id: instructorId }).eq("id", enrolmentId).select("student_id").single();
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/staff/students/${data.student_id}`);
  return ok(undefined, "Instructor assigned");
}

export async function issueActivationCode(studentId: string): Promise<ActionResult<{ code: string }>> {
  await office();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_student_activation_code", { p_student: studentId });
  if (error || !data) return fail(friendlyDbError(error));
  return ok({ code: data as unknown as string }, "Activation code created");
}

/** Reset a student's portal password to a temporary one (they must change it on next sign-in). */
export async function resetStudentPassword(studentId: string): Promise<ActionResult<{ password: string }>> {
  await office();
  const supabase = await createClient();
  // RLS check: the caller must be able to see this student.
  const { data: st } = await supabase.from("students").select("user_id").eq("id", studentId).maybeSingle();
  if (!st?.user_id) return fail("This student has no portal account yet – issue an activation code instead.");
  const temp = `EK-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(st.user_id, { password: temp });
  if (error) return fail("Couldn't reset the password.");
  await admin.from("profiles").update({ must_change_password: true }).eq("id", st.user_id);
  return ok({ password: temp }, "Temporary password set");
}

export async function revealIdNumber(studentId: string): Promise<ActionResult<{ value: string | null }>> {
  await office();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_student_id_number", { p_student: studentId });
  if (error) return fail(friendlyDbError(error));
  return ok({ value: (data as unknown as string) ?? null }, "ID number revealed (logged)");
}

export async function enrolmentAction(enrolmentId: string, action: "training_complete" | "complete" | "withdraw", reason?: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in again.");
  const supabase = await createClient();
  const res = action === "training_complete" ? await supabase.rpc("mark_training_complete", { p_enrolment: enrolmentId, p_note: reason })
    : action === "complete" ? await supabase.rpc("complete_enrolment", { p_enrolment: enrolmentId })
    : await supabase.rpc("withdraw_enrolment", { p_enrolment: enrolmentId, p_reason: reason ?? "" });
  if (res.error) return fail(friendlyDbError(res.error));
  revalidatePath("/staff", "layout");
  return ok(undefined, action === "complete" ? `Course completed – certificate ${res.data}` : action === "withdraw" ? "Enrolment withdrawn" : "Training marked complete");
}

export async function anonymizeStudent(studentId: string, reason: string): Promise<ActionResult> {
  await office();
  const supabase = await createClient();
  const { data: docs } = await supabase.from("student_documents").select("storage_path").eq("student_id", studentId);
  const { error } = await supabase.rpc("anonymize_student", { p_student: studentId, p_reason: reason });
  if (error) return fail(friendlyDbError(error));
  if (docs?.length) await createAdminClient().storage.from("student-documents").remove(docs.map((d) => d.storage_path));
  revalidatePath(`/staff/students/${studentId}`);
  return ok(undefined, "Student record anonymised");
}
