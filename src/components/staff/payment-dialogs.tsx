"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { createAdjustment, findStudents, matchPayment, reassignPayment, recordManualPayment, requestRefund, waiveInstalment } from "@/features/payments/actions";
import { formatKES, todayKE } from "@/lib/format";

export function RecordPaymentDialog({ studentId, isFinance, trigger }: { studentId: string; isFinance: boolean; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { run, pending, fieldErrors } = useAction(recordManualPayment, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm" variant="secondary"><Plus />Record cash/bank payment</Button>}</DialogTrigger>
      <DialogContent title="Record a payment" description="M-Pesa Paybill payments are recorded automatically – use this only for cash or bank transfers.">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run({ student_id: studentId, amount: Number(f.get("amount")), source: f.get("source") as "cash", reference: String(f.get("reference") ?? ""),
            received_at: String(f.get("received_at")), notes: String(f.get("notes") ?? "") });
        }}>
          {!isFinance && <Alert tone="info">Your entry will be checked and confirmed by the accountant before it counts towards the balance.</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (KES)" htmlFor="pay-amount" required error={fieldErrors.amount}><Input id="pay-amount" name="amount" type="number" inputMode="decimal" min="1" step="1" required /></Field>
            <Field label="Method" htmlFor="pay-source" required>
              <Select id="pay-source" name="source" defaultValue="cash"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></Select>
            </Field>
            <Field label="Date received" htmlFor="pay-date" required><Input id="pay-date" name="received_at" type="date" max={todayKE()} defaultValue={todayKE()} required /></Field>
            <Field label="Reference" htmlFor="pay-ref" hint="Cash book page or bank ref"><Input id="pay-ref" name="reference" /></Field>
          </div>
          <Field label="Notes" htmlFor="pay-notes"><Textarea id="pay-notes" name="notes" rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Record payment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudentPicker({ onPick }: { onPick: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<{ id: string; label: string }[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(async () => setOpts(await findStudents(q)), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-2">
      <Input placeholder="Search name, phone or student number" value={q} onChange={(e) => { setQ(e.target.value); setSel(null); onPick(null); }} aria-label="Find student" />
      <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
        {opts.length === 0 && <li className="px-3 py-2 text-sm text-muted">{q.length < 2 ? "Type to search" : "No students found"}</li>}
        {opts.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => { setSel(o.id); onPick(o.id); }} className={`w-full px-3 py-2 text-left text-sm ${sel === o.id ? "bg-brand-50 font-medium text-brand-800" : "hover:bg-surface-muted"}`}>{o.label}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchPaymentDialog({ paymentId, amount, reference, mode }: { paymentId: string; amount: number; reference: string; mode: "match" | "reassign" }) {
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const action = useAction(mode === "match" ? matchPayment : reassignPayment, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant={mode === "match" ? "primary" : "secondary"}>{mode === "match" ? "Match to student" : "Move to another student"}</Button></DialogTrigger>
      <DialogContent title={mode === "match" ? "Match payment to a student" : "Reassign payment"} description={`${formatKES(amount)} · ${reference}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (student) action.run(paymentId, student, note); }}>
          <StudentPicker onPick={setStudent} />
          <Field label={mode === "match" ? "How did you confirm this?" : "Reason"} htmlFor="match-note" required hint="Recorded in the reconciliation audit trail">
            <Textarea id="match-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Student showed M-Pesa SMS at front desk" />
          </Field>
          <Button type="submit" className="w-full" loading={action.pending} disabled={!student || note.trim().length < 5}>Confirm</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdjustmentDialog({ lines }: { lines: { id: string; label: string; outstanding: number }[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(createAdjustment, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Post adjustment</Button></DialogTrigger>
      <DialogContent title="Post a financial adjustment" description="Creates a credit/debit note and a balanced journal entry. Cannot be edited afterwards.">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run({ invoice_line_id: String(f.get("line")), type: f.get("type") as "credit_note", amount: Number(f.get("amount")), reason: String(f.get("reason")) });
        }}>
          <Field label="Fee line" htmlFor="adj-line" required>
            <Select id="adj-line" name="line">{lines.map((l) => <option key={l.id} value={l.id}>{l.label} – {formatKES(l.outstanding)} unpaid</option>)}</Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="adj-type" required>
              <Select id="adj-type" name="type"><option value="credit_note">Credit note (reduce)</option><option value="waiver">Waiver (reduce)</option>
                <option value="write_off">Write-off (bad debt)</option><option value="debit_note">Debit note (increase)</option></Select>
            </Field>
            <Field label="Amount (KES)" htmlFor="adj-amount" required><Input id="adj-amount" name="amount" type="number" min="1" step="0.01" required /></Field>
          </div>
          <Field label="Reason" htmlFor="adj-reason" required><Textarea id="adj-reason" name="reason" required minLength={5} rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Post adjustment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WaiveDialog({ instalmentId, outstanding, label }: { instalmentId: string; outstanding: number; label: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(waiveInstalment, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button className="text-xs font-medium text-brand-700 hover:underline">Waive</button></DialogTrigger>
      <DialogContent title={`Waive ${label}`} description={`Up to ${formatKES(outstanding)} unpaid. Posts a waiver credit note against tuition.`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(instalmentId, Number(f.get("amount")), String(f.get("reason"))); }}>
          <Field label="Amount (KES)" htmlFor="w-amount" required><Input id="w-amount" name="amount" type="number" min="1" max={outstanding} step="0.01" defaultValue={outstanding} required /></Field>
          <Field label="Reason" htmlFor="w-reason" required><Textarea id="w-reason" name="reason" required minLength={5} rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Waive</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RefundRequestDialog({ studentId, credit }: { studentId: string; credit: number }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(requestRefund, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Request refund</Button></DialogTrigger>
      <DialogContent title="Request a refund" description={`Available credit: ${formatKES(credit)}. A second finance user must approve it.`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(studentId, Number(f.get("amount")), String(f.get("reason")), f.get("method") as "mpesa"); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (KES)" htmlFor="r-amount" required><Input id="r-amount" name="amount" type="number" min="1" max={credit} step="0.01" defaultValue={credit} required /></Field>
            <Field label="Pay out by" htmlFor="r-method" required><Select id="r-method" name="method"><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option></Select></Field>
          </div>
          <Field label="Reason" htmlFor="r-reason" required><Textarea id="r-reason" name="reason" required minLength={5} rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Submit request</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
