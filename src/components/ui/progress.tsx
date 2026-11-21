import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, tone = "brand", label }: {
  value: number; className?: string; tone?: "brand" | "success" | "warning" | "danger"; label?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = { brand: "bg-brand-500", success: "bg-success-600", warning: "bg-accent-500", danger: "bg-danger-600" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)} role="progressbar"
      aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width]", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Ring chart for "paid vs total" – pure SVG, no JS. */
export function ProgressRing({ value, size = 120, stroke = 12, children, label }: {
  value: number; size?: number; stroke?: number; children?: React.ReactNode; label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand-500)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
