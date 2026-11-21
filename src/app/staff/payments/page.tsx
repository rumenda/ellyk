import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, Wallet } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, MobileRow, Pagination } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/states";
import { buildHref, getLocations, locationOptions, pageParam, pgSearch } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDateTime, fullName, humanize } from "@/lib/format";
import { mpesaEnv } from "@/lib/mpesa/service";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Payments" };
const PAGE = 30;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("manager", "admin", "accountant");
  const sp = await searchParams;
  const tab = sp.tab ?? "all";
  const page = pageParam(sp.page);
  const supabase = await createClient();
  const locations = await getLocations();
  const [unmatchedCount, pendingCount] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "unmatched"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending_verification"),
  ]);
  let q = supabase.from("payments").select("id, receipt_number, source, status, amount, received_at, external_reference, payer_name, location_id, student:students(student_number, first_name, middle_name, last_name)", { count: "exact" });
  if (tab === "unmatched") q = q.eq("status", "unmatched");
  else if (tab === "pending") q = q.eq("status", "pending_verification");
  if (sp.location) q = q.eq("location_id", sp.location);
  if (sp.source) q = q.eq("source", sp.source as Database["public"]["Enums"]["payment_source"]);
  if (sp.from) q = q.gte("received_at", new Date(`${sp.from}T00:00:00+03:00`).toISOString());
  if (sp.to) q = q.lte("received_at", new Date(`${sp.to}T23:59:59+03:00`).toISOString());
  if (sp.q) { const t = pgSearch(sp.q); q = q.or(`external_reference.ilike.%${t}%,receipt_number.ilike.%${t}%,payer_name.ilike.%${t}%`); }
  const { data, count } = await q.order("received_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const rows = data ?? [];
  type Row = (typeof rows)[number];
  const who = (r: Row) => r.student ? `${fullName(r.student)} · ${r.student.student_number}` : r.payer_name ? `Unidentified – ${r.payer_name}` : "Unidentified";

  return (
    <div>
      <PageHeader title="Payments" description="Every shilling received, how it was matched and where it went"
        actions={mpesaEnv() === "sandbox" && hasRole(user, "manager", "accountant") && <Link href="/staff/payments/simulator" className={buttonVariants({ variant: "secondary" })}><FlaskConical />M-Pesa sandbox</Link>} />
      <LinkTabs active={tab} tabs={[
        { key: "all", label: "All payments", href: buildHref("/staff/payments", sp, { tab: undefined, page: undefined }) },
        { key: "unmatched", label: "Unmatched", href: buildHref("/staff/payments", sp, { tab: "unmatched", page: undefined }), count: unmatchedCount.count ?? 0 },
        { key: "pending", label: "Awaiting verification", href: buildHref("/staff/payments", sp, { tab: "pending", page: undefined }), count: pendingCount.count ?? 0 },
      ]} />
      <Card>
        <FilterBar searchPlaceholder="M-Pesa code, receipt no. or payer" filters={[
          { name: "location", label: "All locations", options: locationOptions(locations) },
          { name: "source", label: "All methods", options: [{ value: "mpesa_c2b", label: "M-Pesa" }, { value: "cash", label: "Cash" }, { value: "bank_transfer", label: "Bank" }] },
          { name: "from", label: "From", type: "date" }, { name: "to", label: "To", type: "date" },
        ]} />
        <DataTable<Row> rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/staff/payments/${r.id}`} caption="Payments"
          empty={<EmptyState icon={Wallet} title={tab === "unmatched" ? "No unmatched payments 🎉" : tab === "pending" ? "Nothing awaiting verification" : "No payments found"}
            description={tab === "unmatched" ? "Payments whose account number doesn't match a student appear here for reconciliation." : undefined} />}
          columns={[
            { key: "ref", header: "Reference", cell: (r) => <span className="font-mono text-[13px]">{r.external_reference ?? r.receipt_number ?? "—"}</span> },
            { key: "who", header: "Student", cell: (r) => <span className={r.student ? "" : "text-danger-700"}>{who(r)}</span> },
            { key: "when", header: "Received", cell: (r) => formatDateTime(r.received_at) },
            { key: "src", header: "Method", cell: (r) => r.source === "mpesa_c2b" ? "M-Pesa" : humanize(r.source) },
            { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "amt", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} strong /> },
          ]}
          mobile={(r) => <MobileRow title={<Money value={r.amount} />} subtitle={who(r)} meta={<><StatusBadge status={r.status} /><span className="text-xs text-muted">{formatDateTime(r.received_at)}</span></>}
            right={<span className="font-mono text-xs text-muted">{r.external_reference}</span>} />} />
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => buildHref("/staff/payments", sp, { page: p })} />
      </Card>
    </div>
  );
}
