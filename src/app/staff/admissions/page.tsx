import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, UserPlus } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { NewLeadDialog } from "@/components/staff/lead-forms";
import { SOURCES } from "@/features/leads/constants";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { buildHref, getCourses, getLocations, locationOptions, pgSearch } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDateShort, formatPhone, humanize, relativeDays } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Admissions" };
type Stage = Database["public"]["Enums"]["lead_stage"];
const OPEN: Stage[] = ["new", "contacted", "interested", "follow_up", "ready_to_enrol"];

export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("manager", "admin");
  const sp = await searchParams;
  const view = sp.view ?? "pipeline";
  const supabase = await createClient();
  const [locations, courses] = await Promise.all([getLocations(), getCourses()]);
  let q = supabase.from("leads").select("id, full_name, phone, stage, source, follow_up_at, created_at, preferred_location_id, course:courses(name), assignee:profiles!leads_assigned_to_fkey(full_name)").order("created_at", { ascending: false }).limit(300);
  if (sp.location) q = q.eq("preferred_location_id", sp.location);
  if (sp.source) q = q.eq("source", sp.source as Database["public"]["Enums"]["lead_source"]);
  if (sp.q) q = q.or(`full_name.ilike.%${pgSearch(sp.q)}%,phone.ilike.%${pgSearch(sp.q).replace(/^0/, "")}%`);
  if (view === "closed") q = q.in("stage", ["converted", "lost"]);
  else q = q.in("stage", OPEN);
  const { data } = await q;
  const leads = data ?? [];
  const now = new Date().toISOString();
  const due = leads.filter((l) => l.follow_up_at && l.follow_up_at <= now && OPEN.includes(l.stage));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());

  const card = (l: (typeof leads)[number]) => (
    <Link key={l.id} href={`/staff/admissions/${l.id}`} className="block rounded-md border border-border bg-surface p-3 shadow-sm hover:border-brand-200">
      <p className="font-medium">{l.full_name}</p>
      <p className="text-xs text-muted">{formatPhone(l.phone)} · {humanize(l.source)}</p>
      {l.course?.name && <p className="mt-1 truncate text-xs text-muted">{l.course.name}</p>}
      {l.follow_up_at && (
        <p className={cn("mt-1.5 text-xs font-medium", l.follow_up_at <= now ? "text-danger-700" : "text-muted")}>
          Follow up {relativeDays(l.follow_up_at.slice(0, 10), today)}
        </p>
      )}
    </Link>
  );

  return (
    <div>
      <PageHeader title="Admissions" description="Enquiries and leads, from first contact to enrolment"
        actions={<NewLeadDialog locations={locations.map((l) => ({ id: l.id, name: l.name }))} courses={courses.map((c) => ({ id: c.id, name: c.name }))} />} />
      {due.length > 0 && view !== "closed" && (
        <Card className="mb-4 border-warning-600/30 bg-warning-50 p-3 text-sm text-warning-700">
          <p className="flex items-center gap-2 font-semibold"><BellRing className="size-4" />{due.length} follow-up{due.length > 1 ? "s" : ""} due</p>
          <p className="mt-1">{due.slice(0, 5).map((l) => l.full_name).join(", ")}{due.length > 5 ? "…" : ""}</p>
        </Card>
      )}
      <LinkTabs active={view} tabs={[
        { key: "pipeline", label: "Pipeline", href: buildHref("/staff/admissions", sp, { view: undefined }) },
        { key: "list", label: "List", href: buildHref("/staff/admissions", sp, { view: "list" }) },
        { key: "closed", label: "Converted & lost", href: buildHref("/staff/admissions", sp, { view: "closed" }) },
      ]} />
      <Card className="mb-4">
        <FilterBar className="border-b-0" searchPlaceholder="Search name or phone" filters={[
          { name: "location", label: "All locations", options: locationOptions(locations) },
          { name: "source", label: "All sources", options: SOURCES.map(([v, l]) => ({ value: v, label: l })) },
        ]} />
      </Card>
      {leads.length === 0 ? <Card><EmptyState icon={UserPlus} title="No leads here" description="New enquiries from walk-ins, calls, WhatsApp and the website appear here." /></Card>
      : view === "pipeline" ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {OPEN.map((stage) => {
            const items = leads.filter((l) => l.stage === stage);
            return (
              <section key={stage} className="rounded-lg bg-surface-muted p-2">
                <h2 className="flex items-center justify-between px-1 py-1.5 text-sm font-semibold">{humanize(stage)}<span className="rounded-full bg-surface px-2 text-xs text-muted">{items.length}</span></h2>
                <div className="space-y-2">{items.length ? items.map(card) : <p className="px-1 py-3 text-xs text-muted">Nothing here</p>}</div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {leads.map((l) => (
              <li key={l.id}>
                <Link href={`/staff/admissions/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60 sm:px-5">
                  <span className="min-w-0"><span className="block truncate font-medium">{l.full_name}</span>
                    <span className="block truncate text-xs text-muted">{formatPhone(l.phone)} · {humanize(l.source)} · {formatDateShort(l.created_at)} · {l.assignee?.full_name ?? "Unassigned"}</span></span>
                  <StatusBadge status={l.stage} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
