import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { CompetencyForm } from "@/components/staff/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { toggleCompetency } from "@/features/settings/actions";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Competencies" };

export default async function CompetenciesSettings() {
  await requireRole("manager");
  const supabase = await createClient();
  const [{ data: items }, { data: lcs }] = await Promise.all([
    supabase.from("competencies").select("*, licence:licence_classes(name)").order("sort_order"),
    supabase.from("licence_classes").select("id, name"),
  ]);
  const lc = (lcs ?? []).map((l) => ({ id: l.id, name: l.name }));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Training competencies" breadcrumbs={[{ label: "Settings", href: "/staff/settings" }, { label: "Competencies" }]}
        description="Instructors rate each skill. All 'required' skills must reach Competent before training can be signed off."
        actions={<CompetencyForm licenceClasses={lc} nextOrder={(items?.length ?? 0) + 1} />} />
      <Card><ul className="divide-y divide-border">
        {(items ?? []).map((c) => (
          <li key={c.id} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${c.is_active ? "" : "opacity-60"}`}>
            <span className="text-sm"><span className="font-medium">{c.sort_order}. {c.name}</span><span className="block text-xs text-muted">{c.code} · {c.category} · {c.licence?.name ?? "All classes"}</span></span>
            <span className="flex items-center gap-2">
              {c.required_for_test && <Badge tone="brand">Required</Badge>}
              <CompetencyForm licenceClasses={lc} nextOrder={0} item={c} />
              <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return toggleCompetency(c.id, !c.is_active); }}>{c.is_active ? "Disable" : "Enable"}</ActionButton>
            </span>
          </li>
        ))}
      </ul></Card>
    </div>
  );
}
