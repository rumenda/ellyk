import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { markNotificationsRead } from "@/features/student/actions";
import { requireStudent } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireStudent();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(60);
  const unread = (data ?? []).some((n) => !n.read_at);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        {unread && <ActionButton variant="secondary" size="sm" action={async () => { "use server"; return markNotificationsRead(); }}>Mark all read</ActionButton>}
      </div>
      <Card>
        {(data ?? []).length === 0 ? <EmptyState icon={Bell} title="You're all caught up" description="Payment confirmations, lesson reminders and NTSA updates will appear here." /> : (
          <ul className="divide-y divide-border">
            {data!.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/app"} className={cn("flex gap-3 px-4 py-3.5", !n.read_at && "bg-brand-50/60")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand-600")} aria-hidden />
                  <div className="min-w-0">
                    <p className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-subtle">{formatDateTime(n.created_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
