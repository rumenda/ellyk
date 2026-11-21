import "server-only";
import { mpesaEnv } from "./service";

/**
 * Minimal Daraja client for C2B URL registration. Requires MPESA_CONSUMER_KEY /
 * MPESA_CONSUMER_SECRET; nothing is sent when they are missing.
 */
const base = () => (mpesaEnv() === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");

export function darajaConfigured() {
  return Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_SHORTCODE);
}

async function token(): Promise<string> {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function registerC2BUrls(appUrl: string): Promise<{ ok: boolean; message: string }> {
  if (!darajaConfigured()) return { ok: false, message: "Daraja credentials are not configured (MPESA_CONSUMER_KEY / SECRET / SHORTCODE)." };
  const t = process.env.MPESA_CALLBACK_TOKEN;
  const res = await fetch(`${base()}/mpesa/c2b/v2/registerurl`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ShortCode: process.env.MPESA_SHORTCODE, ResponseType: "Completed",
      ConfirmationURL: `${appUrl}/api/mpesa/c2b/confirmation?token=${t}`,
      ValidationURL: `${appUrl}/api/mpesa/c2b/validation?token=${t}`,
    }),
    cache: "no-store",
  });
  const body = await res.text();
  return { ok: res.ok, message: res.ok ? "URLs registered with Safaricom" : `Safaricom responded ${res.status}: ${body.slice(0, 200)}` };
}
