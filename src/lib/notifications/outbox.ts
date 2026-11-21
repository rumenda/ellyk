import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendPush, sendSms } from "./providers";

/** Deliver queued SMS/email/push notifications. Idempotent per delivery row. */
export async function processOutbox(limit = 100) {
  const admin = createAdminClient();
  const { data: queue } = await admin.from("notification_deliveries")
    .select("id, channel, attempts, notification:notifications(title, body, link, user_id, profile:profiles(phone, email))")
    .eq("status", "queued").lt("attempts", 5).order("created_at").limit(limit);
  const counts: Record<string, number> = {};
  for (const d of queue ?? []) {
    const n = d.notification;
    if (!n) continue;
    let res;
    if (d.channel === "sms") res = await sendSms(n.profile?.phone ?? null, `${n.body}`);
    else if (d.channel === "email") res = await sendEmail(n.profile?.email ?? null, n.title, `${n.body}\n\n– Elly K Driving School`);
    else {
      const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", n.user_id);
      res = await sendPush(subs ?? [], n.title, n.body, n.link);
      if (res.gone.length) await admin.from("push_subscriptions").delete().in("endpoint", res.gone);
    }
    const retry = res.status === "failed" && d.attempts + 1 < 5;
    await admin.from("notification_deliveries").update({
      status: retry ? "queued" : res.status, provider: res.provider, provider_message_id: res.id ?? null,
      error_message: res.error?.slice(0, 300) ?? null, attempts: d.attempts + 1, sent_at: res.status === "sent" ? new Date().toISOString() : null,
    }).eq("id", d.id);
    counts[res.status] = (counts[res.status] ?? 0) + 1;
  }
  return counts;
}
