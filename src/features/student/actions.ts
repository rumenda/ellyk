"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { fail, friendlyDbError, ok, type ActionResult } from "@/lib/actions";
import { getSessionUser, requireStudent } from "@/lib/auth/session";
import { buildSchedule, ScheduleError } from "@/lib/finance/schedule";
import { todayKE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  await requireStudentOrStaff();
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/app", "layout");
  return ok(undefined, "Marked as read");
}

async function requireStudentOrStaff() {
  const u = await getSessionUser();
  if (!u) throw new Error("Not signed in");
  return u;
}

export async function updateNotificationPreferences(prefs: { sms: boolean; email: boolean; push: boolean }): Promise<ActionResult> {
  const user = await requireStudentOrStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() });
  if (error) return fail(friendlyDbError(error));
  return ok(undefined, "Preferences saved");
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<ActionResult> {
  const user = await requireStudentOrStaff();
  if (!/^https:\/\//.test(sub.endpoint)) return fail("Invalid subscription");
  const supabase = await createClient();
  const h = await headers();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: h.get("user-agent")?.slice(0, 200) ?? null,
  }, { onConflict: "endpoint" });
  if (error) return fail(friendlyDbError(error));
  return ok(undefined, "Push notifications enabled");
}

/** Student accepts their own fee agreement in the portal. */
export async function acceptMyAgreement(enrolmentId: string): Promise<ActionResult> {
  const user = await requireStudent();
  const supabase = await createClient();
  const { data: enr } = await supabase.from("enrolments").select("id, student_id, status, price_version_id").eq("id", enrolmentId).maybeSingle();
  if (!enr || enr.student_id !== user.studentId) return fail("Enrolment not found.");
  if (enr.status !== "pending_acceptance") return fail("This fee plan has already been accepted.");
  const { data: q, error: qe } = await supabase.rpc("quote_price_version", { p_price_version: enr.price_version_id });
  if (qe || !q) return fail(friendlyDbError(qe));
  const quote = q as { total: number; deposit: number; instalment_mode: "count" | "amount"; instalment_count: number | null; instalment_amount: number | null; frequency: "weekly" | "fortnightly" | "monthly" };
  try {
    const schedule = buildSchedule({ total: quote.total, deposit: quote.deposit, mode: quote.instalment_mode, count: quote.instalment_count,
      amount: quote.instalment_amount, frequency: quote.frequency, depositDueDate: todayKE() });
    const h = await headers();
    const { error } = await supabase.rpc("accept_enrolment_agreement", {
      p_enrolment: enrolmentId, p_schedule: schedule as unknown as Json, p_accepted_via: "student_portal",
      p_ip: h.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });
    if (error) return fail(friendlyDbError(error));
  } catch (e) {
    if (e instanceof ScheduleError) return fail(e.message);
    throw e;
  }
  revalidatePath("/app", "layout");
  return ok(undefined, "Fee plan accepted. Pay your deposit to start training.");
}
