"use client";
import { useState } from "react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { ntsaTransition, recordNtsaPayment, recordTestResult } from "@/features/ntsa/actions";
import { formatKES, todayKE } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["ntsa_status"];

export function TransitionDialog({ processId, to, label, fields, variant = "primary" }: {
  processId: string; to: Status; label: string; fields?: ("booking_reference" | "test_date" | "test_centre")[]; variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(ntsaTransition, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant={variant}>{label}</Button></DialogTrigger>
      <DialogContent title={label}>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const details: Record<string, string> = {};
          for (const k of fields ?? []) details[k] = String(f.get(k) ?? "");
          run(processId, to, String(f.get("note") || "") || undefined, details);
        }}>
          {fields?.includes("booking_reference") && <Field label="NTSA booking reference" htmlFor="t-ref" required><Input id="t-ref" name="booking_reference" required /></Field>}
          {fields?.includes("test_date") && <Field label="Test date & time" htmlFor="t-date" required><Input id="t-date" name="test_date" type="datetime-local" required /></Field>}
          {fields?.includes("test_centre") && <Field label="Test centre" htmlFor="t-centre" required><Input id="t-centre" name="test_centre" placeholder="e.g. NTSA Likoni Road Test Centre" required /></Field>}
          <Field label="Note (optional)" htmlFor="t-note"><Textarea id="t-note" name="note" rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Confirm</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NtsaPaymentDialog({ processId, due, held }: { processId: string; due: number; held: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(due);
  const { run, pending } = useAction(recordNtsaPayment, { onSuccess: () => setOpen(false) });
  const advancing = amount > held;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Record NTSA payment</Button></DialogTrigger>
      <DialogContent title="Record payment made to NTSA" description={`Funds held for this student: ${formatKES(held)}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(processId, amount, String(f.get("paid_on")), String(f.get("reference")), String(f.get("from")), String(f.get("override") || "")); }}>
          <Alert tone="info">Record this after paying on eCitizen/NTSA. The app does not pay NTSA directly.</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (KES)" htmlFor="n-amt" required><Input id="n-amt" type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
            <Field label="Date paid" htmlFor="n-date" required><Input id="n-date" name="paid_on" type="date" max={todayKE()} defaultValue={todayKE()} /></Field>
            <Field label="eCitizen / NTSA reference" htmlFor="n-ref" required><Input id="n-ref" name="reference" required /></Field>
            <Field label="Paid from" htmlFor="n-from"><Select id="n-from" name="from" defaultValue="1000"><option value="1000">M-Pesa Paybill</option><option value="1020">Bank account</option><option value="1010">Cash</option></Select></Field>
          </div>
          {advancing && <Field label="Reason for advancing school funds" htmlFor="n-ovr" required hint="The amount exceeds NTSA funds collected from this student."><Textarea id="n-ovr" name="override" required minLength={5} rows={2} /></Field>}
          <Button type="submit" className="w-full" loading={pending}>Record payment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TestResultDialog({ processId }: { processId: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(recordTestResult, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Record test result</Button></DialogTrigger>
      <DialogContent title="Record NTSA test result">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(processId, f.get("result") as "passed", String(f.get("notes") || "")); }}>
          <Field label="Result" htmlFor="tr-r" required><Select id="tr-r" name="result" defaultValue="passed"><option value="passed">Passed</option><option value="failed">Failed – retest required</option><option value="absent">Absent</option></Select></Field>
          <Field label="Examiner notes" htmlFor="tr-n"><Textarea id="tr-n" name="notes" rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Save result</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
