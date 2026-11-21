"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { useAction } from "@/components/forms/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createSessions, rescheduleSession, requestSessionChange } from "@/features/schedule/actions";
import { todayKE } from "@/lib/format";

type Opt = { id: string; name: string; locationIds?: string[] };

export function NewSessionDialog({ locations, instructors, courses, defaultDate }: { locations: Opt[]; instructors: Opt[]; courses: Opt[]; defaultDate?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState(locations[0]?.id ?? "");
  const [type, setType] = useState("practical");
  const { run, pending, fieldErrors } = useAction(createSessions, { onSuccess: (d) => { setOpen(false); if (d?.id) router.push(`/staff/schedule/${d.id}`); } });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />Schedule session</Button></DialogTrigger>
      <DialogContent title="Schedule a training session" description="Clashes for the instructor, students and motorcycles are blocked automatically." wide>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(Object.fromEntries(new FormData(e.currentTarget)) as never); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" htmlFor="s-loc" required error={fieldErrors.location_id}>
              <Select id="s-loc" name="location_id" value={loc} onChange={(e) => setLoc(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
            </Field>
            <Field label="Instructor" htmlFor="s-ins" required error={fieldErrors.instructor_id}>
              <Select id="s-ins" name="instructor_id" defaultValue=""><option value="" disabled>Choose…</option>
                {instructors.filter((i) => i.locationIds?.includes(loc)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
            </Field>
            <Field label="Lesson type" htmlFor="s-type" required>
              <Select id="s-type" name="lesson_type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="practical">Practical</option><option value="theory">Theory</option><option value="assessment">Assessment</option><option value="mock_test">Mock test</option>
              </Select>
            </Field>
            <Field label="Title" htmlFor="s-title" required error={fieldErrors.title}>
              <Input id="s-title" name="title" key={type} defaultValue={type === "theory" ? "Theory: Highway Code & safety" : type === "practical" ? "Practical: machine control" : type === "mock_test" ? "Mock NTSA test" : "Skills assessment"} />
            </Field>
            <Field label="Date" htmlFor="s-date" required error={fieldErrors.date}><Input id="s-date" name="date" type="date" min={todayKE()} defaultValue={defaultDate ?? todayKE()} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start" htmlFor="s-start" required><Input id="s-start" name="start" type="time" defaultValue="08:00" step={900} /></Field>
              <Field label="End" htmlFor="s-end" required error={fieldErrors.end}><Input id="s-end" name="end" type="time" defaultValue="10:00" step={900} /></Field>
            </div>
            <Field label="Capacity" htmlFor="s-cap" required hint="Practical: one per motorcycle"><Input id="s-cap" name="capacity" type="number" min={1} max={60} key={type + "c"} defaultValue={type === "theory" ? 12 : 3} /></Field>
            <Field label="Repeat weekly for" htmlFor="s-rep" hint="0 = one-off">
              <Select id="s-rep" name="repeat_weeks" defaultValue="0">{[0, 1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n === 0 ? "Does not repeat" : `${n} more week${n > 1 ? "s" : ""}`}</option>)}</Select>
            </Field>
            <Field label="Course (optional)" htmlFor="s-course">
              <Select id="s-course" name="course_id" defaultValue=""><option value="">Any course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="s-notes"><Textarea id="s-notes" name="notes" rows={2} /></Field>
          <Button type="submit" className="w-full" loading={pending}>Schedule</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RescheduleDialog({ sessionId, date, start, end }: { sessionId: string; date: string; start: string; end: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(rescheduleSession, { onSuccess: (d) => { setOpen(false); if (d) router.push(`/staff/schedule/${d.id}`); } });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><CalendarClock />Reschedule</Button></DialogTrigger>
      <DialogContent title="Reschedule session" description="Booked students move with the session and are notified.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(sessionId, String(f.get("date")), String(f.get("start")), String(f.get("end"))); }}>
          <Field label="New date" htmlFor="r-date" required><Input id="r-date" name="date" type="date" min={todayKE()} defaultValue={date} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="r-start" required><Input id="r-start" name="start" type="time" defaultValue={start} /></Field>
            <Field label="End" htmlFor="r-end" required><Input id="r-end" name="end" type="time" defaultValue={end} /></Field>
          </div>
          <Button type="submit" className="w-full" loading={pending}>Move session</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeRequestDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction(requestSessionChange, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><CalendarClock />Request change</Button></DialogTrigger>
      <DialogContent title="Request a reschedule" description="The office will review and move the session if possible.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(sessionId, String(f.get("reason")), String(f.get("proposed") || "") || undefined); }}>
          <Field label="Reason" htmlFor="cr-reason" required><Textarea id="cr-reason" name="reason" required minLength={5} rows={3} /></Field>
          <Field label="Suggested new time (optional)" htmlFor="cr-proposed"><Input id="cr-proposed" name="proposed" type="datetime-local" /></Field>
          <Button type="submit" className="w-full" loading={pending}>Send request</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
