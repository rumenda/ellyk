"use client";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { submitEnquiry } from "@/features/leads/public-actions";

export function EnquiryForm({ locations, courses }: { locations: { id: string; name: string }[]; courses: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(submitEnquiry, null);
  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="size-12 text-success-600" />
        <p className="mt-3 font-semibold">Enquiry received</p>
        <p className="mt-1 text-sm text-muted">{state.message}</p>
      </div>
    );
  }
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Your name" htmlFor="full_name" error={fe.full_name} required>
        <Input id="full_name" name="full_name" autoComplete="name" required aria-invalid={!!fe.full_name} />
      </Field>
      <Field label="Phone number" htmlFor="phone" error={fe.phone} required>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" required aria-invalid={!!fe.phone} />
      </Field>
      <Field label="Where would you like to train?" htmlFor="preferred_location_id" error={fe.preferred_location_id} required>
        <Select id="preferred_location_id" name="preferred_location_id" required defaultValue="">
          <option value="" disabled>Choose a location</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </Field>
      <Field label="Course" htmlFor="interested_course_id">
        <Select id="interested_course_id" name="interested_course_id" defaultValue="">
          <option value="">Not sure yet</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Anything we should know? (optional)" htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={500} placeholder="e.g. I can only train on weekends" />
      </Field>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox name="consent" className="mt-0.5" required />
        <span>I agree that Elly K Driving School may contact me about training and keep these details for that purpose.</span>
      </label>
      {fe.consent && <p className="text-sm text-danger-700">{fe.consent[0]}</p>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>Send enquiry</Button>
    </form>
  );
}
