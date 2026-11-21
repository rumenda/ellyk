import type { Metadata } from "next";
import { RecordForm } from "@/components/forms/record-form";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { saveLocation } from "@/features/settings/actions";
import { requireRole } from "@/lib/auth/session";
import { formatPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Locations" };
const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]] as const;
type Hours = Record<string, { open: string; close: string } | null>;

function LocationFields({ l }: { l?: { code: string; name: string; address: string | null; phone: string | null; capacity: number; is_active: boolean; opening_hours: Hours } }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor={`n-${l?.code}`} required><Input id={`n-${l?.code}`} name="name" defaultValue={l?.name} required /></Field>
        <Field label="Code" htmlFor={`c-${l?.code}`} required><Input id={`c-${l?.code}`} name="code" defaultValue={l?.code} required /></Field>
        <Field label="Phone" htmlFor={`p-${l?.code}`}><Input id={`p-${l?.code}`} name="phone" defaultValue={l?.phone ? formatPhone(l.phone) : ""} /></Field>
        <Field label="Address" htmlFor={`a-${l?.code}`} className="sm:col-span-2"><Input id={`a-${l?.code}`} name="address" defaultValue={l?.address ?? ""} /></Field>
        <Field label="Capacity (students)" htmlFor={`k-${l?.code}`}><Input id={`k-${l?.code}`} name="capacity" type="number" min={1} defaultValue={l?.capacity ?? 40} /></Field>
      </div>
      <fieldset><legend className="text-sm font-medium">Opening hours <span className="font-normal text-muted">(leave blank when closed)</span></legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {DAYS.map(([k, label]) => (
            <div key={k} className="rounded-md border border-border p-2 text-xs"><p className="mb-1 font-medium">{label}</p>
              <Input aria-label={`${label} opens`} name={`${k}_open`} type="time" defaultValue={l?.opening_hours?.[k]?.open ?? ""} className="mb-1 h-8 px-1.5 text-xs" />
              <Input aria-label={`${label} closes`} name={`${k}_close`} type="time" defaultValue={l?.opening_hours?.[k]?.close ?? ""} className="h-8 px-1.5 text-xs" /></div>
          ))}
        </div></fieldset>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="is_active" defaultChecked={l?.is_active ?? true} />Active</label>
    </>
  );
}

export default async function LocationsPage() {
  await requireRole("manager");
  const supabase = await createClient();
  const [{ data: locs }, { data: counts }] = await Promise.all([
    supabase.from("locations").select("*").order("name"),
    supabase.from("enrolments").select("location_id").in("status", ["active", "training_complete", "awaiting_deposit"]),
  ]);
  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader title="Locations" description="Compare performance across locations in Reports → Location comparison." />
      {(locs ?? []).map((l) => {
        const active = (counts ?? []).filter((c) => c.location_id === l.id).length;
        return (
          <Card key={l.id}>
            <CardHeader title={<span className="flex items-center gap-2">{l.name}<StatusBadge status={l.is_active ? "active" : "closed"} label={l.is_active ? "Active" : "Inactive"} /></span>} description={`${active} active students · capacity ${l.capacity}`} />
            <CardBody><RecordForm action={async (f) => { "use server"; return saveLocation(f, l.id); }}><LocationFields l={{ ...l, opening_hours: l.opening_hours as Hours }} /></RecordForm></CardBody>
          </Card>
        );
      })}
      <Card><CardHeader title="Add a location" /><CardBody><RecordForm action={async (f) => { "use server"; return saveLocation(f); }} submitLabel="Add location"><LocationFields /></RecordForm></CardBody></Card>
    </div>
  );
}
