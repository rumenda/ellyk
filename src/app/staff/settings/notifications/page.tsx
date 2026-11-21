import type { Metadata } from "next";
import { AnnouncementForm, TemplateEditor } from "@/components/staff/settings-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getLocations } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettings() {
  await requireRole("manager");
  const supabase = await createClient();
  const [locations, { data: templates }, { data: anns }, { data: deliveries }] = await Promise.all([
    getLocations(),
    supabase.from("notification_templates").select("*").order("key").order("channel"),
    supabase.from("announcements").select("*").order("published_at", { ascending: false }).limit(10),
    supabase.from("notification_deliveries").select("status, channel").gte("created_at", new Date(nowMs() - 7 * 86_400_000).toISOString()),
  ]);
  const stats = (deliveries ?? []).reduce<Record<string, number>>((a, d) => { a[`${d.channel}:${d.status}`] = (a[`${d.channel}:${d.status}`] ?? 0) + 1; return a; }, {});
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Notifications & announcements" breadcrumbs={[{ label: "Settings", href: "/staff/settings" }, { label: "Notifications" }]}
        description="Change wording here – no code changes. Use {{placeholders}} shown under each template." />
      <Card><CardHeader title="Post an announcement" description="Students receive it in the app (and as a notification)." /><CardBody><AnnouncementForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} /></CardBody>
        <ul className="divide-y divide-border border-t border-border text-sm">{(anns ?? []).map((a) => <li key={a.id} className="px-5 py-2.5"><span className="font-medium">{a.title}</span> <span className="text-xs text-muted">· {a.audience} · {formatDateTime(a.published_at)}</span></li>)}</ul>
      </Card>
      <Card><CardHeader title="Delivery (last 7 days)" /><CardBody className="flex flex-wrap gap-4 text-sm">
        {Object.keys(stats).length === 0 ? <span className="text-muted">No external deliveries yet.</span> : Object.entries(stats).map(([k, v]) => <span key={k}><span className="text-muted">{k.replace(":", " · ")}</span> <b>{v}</b></span>)}
      </CardBody></Card>
      <Card><CardHeader title="Templates" /><div className="divide-y divide-border">{(templates ?? []).map((t) => <TemplateEditor key={t.id} t={t} />)}</div></Card>
    </div>
  );
}
