"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, friendlyDbError, ok, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/constants";
import { normalizeKenyanPhone } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

async function need(...roles: AppRole[]) {
  const u = await getSessionUser();
  if (!u || !hasRole(u, ...roles)) throw new Error("Not allowed");
  return u;
}
const refresh = () => revalidatePath("/staff", "layout");
const bool = (v: unknown) => v === "on" || v === true || v === "true";

export async function saveSchoolSettings(form: Record<string, string>): Promise<ActionResult> {
  const u = await need("manager", "accountant");
  const supabase = await createClient();
  const managerOnly = hasRole(u, "manager");
  const prio = (form.allocation_priority ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const valid = ["registration", "service_fee", "tuition", "ntsa", "other"];
  if (prio.length && (prio.length !== 5 || !prio.every((p) => valid.includes(p)))) return fail("Allocation order must list all five components once.");
  if (form.kra_pin && !/^[AP]\d{9}[A-Z]$/.test(form.kra_pin.toUpperCase())) return fail("KRA PIN format is like P051234567X.");
  const update: Database["public"]["Tables"]["school_settings"]["Update"] = {
    kra_pin: form.kra_pin ? form.kra_pin.toUpperCase() : null, vat_registered: bool(form.vat_registered), prices_tax_inclusive: bool(form.prices_tax_inclusive),
    etims_enabled: bool(form.etims_enabled), paybill_number: form.paybill_number || null, mpesa_unknown_account_policy: form.mpesa_unknown_account_policy as "accept",
    default_service_fee: Number(form.default_service_fee || 0), payment_due_reminder_days: Number(form.payment_due_reminder_days || 2),
    fiscal_year_start_month: Number(form.fiscal_year_start_month || 1), updated_by: u.id,
    ...(prio.length ? { allocation_priority: prio } : {}),
    ...(managerOnly ? {
      legal_name: form.legal_name, trading_name: form.trading_name, postal_address: form.postal_address || null, physical_address: form.physical_address || null,
      phone: form.phone || null, email: form.email || null, website: form.website || null, require_staff_mfa: bool(form.require_staff_mfa),
      data_retention_years: Number(form.data_retention_years || 7), require_full_payment_for_completion: bool(form.require_full_payment_for_completion),
      minimum_student_age: Number(form.minimum_student_age || 16), terms_version: form.terms_version, terms_text: form.terms_text,
      paybill_account_hint: form.paybill_account_hint,
    } : {}),
  };
  const { error } = await supabase.from("school_settings").update(update).eq("id", 1);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Settings saved");
}

export async function saveSequence(key: string, prefix: string, padding: number): Promise<ActionResult> {
  await need("manager", "accountant");
  if (!/^[A-Z]{1,6}$/.test(prefix)) return fail("Prefix: 1–6 capital letters.");
  const supabase = await createClient();
  const { error } = await supabase.from("document_sequences").update({ prefix, padding }).eq("key", key);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Numbering updated – applies to new documents");
}

export async function saveTaxRate(code: string, name: string, rate: number, etims: string, id?: string): Promise<ActionResult> {
  await need("manager", "accountant");
  if (rate < 0 || rate >= 100) return fail("Rate must be between 0 and 99.99%.");
  const supabase = await createClient();
  const row = { code: code.toUpperCase(), name, rate: rate / 100, etims_tax_type: etims || null };
  const { error } = id ? await supabase.from("tax_rates").update(row).eq("id", id) : await supabase.from("tax_rates").insert(row);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Tax rate saved");
}

// ---------------------------------------------------------------- courses
const courseSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,16}$/, "2–16 letters, numbers or dashes"),
  name: z.string().trim().min(3).max(100), licence_class_id: z.uuid("Choose a licence class"), description: z.string().max(500).optional(),
  duration_weeks: z.coerce.number().int().min(1).max(104), theory_sessions: z.coerce.number().int().min(0).max(200), practical_sessions: z.coerce.number().int().min(0).max(200),
  is_active: z.boolean().optional(), location_ids: z.array(z.string()).default([]),
});
export async function saveCourse(input: z.input<typeof courseSchema>, id?: string): Promise<ActionResult<{ id: string }>> {
  await need("manager");
  const p = courseSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const { location_ids, ...row } = p.data;
  const supabase = await createClient();
  const res = id ? await supabase.from("courses").update(row).eq("id", id).select("id").single() : await supabase.from("courses").insert(row).select("id").single();
  if (res.error) return fail(friendlyDbError(res.error));
  await supabase.from("course_locations").delete().eq("course_id", res.data.id);
  if (location_ids.length) await supabase.from("course_locations").insert(location_ids.map((location_id) => ({ course_id: res.data.id, location_id })));
  refresh();
  return ok({ id: res.data.id }, "Course saved");
}

