"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { FeeQuote, type Quote } from "@/components/fee-quote";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { previewQuote, registerStudentWizard } from "@/features/students/actions";
import { enrolSchema, studentSchema } from "@/features/students/schemas";
import type { ScheduleRow } from "@/lib/finance/schedule";
import { formatPhone, humanize, normalizeKenyanPhone, todayKE } from "@/lib/format";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string; locationIds?: string[] };
type Lead = { id: string; full_name: string; phone: string; email: string | null; preferred_location_id: string | null; interested_course_id: string | null } | null;

const STEPS = ["Personal", "Identification", "Contact", "Emergency", "Course", "Fee plan", "Review"] as const;
const STEP_FIELDS: string[][] = [
  ["first_name", "last_name", "middle_name", "gender", "date_of_birth"],
  ["id_type", "id_number"],
  ["phone", "alt_phone", "email", "residence"],
  ["emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"],
  ["home_location_id", "course_id", "location_id", "start_date"],
  [], [],
];

export function RegistrationWizard({ locations, courses, instructors, lead }: { locations: Opt[]; courses: Opt[]; instructors: Opt[]; lead: Lead }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [quote, setQuote] = useState<{ quote: Quote; schedule: ScheduleRow[] } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const names = lead?.full_name.split(" ") ?? [];
  const [v, setV] = useState<Record<string, string | boolean>>({
    first_name: names[0] ?? "", middle_name: names.length > 2 ? names.slice(1, -1).join(" ") : "", last_name: names.length > 1 ? names[names.length - 1]! : "",
    gender: "", date_of_birth: "", id_type: "national_id", id_number: "", phone: lead?.phone ? formatPhone(lead.phone) : "", alt_phone: "",
    email: lead?.email ?? "", residence: "", emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relationship: "",
    home_location_id: lead?.preferred_location_id ?? (locations.length === 1 ? locations[0]!.id : ""),
    enrol: true, course_id: lead?.interested_course_id ?? "", location_id: lead?.preferred_location_id ?? "", start_date: todayKE(),
    instructor_id: "", accept_now: true, deposit_due: todayKE(), consent_data_processing: false, consent_sms: true,
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const studentPayload = () => ({
    first_name: v.first_name, middle_name: v.middle_name || undefined, last_name: v.last_name, gender: v.gender || undefined,
    date_of_birth: v.date_of_birth, id_type: v.id_type, id_number: v.id_number, phone: v.phone, alt_phone: v.alt_phone || undefined,
    email: v.email || "", residence: v.residence || undefined, emergency_contact_name: v.emergency_contact_name,
    emergency_contact_phone: v.emergency_contact_phone, emergency_contact_relationship: v.emergency_contact_relationship,
    home_location_id: v.home_location_id, consent_data_processing: v.consent_data_processing === true, consent_sms: v.consent_sms === true,
    lead_id: lead?.id,
  });
  const enrolPayload = () => v.enrol ? {
    course_id: v.course_id, location_id: v.location_id || v.home_location_id, start_date: v.start_date,
    instructor_id: v.instructor_id || undefined, accept_now: v.accept_now === true, deposit_due: v.deposit_due,
  } : null;

  function validate(s: number) {
    const fields = STEP_FIELDS[s]!;
    const errs: Record<string, string> = {};
    const r = studentSchema.safeParse(studentPayload());
    if (!r.success) r.error.issues.forEach((i) => { const k = String(i.path[0]); if (fields.includes(k)) errs[k] ??= i.message; });
    if (s === 4 && v.enrol) {
      const e = enrolSchema.safeParse(enrolPayload());
      if (!e.success) e.error.issues.forEach((i) => { const k = String(i.path[0]); errs[k] ??= i.message; });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validate(step)) return;
    if (step === 4) {
      if (!v.enrol) { setStep(6); return; }
      setQuote(null); setQuoteError(null);
      start(async () => {
        const r = await previewQuote(String(v.course_id), String(v.deposit_due));
        if (r.ok) setQuote(r.data!); else setQuoteError(r.error);
        setStep(5);
      });
      return;
    }
    setStep((x) => Math.min(x + 1, STEPS.length - 1));
  }

  function submit() {
    const r = studentSchema.safeParse(studentPayload());
    if (!r.success) { toast.error(r.error.issues[0]!.message); return; }
    start(async () => {
      const res = await registerStudentWizard(r.data, enrolPayload() as never);
      if (!res.ok) {
        toast.error(res.error);
        const fe = res.fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fe).map(([k, m]) => [k, m[0]!])));
        return;
      }
      if (res.data?.warning) toast.warning(res.data.warning); else toast.success("Student registered");
      router.push(`/staff/students/${res.data!.id}?registered=1`);
    });
  }

  const err = (k: string) => errors[k];
  const f = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false, hint?: string) => (
    <Field label={label} htmlFor={k} error={err(k)} required={required} hint={hint}>
      <Input id={k} value={String(v[k] ?? "")} onChange={set(k)} aria-invalid={!!err(k)} {...props} />
    </Field>
  );
  const coursesHere = courses.filter((c) => !v.location_id && !v.home_location_id ? true : c.locationIds?.includes(String(v.location_id || v.home_location_id)));
  const instructorsHere = instructors.filter((i) => i.locationIds?.includes(String(v.location_id || v.home_location_id)));

  return (
    <div className="space-y-4">
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand-500" : "bg-border")} />
            <p className={cn("mt-1.5 hidden text-xs sm:block", i === step ? "font-semibold text-text" : "text-muted")}>{s}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm font-medium text-muted sm:hidden">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      <Card className="p-4 sm:p-6">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {f("first_name", "First name", { autoComplete: "given-name" }, true)}
            {f("middle_name", "Middle name")}
            {f("last_name", "Last name", { autoComplete: "family-name" }, true)}
            <Field label="Gender" htmlFor="gender">
              <Select id="gender" value={String(v.gender)} onChange={set("gender")}>
                <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
              </Select>
            </Field>
            {f("date_of_birth", "Date of birth", { type: "date", max: todayKE() }, true, "Needed for NTSA – minimum age applies")}
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ID document" htmlFor="id_type" required>
              <Select id="id_type" value={String(v.id_type)} onChange={set("id_type")}>
                <option value="national_id">National ID</option><option value="passport">Passport</option>
                <option value="alien_id">Alien ID</option><option value="birth_certificate">Birth certificate</option>
              </Select>
            </Field>
            {f("id_number", "ID number", { autoComplete: "off", inputMode: v.id_type === "national_id" ? "numeric" : "text" }, true, "Stored securely; only the last 4 digits are shown to most staff")}
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {f("phone", "Mobile number", { type: "tel", inputMode: "tel", placeholder: "0712 345 678" }, true, "Used for M-Pesa matching and SMS")}
            {f("alt_phone", "Alternative number", { type: "tel", inputMode: "tel" })}
            {f("email", "Email (optional)", { type: "email", autoComplete: "email" })}
            {f("residence", "Area of residence", { placeholder: "e.g. Roysambu" })}
          </div>
        )}
        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {f("emergency_contact_name", "Contact name", {}, true)}
            {f("emergency_contact_relationship", "Relationship", { placeholder: "Parent, spouse, sibling…" }, true)}
            {f("emergency_contact_phone", "Contact phone", { type: "tel", inputMode: "tel" }, true)}
          </div>
        )}
        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Home location" htmlFor="home_location_id" error={err("home_location_id")} required>
              <Select id="home_location_id" value={String(v.home_location_id)} onChange={(e) => { set("home_location_id")(e); setV((p) => ({ ...p, location_id: e.target.value, course_id: "", instructor_id: "" })); }}>
                <option value="">Choose…</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
            <label className="flex items-center gap-3 self-end pb-2.5 text-sm font-medium">
              <Checkbox checked={v.enrol === true} onChange={set("enrol")} />Enrol on a course now
            </label>
            {v.enrol && <>
              <Field label="Course" htmlFor="course_id" error={err("course_id")} required>
                <Select id="course_id" value={String(v.course_id)} onChange={set("course_id")}>
                  <option value="">Choose…</option>{coursesHere.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              {f("start_date", "Training start date", { type: "date" }, true)}
              <Field label="Instructor (optional)" htmlFor="instructor_id">
                <Select id="instructor_id" value={String(v.instructor_id)} onChange={set("instructor_id")}>
                  <option value="">Assign later</option>{instructorsHere.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
              </Field>
              {f("deposit_due", "Deposit due date", { type: "date" }, true, "Weekly instalments follow from this date")}
            </>}
          </div>
        )}
        {step === 5 && (
          quoteError ? <Alert tone="danger" title="Can't prepare the fee plan">{quoteError}</Alert>
          : quote ? (
            <div className="space-y-4">
              <Alert tone="info">Show this breakdown to the student. Every component, including the NTSA amount and the platform service fee, is listed.</Alert>
              <FeeQuote quote={quote.quote} schedule={quote.schedule} />
              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <Checkbox checked={v.accept_now === true} onChange={set("accept_now")} className="mt-0.5" />
                <span><span className="font-medium">The student has reviewed and accepts this fee plan now.</span>
                  <span className="block text-muted">Untick to let them review and accept in the student app later.</span></span>
              </label>
            </div>
          ) : <p className="text-sm text-muted">Loading fee plan…</p>
        )}
        {step === 6 && (
          <div className="space-y-4">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[["Name", [v.first_name, v.middle_name, v.last_name].filter(Boolean).join(" ")], ["Date of birth", v.date_of_birth],
                ["ID", `${humanize(String(v.id_type))} ${v.id_number}`], ["Phone", normalizeKenyanPhone(String(v.phone)) ? formatPhone(String(v.phone)) : v.phone],
                ["Emergency contact", `${v.emergency_contact_name} (${v.emergency_contact_relationship}) ${v.emergency_contact_phone}`],
                ["Location", locations.find((l) => l.id === v.home_location_id)?.name],
                ["Course", v.enrol ? courses.find((c) => c.id === v.course_id)?.name : "Not enrolling now"],
                ["Fee plan", v.enrol ? (v.accept_now ? "Accepted in person" : "Student will accept in app") : "—"]].map(([k, val]) => (
                <div key={String(k)} className="flex justify-between gap-3 border-b border-border py-1.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{String(val ?? "—")}</dd></div>
              ))}
            </dl>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <Checkbox checked={v.consent_data_processing === true} onChange={set("consent_data_processing")} className="mt-0.5" />
              <span><span className="font-medium">Data protection consent *</span><span className="block text-muted">The student agrees that Elly K may process these details for training, NTSA registration and payments, as required by the Data Protection Act, 2019.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <Checkbox checked={v.consent_sms === true} onChange={set("consent_sms")} className="mt-0.5" />
              <span>The student agrees to receive SMS reminders about lessons and payments.</span>
            </label>
            {err("consent_data_processing") && <p className="text-sm text-danger-700">{err("consent_data_processing")}</p>}
          </div>
        )}
      </Card>

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={() => setStep((s) => (s === 6 && !v.enrol ? 4 : Math.max(0, s - 1)))} disabled={step === 0 || pending}>
          <ChevronLeft />Back
        </Button>
        {step < 6 ? (
          <Button onClick={next} loading={pending} disabled={step === 5 && !!quoteError}>Continue<ChevronRight /></Button>
        ) : (
          <Button onClick={submit} loading={pending} disabled={v.consent_data_processing !== true}><Check />Register student</Button>
        )}
      </div>
    </div>
  );
}
