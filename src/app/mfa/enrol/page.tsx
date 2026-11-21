import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaManager } from "@/components/mfa/mfa";
import { homeFor, requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up two-step verification" };

export default async function MfaEnrolPage() {
  const user = await requireStaff();
  return (
    <AuthShell title="Set up two-step verification" description="The school requires staff accounts to use an authenticator app.">
      <MfaManager onDoneHref={homeFor(user)} />
    </AuthShell>
  );
}
