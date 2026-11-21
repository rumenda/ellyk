import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaChallenge } from "@/components/mfa/mfa";
import { homeFor, requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verify it's you" };

export default async function MfaPage() {
  const user = await requireStaff();
  return (
    <AuthShell title="Two-step verification" description="Enter the code from your authenticator app to continue.">
      <MfaChallenge next={homeFor(user)} />
    </AuthShell>
  );
}
