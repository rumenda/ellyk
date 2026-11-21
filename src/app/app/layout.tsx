import Link from "next/link";
import { Bell } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { BottomNav, TopNav } from "@/components/student/bottom-nav";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudent();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur no-print">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/app" className="flex items-center gap-2" aria-label="Elly K home">
            <BrandMark className="size-8" /><span className="font-semibold tracking-tight">Elly K</span>
          </Link>
          <Link href="/app/notifications" className="relative grid size-11 place-items-center rounded-full hover:bg-surface-muted"
            aria-label={count ? `Notifications, ${count} unread` : "Notifications"}>
            <Bell className="size-[22px]" />
            {!!count && <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-danger-600 px-1 text-[11px] font-semibold text-white">{count > 9 ? "9+" : count}</span>}
          </Link>
        </div>
        <TopNav />
      </header>
      <OfflineBanner />
      <InstallPrompt />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
