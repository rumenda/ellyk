import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/format";

const phone = z.string().trim().refine((v) => normalizeKenyanPhone(v) !== null, "Enter a valid Kenyan mobile number, e.g. 0712 345 678");
const optionalPhone = z.string().trim().optional().refine((v) => !v || normalizeKenyanPhone(v) !== null, "Enter a valid Kenyan mobile number");

export const studentSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  middle_name: z.string().trim().max(60).optional(),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  gender: z.enum(["female", "male", "other", "prefer_not_to_say", ""]).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter date of birth").refine((d) => d < new Date().toISOString().slice(0, 10), "Date must be in the past"),
  id_type: z.enum(["national_id", "passport", "alien_id", "birth_certificate"]),
  id_number: z.string().trim().min(4, "Enter the ID number").max(30).regex(/^[A-Za-z0-9-]+$/, "Letters and numbers only"),
  phone,
  alt_phone: optionalPhone,
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  residence: z.string().trim().max(120).optional(),
  emergency_contact_name: z.string().trim().min(2, "Emergency contact name is required").max(120),
  emergency_contact_phone: phone,
  emergency_contact_relationship: z.string().trim().min(2, "Relationship is required").max(40),
  home_location_id: z.uuid("Choose a location"),
  consent_data_processing: z.literal(true, { error: "The student must consent to data processing" }),
  consent_sms: z.boolean().optional(),
  lead_id: z.string().optional(),
});

export const enrolSchema = z.object({
  course_id: z.uuid("Choose a course"),
  location_id: z.uuid("Choose a location"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date"),
  instructor_id: z.string().optional(),
  accept_now: z.boolean().optional(),
  deposit_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type StudentInput = z.infer<typeof studentSchema>;
export type EnrolInput = z.infer<typeof enrolSchema>;
