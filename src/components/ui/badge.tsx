import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted ring-border",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-success-50 text-success-700 ring-success-600/20",
  warning: "bg-warning-50 text-warning-700 ring-warning-600/25",
  danger: "bg-danger-50 text-danger-700 ring-danger-600/20",
  info: "bg-info-50 text-info-700 ring-info-600/20",
  accent: "bg-accent-100 text-accent-700 ring-accent-500/30",
};

export function Badge({ tone = "neutral", className, children, dot }: {
  tone?: Tone; className?: string; children: React.ReactNode; dot?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
