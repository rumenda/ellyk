import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" description="Staff: we'll email you a reset link."
      footer={<>Students: visit or call the office and we&apos;ll reset your portal access straight away.</>}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