const pvSchema = z.object({
  label: z.string().trim().min(3, "Give the version a label"), effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deposit_amount: z.coerce.number().min(0), instalment_mode: z.enum(["count", "amount"]), instalment_count: z.coerce.number().int().min(1).max(52).optional(),
  instalment_amount: z.coerce.number().positive().optional(), instalment_frequency: z.enum(["weekly", "fortnightly", "monthly"]),
  min_paid_before_training: z.coerce.number().min(0), min_paid_before_ntsa: z.coerce.number().min(0), notes: z.string().max(500).optional(),
  items: z.array(z.object({ component: z.enum(["registration", "tuition", "ntsa", "service_fee", "other"]), label: z.string().trim().min(2), amount: z.coerce.number().min(0), tax_rate_id: z.string().optional() })).min(1, "Add at least one fee item"),
});

/** Create (or replace) a DRAFT price version. Published versions can never be edited. */
export async function savePriceDraft(courseId: string, input: z.input<typeof pvSchema>, draftId?: string): Promise<ActionResult<{ id: string }>> {
  const u = await need("manager", "accountant");
  const p = pvSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]!.message, zodFieldErrors(p.error.issues));
  const { items, ...v } = p.data;
  const total = items.reduce((s, i) => s + i.amount, 0);
  if (v.deposit_amount > total) return fail("Deposit cannot exceed the course total.");
  if (items.filter((i) => i.component === "service_fee").length > 1) return fail("Only one platform service fee line is allowed.");
  const supabase = await createClient();
  let id = draftId;
  const row = { ...v, instalment_count: v.instalment_mode === "count" ? v.instalment_count ?? 6 : null, instalment_amount: v.instalment_mode === "amount" ? v.instalment_amount ?? null : null };
  if (id) {
    const { error } = await supabase.from("course_price_versions").update(row).eq("id", id).eq("status", "draft");
    if (error) return fail(friendlyDbError(error));
    await supabase.from("course_price_items").delete().eq("price_version_id", id);
  } else {
    const { data: last } = await supabase.from("course_price_versions").select("version").eq("course_id", courseId).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase.from("course_price_versions").insert({ ...row, course_id: courseId, version: (last?.version ?? 0) + 1, created_by: u.id }).select("id").single();
    if (error) return fail(friendlyDbError(error));
    id = data.id;
  }
  const { error: ie } = await supabase.from("course_price_items").insert(items.map((i, n) => ({ price_version_id: id!, component: i.component, label: i.label, amount: i.amount, tax_rate_id: i.tax_rate_id || null, sort_order: n + 1 })));
  if (ie) return fail(friendlyDbError(ie));
  refresh();
  return ok({ id: id! }, "Draft saved");
}

