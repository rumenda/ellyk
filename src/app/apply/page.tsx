import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { EnquiryForm } from "./enquiry-form";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Enquire about training" };
export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const admin = createAdminClient();
  const [locations, courses] = await Promise.all([
    admin.from("locations").select("id, name").eq("is_active", true).order("name"),
    admin.from("courses").select("id, name").eq("is_active", true).order("name"),
  ]);
  return (
    <AuthShell title="Learn to ride with Elly K" description="Leave your details and we'll call you to explain fees, the weekly payment plan and lesson times.">
      <EnquiryForm locations={locations.data ?? []} courses={courses.data ?? []} />
    </AuthShell>
  );
}
