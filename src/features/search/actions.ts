"use server";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface SearchHit { kind: string; id: string; title: string; subtitle: string; href: string }

/** Global staff search. Runs as the user, so RLS limits results to what they may see. */
export async function globalSearch(query: string): Promise<SearchHit[]> {
  const user = await getSessionUser();
  if (!user || !hasRole(user, "manager", "admin", "accountant", "instructor")) return [];
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_global", { p_query: q });
  return (data ?? []) as SearchHit[];
}
