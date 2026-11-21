import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ActivateForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Activate your account" };

export default function ActivatePage() {
  return (
    <AuthShell title="Activate your student account" description="Use the activation code the school office gave you when you registered."
      footer={<>No code? Ask at your training location or call the office – codes are free.</>}>
      <ActivateForm />
    </AuthShell>
  );
}
