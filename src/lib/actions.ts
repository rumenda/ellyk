import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const ok = <T,>(data?: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
export const fail = (error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> => ({
  ok: false, error, fieldErrors,
});

const CONSTRAINT_MESSAGES: Record<string, string> = {
  training_sessions_no_instructor_overlap: "The instructor already has a session at this time.",
  session_bookings_no_student_overlap: "This student is already booked on another session at this time.",
  session_bookings_no_vehicle_overlap: "That motorcycle is already assigned to another session at this time.",
  session_bookings_session_id_student_id_key: "This student is already booked on this session.",
  enrolments_one_open_per_course: "The student already has an open enrolment for this course.",
  student_identities_unique: "Another student is already registered with this ID number.",
  payments_ext_ref_unique: "A payment with this reference has already been recorded.",
  ntsa_payments_reference_unique: "This NTSA payment reference has already been recorded.",
  course_price_versions_course_id_version_key: "That version number already exists for this course.",
  locations_code_key: "Another location already uses this code.",
  vehicles_registration_key: "A vehicle with this registration already exists.",
  vehicles_asset_number_key: "A vehicle with this asset number already exists.",
  courses_code_key: "Another course already uses this code.",
  fiscal_periods_daterange_excl: "This period overlaps an existing fiscal period.",
};

/** Translate database errors into messages staff can act on. Never leaks SQL. */
export function friendlyDbError(error: PostgrestError | { message: string; code?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  const msg = error.message ?? "";
  for (const [constraint, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (msg.includes(constraint)) return text;
  }
  switch (error.code) {
    case "23P01":
      return "This conflicts with an existing booking.";
    case "23505":
      return "This record already exists.";
    case "23503":
      return "This record is linked to other information and cannot be changed this way.";
    case "23514":
      return "Some values are not allowed. Please check the form.";
    case "42501":
      return msg && !/policy|permission denied for/i.test(msg) ? msg : "You don't have permission to do that.";
    case "PGRST116":
      return "Record not found.";
    case "P0001":
      return msg; // raised deliberately by our functions with a human-readable message
  }
  if (/row-level security/i.test(msg)) return "You don't have permission to do that.";
  return msg.length < 200 && !/syntax|column|relation|function/i.test(msg) ? msg : "Something went wrong. Please try again.";
}

/** Flatten zod issues to field errors. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".") || "_form";
    (out[key] ??= []).push(i.message);
  }
  return out;
}

/**
 * useActionState actions receive (prevState, formData) after hydration, but a
 * form submitted before hydration (slow networks) can arrive as (formData).
 * Accept both so early submissions are never silently empty.
 */
export function formDataArg(a: unknown, b: unknown): FormData {
  if (b instanceof FormData) return b;
  if (a instanceof FormData) return a;
  return new FormData();
}
