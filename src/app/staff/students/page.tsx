import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, MobileRow, Pagination } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { buildHref, getLocations, locationOptions, pageParam, pgSearch } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatPhone, fullName, normalizeKenyanPhone, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Students" };
const PAGE = 25;
type Status = Database["public"]["Enums"]["student_status"];
const STATUSES: Status[] = ["applicant", "active", "suspended", "completed", "withdrawn", "alumni"];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("manager", "admin", "accountant", "instructor");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const supabase = await createClient();
  const locations = await getLocations();

  let q = supabase.from("students")
    .select("id, student_number, first_name, middle_name, last_name, phone, status, home_location_id, registered_at, enrolments(status, course:courses(name))", { count: "exact" })
    .is("anonymized_at", null);
  if (sp.location) q = q.eq("home_location_id", sp.location);
  if (sp.status && STATUSES.includes(sp.status as Status)) q = q.eq("status", sp.status as Status);
  if (sp.q) {
    const term = pgSearch(sp.q);
    const ph = normalizeKenyanPhone(sp.q);
    q = ph ? q.eq("phone", ph) : q.or(`student_number.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,middle_name.ilike.%${term}%`);
  }
  const { data, count, error } = await q.order("registered_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const ids = (data ?? []).map((s) => s.id);
  const showBalance = hasRole(user, "manager", "admin", "accountant");
  const { data: balances } = showBalance && ids.length
    ? await supabase.from("v_student_balances").select("student_id, total_outstanding").in("student_id", ids)
    : { data: [] as { student_id: string | null; total_outstanding: number | null }[] };
  const bal = new Map((balances ?? []).map((b) => [b.student_id, toNumber(b.total_outstanding)]));
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  const rows = (data ?? []).map((s) => {
    const open = s.enrolments.find((e) => !["completed", "withdrawn", "cancelled"].includes(e.status)) ?? s.enrolments[0];
    return { ...s, name: fullName(s), course: open?.course?.name ?? "—", enrolStatus: open?.status, balance: bal.get(s.id) ?? 0 };
  });
  type Row = (typeof rows)[number];

  return (
    <div>
      <PageHeader title="Students" description={hasRole(user, "instructor") && !hasRole(user, "manager", "admin") ? "Students assigned to you or booked on your sessions" : `${count ?? 0} students`}
        actions={hasRole(user, "manager", "admin") && <Link href="/staff/students/new" className={buttonVariants()}><Plus />Register student</Link>} />
      <Card>
        <FilterBar searchPlaceholder="Search name, phone or student number" filters={[
          { name: "location", label: "All locations", options: locationOptions(locations) },
          { name: "status", label: "Any status", options: STATUSES.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) })) },
        ]} />
        {error ? <ErrorState /> : (
          <DataTable<Row> rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/staff/students/${r.id}`} caption="Students"
            empty={<EmptyState icon={Users} title={sp.q || sp.status || sp.location ? "No students match these filters" : "No students yet"}
              description={sp.q ? "Try a phone number or the student number (e.g. EK00012)." : "Registered students will appear here."} />}
            columns={[
              { key: "name", header: "Student", cell: (r) => <span>{r.name}<span className="block text-xs font-normal text-muted">{r.student_number}</span></span> },
              { key: "phone", header: "Phone", cell: (r) => <span className="whitespace-nowrap tabular">{formatPhone(r.phone)}</span> },
              { key: "course", header: "Course", cell: (r) => <span>{r.course}{r.enrolStatus && <span className="mt-1 block"><StatusBadge status={r.enrolStatus} /></span>}</span> },
              { key: "location", header: "Location", cell: (r) => locName(r.home_location_id) },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              ...(showBalance ? [{ key: "balance", header: "Balance", align: "right" as const, cell: (r: Row) => <Money value={r.balance} tone={r.balance > 0 ? undefined : "muted"} /> }] : []),
            ]}
            mobile={(r) => (
              <MobileRow title={r.name} subtitle={`${r.student_number} · ${formatPhone(r.phone)}`}
                meta={<><StatusBadge status={r.enrolStatus ?? r.status} /><span className="text-xs text-muted">{locName(r.home_location_id)}</span></>}
                right={showBalance ? <><Money value={r.balance} className="text-sm font-semibold" /><span className="block text-xs text-muted">balance</span></> : undefined} />
            )} />
        )}
        <Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => buildHref("/staff/students", sp, { page: p })} />
      </Card>
    </div>
  );
}
