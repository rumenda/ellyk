"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { createPeriod, createSettlement, recordExpense } from "@/features/finance/actions";
import { todayKE } from "@/lib/format";

type Opt = { id: string; name: string };

export function ExpenseDialog({ categories, locations, vehicles }: { categories: Opt[]; locations: Opt[]; vehicles: Opt[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending, fieldErrors } = useAction(recordExpense, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />Record expense</Button></DialogTrigger>
      <DialogContent title="Record an expense" wide>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(Object.fromEntries(new FormData(e.currentTarget)) as never); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="e-date" required error={fieldErrors.expense_date}><Input id="e-date" name="expense_date" type="date" max={todayKE()} defaultValue={todayKE()} /></Field>
            <Field label="Category" htmlFor="e-cat" required error={fieldErrors.category_id}><Select id="e-cat" name="category_id" defaultValue=""><option value="" disabled>Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Description" htmlFor="e-desc" required error={fieldErrors.description}><Input id="e-desc" name="description" /></Field>
            <Field label="Vendor" htmlFor="e-vendor"><Input id="e-vendor" name="vendor" /></Field>
            <Field label="Amount (KES)" htmlFor="e-amt" required error={fieldErrors.amount}><Input id="e-amt" name="amount" type="number" min="1" step="0.01" /></Field>
            <Field label="Paid from" htmlFor="e-from" required><Select id="e-from" name="paid_from" defaultValue="1000"><option value="1000">M-Pesa Paybill</option><option value="1010">Cash on hand</option><option value="1020">Bank account</option></Select></Field>
            <Field label="Location" htmlFor="e-loc"><Select id="e-loc" name="location_id" defaultValue=""><option value="">School-wide</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <Field label="Motorcycle (fuel/repairs)" htmlFor="e-veh"><Select id="e-veh" name="vehicle_id" defaultValue=""><option value="">Not vehicle-related</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
            <Field label="Reference" htmlFor="e-ref"><Input id="e-ref" name="reference" /></Field>
          </div>
          <Button type="submit" className="w-full" loading={pending}>Record expense</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SettlementDialog() {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(createSettlement, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />Prepare settlement</Button></DialogTrigger>
      <DialogContent title="Prepare a developer settlement" description="Batches every unsettled service-fee collection (and reversal) up to the date you choose.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(String(f.get("end")), String(f.get("notes") || "")); }}>
          <Field label="Include collections up to" htmlFor="st-end" required><Input id="st-end" name="end" type="date" max={todayKE()} defaultValue={todayKE()} /></Field>
          <Field label="Notes" htmlFor="st-notes"><Input id="st-notes" name="notes" /></Field>
          <Button type="submit" className="w-full" loading={pending}>Prepare batch</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PeriodDialog() {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(createPeriod, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary"><Plus />New period</Button></DialogTrigger>
      <DialogContent title="Create fiscal period">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(String(f.get("name")), String(f.get("s")), String(f.get("e"))); }}>
          <Field label="Name" htmlFor="p-n" required><Input id="p-n" name="name" placeholder="2027-01" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" htmlFor="p-s" required><Input id="p-s" name="s" type="date" required /></Field>
            <Field label="Ends" htmlFor="p-e" required><Input id="p-e" name="e" type="date" required /></Field>
          </div>
          <Button type="submit" className="w-full" loading={pending}>Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
