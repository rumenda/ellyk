"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { addTimeOff, logFuel, logMaintenance, saveVehicle, setAvailability, setInstructorLocations } from "@/features/ops/actions";
import { todayKE } from "@/lib/format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Opt = { id: string; name: string };

export function AvailabilityForm({ instructorId, locations, current }: { instructorId: string; locations: Opt[]; current: { location_id: string; weekday: number; start_time: string; end_time: string }[] }) {
  const [loc, setLoc] = useState(locations[0]?.id ?? "");
  const mine = current.filter((c) => c.location_id === loc);
  const [days, setDays] = useState<number[]>(mine.map((m) => m.weekday));
  const { run, pending } = useAction(setAvailability);
  return (
    <form key={loc} className="space-y-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(instructorId, loc, days, String(f.get("start")), String(f.get("end"))); }}>
      <Select aria-label="Location" value={loc} onChange={(e) => { setLoc(e.target.value); setDays(current.filter((c) => c.location_id === e.target.value).map((m) => m.weekday)); }}>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </Select>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d, i) => (
          <button type="button" key={d} aria-pressed={days.includes(i)} onClick={() => setDays((x) => x.includes(i) ? x.filter((y) => y !== i) : [...x, i])}
            className={`h-10 w-12 rounded-md border text-sm font-medium ${days.includes(i) ? "border-brand-600 bg-brand-600 text-white" : "border-border-strong text-muted"}`}>{d}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="av-s"><Input id="av-s" name="start" type="time" defaultValue={mine[0]?.start_time.slice(0, 5) ?? "07:30"} /></Field>
        <Field label="To" htmlFor="av-e"><Input id="av-e" name="end" type="time" defaultValue={mine[0]?.end_time.slice(0, 5) ?? "17:30"} /></Field>
      </div>
      <Button type="submit" size="sm" loading={pending}>Save availability</Button>
    </form>
  );
}

export function LocationsForm({ instructorId, locations, current }: { instructorId: string; locations: Opt[]; current: string[] }) {
  const [sel, setSel] = useState(current);
  const { run, pending } = useAction(setInstructorLocations);
  return (
    <div className="space-y-2">
      {locations.map((l) => <label key={l.id} className="flex items-center gap-2 text-sm"><Checkbox checked={sel.includes(l.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id))} />{l.name}</label>)}
      <Button size="sm" variant="secondary" loading={pending} onClick={() => run(instructorId, sel)}>Save locations</Button>
    </div>
  );
}

