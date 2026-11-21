"use client";
import { useState } from "react";
import { Copy, Eye, KeyRound, Plus, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { FeeQuote, type Quote } from "@/components/fee-quote";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import {
  assignInstructor, createEnrolment, issueActivationCode, previewQuote, resetStudentPassword, revealIdNumber,
} from "@/features/students/actions";
import type { ScheduleRow } from "@/lib/finance/schedule";
import { todayKE } from "@/lib/format";

type Opt = { id: string; name: string; locationIds?: string[] };

export function EnrolDialog({ studentId, homeLocation, locations, courses, instructors }: {
  studentId: string; homeLocation: string; locations: Opt[]; courses: Opt[]; instructors: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState(homeLocation);
  const [course, setCourse] = useState("");
  const [start, setStart] = useState(todayKE());
  const [instructor, setInstructor] = useState("");
  const [acceptNow, setAcceptNow] = useState(false);
  const [preview, setPreview] = useState<{ quote: Quote; schedule: ScheduleRow[] } | null>(null);
  const { run, pending, fieldErrors } = useAction(createEnrolment, { onSuccess: () => setOpen(false) });
  const prev = useAction(previewQuote, { refresh: false, successMessage: "Fee plan loaded", onSuccess: (d) => setPreview(d ?? null) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus />Enrol on course</Button></DialogTrigger>
      <DialogContent title="Enrol on a course" description="The current published price is locked in for this student." wide>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(studentId, { course_id: course, location_id: loc, start_date: start, instructor_id: instructor || undefined, accept_now: acceptNow, deposit_due: start }); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" htmlFor="enr-loc" required error={fieldErrors.location_id}>
              <Select id="enr-loc" value={loc} onChange={(e) => { setLoc(e.target.value); setCourse(""); setPreview(null); }}>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
            <Field label="Course" htmlFor="enr-course" required error={fieldErrors.course_id}>
              <Select id="enr-course" value={course} onChange={(e) => { setCourse(e.target.value); setPreview(null); }} required>
                <option value="">Choose…</option>
                {courses.filter((c) => c.locationIds?.includes(loc)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Start / deposit date" htmlFor="enr-start" required><Input id="enr-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Instructor" htmlFor="enr-ins">
              <Select id="enr-ins" value={instructor} onChange={(e) => setInstructor(e.target.value)}>
                <option value="">Assign later</option>
                {instructors.filter((i) => i.locationIds?.includes(loc)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
          </div>
          {course && !preview && <Button type="button" variant="secondary" size="sm" loading={prev.pending} onClick={() => prev.run(course, start)}>Show fee plan</Button>}
          {preview && <FeeQuote quote={preview.quote} schedule={preview.schedule} />}
          {preview && (
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <Checkbox checked={acceptNow} onChange={(e) => setAcceptNow(e.target.checked)} className="mt-0.5" />
              <span>The student has reviewed and accepts this fee plan now (in person).</span>
            </label>
          )}
          <Button type="submit" className="w-full" loading={pending} disabled={!course}>Create enrolment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignInstructorSelect({ enrolmentId, current, instructors }: { enrolmentId: string; current: string | null; instructors: Opt[] }) {
  const { run, pending } = useAction(assignInstructor);
  return (
    <Select aria-label="Assigned instructor" defaultValue={current ?? ""} disabled={pending} className="h-9 text-sm"
      onChange={(e) => run(enrolmentId, e.target.value || null)}>
      <option value="">Unassigned</option>
      {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
    </Select>
  );
}

function SecretDialog({ title, description, value, onClose }: { title: string; description: string; value: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={title} description={description}>
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-4 py-3">
          <span className="font-mono text-2xl font-semibold tracking-widest">{value}</span>
          <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(value); toast.success("Copied"); }}><Copy />Copy</Button>
        </div>
        <p className="mt-3 text-xs text-muted">Shown once. Give it to the student directly – never share it in group chats.</p>
      </DialogContent>
    </Dialog>
  );
}

export function PortalAccessButtons({ studentId, hasAccount }: { studentId: string; hasAccount: boolean }) {
  const [secret, setSecret] = useState<{ title: string; description: string; value: string } | null>(null);
  const code = useAction(issueActivationCode, { refresh: false, onSuccess: (d) => d && setSecret({ title: "Activation code", description: "The student enters this at /activate with their student number and phone. Valid 14 days.", value: d.code }) });
  const reset = useAction(resetStudentPassword, { refresh: false, onSuccess: (d) => d && setSecret({ title: "Temporary password", description: "The student must set a new password when they next sign in.", value: d.password }) });
  return (
    <>
      {hasAccount
        ? <Button size="sm" variant="secondary" loading={reset.pending} onClick={() => reset.run(studentId)}><KeyRound />Reset portal password</Button>
        : <Button size="sm" variant="secondary" loading={code.pending} onClick={() => code.run(studentId)}><Smartphone />Issue activation code</Button>}
      {secret && <SecretDialog {...secret} onClose={() => setSecret(null)} />}
    </>
  );
}

export function RevealId({ studentId, last4 }: { studentId: string; last4: string | null }) {
  const [value, setValue] = useState<string | null>(null);
  const { run, pending } = useAction(revealIdNumber, { refresh: false, onSuccess: (d) => setValue(d?.value ?? "Not recorded") });
  if (value) return <span className="font-mono">{value}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">••••{last4 ?? ""}</span>
      <button onClick={() => run(studentId)} disabled={pending} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"><Eye className="size-3.5" />Reveal (logged)</button>
    </span>
  );
}

export function NoAccountHint() {
  return <Alert tone="info">This student has no app account yet. Issue an activation code so they can see their schedule and balance on their phone.</Alert>;
}
