import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: {
  title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 sm:px-5", className)} {...props} />;
}
