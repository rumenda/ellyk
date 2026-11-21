import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileBarChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { REPORTS } from "@/features/reports/definitions";
import { hasRole, requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsIndex() {
  const user = await requireRole("manager", "admin", "accountant", "platform_owner");
  const mine = REPORTS.filter((r) => hasRole(user, ...r.roles));
  const groups = [...new Set(mine.map((r) => r.group))];
  return (
    <div>
      <PageHeader title="Reports" description="Live from the database. Every report can be filtered and exported to CSV (opens in Excel)." />
      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {groups.map((g) => (
          <Card key={g}>
            <h2 className="border-b border-border px-5 py-3 text-[15px] font-semibold">{g}</h2>
            <ul className="divide-y divide-border">
              {mine.filter((r) => r.group === g).map((r) => (
                <li key={r.slug}>
                  <Link href={`/staff/reports/${r.slug}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/60">
                    <FileBarChart className="size-5 shrink-0 text-brand-600" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{r.title}</span><span className="block text-xs text-muted">{r.description}</span></span>
                    <ChevronRight className="size-4 text-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