export function TimeOffDialog({ instructorId }: { instructorId: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(addTimeOff, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus />Leave / unavailable</Button></DialogTrigger>
      <DialogContent title="Record leave">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(instructorId, String(f.get("s")), String(f.get("e")), String(f.get("r"))); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="to-s" required><Input id="to-s" name="s" type="date" defaultValue={todayKE()} /></Field>
            <Field label="To" htmlFor="to-e" required><Input id="to-e" name="e" type="date" defaultValue={todayKE()} /></Field>
          </div>
          <Field label="Reason" htmlFor="to-r"><Input id="to-r" name="r" /></Field>
          <Button type="submit" className="w-full" loading={pending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VehicleDialog({ locations, vehicle }: { locations: Opt[]; vehicle?: Record<string, string | number | null> }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(saveVehicle, { onSuccess: () => setOpen(false) });
  const v = (k: string) => (vehicle?.[k] ?? "") as string;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size={vehicle ? "sm" : "md"} variant={vehicle ? "secondary" : "primary"}>{vehicle ? "Edit" : <><Plus />Add motorcycle</>}</Button></DialogTrigger>
      <DialogContent title={vehicle ? "Edit motorcycle" : "Add motorcycle"} wide>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>, vehicle?.id as string | undefined); }}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Asset no." htmlFor="v-a" required><Input id="v-a" name="asset_number" defaultValue={v("asset_number")} required /></Field>
            <Field label="Registration" htmlFor="v-r" required><Input id="v-r" name="registration" defaultValue={v("registration")} required placeholder="KMGA 123A" /></Field>
            <Field label="Location" htmlFor="v-l" required><Select id="v-l" name="location_id" defaultValue={v("location_id")}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <Field label="Make" htmlFor="v-mk" required><Input id="v-mk" name="make" defaultValue={v("make")} required /></Field>
            <Field label="Model" htmlFor="v-md" required><Input id="v-md" name="model" defaultValue={v("model")} required /></Field>
            <Field label="Year" htmlFor="v-y"><Input id="v-y" name="year" type="number" defaultValue={v("year")} /></Field>
            <Field label="Engine (cc)" htmlFor="v-cc"><Input id="v-cc" name="engine_cc" type="number" defaultValue={v("engine_cc")} /></Field>
            <Field label="Odometer (km)" htmlFor="v-o"><Input id="v-o" name="odometer_km" type="number" defaultValue={v("odometer_km")} /></Field>
            <Field label="Next service (km)" htmlFor="v-nk"><Input id="v-nk" name="next_service_km" type="number" defaultValue={v("next_service_km")} /></Field>
            <Field label="Next service date" htmlFor="v-nd"><Input id="v-nd" name="next_service_date" type="date" defaultValue={v("next_service_date")} /></Field>
            <Field label="Insurance expiry" htmlFor="v-ie"><Input id="v-ie" name="insurance_expiry" type="date" defaultValue={v("insurance_expiry")} /></Field>
            <Field label="Inspection expiry" htmlFor="v-ix"><Input id="v-ix" name="inspection_expiry" type="date" defaultValue={v("inspection_expiry")} /></Field>
          </div>
          <Field label="Notes" htmlFor="v-n"><Textarea id="v-n" name="notes" rows={2} defaultValue={v("notes")} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MaintenanceDialog({ vehicleId, odometer }: { vehicleId: string; odometer: number }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(logMaintenance, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus />Log service / repair</Button></DialogTrigger>
      <DialogContent title="Log maintenance" wide>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(vehicleId, Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>); }}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="m-t"><Select id="m-t" name="maintenance_type" defaultValue="service"><option value="service">Service</option><option value="repair">Repair</option><option value="inspection">Inspection</option><option value="tyres">Tyres</option><option value="other">Other</option></Select></Field>
            <Field label="Date" htmlFor="m-d"><Input id="m-d" name="performed_on" type="date" defaultValue={todayKE()} max={todayKE()} /></Field>
            <Field label="Odometer (km)" htmlFor="m-o"><Input id="m-o" name="odometer_km" type="number" defaultValue={odometer} /></Field>
            <Field label="Cost (KES)" htmlFor="m-c" hint="Record payment under Finance → Expenses"><Input id="m-c" name="cost" type="number" min={0} /></Field>
            <Field label="Vendor / mechanic" htmlFor="m-v"><Input id="m-v" name="vendor" /></Field>
            <Field label="Next service date" htmlFor="m-nd"><Input id="m-nd" name="next_service_date" type="date" /></Field>
          </div>
          <Field label="Work done" htmlFor="m-desc" required><Textarea id="m-desc" name="description" rows={2} required /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="return_to_service" />Return motorcycle to service (status: available)</label>
          <Button type="submit" className="w-full" loading={pending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FuelDialog({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(logFuel, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Log fuel</Button></DialogTrigger>
      <DialogContent title="Log fuel">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(vehicleId, Number(f.get("l")), Number(f.get("c")), f.get("o") ? Number(f.get("o")) : undefined); }}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Litres" htmlFor="f-l" required><Input id="f-l" name="l" type="number" step="0.1" min="0.1" required /></Field>
            <Field label="Cost" htmlFor="f-c" required><Input id="f-c" name="c" type="number" min="0" required /></Field>
            <Field label="Odometer" htmlFor="f-o"><Input id="f-o" name="o" type="number" /></Field>
          </div>
          <Button type="submit" className="w-full" loading={pending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
