import type { Metadata } from "next";
import { AlertTriangle, CalendarCheck, ClipboardCheck, GraduationCap, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { BarChart, HBarChart, LineChart, StackedBar } from "@/components/ui/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { ErrorState } from "@/components/ui/states";
import { getLocations, locationOptions } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatKES, humanize, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

interface Dash {
  period: { from: string; to: string };
  active_students: number; new_registrations: number; enrolments_in_period: number; collected: number; outstanding: number;
  payments_due_7d: number; overdue_amount: number; overdue_students: number; lessons_scheduled: number; lessons_today: number;
  attendance_rate: number | null; ready_for_ntsa: number; tests_upcoming: number; training_completion: number | null;
  service_fees_collected: number; pass_rate: number | null;
  enrolments_by_month: { month: string; value: number }[]; collections_by_week: { week: string; value: number }[];
  students_by_location: { label: string; value: number }[]; instructor_workload: { label: string; value: number }[];
  payment_ageing: { current: number; d1_30: number; d31_60: number; d60_plus: number };
  ntsa_pipeline: Record<string, number>; lead_pipeline: Record<string, number>;
}

const MONTH = new Intl.DateTimeFormat("en-KE", { month: "short" });

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ location?: string; from?: string; to?: string }> }) {
  const user = await requireRole("manager", "admin");
  const sp = await searchParams;
  const supabase = await createClient();
  const [locations, { data, error }] = await Promise.all([
    getLocations(),
    supabase.rpc("dashboard_manager", { p_location: sp.location || undefined, p_from: sp.from || undefined, p_to: sp.to || undefined }),
  ]);
  const d = data as unknown as Dash | null;
  const locName = locations.find((l) => l.id === sp.location)?.name;

  return (
    <div>
      <PageHeader title={`Good day, ${user.fullName.split(" ")[0]}`}
        description={d ? `${locName ?? "All locations"} · ${formatDate(d.period.from)} – ${formatDate(d.period.to)}` : undefined} />
      <Card className="mb-5">
        <FilterBar filters={[
          { name: "location", label: "All locations", options: locationOptions(locations) },
          { name: "from", label: "From", type: "date" },
          { name: "to", label: "To", type: "date" },
        ]} className="border-b-0" />
      </Card>
      {error || !d ? <Card><ErrorState /></Card> : (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Active students" value={d.active_students} icon={Users} tone="brand" href="/staff/students?status=active" />
            <StatCard label="Collected (period)" value={formatKES(d.collected)} icon={Wallet} tone="success" href="/staff/payments" />
            <StatCard label="Outstanding balances" value={formatKES(d.outstanding)} icon={TrendingUp} hint={`${formatKES(d.payments_due_7d)} due in 7 days`} href="/staff/reports/outstanding" />
            <StatCard label="Overdue" value={formatKES(d.overdue_amount)} icon={AlertTriangle} tone={d.overdue_amount > 0 ? "danger" : "neutral"} hint={`${d.overdue_students} student${d.overdue_students === 1 ? "" : "s"}`} href="/staff/reports/ageing" />
            <StatCard label="New registrations" value={d.new_registrations} icon={UserPlus} hint={`${d.enrolments_in_period} enrolments in period`} href="/staff/students" />
            <StatCard label="Lessons next 7 days" value={d.lessons_scheduled} icon={CalendarCheck} hint={`${d.lessons_today} today · attendance ${d.attendance_rate ?? "–"}%`} href="/staff/schedule" />
            <StatCard label="Ready for NTSA" value={d.ready_for_ntsa} icon={ClipboardCheck} tone="warning" hint={`${d.tests_upcoming} tests upcoming · pass rate ${d.pass_rate ?? "–"}%`} href="/staff/ntsa" />
            <StatCard label="Avg. training completion" value={`${d.training_completion ?? 0}%`} icon={GraduationCap} hint={`Service fees collected ${formatKES(d.service_fees_collected)}`} href="/staff/training" />
          </section>

          <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
            <Card className="lg:col-span-2">
              <CardHeader title="Collections" description="Confirmed payments per week (last 12 weeks)" />
              <CardBody><LineChart money valueLabel="KES collected" data={d.collections_by_week.map((x) => ({ label: formatDate(x.week).replace(/ \d{4}$/, ""), value: toNumber(x.value) }))} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Payment ageing" description="Unpaid instalments by days overdue" />
              <CardBody>
                <StackedBar segments={[
                  { label: "Not yet due", value: toNumber(d.payment_ageing.current), color: "var(--brand-500)" },
                  { label: "1–30 days", value: toNumber(d.payment_ageing.d1_30), color: "var(--accent-500)" },
                  { label: "31–60 days", value: toNumber(d.payment_ageing.d31_60), color: "#ea580c" },
                  { label: "60+ days", value: toNumber(d.payment_ageing.d60_plus), color: "var(--danger-600)" },
                ]} />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
            <Card>
              <CardHeader title="Enrolments" description="New enrolments per month" />
              <CardBody><BarChart valueLabel="Enrolments" data={d.enrolments_by_month.map((x) => ({ label: MONTH.format(new Date(`${x.month}-15`)), value: x.value }))} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Active students by location" />
              <CardBody><HBarChart valueLabel="Students" data={d.students_by_location} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Instructor workload" description="Sessions in the last 7 and next 7 days" />
              <CardBody><HBarChart valueLabel="Sessions" data={d.instructor_workload} /></CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader title="NTSA pipeline" />
              <CardBody>
                <HBarChart valueLabel="Students" data={["documents_pending", "ready_for_payment", "payment_pending", "paid_by_school", "booking_pending", "test_booked", "test_scheduled", "failed_retest_required", "passed"]
                  .map((s) => ({ label: humanize(s), value: d.ntsa_pipeline[s] ?? 0 })).filter((x) => x.value > 0)} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Admissions pipeline" description="Leads by stage" />
              <CardBody>
                <HBarChart valueLabel="Leads" data={["new", "contacted", "interested", "follow_up", "ready_to_enrol", "converted", "lost"]
                  .map((s) => ({ label: humanize(s), value: d.lead_pipeline[s] ?? 0 }))} />
              </CardBody>
            </Card>
          </div>
          <p className="text-xs text-muted">All figures are calculated live from payments, allocations and training records. Outstanding: <Money value={d.outstanding} />.</p>
        </div>
      )}
    </div>
  );
}
