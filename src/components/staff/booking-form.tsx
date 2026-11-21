"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select } from "@/components/ui/input";
import { addBooking } from "@/features/schedule/actions";

export function BookingForm({ sessionId, candidates, vehicles, needsVehicle, canOverride }: {
  sessionId: string; candidates: { enrolmentId: string; label: string; gateMet: boolean }[];
  vehicles: { id: string; label: string }[]; needsVehicle: boolean; canOverride: boolean;
}) {
  const [enr, setEnr] = useState("");
  const [veh, setVeh] = useState("");
  const [override, setOverride] = useState(false);
  const { run, pending } = useAction(addBooking, { onSuccess: () => { setEnr(""); setVeh(""); setOverride(false); } });
  const sel = candidates.find((c) => c.enrolmentId === enr);
  if (candidates.length === 0) return <p className="text-sm text-muted">No other active students at this location are available to book.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(sessionId, enr, veh || null, override); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Student" htmlFor="b-enr"><Select id="b-enr" value={enr} onChange={(e) => setEnr(e.target.value)} required>
          <option value="">Choose a student…</option>
          {candidates.map((c) => <option key={c.enrolmentId} value={c.enrolmentId}>{c.label}{c.gateMet ? "" : " – payment gate not met"}</option>)}
        </Select></Field>
        {needsVehicle && <Field label="Motorcycle" htmlFor="b-veh"><Select id="b-veh" value={veh} onChange={(e) => setVeh(e.target.value)}>
          <option value="">No motorcycle</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </Select></Field>}
      </div>
      {sel && !sel.gateMet && (canOverride
        ? <label className="flex items-center gap-2 text-sm"><Checkbox checked={override} onChange={(e) => setOverride(e.target.checked)} />Override minimum payment rule (manager, audited)</label>
        : <p className="text-sm text-warning-700">This student hasn&apos;t paid the minimum required before training. Ask a manager to override.</p>)}
      <Button type="submit" size="sm" loading={pending} disabled={!enr || (sel && !sel.gateMet && !override)}><UserPlus />Book student</Button>
    </form>
  );
}
