import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getCourses, getInstructors, getLocations } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RegistrationWizard } from "./wizard";

export const metadata: Metadata = { title: "Register student" };

export default async function NewStudentPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const user = await requireRole("manager", "admin");
  const { lead } = await searchParams;
  const supabase = await createClient();
  const [locations, courses, instructors, leadRow] = await Promise.all([
    getLocations(), getCourses(), getInstructors(),
    lead ? supabase.from("leads").select("id, full_name, phone, email, preferred_location_id, interested_course_id").eq("id", lead).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const allowed = user.roles.includes("manager") ? locations : locations.filter((l) => user.locationIds.includes(l.id));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Register a student" breadcrumbs={[{ label: "Students", href: "/staff/students" }, { label: "Register" }]}
        description="Takes about 3 minutes. Fields marked * are required." />
      <RegistrationWizard
        locations={allowed.filter((l) => l.is_active).map((l) => ({ id: l.id, name: l.name }))}
        courses={courses.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, locationIds: c.course_locations.map((x) => x.location_id) }))}
        instructors={instructors.filter((i) => i.is_active).map((i) => ({ id: i.id, name: i.name, locationIds: i.locationIds }))}
        lead={leadRow.data ?? null}
      />
    </div>
  );
}
