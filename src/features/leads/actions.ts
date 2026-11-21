"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, friendlyDbError, ok, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { normalizeKenyanPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Stage = Database["public"]["Enums"]["lead_stage"];
type Source = Database["public"]["Enums"]["lead_source"];

async function staff() {
  const u = await getSessionUser();
  if (!u || !hasRole(u, "manager", "admin")) throw new Error("Not allowed");
  return u;
}

const leadSchema = z.object({
  full_name: z.string().trim().min(2, "Enter a name").max(120),
  phone: z.string().trim().refine((v) => normalizeKenyanPhone(v) !== null, "Enter a valid Kenyan mobile number"),
  alt_phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email()]).optional(),
  preferred_location_id: z.string().optional(),
  interested_course_id: z.string().optional(),
  source: z.enum(["walk_in", "phone", "whatsapp", "referral", "social_media", "agent", "roadshow", "website", "other"]),
  referral_name: z.string().trim().max(120).optional(),
  follow_up_at: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function createLead(input: z.input<typeof leadSchema>): Promise<ActionResult<{ id: string }>> {
  const user = await staff();
  const p = leadSchema.safeParse(input);
  if (!p.success) return fail("Please fix the highlighted fields.", zodFieldErrors(p.error.issues));
  const d = p.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").insert({
    full_name: d.full_name, phone: normalizeKenyanPhone(d.phone)!, alt_phone: normalizeKenyanPhone(d.alt_phone ?? ""),
    email: d.email || null, preferred_location_id: d.preferred_location_id || null, interested_course_id: d.interested_course_id || null,
    source: d.source as Source, referral_name: d.referral_name || null, notes: d.notes || null,
    follow_up_at: d.follow_up_at ? new Date(`${d.follow_up_at}T09:00:00+03:00`).toISOString() : null,
    assigned_to: user.id, created_by: user.id,
  }).select("id").single();
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/staff/admissions");
  return ok({ id: data.id }, "Lead added");
}

export async function updateLeadStage(id: string, stage: Stage, lostReason?: string): Promise<ActionResult> {
  await staff();
  if (stage === "lost" && (!lostReason || lostReason.trim().length < 3)) return fail("Say why the lead was lost.");
  if (stage === "converted") return fail("Convert a lead by registering them as a student.");
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ stage, lost_reason: stage === "lost" ? lostReason : null }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/staff/admissions", "layout");
  return ok(undefined, "Stage updated");
}

export async function addLeadActivity(id: string, type: "note" | "call" | "whatsapp" | "sms" | "visit", body: string, followUp?: string): Promise<ActionResult> {
  const user = await staff();
  if (!body.trim()) return fail("Write a short note.");
  const supabase = await createClient();
  const { error } = await supabase.from("lead_activities").insert({ lead_id: id, activity_type: type, body: body.trim().slice(0, 1000), created_by: user.id });
  if (error) return fail(friendlyDbError(error));
  if (followUp) {
    await supabase.from("leads").update({ follow_up_at: new Date(`${followUp}T09:00:00+03:00`).toISOString() }).eq("id", id);
    await supabase.from("lead_activities").insert({ lead_id: id, activity_type: "follow_up_set", body: `Follow up on ${followUp}`, created_by: user.id });
  }
  revalidatePath(`/staff/admissions/${id}`);
  return ok(undefined, "Activity logged");
}

export async function assignLead(id: string, userId: string): Promise<ActionResult> {
  await staff();
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ assigned_to: userId }).eq("id", id);
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/staff/admissions/${id}`);
  return ok(undefined, "Lead reassigned");
}
