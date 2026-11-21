import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/states";
import { getSessionUser, homeFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));
  return (
    <AuthShell title="Welcome back" description="Sign in to see your lessons, payments and progress."
      footer={<>Want to learn to ride? <a href="/apply" className="font-medium text-brand-700 hover:underline">Send an enquiry</a> and we&apos;ll call you.</>}>
      {error === "link" && <Alert tone="warning" className="mb-4">That link has expired. Request a new one.</Alert>}
      {error === "no-access" && <Alert tone="warning" className="mb-4">Your account has no access yet. Contact the school office.</Alert>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
