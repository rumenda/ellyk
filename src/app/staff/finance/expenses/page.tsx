import type { Metadata } from "next";
import { Money } from "@/components/money";
import { ExpenseDialog } from "@/components/staff/finance-forms";
import { Card } from "@/components/ui/card";
import { DataTable, MobileRow } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { getLocations } from "@/features/staff/lookups";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const [locations, { data: cats }, { data: vehicles }, { data }] = await Promise.all([
    getLocations(),
    supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id, registration").eq("is_active", true).order("registration"),
    supabase.from("expenses").select("id, expense_number, expense_date, description, vendor, amount, paid_from, category:expense_categories(name), location:locations(name)").order("expense_date", { ascending: false }).limit(200),
  ]);
  const rows = data ?? [];
  type Row = (typeof rows)[number];
  return (
    <div>
      <PageHeader title="Expenses" description="Each expense posts Dr expense / Cr cash account." actions={<ExpenseDialog categories={cats ?? []} locations={locations.map((l) => ({ id: l.id, name: l.name }))} vehicles={(vehicles ?? []).map((v) => ({ id: v.id, name: v.registration }))} />} />
      <Card>
        <DataTable<Row> rows={rows} rowKey={(r) => r.id} caption="Expenses" empty={<EmptyState title="No expenses recorded" />}
          columns={[
            { key: "d", header: "Date", cell: (r) => formatDate(r.expense_date) },
            { key: "x", header: "Description", cell: (r) => <span>{r.description}<span className="block text-xs text-muted">{r.expense_number} · {r.vendor}</span></span> },
            { key: "c", header: "Category", cell: (r) => r.category?.name },
            { key: "l", header: "Location", cell: (r) => r.location?.name ?? "All" },
            { key: "a", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} strong /> },
          ]}
          mobile={(r) => <MobileRow title={r.description} subtitle={`${formatDate(r.expense_date)} · ${r.category?.name}`} right={<Money value={r.amount} />} />} />
      </Card>
    </div>
  );
}
