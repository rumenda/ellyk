import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({ value, className, strong, tone }: {
  value: number | string | null | undefined; className?: string; strong?: boolean; tone?: "danger" | "success" | "muted";
}) {
  return (
    <span className={cn("tabular whitespace-nowrap", strong && "font-semibold",
      tone === "danger" && "text-danger-700", tone === "success" && "text-success-700", tone === "muted" && "text-muted", className)}>
      {formatKES(value)}
    </span>
  );
}