export async function publishPriceVersion(id: string): Promise<ActionResult> {
  await need("manager", "accountant");
  const supabase = await createClient();
  const { error } = await supabase.from("course_price_versions").update({ status: "active" }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Price published. New enrolments use it; existing students keep their agreed fees.");
}

export async function deletePriceDraft(id: string): Promise<ActionResult> {
  await need("manager", "accountant");
  const supabase = await createClient();
  const { error } = await supabase.from("course_price_versions").delete().eq("id", id).eq("status", "draft");
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Draft deleted");
}

// ---------------------------------------------------------------- competencies
export async function saveCompetency(input: { code: string; name: string; category: string; licence_class_id?: string; required_for_test: boolean; sort_order: number }, id?: string): Promise<ActionResult> {
  await need("manager");
  if (input.name.trim().length < 3) return fail("Give the competency a name.");
  const supabase = await createClient();
  const row = { code: input.code.trim().toUpperCase().replace(/\s+/g, "-"), name: input.name.trim(), category: input.category.trim() || "General", licence_class_id: input.licence_class_id || null, required_for_test: input.required_for_test, sort_order: input.sort_order };
  const { error } = id ? await supabase.from("competencies").update(row).eq("id", id) : await supabase.from("competencies").insert(row);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Competency saved");
}
export async function toggleCompetency(id: string, active: boolean): Promise<ActionResult> {
  await need("manager");
  const supabase = await createClient();
  const { error } = await supabase.from("competencies").update({ is_active: active }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, active ? "Competency enabled" : "Competency disabled");
}

// ---------------------------------------------------------------- notifications
export async function saveTemplate(id: string, title: string, body: string, active: boolean): Promise<ActionResult> {
  const u = await need("manager");
  if (!title.trim() || !body.trim()) return fail("Title and message are required.");
  if (body.length > 480) return fail("Keep messages under 480 characters (3 SMS).");
  const supabase = await createClient();
  const { error } = await supabase.from("notification_templates").update({ title, body, is_active: active, updated_by: u.id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Template saved");
}
export async function postAnnouncement(title: string, body: string, audience: "students" | "staff" | "everyone", locationId: string | null, important: boolean): Promise<ActionResult> {
  const u = await need("manager", "admin");
  if (title.trim().length < 3 || body.trim().length < 5) return fail("Write a title and a message.");
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({ title, body, audience, location_id: locationId || null, is_important: important, created_by: u.id });
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Announcement published");
}

// ---------------------------------------------------------------- users
const userSchema = z.object({
  full_name: z.string().trim().min(2), email: z.email("Enter a work email"), phone: z.string().optional(),
  roles: z.array(z.enum(["manager", "admin", "accountant", "instructor"])).min(1, "Choose at least one role"),
  location_ids: z.array(z.string()).default([]), employee_number: z.string().trim().min(2, "Employee number is required"), job_title: z.string().optional(),
});
/** Manager-only: create a staff account with a temporary password (must change at first sign-in). */
export async function createStaffUser(input: z.input<typeof userSchema>): Promise<ActionResult<{ password: string }>> {
  const me = await need("manager");
  const p = userSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const d = p.data;
  const admin = createAdminClient();
  const temp = `Ek-${crypto.randomUUID().slice(0, 8)}!${Math.floor(10 + Math.random() * 89)}`;
  const created = await admin.auth.admin.createUser({ email: d.email.toLowerCase(), password: temp, email_confirm: true, user_metadata: { full_name: d.full_name } });
  if (created.error || !created.data.user) return fail(created.error?.message.includes("already") ? "A user with this email already exists." : "Couldn't create the account.");
  const uid = created.data.user.id;
  const steps = [
    await admin.from("profiles").insert({ id: uid, full_name: d.full_name, email: d.email.toLowerCase(), phone: normalizeKenyanPhone(d.phone ?? ""), must_change_password: true }),
    await admin.from("staff").insert({ user_id: uid, employee_number: d.employee_number, job_title: d.job_title || null }),
    await admin.from("notification_preferences").insert({ user_id: uid }),
  ];
  // Roles are granted with the manager's own session so the grant is audited against them.
  const supabase = await createClient();
  const rr = await supabase.from("user_roles").insert(d.roles.map((role) => ({ user_id: uid, role, granted_by: me.id })));
  if (d.location_ids.length) await supabase.from("staff_locations").insert(d.location_ids.map((location_id) => ({ user_id: uid, location_id })));
  if (d.roles.includes("instructor")) {
    const ins = await admin.from("instructors").insert({ user_id: uid, employee_number: d.employee_number }).select("id").single();
    if (ins.data && d.location_ids.length) await admin.from("instructor_locations").insert(d.location_ids.map((location_id) => ({ instructor_id: ins.data!.id, location_id })));
  }
  if (steps.some((s) => s.error) || rr.error) {
    await admin.auth.admin.deleteUser(uid);
    return fail(friendlyDbError(steps.find((s) => s.error)?.error ?? rr.error));
  }
  refresh();
  return ok({ password: temp }, "Staff account created");
}

export async function setUserRoles(userId: string, requested: AppRole[]): Promise<ActionResult> {
  const me = await need("manager");
  const STAFF = ["manager", "admin", "accountant", "instructor"] as const;
  const roles = requested.filter((r): r is (typeof STAFF)[number] => (STAFF as readonly string[]).includes(r));
  if (userId === me.id && !roles.includes("manager")) return fail("You can't remove your own manager role.");
  const supabase = await createClient();
  const { data: cur } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const current = (cur ?? []).map((r) => r.role).filter((r): r is (typeof STAFF)[number] => (STAFF as readonly string[]).includes(r));
  const add = roles.filter((r) => !current.includes(r));
  const remove = current.filter((r) => !roles.includes(r));
  if (remove.length) { const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).in("role", remove); if (error) return fail(friendlyDbError(error)); }
  if (add.length) { const { error } = await supabase.from("user_roles").insert(add.map((role) => ({ user_id: userId, role, granted_by: me.id }))); if (error) return fail(friendlyDbError(error)); }
  refresh();
  return ok(undefined, "Roles updated");
}

export async function setUserLocations(userId: string, locationIds: string[]): Promise<ActionResult> {
  await need("manager");
  const supabase = await createClient();
  await supabase.from("staff_locations").delete().eq("user_id", userId);
  if (locationIds.length) { const { error } = await supabase.from("staff_locations").insert(locationIds.map((location_id) => ({ user_id: userId, location_id }))); if (error) return fail(friendlyDbError(error)); }
  refresh();
  return ok(undefined, "Locations updated");
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const me = await need("manager");
  if (userId === me.id) return fail("You can't deactivate yourself.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", userId);
  if (error) return fail(friendlyDbError(error));
  if (!active) await createAdminClient().auth.admin.signOut(userId).catch(() => null);
  refresh();
  return ok(undefined, active ? "Account reactivated" : "Account deactivated – they can no longer sign in");
}

// ---------------------------------------------------------------- locations
export async function saveLocation(form: Record<string, string>, id?: string): Promise<ActionResult> {
  await need("manager");
  if (!/^[A-Z0-9]{2,8}$/.test((form.code ?? "").toUpperCase())) return fail("Code: 2–8 letters/numbers.");
  if (form.phone && !normalizeKenyanPhone(form.phone)) return fail("Enter a valid phone number.");
  const hours: Record<string, { open: string; close: string } | null> = {};
  for (const d of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) hours[d] = form[`${d}_open`] && form[`${d}_close`] ? { open: form[`${d}_open`]!, close: form[`${d}_close`]! } : null;
  const row = { code: form.code!.toUpperCase(), name: form.name!, address: form.address || null, phone: normalizeKenyanPhone(form.phone ?? ""),
    capacity: Number(form.capacity || 40), is_active: bool(form.is_active), opening_hours: hours, manager_user_id: form.manager_user_id || null };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("locations").update(row).eq("id", id) : await supabase.from("locations").insert(row);
  if (error) return fail(friendlyDbError(error));
  refresh();
  return ok(undefined, "Location saved");
}
