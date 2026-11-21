"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronsLeft, KeyRound, LogOut, Menu as MenuIcon, MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import { BrandMark, BrandName } from "@/components/brand";
import { Drawer } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { signOut } from "@/features/auth/actions";
import { humanize, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CommandSearch } from "./command-search";
import { ICONS } from "./icons";
import type { NavItem } from "./nav-config";

function subscribeSidebar(cb: () => void) {
  window.addEventListener("ek-sidebar", cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener("ek-sidebar", cb); window.removeEventListener("storage", cb); };
}
function readSidebar() {
  try { return localStorage.getItem("ek.sidebar") === "1"; } catch { return false; }
}

function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export function StaffShell({ nav, shortcuts, user, canSearch, children }: {
  nav: NavItem[];
  shortcuts: string[];
  user: { fullName: string; roles: string[]; email: string | null };
  canSearch: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  useEffect(() => {
    if (!canSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSearch]);

  const toggle = () => {
    try { localStorage.setItem("ek.sidebar", collapsed ? "0" : "1"); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event("ek-sidebar"));
  };

  const navList = (compact: boolean, onNavigate?: () => void) => (
    <ul className="space-y-0.5">
      {nav.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(path, item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} onClick={onNavigate} title={compact ? item.label : undefined} aria-current={active ? "page" : undefined}
              className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                active ? "bg-brand-50 text-brand-800" : "text-muted hover:bg-surface-muted hover:text-text", compact && "justify-center px-0")}>
              <Icon className={cn("size-[18px] shrink-0", active && "text-brand-600")} />
              {!compact && <span className="truncate">{item.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const userMenu = (
    <Menu>
      <MenuTrigger className="flex items-center gap-2 rounded-full p-0.5 hover:bg-surface-muted" aria-label="Account menu">
        <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{initials(user.fullName)}</span>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <span className="block text-sm font-semibold text-text">{user.fullName}</span>
          <span className="block">{user.roles.map(humanize).join(" · ")}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem asChild><Link href="/staff/account"><ShieldCheck />Security & MFA</Link></MenuItem>
        <MenuItem asChild><Link href="/account/password"><KeyRound />Change password</Link></MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => { void signOut(); }}><LogOut />Sign out</MenuItem>
      </MenuContent>
    </Menu>
  );

  const shortcutItems = shortcuts.map((h) => nav.find((n) => n.href === h)).filter(Boolean) as NavItem[];

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop / tablet sidebar */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] lg:flex", collapsed ? "w-[72px]" : "w-64")}>
        <div className={cn("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center px-0")}>
          <Link href={nav[0]?.href ?? "/staff"} aria-label="Home">{collapsed ? <BrandMark /> : <BrandName />}</Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">{navList(collapsed)}</nav>
        <button onClick={toggle} className="m-3 flex h-9 items-center justify-center gap-2 rounded-md text-sm text-muted hover:bg-surface-muted"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronsLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:h-16 sm:px-5 no-print">
          <button className="grid size-10 place-items-center rounded-md hover:bg-surface-muted lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <MenuIcon className="size-5" />
          </button>
          <Link href={nav[0]?.href ?? "/staff"} className="lg:hidden" aria-label="Home"><BrandMark className="size-8" /></Link>
          {canSearch && (
            <button onClick={() => setSearch(true)}
              className="ml-1 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-sm text-subtle hover:border-border-strong sm:max-w-md">
              <Search className="size-4 shrink-0" />
              <span className="truncate">Search students, payments…</span>
              <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 text-[11px] sm:inline">Ctrl K</kbd>
            </button>
          )}
          <div className="ml-auto shrink-0">{userMenu}</div>
        </header>
        <OfflineBanner />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom shortcuts */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe lg:hidden no-print" aria-label="Shortcuts">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${shortcutItems.length + 1}, minmax(0, 1fr))` }}>
          {shortcutItems.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(path, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-brand-700" : "text-muted")}
                  aria-current={active ? "page" : undefined}>
                  <Icon className="size-5" />{item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setDrawer(true)} className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted">
              <MoreHorizontal className="size-5" />More
            </button>
          </li>
        </ul>
      </nav>

      <Drawer open={drawer} onOpenChange={setDrawer} title="Menu">
        <div className="flex h-14 items-center border-b border-border px-4"><BrandName /></div>
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">{navList(false, () => setDrawer(false))}</nav>
        <div className="border-t border-border p-3 text-sm">
          <p className="px-3 font-medium">{user.fullName}</p>
          <p className="px-3 text-xs text-muted">{user.roles.map(humanize).join(" · ")}</p>
        </div>
      </Drawer>
      {canSearch && <CommandSearch open={search} onOpenChange={setSearch} />}
    </div>
  );
}
