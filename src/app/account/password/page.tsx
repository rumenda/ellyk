import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/forms";
import { homeFor, requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const user = await requireRole();
  const { first } = await searchParams;
  return (
    <AuthShell title={first ? "Set a new password" : "Change password"}
      description={first ? "For your security, please replace the temporary password you were given." : undefined}>
      <ChangePasswordForm backHref={homeFor(user)} />
    </AuthShell>
  );
}
