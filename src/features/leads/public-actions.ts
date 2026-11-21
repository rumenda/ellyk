"use server";
import { z } from "zod";
import { fail, formDataArg, ok, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { normalizeKenyanPhone } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/security/request";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  phone: z.string().trim().transform((v) => normalizeKenyanPhone(v)).refine((v): v is string => v !== null, "Enter a valid Kenyan mobile number"),
  preferred_location_id: z.uuid("Choose a location"),
  interested_course_id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().trim().max(500).optional(),
  consent: z.literal("on", { error: "Please agree so we can contact you" }),
  website: z.string().max(0).optional(), // honeypot
});

/** Public enquiry → CRM lead. Uses the service role with strict validation and rate limits. */
export async function submitEnquiry(prev: ActionResult | null, input: FormData): Promise<ActionResult> {
  const formData = formDataArg(prev, input);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the form.", zodFieldErrors(parsed.error.issues));
  const ip = await clientIp();
  if (!(await rateLimit(`enquiry:${ip}`, 5, 3600))) return fail("We've received several enquiries from this device. Please call us instead.");

  const admin = createAdminClient();
  const { data: existing } = await admin.from("leads").select("id").eq("phone", parsed.data.phone)
    .not("stage", "in", "(converted,lost)").maybeSingle();
  if (existing) {
    await admin.from("lead_activities").insert({ lead_id: existing.id, activity_type: "note", body: `Repeat website enquiry: ${parsed.data.notes ?? ""}`.trim() });
    return ok(undefined, "Thanks! We already have your details and will call you shortly.");
  }
  const { error } = await admin.from("leads").insert({
    full_name: parsed.data.full_name, phone: parsed.data.phone, preferred_location_id: parsed.data.preferred_location_id,
    interested_course_id: parsed.data.interested_course_id ?? null, source: "website", stage: "new",
    notes: parsed.data.notes || null, consent_to_contact: true,
  });
  if (error) return fail("We couldn't send your enquiry. Please try again or call us.");
  return ok(undefined, "Thanks! Our team will call you within one working day.");
}
