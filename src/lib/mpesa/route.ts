import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ipAllowed, validCallbackToken, type CallbackResult } from "./service";
import { rateLimit } from "@/lib/security/request";

export async function callbackRoute(req: NextRequest, handler: (raw: unknown, ip: string, authed: boolean) => Promise<CallbackResult>) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
  if (!(await rateLimit(`mpesa:${ip}`, 600, 60))) return NextResponse.json({ ResultCode: "1", ResultDesc: "Slow down" }, { status: 429 });
  const authed = validCallbackToken(req.nextUrl.searchParams.get("token")) && ipAllowed(ip);
  let raw: unknown = null;
  try {
    const text = await req.text();
    if (text.length > 20_000) return NextResponse.json({ ResultCode: "1", ResultDesc: "Too large" }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ ResultCode: "1", ResultDesc: "Invalid JSON" }, { status: 400 });
  }
  const res = await handler(raw, ip, authed);
  return NextResponse.json(res.body, { status: res.status, headers: { "Cache-Control": "no-store" } });
}
