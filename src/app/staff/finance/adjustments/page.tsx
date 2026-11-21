import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/money";
import { Card } from "@/components/ui/card";
import { DataTable, MobileRow } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { formatDate, fullName, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Adjustments" };

export default async function AdjustmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("financial_adjustments").select("id, adjustment_number, adjustment_type, amount, reason, created_at, student:students(id, student_number, first_name, middle_name, last_name), line:invoice_lines(component), author:profiles(full_name)").order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  type Row = (typeof rows)[number];
  return (
    <div>
      <PageHeader title="Adjustments" description="Credit notes, waivers, write-offs and debit notes. Post new ones from the student's Fees tab." />
      <Card>
        <DataTable<Row> rows={rows} rowKey={(r) => r.id} caption="Adjustments" empty={<EmptyState title="No adjustments posted" />}
          columns={[
            { key: "n", header: "Number", cell: (r) => <span className="tabular">{r.adjustment_number}</span> },
            { key: "s", header: "Student", cell: (r) => r.student ? <Link className="hover:underline" href={`/staff/students/${r.student.id}?tab=finance`}>{fullName(r.student)}</Link> : "—" },
            { key: "t", header: "Type", cell: (r) => `${humanize(r.adjustment_type)} · ${humanize(r.line?.component)}` },
            { key: "r", header: "Reason", cell: (r) => <span className="text-muted">{r.reason}</span> },
            { key: "d", header: "Posted", cell: (r) => <span>{formatDate(r.created_at)}<span className="block text-xs text-muted">{r.author?.full_name}</span></span> },
            { key: "a", header: "Amount", align: "right", cell: (r) => <Money value={r.adjustment_type === "debit_note" ? r.amount : -r.amount} /> },
          ]}
          mobile={(r) => <MobileRow title={`${humanize(r.adjustment_type)} · ${r.student ? fullName(r.student) : ""}`} subtitle={r.reason} right={<Money value={r.amount} />} />} />
      </Card>
    </div>
  );
}
