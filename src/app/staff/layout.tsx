import { redirect } from "next/navigation";
import { StaffShell } from "@/components/shell/staff-shell";
import { mobileShortcuts, navFor } from "@/components/shell/nav-config";
import { hasRole, requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  if (user.mustChangePassword) redirect("/account/password?first=1");

  // MFA enforcement (configurable): staff with a verified factor must step up to aal2;
  // when the school requires MFA, staff without a factor are sent to enrol one.
  const supabase = await createClient();
  const [{ data: settings }, { data: factors }] = await Promise.all([
    supabase.from("school_settings").select("require_staff_mfa").eq("id", 1).single(),
    supabase.auth.mfa.listFactors(),
  ]);
  const hasFactor = (factors?.totp ?? []).some((f) => f.status === "verified");
  if (hasFactor && user.aal !== "aal2") redirect("/mfa");
  if (settings?.require_staff_mfa && !hasFactor) redirect("/mfa/enrol");

  return (
    <StaffShell
      nav={navFor(user.roles)}
      shortcuts={mobileShortcuts(user.roles)}
      user={{ fullName: user.fullName, roles: user.roles, email: user.email }}
      canSearch={hasRole(user, "manager", "admin", "accountant", "instructor")}
    >
      {children}
    </StaffShell>
  );
}
