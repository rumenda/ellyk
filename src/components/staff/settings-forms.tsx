"use client";
import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { createStaffUser, postAnnouncement, saveCompetency, saveSequence, saveTaxRate, saveTemplate, setUserLocations, setUserRoles } from "@/features/settings/actions";

export function SequenceRow({ seq }: { seq: { key: string; prefix: string; padding: number; include_year: boolean; next_value: number } }) {
  const [prefix, setPrefix] = useState(seq.prefix);
  const { run, pending } = useAction(saveSequence);
  const sample = `${prefix}${seq.include_year ? `-${new Date().getFullYear()}-` : ""}${String(seq.next_value).padStart(seq.padding, "0")}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm sm:px-5">
      <span className="w-24 capitalize text-muted">{seq.key}</span>
      <Input aria-label={`${seq.key} prefix`} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} className="h-9 w-24" maxLength={6} />
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">Next: {sample}</span>
      <Button size="sm" variant="secondary" loading={pending} disabled={prefix === seq.prefix} onClick={() => run(seq.key, prefix, seq.padding)}>Save</Button>
    </li>
  );
}

export function TaxRateForm({ rate }: { rate?: { id: string; code: string; name: string; rate: number; etims_tax_type: string | null } }) {
  const { run, pending } = useAction(saveTaxRate);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(String(f.get("code")), String(f.get("name")), Number(f.get("rate")), String(f.get("etims")), rate?.id); }}>
      <Input name="code" aria-label="Code" defaultValue={rate?.code} placeholder="VAT16" className="h-9 w-24" required />
      <Input name="name" aria-label="Name" defaultValue={rate?.name} placeholder="VAT 16%" className="h-9 min-w-0 flex-1" required />
      <Input name="rate" aria-label="Rate %" type="number" step="0.01" defaultValue={rate ? rate.rate * 100 : ""} placeholder="%" className="h-9 w-20" required />
      <Input name="etims" aria-label="eTIMS type" defaultValue={rate?.etims_tax_type ?? ""} placeholder="eTIMS" className="h-9 w-20" />
      <Button size="sm" variant={rate ? "secondary" : "primary"} loading={pending}>{rate ? "Save" : <><Plus />Add</>}</Button>
    </form>
  );
}

export function CompetencyForm({ licenceClasses, item, nextOrder }: { licenceClasses: { id: string; name: string }[]; nextOrder: number; item?: { id: string; code: string; name: string; category: string; licence_class_id: string | null; required_for_test: boolean; sort_order: number } }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(saveCompetency, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{item ? <Button size="sm" variant="ghost">Edit</Button> : <Button><Plus />Add competency</Button>}</DialogTrigger>
      <DialogContent title={item ? "Edit competency" : "Add competency"}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
          run({ code: String(f.get("code")), name: String(f.get("name")), category: String(f.get("category")), licence_class_id: String(f.get("lc") || ""), required_for_test: f.get("req") === "on", sort_order: Number(f.get("order")) }, item?.id); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="c-name" required><Input id="c-name" name="name" defaultValue={item?.name} required /></Field>
            <Field label="Code" htmlFor="c-code" required><Input id="c-code" name="code" defaultValue={item?.code} required /></Field>
            <Field label="Category" htmlFor="c-cat"><Input id="c-cat" name="category" defaultValue={item?.category ?? "Road craft"} /></Field>
            <Field label="Licence class" htmlFor="c-lc"><Select id="c-lc" name="lc" defaultValue={item?.licence_class_id ?? ""}><option value="">All classes</option>{licenceClasses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <Field label="Order" htmlFor="c-ord"><Input id="c-ord" name="order" type="number" defaultValue={item?.sort_order ?? nextOrder} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="req" defaultChecked={item?.required_for_test ?? true} />Required before the NTSA test</label>
          <Button type="submit" className="w-full" loading={pending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateEditor({ t }: { t: { id: string; key: string; channel: string; title: string; body: string; is_active: boolean; description: string | null } }) {
  const [title, setTitle] = useState(t.title);
  const [body, setBody] = useState(t.body);
  const [active, setActive] = useState(t.is_active);
  const { run, pending } = useAction(saveTemplate);
  const vars = [...new Set(body.match(/\{\{\w+\}\}/g) ?? [])];
  return (
    <form className="space-y-2 px-5 py-4" onSubmit={(e) => { e.preventDefault(); run(t.id, title, body, active); }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{t.key.replace(/_/g, " ")} <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs uppercase text-muted">{t.channel.replace("_", "-")}</span></p>
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />Active</label>
      </div>
      {t.description && <p className="text-xs text-muted">{t.description}</p>}
      <Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
      <Textarea aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted">{body.length}/480 · Placeholders: {vars.join(" ") || "none"}</p>
        <Button size="sm" variant="secondary" loading={pending} disabled={title === t.title && body === t.body && active === t.is_active}>Save</Button></div>
    </form>
  );
}

export function AnnouncementForm({ locations }: { locations: { id: string; name: string }[] }) {
  const { run, pending } = useAction(postAnnouncement);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(String(f.get("title")), String(f.get("body")), f.get("aud") as "students", String(f.get("loc") || "") || null, f.get("imp") === "on"); (e.target as HTMLFormElement).reset(); }}>
      <Input name="title" aria-label="Title" placeholder="Title" required />
      <Textarea name="body" aria-label="Message" placeholder="Message" rows={3} required />
      <div className="flex flex-wrap gap-2">
        <Select name="aud" aria-label="Audience" className="h-10 w-auto"><option value="students">Students</option><option value="staff">Staff</option><option value="everyone">Everyone</option></Select>
        <Select name="loc" aria-label="Location" className="h-10 w-auto"><option value="">All locations</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
        <label className="flex items-center gap-2 text-sm"><Checkbox name="imp" />Important</label>
        <Button type="submit" size="sm" className="h-10" loading={pending}>Publish</Button>
      </div>
    </form>
  );
}

const ROLES = [["manager", "Manager"], ["admin", "Administrator / reception"], ["accountant", "Accountant"], ["instructor", "Instructor"]] as const;

export function CreateUserDialog({ locations }: { locations: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const { run, pending, fieldErrors } = useAction(createStaffUser, { onSuccess: (d) => setTemp(d?.password ?? null) });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTemp(null); }}>
      <DialogTrigger asChild><Button><Plus />Add staff member</Button></DialogTrigger>
      <DialogContent title="Add a staff member" description="They'll be asked to set their own password at first sign-in." wide>
        {temp ? (
          <div className="space-y-3">
            <p className="text-sm">Account created. Share this temporary password privately:</p>
            <div className="flex items-center justify-between rounded-md bg-surface-muted px-4 py-3"><code className="text-lg font-semibold">{temp}</code>
              <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(temp); toast.success("Copied"); }}><Copy />Copy</Button></div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
            run({ full_name: String(f.get("name")), email: String(f.get("email")), phone: String(f.get("phone") || ""), employee_number: String(f.get("emp")), job_title: String(f.get("title") || ""),
              roles: f.getAll("roles").map(String) as never, location_ids: f.getAll("locs").map(String) }); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="u-name" required error={fieldErrors.full_name}><Input id="u-name" name="name" required /></Field>
              <Field label="Work email" htmlFor="u-email" required error={fieldErrors.email}><Input id="u-email" name="email" type="email" required /></Field>
              <Field label="Phone" htmlFor="u-phone"><Input id="u-phone" name="phone" type="tel" /></Field>
              <Field label="Employee number" htmlFor="u-emp" required error={fieldErrors.employee_number}><Input id="u-emp" name="emp" required /></Field>
              <Field label="Job title" htmlFor="u-title"><Input id="u-title" name="title" /></Field>
            </div>
            <fieldset><legend className="text-sm font-medium">Roles</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{ROLES.map(([v, l]) => <label key={v} className="flex items-center gap-2 text-sm"><Checkbox name="roles" value={v} />{l}</label>)}</div>
              {fieldErrors.roles && <p className="mt-1 text-sm text-danger-700">{fieldErrors.roles[0]}</p>}</fieldset>
            <fieldset><legend className="text-sm font-medium">Locations <span className="font-normal text-muted">(admins and instructors only see these)</span></legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">{locations.map((l) => <label key={l.id} className="flex items-center gap-2 text-sm"><Checkbox name="locs" value={l.id} />{l.name}</label>)}</div></fieldset>
            <Button type="submit" className="w-full" loading={pending}>Create account</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UserAccessForm({ userId, roles, locationIds, locations }: { userId: string; roles: string[]; locationIds: string[]; locations: { id: string; name: string }[] }) {
  const [r, setR] = useState(roles);
  const [l, setL] = useState(locationIds);
  const saveR = useAction(setUserRoles);
  const saveL = useAction(setUserLocations);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2">{ROLES.map(([v, label]) => <label key={v} className="flex items-center gap-2 text-sm"><Checkbox checked={r.includes(v)} onChange={(e) => setR((x) => e.target.checked ? [...x, v] : x.filter((y) => y !== v))} />{label}</label>)}</div>
      <Button size="sm" variant="secondary" loading={saveR.pending} onClick={() => saveR.run(userId, r as never)}>Save roles</Button>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">{locations.map((x) => <label key={x.id} className="flex items-center gap-2 text-sm"><Checkbox checked={l.includes(x.id)} onChange={(e) => setL((y) => e.target.checked ? [...y, x.id] : y.filter((z) => z !== x.id))} />{x.name}</label>)}</div>
      <Button size="sm" variant="secondary" loading={saveL.pending} onClick={() => saveL.run(userId, l)}>Save locations</Button>
    </div>
  );
}
