"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveCourse, savePriceDraft } from "@/features/settings/actions";
import { buildSchedule } from "@/lib/finance/schedule";
import { formatDateShort, formatKES, todayKE } from "@/lib/format";

type Opt = { id: string; name: string };
type Item = { component: "registration" | "tuition" | "ntsa" | "service_fee" | "other"; label: string; amount: number; tax_rate_id?: string };

export function CourseDialog({ licenceClasses, locations, course }: {
  licenceClasses: Opt[]; locations: Opt[];
  course?: { id: string; code: string; name: string; licence_class_id: string; description: string | null; duration_weeks: number; theory_sessions: number; practical_sessions: number; is_active: boolean; locationIds: string[] };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending, fieldErrors } = useAction(saveCourse, { onSuccess: (d) => { setOpen(false); if (!course && d) router.push(`/staff/settings/courses/${d.id}`); } });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{course ? <Button size="sm" variant="secondary">Edit course</Button> : <Button><Plus />New course</Button>}</DialogTrigger>
      <DialogContent title={course ? "Edit course" : "New course"} wide>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
          run({ code: String(f.get("code")), name: String(f.get("name")), licence_class_id: String(f.get("lc")), description: String(f.get("desc") || ""),
            duration_weeks: Number(f.get("weeks")), theory_sessions: Number(f.get("theory")), practical_sessions: Number(f.get("practical")),
            is_active: f.get("active") === "on", location_ids: f.getAll("locs").map(String) }, course?.id); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course name" htmlFor="co-n" required error={fieldErrors.name}><Input id="co-n" name="name" defaultValue={course?.name} required /></Field>
            <Field label="Code" htmlFor="co-c" required error={fieldErrors.code}><Input id="co-c" name="code" defaultValue={course?.code} required /></Field>
            <Field label="Licence class" htmlFor="co-l" required><Select id="co-l" name="lc" defaultValue={course?.licence_class_id}>{licenceClasses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <Field label="Duration (weeks)" htmlFor="co-w" required><Input id="co-w" name="weeks" type="number" min={1} defaultValue={course?.duration_weeks ?? 6} /></Field>
            <Field label="Theory sessions" htmlFor="co-t"><Input id="co-t" name="theory" type="number" min={0} defaultValue={course?.theory_sessions ?? 4} /></Field>
            <Field label="Practical lessons" htmlFor="co-p"><Input id="co-p" name="practical" type="number" min={0} defaultValue={course?.practical_sessions ?? 10} /></Field>
          </div>
          <Field label="Description" htmlFor="co-d"><Textarea id="co-d" name="desc" defaultValue={course?.description ?? ""} rows={2} /></Field>
          <fieldset><legend className="text-sm font-medium">Offered at</legend><div className="mt-2 flex flex-wrap gap-4">{locations.map((l) => <label key={l.id} className="flex items-center gap-2 text-sm"><Checkbox name="locs" value={l.id} defaultChecked={course?.locationIds.includes(l.id)} />{l.name}</label>)}</div></fieldset>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="active" defaultChecked={course?.is_active ?? true} />Open for enrolment</label>
          <Button type="submit" className="w-full" loading={pending}>Save course</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PriceDraftEditor({ courseId, taxRates, defaultServiceFee, draft, base }: {
  courseId: string; taxRates: Opt[]; defaultServiceFee: number;
  draft?: { id: string; label: string; effective_from: string; deposit_amount: number; instalment_mode: "count" | "amount"; instalment_count: number | null; instalment_amount: number | null; instalment_frequency: "weekly" | "fortnightly" | "monthly"; min_paid_before_training: number; min_paid_before_ntsa: number; items: Item[] };
  base?: { items: Item[]; deposit_amount: number; instalment_count: number | null; min_paid_before_training: number; min_paid_before_ntsa: number };
}) {
  const [open, setOpen] = useState(false);
  const src = draft ?? base;
  const [items, setItems] = useState<Item[]>(src?.items ?? [
    { component: "registration", label: "Registration fee", amount: 0 }, { component: "tuition", label: "Tuition", amount: 0 },
    { component: "ntsa", label: "NTSA fees", amount: 0 }, { component: "service_fee", label: "Platform service fee", amount: defaultServiceFee },
  ]);
  const [deposit, setDeposit] = useState(src?.deposit_amount ?? 0);
  const [mode, setMode] = useState<"count" | "amount">(draft?.instalment_mode ?? "count");
  const [count, setCount] = useState(src?.instalment_count ?? 6);
  const [amount, setAmount] = useState(draft?.instalment_amount ?? 1500);
  const [freq, setFreq] = useState<"weekly" | "fortnightly" | "monthly">(draft?.instalment_frequency ?? "weekly");
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const preview = useMemo(() => {
    try { return total > 0 ? buildSchedule({ total, deposit, mode, count, amount, frequency: freq, depositDueDate: todayKE() }) : []; } catch { return []; }
  }, [total, deposit, mode, count, amount, freq]);
  const { run, pending } = useAction(savePriceDraft, { onSuccess: () => setOpen(false) });
  const upd = (i: number, patch: Partial<Item>) => setItems((x) => x.map((it, n) => (n === i ? { ...it, ...patch } : it)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{draft ? <Button size="sm" variant="secondary">Edit draft</Button> : <Button size="sm"><Plus />New price version</Button>}</DialogTrigger>
      <DialogContent title={draft ? "Edit draft price" : "New price version"} description="Drafts can be edited freely. Once published, a version is locked; students keep the version they accepted." wide>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
          run(courseId, { label: String(f.get("label")), effective_from: String(f.get("from")), deposit_amount: deposit, instalment_mode: mode, instalment_count: count, instalment_amount: amount,
            instalment_frequency: freq, min_paid_before_training: Number(f.get("mtr")), min_paid_before_ntsa: Number(f.get("mntsa")), items }, draft?.id); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Version label" htmlFor="pv-l" required><Input id="pv-l" name="label" defaultValue={draft?.label ?? `Pricing from ${todayKE()}`} required /></Field>
            <Field label="Effective from" htmlFor="pv-f"><Input id="pv-f" name="from" type="date" defaultValue={draft?.effective_from ?? todayKE()} /></Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Fee items</p>
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="grid grid-cols-12 gap-2">
                  <Select aria-label="Component" className="col-span-12 h-10 sm:col-span-3" value={it.component} onChange={(e) => upd(i, { component: e.target.value as Item["component"] })}>
                    <option value="registration">Registration</option><option value="tuition">Tuition</option><option value="ntsa">NTSA (pass-through)</option><option value="service_fee">Platform service fee</option><option value="other">Other</option>
                  </Select>
                  <Input aria-label="Label" className="col-span-12 h-10 sm:col-span-4" value={it.label} onChange={(e) => upd(i, { label: e.target.value })} />
                  <Input aria-label="Amount" className="col-span-5 h-10 sm:col-span-2" type="number" min={0} value={it.amount} onChange={(e) => upd(i, { amount: Number(e.target.value) })} />
                  <Select aria-label="Tax" className="col-span-5 h-10 sm:col-span-2" value={it.tax_rate_id ?? ""} onChange={(e) => upd(i, { tax_rate_id: e.target.value || undefined })} disabled={it.component === "ntsa" || it.component === "service_fee"}>
                    <option value="">No tax</option>{taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                  <Button type="button" variant="ghost" size="icon" className="col-span-2 h-10 w-full sm:col-span-1" aria-label="Remove item" onClick={() => setItems((x) => x.filter((_, n) => n !== i))}><Trash2 /></Button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between">
              <Button type="button" size="sm" variant="secondary" onClick={() => setItems((x) => [...x, { component: "other", label: "Other charge", amount: 0 }])}><Plus />Add item</Button>
              <p className="text-sm">Total <Money value={total} strong /></p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Deposit" htmlFor="pv-d" required><Input id="pv-d" type="number" min={0} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} /></Field>
            <Field label="Frequency" htmlFor="pv-fr"><Select id="pv-fr" value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)}><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option></Select></Field>
            <Field label="Plan by" htmlFor="pv-m"><Select id="pv-m" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="count">Number of instalments</option><option value="amount">Fixed instalment amount</option></Select></Field>
            {mode === "count" ? <Field label="Instalments" htmlFor="pv-c"><Input id="pv-c" type="number" min={1} max={52} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
              : <Field label="Instalment amount" htmlFor="pv-a"><Input id="pv-a" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>}
            <Field label="Min. paid before training" htmlFor="pv-mtr"><Input id="pv-mtr" name="mtr" type="number" min={0} defaultValue={src?.min_paid_before_training ?? 0} /></Field>
            <Field label="Min. paid before NTSA" htmlFor="pv-mn"><Input id="pv-mn" name="mntsa" type="number" min={0} defaultValue={src?.min_paid_before_ntsa ?? 0} /></Field>
          </div>
          {preview.length > 0 && (
            <div className="rounded-md bg-surface-muted p-3 text-sm">
              <p className="font-medium">Preview (no interest): {formatKES(deposit)} deposit + {preview.length - (deposit > 0 ? 1 : 0)} × {freq} payments</p>
              <p className="mt-1 text-xs text-muted">{preview.slice(0, 8).map((r) => `${formatDateShort(r.due_date)} ${formatKES(r.amount)}`).join(" · ")}{preview.length > 8 ? " …" : ""}</p>
            </div>
          )}
          <Button type="submit" className="w-full" loading={pending} disabled={total <= 0}>Save draft</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
