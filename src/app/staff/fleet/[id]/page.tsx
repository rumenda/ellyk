import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { Money } from "@/components/money";
import { FuelDialog, MaintenanceDialog, VehicleDialog } from "@/components/staff/ops-forms";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { setVehicleStatus } from "@/features/ops/actions";
import { getLocations } from "@/features/staff/lookups";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDate, formatDateShort, formatDateTime, formatTime, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Motorcycle" };

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("manager", "admin", "instructor");
  const { id } = await params;
  const office = hasRole(user, "manager", "admin");
  const supabase = await createClient();
  const { data: v } = await supabase.from("vehicles").select("*, location:locations(name)").eq("id", id).maybeSingle();
  if (!v) notFound();
  const [locations, { data: maint }, { data: fuel }, { data: incidents }, { data: bookings }] = await Promise.all([
    office ? getLocations() : Promise.resolve([]),
    supabase.from("vehicle_maintenance").select("*").eq("vehicle_id", id).order("performed_on", { ascending: false }),
    supabase.from("fuel_logs").select("*").eq("vehicle_id", id).order("filled_on", { ascending: false }).limit(10),
    supabase.from("vehicle_incidents").select("*").eq("vehicle_id", id).order("occurred_at", { ascending: false }),
    supabase.from("session_bookings").select("id, session:training_sessions!inner(id, title, starts_at)").eq("vehicle_id", id).eq("is_live", true).gte("session.starts_at", new Date().toISOString()).limit(10),
  ]);
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Fleet", href: "/staff/fleet" }, { label: v.registration }]}
        title={<span className="flex items-center gap-2">{v.registration}<StatusBadge status={v.status} /></span>}
        description={`${v.asset_number} · ${v.make} ${v.model} ${v.year ?? ""} · ${v.engine_cc ?? "?"}cc · ${v.location?.name}`}
        actions={<>
          <FuelDialog vehicleId={id} />
          {office && <MaintenanceDialog vehicleId={id} odometer={v.odometer_km} />}
          {office && <VehicleDialog locations={locations.map((l) => ({ id: l.id, name: l.name }))} vehicle={v as unknown as Record<string, string>} />}
          {office && v.status !== "maintenance" && <ActionButton size="sm" variant="secondary" requireReason reasonLabel="What's wrong?" action={async (r) => { "use server"; return setVehicleStatus(id, "maintenance", r); }} confirm={{ title: "Send to maintenance?", description: "It will be blocked from new bookings.", confirmLabel: "Send" }}>To maintenance</ActionButton>}
          {office && v.status === "maintenance" && <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return setVehicleStatus(id, "available"); }}>Back in service</ActionButton>}
        </>} />
      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-5 lg:col-span-2">
          <Card><CardHeader title="Service & repair history" />
            <ul className="divide-y divide-border text-sm">{(maint ?? []).map((m) => (
              <li key={m.id} className="flex justify-between gap-3 px-4 py-3 sm:px-5"><span><span className="font-medium">{humanize(m.maintenance_type)}</span> · {formatDate(m.performed_on)}<span className="block text-muted">{m.description}{m.vendor ? ` · ${m.vendor}` : ""}</span></span><Money value={m.cost} /></li>
            ))}{(maint ?? []).length === 0 && <li className="px-5 py-3 text-muted">No records yet.</li>}</ul>
          </Card>
          <Card><CardHeader title="Incidents" />
            <ul className="divide-y divide-border text-sm">{(incidents ?? []).map((i) => (
              <li key={i.id} className="px-4 py-3 sm:px-5"><span className="font-medium">{humanize(i.severity)}</span> · {formatDateTime(i.occurred_at)} <StatusBadge status={i.status} /><span className="block text-muted">{i.description}</span></li>
            ))}{(incidents ?? []).length === 0 && <li className="px-5 py-3 text-muted">No incidents.</li>}</ul>
          </Card>
        </div>
        <div className="space-y-5">
          <Card><CardHeader title="Compliance" /><CardBody className="space-y-1.5 text-sm">
            <p><span className="text-muted">Odometer:</span> {v.odometer_km.toLocaleString("en-KE")} km</p>
            <p><span className="text-muted">Next service:</span> {formatDate(v.next_service_date)}{v.next_service_km ? ` or ${v.next_service_km.toLocaleString("en-KE")} km` : ""}</p>
            <p><span className="text-muted">Insurance expiry:</span> {formatDate(v.insurance_expiry)}</p>
            <p><span className="text-muted">Inspection expiry:</span> {formatDate(v.inspection_expiry)}</p>
            {v.notes && <p className="pt-2 text-muted">{v.notes}</p>}
          </CardBody></Card>
          <Card><CardHeader title="Upcoming sessions" />
            <ul className="divide-y divide-border text-sm">{(bookings ?? []).map((b) => <li key={b.id} className="px-4 py-2.5 sm:px-5">{b.session?.title}<span className="block text-xs text-muted">{formatDateShort(b.session!.starts_at)} {formatTime(b.session!.starts_at)}</span></li>)}
              {(bookings ?? []).length === 0 && <li className="px-5 py-3 text-muted">Not booked.</li>}</ul>
          </Card>
          <Card><CardHeader title="Fuel" />
            <ul className="divide-y divide-border text-sm">{(fuel ?? []).map((f) => <li key={f.id} className="flex justify-between px-4 py-2 sm:px-5"><span>{formatDate(f.filled_on)} · {f.litres} L</span><Money value={f.cost} /></li>)}
              {(fuel ?? []).length === 0 && <li className="px-5 py-3 text-muted">No fuel logged.</li>}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
