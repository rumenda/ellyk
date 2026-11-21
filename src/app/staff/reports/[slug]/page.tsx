import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { FilterBar, type FilterDef } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { PrintButton } from "@/components/print-button";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { findReport, parseFilters, type Col } from "@/features/reports/definitions";
import { getCourses, getLocations, locationOptions } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Report" };

function Cell({ col, v }: { col: Col; v: string | number | null }) {
  if (v === null || v === undefined || v === "") return <span className="text-subtle">—</span>;
  switch (col.type) {
    case "money": return <Money value={v} />;
    case "date": return <>{formatDate(String(v))}</>;
    case "status": return <StatusBadge status={String(v)} />;
    case "percent": return <span className="tabular">{v}%</span>;
    case "number": return <span className="tabular">{v}</span>;
    default: return <>{v}</>;
  }
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("manager", "admin", "accountant", "platform_owner");
  const { slug } = await params;
  const def = findReport(slug);
  if (!def || !hasRole(user, ...def.roles)) notFound();
  const sp = await searchParams;
  const f = parseFilters(sp);
  const supabase = await createClient();
  const [locations, courses, result] = await Promise.all([getLocations(), getCourses(), def.run(supabase, f)]);
  const filters: FilterDef[] = [];
  if (def.filters.includes("date")) filters.push({ name: "from", label: "From", type: "date" }, { name: "to", label: "To", type: "date" });
  if (def.filters.includes("location")) filters.push({ name: "location", label: "All locations", options: locationOptions(locations) });
  if (def.filters.includes("course")) filters.push({ name: "course", label: "All courses", options: courses.map((c) => ({ value: c.id, label: c.name })) });
  const qs = new URLSearchParams(Object.entries({ from: f.from, to: f.to, location: f.location, course: f.course }).filter(([, v]) => v) as [string, string][]);
  const numericRight = (c: Col) => ["money", "number", "percent"].includes(c.type ?? "");

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Reports", href: "/staff/reports" }, { label: def.title }]} title={def.title}
        description={`${def.description}${def.filters.includes("date") ? ` · ${formatDate(f.from)} – ${formatDate(f.to)}` : ""}`}
        actions={<><PrintButton /><a href={`/api/reports/${slug}.csv?${qs}`} className={buttonVariants({ size: "sm" })}><Download />Export CSV</a></>} />
      <Card>
        {filters.length > 0 && <FilterBar filters={filters} />}
        {result.totals && (
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-border px-4 py-3 text-sm sm:px-5">
            {Object.entries(result.totals).map(([k, v]) => (
              <div key={k}><p className="text-xs text-muted">{humanize(k)}</p><p className="font-semibold">{/rate|pass_rate/.test(k) ? `${v}%` : result.columns.find((c) => c.key === k)?.type === "money" || /revenue|expenses|surplus|amount/.test(k) ? <Money value={v} /> : v}</p></div>
            ))}
          </div>
        )}
        {result.rows.length === 0 ? <EmptyState title="No data for these filters" description="Try a wider date range or another location." /> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  {result.columns.map((c) => <th key={c.key} className={cn("px-4 py-2.5 font-medium first:pl-5 last:pr-5", numericRight(c) && "text-right")}>{c.label}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {result.rows.map((r, i) => <tr key={i}>{result.columns.map((c) => <td key={c.key} className={cn("px-4 py-2.5 first:pl-5 last:pr-5", numericRight(c) && "text-right")}><Cell col={c} v={r[c.key] ?? null} /></td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {result.rows.map((r, i) => (
                <li key={i} className="space-y-1 px-4 py-3 text-sm">
                  <p className="font-medium"><Cell col={result.columns[0]!} v={r[result.columns[0]!.key] ?? null} /> {result.columns[1] && <span className="text-muted">· <Cell col={result.columns[1]} v={r[result.columns[1].key] ?? null} /></span>}</p>
                  <dl className="grid grid-cols-1 gap-x-3 gap-y-1 min-[420px]:grid-cols-2">
                    {result.columns.slice(2).map((c) => <div key={c.key} className="flex justify-between gap-2"><dt className="text-xs text-muted">{c.label}</dt><dd className="text-right"><Cell col={c} v={r[c.key] ?? null} /></dd></div>)}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
