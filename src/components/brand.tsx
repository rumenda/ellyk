import { cn } from "@/lib/utils";

/** Elly K mark: a wheel on a road – replace with official artwork when available. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="10" fill="var(--brand-600)" />
      <circle cx="20" cy="18" r="9" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="20" cy="18" r="2.5" fill="var(--accent-400)" />
      <path d="M8 33h24" stroke="var(--accent-400)" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4" />
    </svg>
  );
}

export function BrandName({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight text-text">Elly K</span>
          <span className="block text-xs text-muted">Driving School</span>
        </span>
      )}
    </span>
  );
}
