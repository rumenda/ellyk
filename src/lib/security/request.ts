import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Shared rate limiter (Postgres-backed so it works across serverless
 * instances). Returns true if the request is allowed. Fails open only if the
 * limiter itself is unavailable, and logs that.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key, p_max: max, p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error("[rate-limit] unavailable", (e as Error).message);
    return true;
  }
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
