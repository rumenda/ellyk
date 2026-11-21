"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  ["/staff/finance", "Overview"], ["/staff/finance/journal", "Journal"], ["/staff/finance/trial-balance", "Trial balance"],
  ["/staff/finance/adjustments", "Adjustments"], ["/staff/finance/refunds", "Refunds"], ["/staff/finance/expenses", "Expenses"],
  ["/staff/finance/settlements", "Developer settlements"], ["/staff/finance/periods", "Periods"],
] as const;

export function FinanceNav() {
  const path = usePathname();
  return (
    <div className="-mx-4 mb-5 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0 no-print">
      <nav className="flex gap-1">
        {TABS.map(([href, label]) => {
          const active = href === "/staff/finance" ? path === href : path.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium", active ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-text")}>{label}</Link>;
        })}
      </nav>
    </div>
  );
}
