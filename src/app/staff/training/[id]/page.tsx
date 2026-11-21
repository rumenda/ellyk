import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms/action-button";
import { AssessmentForm } from "@/components/staff/assessment-form";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { getCompetencies, normalizeProgress } from "@/features/student/queries";
import { enrolmentAction } from "@/features/students/actions";
import { requireRole } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Assess skills" };

export default async function AssessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session?: string }> }) {
  await requireRole("manager", "admin", "instructor");
  const { id } = await params;
  const { session } = await searchParams;
  const supabase = await createClient();
  const { data: e } = await supabase.from("enrolments").select("id, status, student:students(id, student_number, first_name, middle_name, last_name), course:courses(name)").eq("id", id).maybeSingle();
  if (!e || !e.student) notFound();
  const [items, { data: p }] = await Promise.all([getCompetencies(id), supabase.from("v_enrolment_progress").select("*").eq("enrolment_id", id).maybeSingle()]);
  const prog = normalizeProgress(p ?? {});
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader breadcrumbs={[{ label: "Training", href: "/staff/training" }, { label: fullName(e.student) }]}
        title={<span className="flex items-center gap-2">{fullName(e.student)}<StatusBadge status={e.status} /></span>}
        description={<><Link className="hover:underline" href={`/staff/students/${e.student.id}`}>{e.student.student_number}</Link> · {e.course?.name}</>}
        actions={e.status === "active" && prog.competencies_complete && <ActionButton action={async () => { "use server"; return enrolmentAction(id, "training_complete"); }}
          confirm={{ title: "Sign off training as complete?", description: "The student becomes eligible for NTSA test booking." }}>Mark training complete</ActionButton>} />
      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between text-sm"><span>{prog.competencies_competent} of {prog.competencies_required} required skills at Competent or above</span><span className="font-semibold">{prog.competency_progress_pct}%</span></div>
        <ProgressBar value={prog.competency_progress_pct} tone="success" className="mt-2" label="Skills" />
      </Card>
      <Card>
        <CardHeader title="Rate each skill" description="Only changed ratings are saved; every assessment is kept as history." />
        <AssessmentForm enrolmentId={id} sessionId={session ?? null} items={items} readOnly={!["active", "training_complete"].includes(e.status)} />
      </Card>
    </div>
  );
}
