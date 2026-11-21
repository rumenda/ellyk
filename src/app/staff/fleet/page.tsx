import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Bike } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import { FilterBar } from "@/components/forms/filter-bar";
import { VehicleDialog } from "@/components/staff/ops-forms";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, MobileRow } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { updateIncident } from "@/features/ops/actions";
import { getLocations, locationOptions } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDate, formatDateTime, humanize, todayKE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Fleet" };
const soon = (d: string | null, days = 30) => !!d && d <= new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export default async function FleetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("manager", "admin", "instructor");
  const sp = await searchParams;
  const office = hasRole(user, "manager", "admin");
  const supabase = await createClient();
  const locations = await getLocations();
  let q = supabase.from("vehicles").select("*, location:locations(name)").eq("is_active", true).order("asset_number");
  if (sp.location) q = q.eq("location_id", sp.location);
  if (sp.status) q = q.eq("status", sp.status as Database["public"]["Enums"]["vehicle_status"]);
  const [{ data }, { data: incidents }] = await Promise.all([
    q, supabase.from("vehicle_incidents").select("id, occurred_at, severity, description, status, injuries, vehicle:vehicles(registration)").neq("status", "closed").order("occurred_at", { ascending: false }),
  ]);
  const rows = data ?? [];
  const today = todayKE();
  const alerts = rows.flatMap((v) => [
    soon(v.insurance_expiry) && `${v.registration}: insurance ${v.insurance_expiry! < today ? "expired" : "expires"} ${formatDate(v.insurance_expiry)}`,
    soon(v.inspection_expiry) && `${v.registration}: inspection due ${formatDate(v.inspection_expiry)}`,
    (soon(v.next_service_date, 7) || (v.next_service_km && v.odometer_km >= v.next_service_km - 200)) && `${v.registration}: service due`,
  ].filter(Boolean) as string[]);
  type Row = (typeof rows)[number];
  return (
    <div>
      <PageHeader title="Fleet" description={`${rows.length} motorcycles · ${rows.filter((v) => v.status === "available").length} available`}
        actions={office && <VehicleDialog locations={locations.map((l) => ({ id: l.id, name: l.name }))} />} />
      {alerts.length > 0 && <Card className="mb-5 border-warning-600/30 bg-warning-50 p-4 text-sm text-warning-700"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />Attention needed</p><ul className="mt-1 list-disc pl-5">{alerts.map((a) => <li key={a}>{a}</li>)}</ul></Card>}
      <Card className="mb-5">
        <FilterBar filters={[{ name: "location", label: "All locations", options: locationOptions(locations) },
          { name: "status", label: "Any status", options: ["available", "assigned", "training", "maintenance", "out_of_service"].map((s) => ({ value: s, label: humanize(s) })) }]} />
        <DataTable<Row> rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/staff/fleet/${r.id}`} caption="Fleet" empty={<EmptyState icon={Bike} title="No motorcycles" />}
          columns={[
            { key: "r", header: "Motorcycle", cell: (r) => <span>{r.registration}<span className="block text-xs font-normal text-muted">{r.asset_number} · {r.make} {r.model} {r.year ?? ""}</span></span> },
            { key: "l", header: "Location", cell: (r) => r.location?.name },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "o", header: "Odometer", align: "right", cell: (r) => `${r.odometer_km.toLocaleString("en-KE")} km` },
            { key: "sv", header: "Next service", cell: (r) => <span className={soon(r.next_service_date, 7) ? "text-warning-700" : ""}>{formatDate(r.next_service_date)}</span> },
            { key: "i", header: "Insurance", cell: (r) => <span className={soon(r.insurance_expiry) ? "font-medium text-danger-700" : ""}>{formatDate(r.insurance_expiry)}</span> },
          ]}
          mobile={(r) => <MobileRow title={r.registration} subtitle={`${r.make} ${r.model} · ${r.location?.name}`} right={<StatusBadge status={r.status} />} />} />
      </Card>
      <Card>
        <CardHeader title="Open incidents" />
        {(incidents ?? []).length === 0 ? <EmptyState title="No open incidents" /> : (
          <ul className="divide-y divide-border text-sm">{incidents!.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span><span className="font-medium">{humanize(i.severity)}{i.injuries ? " · injury" : ""}</span> · {i.vehicle?.registration ?? "No vehicle"} · {formatDateTime(i.occurred_at)}<span className="block text-muted">{i.description}</span></span>
              <span className="flex items-center gap-2"><StatusBadge status={i.status} />
                {office && <ActionButton size="sm" variant="secondary" requireReason reasonLabel="Resolution" action={async (r) => { "use server"; return updateIncident(i.id, "closed", r); }} confirm={{ title: "Close incident", confirmLabel: "Close" }}>Close</ActionButton>}</span>
            </li>
          ))}</ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">Motorcycles in maintenance or out of service, or with expired insurance/inspection, cannot be booked for sessions. <Link className="underline" href="/staff/schedule">Schedule</Link></p>
    </div>
  );
}
