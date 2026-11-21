import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processOutbox } from "@/lib/notifications/outbox";
import { createAdminClient } from "@/lib/supabase/admin";

/** Scheduled job (e.g. Vercel Cron every 15 min): reminders + delivery outbox. */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (expected.length < 16 || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("run_scheduled_notifications");
  if (error) return NextResponse.json({ error: "Scheduling failed" }, { status: 500 });
  const delivered = await processOutbox();
  return NextResponse.json({ scheduled: data, delivered });
}
