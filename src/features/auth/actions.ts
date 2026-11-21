"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, formDataArg, ok, type ActionResult } from "@/lib/actions";
import { getSessionUser, homeFor } from "@/lib/auth/session";
import { STUDENT_EMAIL_DOMAIN } from "@/lib/auth/constants";
import { normalizeKenyanPhone } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit, safeNext } from "@/lib/security/request";

const GENERIC_LOGIN_ERROR = "Those details don't match our records. Check them and try again.";

export async function signIn(prev: ActionResult | null, input: FormData): Promise<ActionResult> {
  const formData = formDataArg(prev, input);
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return fail("Enter your login and password.");

  const ip = await clientIp();
  const allowed = (await rateLimit(`login:ip:${ip}`, 20, 600)) && (await rateLimit(`login:id:${identifier.toLowerCase()}`, 8, 600));
  if (!allowed) return fail("Too many sign-in attempts. Wait a few minutes and try again.");

  const { data: email } = await createAdminClient().rpc("resolve_login_email", { p_identifier: identifier });
  if (!email) return fail(GENERIC_LOGIN_ERROR);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail(GENERIC_LOGIN_ERROR);

  const user = await getSessionUser();
  if (!user) {
    await supabase.auth.signOut();
    return fail("Your account is not active. Contact the school office.");
  }
  await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
  if (user.mustChangePassword) redirect("/account/password?first=1");
  redirect(safeNext(String(formData.get("next") ?? ""), homeFor(user)));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const activateSchema = z.object({
  studentNumber: z.string().trim().min(3, "Enter your student number"),
  phone: z.string().trim().refine((v) => normalizeKenyanPhone(v) !== null, "Enter the phone number you registered with"),
  code: z.string().trim().regex(/^\d{6}$/, "The activation code has 6 digits"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

/** Students activate their portal with the 6-digit code from the office. */
export async function activateStudent(prev: ActionResult | null, input: FormData): Promise<ActionResult> {
  const formData = formDataArg(prev, input);
  const parsed = activateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string[]> = {};
    parsed.error.issues.forEach((i) => (fe[String(i.path[0])] ??= []).push(i.message));
    return fail("Please fix the highlighted fields.", fe);
  }
  const { studentNumber, phone, code, password } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`activate:${ip}`, 10, 3600))) return fail("Too many attempts. Try again in an hour or visit the office.");

  const admin = createAdminClient();
  const { data: studentId } = await admin.rpc("verify_student_activation", {
    p_student_number: studentNumber, p_phone: phone, p_code: code,
  });
  if (!studentId) return fail("We couldn't verify those details. Check the code (it expires after 14 days) or ask the office for a new one.");

  const { data: st } = await admin.from("students").select("student_number, first_name, last_name, phone").eq("id", studentId).single();
  if (!st) return fail("Student not found.");
  const email = `${st.student_number.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `${st.first_name} ${st.last_name}` } });
  if (created.error || !created.data.user) return fail("We couldn't create your account. Please contact the office.");
  const uid = created.data.user.id;
  const profile = await admin.from("profiles").insert({ id: uid, full_name: `${st.first_name} ${st.last_name}`, phone: st.phone });
  const link = await admin.rpc("link_student_account", { p_student: studentId, p_user: uid });
  if (profile.error || link.error) {
    await admin.auth.admin.deleteUser(uid);
    return fail("We couldn't finish setting up your account. Please contact the office.");
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/app?welcome=1");
}

const passwordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters").max(72),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function changePassword(prev: ActionResult | null, input: FormData): Promise<ActionResult> {
  const formData = formDataArg(prev, input);
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]!.message);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message.includes("different") ? "Choose a password you haven't used before." : "Couldn't update your password.");
  if (user.mustChangePassword) await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
  return ok(undefined, "Password updated");
}

export async function requestPasswordReset(prev: ActionResult | null, input: FormData): Promise<ActionResult> {
  const formData = formDataArg(prev, input);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return fail("Enter your staff email address.");
  const ip = await clientIp();
  if (!(await rateLimit(`reset:${ip}`, 5, 3600))) return fail("Too many requests. Try again later.");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/password` });
  // Same response whether or not the account exists.
  return ok(undefined, "If that email belongs to a staff account, a reset link is on its way.");
}
