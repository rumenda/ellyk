"use client";
import { useState } from "react";
import { AlertOctagon } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { reportIncident } from "@/features/schedule/actions";

export function IncidentDialog({ vehicles, sessionId }: { vehicles: { id: string; label: string }[]; sessionId?: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(reportIncident, { onSuccess: () => setOpen(false) });
  const [now] = useState(() => new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 16));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary" size="sm"><AlertOctagon />Report incident</Button></DialogTrigger>
      <DialogContent title="Report an incident" description="Falls, damage, near misses or injuries. The office is notified.">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run({ vehicle_id: String(f.get("vehicle_id") || ""), session_id: sessionId, occurred_at: `${f.get("occurred_at")}:00+03:00`,
            severity: f.get("severity") as "minor", description: String(f.get("description")), injuries: f.get("injuries") === "on" });
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Motorcycle" htmlFor="i-veh"><Select id="i-veh" name="vehicle_id" defaultValue=""><option value="">None / not applicable</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</Select></Field>
            <Field label="Severity" htmlFor="i-sev" required><Select id="i-sev" name="severity" defaultValue="minor"><option value="minor">Minor</option><option value="moderate">Moderate</option><option value="major">Major</option></Select></Field>
            <Field label="When" htmlFor="i-when" required><Input id="i-when" name="occurred_at" type="datetime-local" defaultValue={now} /></Field>
          </div>
          <Field label="What happened?" htmlFor="i-desc" required><Textarea id="i-desc" name="description" rows={3} required minLength={10} /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="injuries" />Someone was injured</label>
          <Button type="submit" className="w-full" loading={pending}>Submit report</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
