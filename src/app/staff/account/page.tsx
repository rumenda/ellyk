import type { Metadata } from "next";
import Link from "next/link";
import { MfaManager } from "@/components/mfa/mfa";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Security" };

export default async function AccountPage() {
  const user = await requireStaff();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Account security" description={`${user.fullName} · ${user.email ?? ""}`} />
      <div className="space-y-4">
        <Card><CardHeader title="Two-step verification" /><CardBody><MfaManager /></CardBody></Card>
        <Card><CardHeader title="Password" /><CardBody><Link href="/account/password" className="text-sm font-medium text-brand-700 hover:underline">Change your password</Link></CardBody></Card>
      </div>
    </div>
  );
}
