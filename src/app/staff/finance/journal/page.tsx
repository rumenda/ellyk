import type { Metadata } from "next";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { buildHref, pageParam } from "@/features/staff/lookups";
import { formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Journal" };
const PAGE = 25;
const SOURCES = ["invoice", "payment", "allocation", "allocation_reversal", "payment_reversal", "adjustment", "refund", "ntsa_remittance", "developer_settlement", "expense", "manual"];

export default async function JournalPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await createClient();
  let q = supabase.from("journal_entries").select("id, entry_number, entry_date, description, source_type, journal_lines(id, debit, credit, memo, component, account:chart_of_accounts(code, name))", { count: "exact" });
  if (sp.source && SOURCES.includes(sp.source)) q = q.eq("source_type", sp.source as Database["public"]["Enums"]["journal_source"]);
  if (sp.from) q = q.gte("entry_date", sp.from);
  if (sp.to) q = q.lte("entry_date", sp.to);
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  return (
    <div>
      <PageHeader title="General journal" description="Immutable, balanced double-entry postings. Corrections are made with reversing entries." />
      <Card>
        <FilterBar filters={[{ name: "source", label: "All sources", options: SOURCES.map((s) => ({ value: s, label: humanize(s) })) },
          { name: "from", label: "From", type: "date" }, { name: "to", label: "To", type: "date" }]} />
        {(data ?? []).length === 0 ? <EmptyState title="No journal entries" /> : (
          <ul className="divide-y divide-border">
            {data!.map((e) => (
              <li key={e.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{e.description}</p>
                  <p className="text-xs text-muted"><span className="tabular">{e.entry_number}</span> · {formatDate(e.entry_date)} · {humanize(e.source_type)}</p>
                </div>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {e.journal_lines.map((l) => (
                      <tr key={l.id} className="text-muted">
                        <td className={`py-0.5 ${l.credit > 0 ? "pl-6" : ""}`}><span className="tabular">{l.account?.code}</span> {l.account?.name}{l.memo ? ` – ${l.memo}` : ""}</td>
                        <td className="w-28 text-right">{l.debit > 0 && <Money value={l.debit} />}</td>
                        <td className="w-28 text-right">{l.credit > 0 && <Money value={l.credit} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => buildHref("/staff/finance/journal", sp, { page: p })} />
      </Card>
    </div>
  );
}
