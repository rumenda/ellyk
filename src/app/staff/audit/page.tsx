import type { Metadata } from "next";
import { FilterBar } from "@/components/forms/filter-bar";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { buildHref, pageParam, pgSearch } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };
const PAGE = 40;
const ENTITIES = ["payments", "payment_allocations", "financial_adjustments", "refunds", "students", "enrolments", "ntsa_processes", "ntsa_payments", "course_price_versions", "course_price_items", "user_roles", "school_settings", "developer_settlements", "expenses", "attendance"];

function Diff({ v }: { v: unknown }) {
  if (!v || typeof v !== "object") return null;
  const entries = Object.entries(v as Record<string, unknown>).slice(0, 6);
  return <span className="text-xs text-muted">{entries.map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`).join(" · ").slice(0, 220)}</span>;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("manager", "accountant", "platform_owner");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, occurred_at, actor_id, actor_roles, action, entity_type, entity_id, old_values, new_values, ip_address", { count: "exact" });
  if (sp.entity) q = q.eq("entity_type", sp.entity);
  if (sp.q) q = q.ilike("action", `%${pgSearch(sp.q)}%`);
  if (sp.from) q = q.gte("occurred_at", new Date(`${sp.from}T00:00:00+03:00`).toISOString());
  const { data, count } = await q.order("occurred_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const actors = [...new Set((data ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: profiles } = actors.length ? await supabase.from("profiles").select("id, full_name").in("id", actors) : { data: [] };
  const who = (id: string | null) => (id ? profiles?.find((p) => p.id === id)?.full_name ?? "Staff user" : "System");
  return (
    <div>
      <PageHeader title="Audit log" description="Append-only record of sensitive changes. Nobody can edit or delete entries." />
      <Card>
        <FilterBar searchPlaceholder="Search action (e.g. payment, permission)" filters={[{ name: "entity", label: "All records", options: ENTITIES.map((e) => ({ value: e, label: humanize(e) })) }, { name: "from", label: "From", type: "date" }]} />
        {(data ?? []).length === 0 ? <EmptyState title="No audit entries" /> : (
          <ul className="divide-y divide-border">
            {data!.map((a) => (
              <li key={a.id} className="px-4 py-2.5 text-sm sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{humanize(a.action.replace(/\./g, " "))}</span>
                  <span className="text-xs text-muted">{formatDateTime(a.occurred_at)} · {who(a.actor_id)}{a.actor_roles?.length ? ` (${a.actor_roles.join(", ")})` : ""}{a.ip_address ? ` · ${a.ip_address}` : ""}</span>
                </div>
                <Diff v={a.new_values ?? a.old_values} />
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => buildHref("/staff/audit", sp, { page: p })} />
      </Card>
    </div>
  );
}
