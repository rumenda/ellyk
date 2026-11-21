import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-driven tabs: deep-linkable and work without JavaScript. */
export function LinkTabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <nav className="flex gap-1" role="tablist">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} role="tab" aria-selected={active === t.key} scroll={false}
            className={cn("flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium",
              active === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-text")}>
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-surface-muted px-1.5 text-xs text-muted">{t.count}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
