import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getLocations = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id, code, name, is_active").order("name");
  return data ?? [];
});

export const getCourses = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id, code, name, is_active, licence_class_id, course_locations(location_id)").order("name");
  return data ?? [];
});

export const getInstructors = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("instructors")
    .select("id, user_id, employee_number, is_active, profile:profiles(full_name, phone), instructor_locations(location_id)")
    .order("employee_number");
  return (data ?? []).map((i) => ({ ...i, name: i.profile?.full_name ?? i.employee_number, locationIds: i.instructor_locations.map((l) => l.location_id) }));
});

export function locationOptions(locs: { id: string; name: string }[]) {
  return locs.map((l) => ({ value: l.id, label: l.name }));
}

/** Parse ?page= safely. */
export function pageParam(v: string | undefined, max = 10_000) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= max ? n : 1;
}

export function buildHref(path: string, params: Record<string, string | undefined>, overrides: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...overrides })) if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

/** Escape user input for PostgREST ilike/or filters. */
export function pgSearch(q: string) {
  return q.replace(/[%_,()\\*]/g, " ").trim().slice(0, 60);
}
