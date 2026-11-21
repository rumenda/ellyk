import "server-only";
import { sendNotification, setVapidDetails } from "web-push";

/**
 * Provider adapters. When a provider isn't configured the delivery is marked
 * "sandbox" (logged, NOT sent) – we never pretend a message went out.
 */
export interface SendResult { status: "sent" | "failed" | "sandbox" | "skipped"; provider: string; id?: string; error?: string }

export function providerStatus() {
  return {
    sms: process.env.SMS_PROVIDER === "africastalking" && !!process.env.AFRICASTALKING_API_KEY && !!process.env.AFRICASTALKING_USERNAME,
    email: process.env.EMAIL_PROVIDER === "resend" && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
    push: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
  };
}

export async function sendSms(to: string | null, message: string): Promise<SendResult> {
  if (!to) return { status: "skipped", provider: "sms", error: "No phone number" };
  if (!providerStatus().sms) return { status: "sandbox", provider: "sms-sandbox" };
  const username = process.env.AFRICASTALKING_USERNAME!;
  const host = username === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
  const body = new URLSearchParams({ username, to, message: message.slice(0, 480) });
  if (process.env.AFRICASTALKING_SENDER_ID) body.set("from", process.env.AFRICASTALKING_SENDER_ID);
  try {
    const res = await fetch(`${host}/version1/messaging`, {
      method: "POST", body, cache: "no-store",
      headers: { apiKey: process.env.AFRICASTALKING_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    });
    const json = (await res.json().catch(() => ({}))) as { SMSMessageData?: { Recipients?: { status: string; messageId: string }[] } };
    const r = json.SMSMessageData?.Recipients?.[0];
    return res.ok && r?.status === "Success" ? { status: "sent", provider: "africastalking", id: r.messageId } : { status: "failed", provider: "africastalking", error: r?.status ?? `HTTP ${res.status}` };
  } catch (e) {
    return { status: "failed", provider: "africastalking", error: (e as Error).message };
  }
}

export async function sendEmail(to: string | null, subject: string, text: string): Promise<SendResult> {
  if (!to || to.endsWith(".local")) return { status: "skipped", provider: "email", error: "No deliverable email" };
  if (!providerStatus().email) return { status: "sandbox", provider: "email-sandbox" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { status: "sent", provider: "resend", id: json.id } : { status: "failed", provider: "resend", error: json.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { status: "failed", provider: "resend", error: (e as Error).message };
  }
}

export async function sendPush(subs: { endpoint: string; p256dh: string; auth: string }[], title: string, body: string, link: string | null): Promise<SendResult & { gone: string[] }> {
  if (!subs.length) return { status: "skipped", provider: "webpush", error: "No subscriptions", gone: [] };
  if (!providerStatus().push) return { status: "sandbox", provider: "webpush-sandbox", gone: [] };
  setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const gone: string[] = [];
  let sent = 0;
  for (const s of subs) {
    try {
      await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url: link ?? "/app" }), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
    }
  }
  return { status: sent > 0 ? "sent" : "failed", provider: "webpush", gone, error: sent ? undefined : "All endpoints failed" };
}
