import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { CourseDialog, PriceDraftEditor } from "@/components/staff/pricing-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { deletePriceDraft, publishPriceVersion } from "@/features/settings/actions";
import { getLocations } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { COMPONENT_SHORT } from "@/lib/finance/allocation";
import { formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Course pricing" };

export default async function CoursePricing({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("manager", "accountant");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: c }, locations, { data: lcs }, { data: taxes }, { data: settings }, { count: enrolled }] = await Promise.all([
    supabase.from("courses").select("*, course_locations(location_id), versions:course_price_versions(*, items:course_price_items(*))").eq("id", id).maybeSingle(),
    getLocations(), supabase.from("licence_classes").select("id, name"), supabase.from("tax_rates").select("id, name").eq("is_active", true),
    supabase.from("school_settings").select("default_service_fee").eq("id", 1).single(),
    supabase.from("enrolments").select("id", { count: "exact", head: true }).eq("course_id", id),
  ]);
  if (!c) notFound();
  const versions = [...c.versions].sort((a, b) => b.version - a.version);
  const active = versions.find((v) => v.status === "active");
  const toItems = (v: (typeof versions)[number]) => [...v.items].sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ component: i.component, label: i.label, amount: Number(i.amount), tax_rate_id: i.tax_rate_id ?? undefined }));
  return (
    <div className="max-w-4xl">
      <PageHeader breadcrumbs={[{ label: "Settings", href: "/staff/settings" }, { label: "Courses", href: "/staff/settings/courses" }, { label: c.name }]}
        title={c.name} description={`${c.code} · ${enrolled ?? 0} enrolments to date`}
        actions={<>
          {hasRole(user, "manager") && <CourseDialog licenceClasses={(lcs ?? []).map((l) => ({ id: l.id, name: l.name }))} locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            course={{ ...c, locationIds: c.course_locations.map((x) => x.location_id) }} />}
          <PriceDraftEditor courseId={id} taxRates={(taxes ?? []).map((t) => ({ id: t.id, name: t.name }))} defaultServiceFee={Number(settings?.default_service_fee ?? 0)}
            base={active ? { items: toItems(active), deposit_amount: Number(active.deposit_amount), instalment_count: active.instalment_count, min_paid_before_training: Number(active.min_paid_before_training), min_paid_before_ntsa: Number(active.min_paid_before_ntsa) } : undefined} />
        </>} />
      <div className="space-y-4">
        {versions.length === 0 && <Card><CardBody className="text-sm text-muted">No pricing yet. Create a price version and publish it before enrolling students.</CardBody></Card>}
        {versions.map((v) => {
          const total = v.items.reduce((s, i) => s + Number(i.amount), 0);
          return (
            <Card key={v.id} className={v.status === "active" ? "border-brand-500" : ""}>
              <CardHeader title={<span className="flex items-center gap-2">Version {v.version} · {v.label}<StatusBadge status={v.status} /></span>}
                description={`Effective ${formatDate(v.effective_from)}${v.published_at ? ` · published ${formatDate(v.published_at)}` : ""}${v.retired_at ? ` · retired ${formatDate(v.retired_at)}` : ""}`}
                action={v.status === "draft" && <div className="flex gap-2">
                  <PriceDraftEditor courseId={id} taxRates={(taxes ?? []).map((t) => ({ id: t.id, name: t.name }))} defaultServiceFee={0}
                    draft={{ id: v.id, label: v.label, effective_from: v.effective_from, deposit_amount: Number(v.deposit_amount), instalment_mode: v.instalment_mode, instalment_count: v.instalment_count, instalment_amount: v.instalment_amount, instalment_frequency: v.instalment_frequency, min_paid_before_training: Number(v.min_paid_before_training), min_paid_before_ntsa: Number(v.min_paid_before_ntsa), items: toItems(v) }} />
                  <ActionButton size="sm" action={async () => { "use server"; return publishPriceVersion(v.id); }} confirm={{ title: `Publish version ${v.version}?`, description: "It becomes the price for all new enrolments and can no longer be edited. The current version is retired; existing students are unaffected.", confirmLabel: "Publish" }}>Publish</ActionButton>
                  <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return deletePriceDraft(v.id); }} confirm={{ title: "Delete draft?", destructive: true, confirmLabel: "Delete" }}>Delete</ActionButton>
                </div>} />
              <CardBody className="grid gap-5 sm:grid-cols-2">
                <ul className="space-y-1 text-sm">
                  {[...v.items].sort((a, b) => a.sort_order - b.sort_order).map((i) => <li key={i.id} className="flex justify-between gap-2"><span>{i.label} <span className="text-xs text-muted">({COMPONENT_SHORT[i.component]})</span></span><Money value={i.amount} /></li>)}
                  <li className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><Money value={total} /></li>
                </ul>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-muted">Deposit</dt><dd><Money value={v.deposit_amount} /></dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Plan</dt><dd>{v.instalment_mode === "count" ? `${v.instalment_count} × ${v.instalment_frequency}` : `${humanize(v.instalment_frequency)} of ${v.instalment_amount}`}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Before training</dt><dd><Money value={v.min_paid_before_training} /></dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Before NTSA</dt><dd><Money value={v.min_paid_before_ntsa} /></dd></div>
                </dl>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
