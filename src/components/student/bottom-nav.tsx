"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, Home, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/training", label: "Training", icon: GraduationCap },
  { href: "/app/payments", label: "Payments", icon: Wallet },
  { href: "/app/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/app/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe md:hidden" aria-label="Main">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? path === "/app" : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", active ? "text-brand-700" : "text-muted")}>
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-brand-100")}>
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** On tablets/desktop the same destinations become a top tab bar. */
export function TopNav() {
  const path = usePathname();
  return (
    <nav className="hidden border-b border-border bg-surface md:block" aria-label="Main">
      <ul className="mx-auto flex max-w-3xl gap-1 px-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? path === "/app" : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined}
                className={cn("flex h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium", active ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-text")}>
                <Icon className="size-4" />{label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
