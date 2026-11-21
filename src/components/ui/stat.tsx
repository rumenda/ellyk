import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", href }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "brand" | "warning" | "danger" | "success"; href?: string;
}) {
  const iconTone = {
    neutral: "bg-surface-muted text-muted", brand: "bg-brand-50 text-brand-600", warning: "bg-warning-50 text-warning-600",
    danger: "bg-danger-50 text-danger-600", success: "bg-success-50 text-success-600",
  }[tone];
  const body = (
    <div className={cn("flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-card", href && "transition-colors hover:border-brand-200")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon && <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", iconTone)}><Icon className="size-4" /></span>}
      </div>
      <p className="tabular text-[22px] font-semibold leading-tight tracking-tight text-text sm:text-2xl">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full rounded-lg">{body}</Link> : body;
}
