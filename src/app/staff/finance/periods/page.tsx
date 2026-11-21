import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { PeriodDialog } from "@/components/staff/finance-forms";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { closePeriod } from "@/features/finance/actions";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fiscal periods" };

export default async function PeriodsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("fiscal_periods").select("*, closer:profiles(full_name)").order("starts_on", { ascending: false });
  return (
    <div>
      <PageHeader title="Fiscal periods" description="Closing a period blocks any further postings dated inside it." actions={<PeriodDialog />} />
      <Card>
        {(data ?? []).length === 0 ? <EmptyState title="No periods defined" /> : (
          <ul className="divide-y divide-border">
            {data!.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span><span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{formatDate(p.starts_on)} – {formatDate(p.ends_on)}{p.closed_at ? ` · closed ${formatDate(p.closed_at)} by ${p.closer?.full_name}` : ""}</span></span>
                <span className="flex items-center gap-2"><StatusBadge status={p.status} />
                  {p.status === "open" && p.ends_on < new Date().toISOString().slice(0, 10) && <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return closePeriod(p.id); }}
                    confirm={{ title: `Close ${p.name}?`, description: "No journal entries can be dated in this period afterwards. This cannot be undone here.", confirmLabel: "Close period" }}>Close</ActionButton>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
