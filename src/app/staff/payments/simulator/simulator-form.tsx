"use client";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { simulateC2B } from "@/features/payments/mpesa-actions";

export function SimulatorForm({ paybill }: { paybill: string }) {
  const { run, pending } = useAction(simulateC2B);
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      run({ account: String(f.get("account")), amount: Number(f.get("amount")), phone: String(f.get("phone")), name: String(f.get("name")) });
    }}>
      <Field label="Paybill" htmlFor="sim-pb"><Input id="sim-pb" value={paybill} readOnly /></Field>
      <Field label="Account number" htmlFor="sim-acc" hint="A student number (e.g. EK00004), or anything else to test unmatched"><Input id="sim-acc" name="account" required /></Field>
      <Field label="Amount (KES)" htmlFor="sim-amt"><Input id="sim-amt" name="amount" type="number" min={1} defaultValue={1000} required /></Field>
      <Field label="Payer phone" htmlFor="sim-ph"><Input id="sim-ph" name="phone" defaultValue="254708374149" /></Field>
      <Field label="Payer first name" htmlFor="sim-nm"><Input id="sim-nm" name="name" defaultValue="JOHN" /></Field>
      <div className="flex items-end"><Button type="submit" className="w-full" loading={pending}>Send sandbox payment</Button></div>
    </form>
  );
}
