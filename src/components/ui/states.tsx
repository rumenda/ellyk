import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: {
  icon?: React.ComponentType<{ className?: string }>; title: string; description?: React.ReactNode;
  action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="size-6" />
      </div>
      <h3 className="text-[15px] font-semibold text-text">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "We couldn't load this", description, action }: {
  title?: string; description?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" role="alert">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-danger-50 text-danger-600">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {description ?? "Check your connection and try again. If it keeps happening, contact the office."}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className, icon: Icon }: {
  tone?: "info" | "warning" | "danger" | "success"; title?: string; children?: React.ReactNode; className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const styles = {
    info: "bg-info-50 border-info-600/20 text-info-700",
    warning: "bg-warning-50 border-warning-600/25 text-warning-700",
    danger: "bg-danger-50 border-danger-600/20 text-danger-700",
    success: "bg-success-50 border-success-600/20 text-success-700",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-md border px-3.5 py-3 text-sm", styles, className)} role={tone === "danger" ? "alert" : "status"}>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-[13.5px] opacity-95")}>{children}</div>}
      </div>
    </div>
  );
}
