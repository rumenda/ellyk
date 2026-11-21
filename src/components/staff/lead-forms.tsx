"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { addLeadActivity, createLead, updateLeadStage } from "@/features/leads/actions";
import { SOURCES, STAGES } from "@/features/leads/constants";


export function NewLeadDialog({ locations, courses }: { locations: { id: string; name: string }[]; courses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending, fieldErrors } = useAction(createLead, { onSuccess: (d) => { setOpen(false); if (d) router.push(`/staff/admissions/${d.id}`); } });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />New enquiry</Button></DialogTrigger>
      <DialogContent title="New enquiry" description="Capture the basics now – you can add more after the first call.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(Object.fromEntries(new FormData(e.currentTarget)) as never); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="l-name" required error={fieldErrors.full_name}><Input id="l-name" name="full_name" required /></Field>
            <Field label="Phone" htmlFor="l-phone" required error={fieldErrors.phone}><Input id="l-phone" name="phone" type="tel" inputMode="tel" required /></Field>
            <Field label="Source" htmlFor="l-source" required>
              <Select id="l-source" name="source" defaultValue="walk_in">{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="Referred by" htmlFor="l-ref"><Input id="l-ref" name="referral_name" /></Field>
            <Field label="Preferred location" htmlFor="l-loc">
              <Select id="l-loc" name="preferred_location_id" defaultValue=""><option value="">Not sure</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
            </Field>
            <Field label="Interested in" htmlFor="l-course">
              <Select id="l-course" name="interested_course_id" defaultValue=""><option value="">Not sure</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
            <Field label="Follow up on" htmlFor="l-fu"><Input id="l-fu" name="follow_up_at" type="date" /></Field>
            <Field label="Email" htmlFor="l-email" error={fieldErrors.email}><Input id="l-email" name="email" type="email" /></Field>
          </div>
          <Field label="Notes" htmlFor="l-notes"><Textarea id="l-notes" name="notes" rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Save enquiry</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeadActivityForm({ leadId }: { leadId: string }) {
  const [body, setBody] = useState("");
  const { run, pending } = useAction(addLeadActivity, { onSuccess: () => setBody("") });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(leadId, f.get("type") as "call", body, String(f.get("follow_up") || "") || undefined); }}>
      <Textarea aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="What happened? e.g. Called – will visit on Saturday with deposit" />
      <div className="flex flex-wrap gap-2">
        <Select name="type" defaultValue="call" className="h-10 w-auto" aria-label="Activity type">
          <option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="visit">Visit</option><option value="note">Note</option>
        </Select>
        <Input name="follow_up" type="date" className="h-10 w-auto" aria-label="Next follow-up" />
        <Button type="submit" size="sm" className="h-10" loading={pending} disabled={!body.trim()}>Log activity</Button>
      </div>
    </form>
  );
}

export function LeadStageSelect({ leadId, stage }: { leadId: string; stage: string }) {
  const { run, pending } = useAction(updateLeadStage);
  return (
    <Select aria-label="Stage" defaultValue={stage} disabled={pending || stage === "converted"} className="h-10"
      onChange={(e) => {
        const s = e.target.value as "lost";
        if (s === "lost") { const r = window.prompt("Why was this lead lost?"); if (!r) { e.target.value = stage; return; } run(leadId, s, r); }
        else run(leadId, s);
      }}>
      {stage === "converted" && <option value="converted">Converted</option>}
      {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  );
}
