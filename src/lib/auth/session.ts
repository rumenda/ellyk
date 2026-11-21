import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "./constants";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  roles: AppRole[];
  studentId: string | null;
  instructorId: string | null;
  locationIds: string[];
  mustChangePassword: boolean;
  aal: "aal1" | "aal2" | null;
}

/**
 * The single place the app resolves "who is this request?". Cached per
 * request. Uses getUser() (validated with Supabase Auth), never trusting the
 * cookie alone.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profile, roles, student, instructor, locations, aal] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, is_active, must_change_password").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("students").select("id").eq("user_id", user.id).maybeSingle(),
    supabase.from("instructors").select("id").eq("user_id", user.id).maybeSingle(),
    supabase.from("staff_locations").select("location_id").eq("user_id", user.id),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!profile.data || !profile.data.is_active) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile.data.full_name,
    phone: profile.data.phone,
    roles: (roles.data ?? []).map((r) => r.role as AppRole),
    studentId: student.data?.id ?? null,
    instructorId: instructor.data?.id ?? null,
    locationIds: (locations.data ?? []).map((l) => l.location_id),
    mustChangePassword: profile.data.must_change_password,
    aal: (aal.data?.currentLevel as "aal1" | "aal2" | null) ?? null,
  };
});

export function hasRole(user: SessionUser | null, ...roles: AppRole[]): boolean {
  return !!user && user.roles.some((r) => roles.includes(r));
}

export const isFinance = (u: SessionUser | null) => hasRole(u, "manager", "accountant");
export const isOffice = (u: SessionUser | null) => hasRole(u, "manager", "admin", "accountant");

/** Landing page for a user based on their roles. */
export function homeFor(user: SessionUser): string {
  if (hasRole(user, "manager", "admin")) return "/staff/dashboard";
  if (hasRole(user, "accountant")) return "/staff/finance";
  if (hasRole(user, "instructor")) return "/staff/my-day";
  if (hasRole(user, "platform_owner")) return "/staff/platform";
  if (user.studentId) return "/app";
  return "/login?error=no-access";
}

/** Require a signed-in user with one of the roles; otherwise redirect. */
export async function requireRole(...roles: AppRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles.length && !hasRole(user, ...roles)) redirect(homeFor(user));
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  return requireRole("platform_owner", "manager", "admin", "accountant", "instructor");
}

export async function requireStudent(): Promise<SessionUser & { studentId: string }> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.studentId) redirect(homeFor(user));
  return user as SessionUser & { studentId: string };
}
