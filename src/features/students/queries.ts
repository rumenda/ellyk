import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeProgress } from "@/features/student/queries";

export async function getStudentDetail(id: string) {
  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("*, location:locations(id, name)").eq("id", id).maybeSingle();
  if (!student) return null;
  const [enrolments, docs, balance, credit, consents, payments, leadAct] = await Promise.all([
    supabase.from("enrolments").select("*, course:courses(name, practical_sessions, theory_sessions), location:locations(name), instructor:instructors(id, profile:profiles(full_name))")
      .eq("student_id", id).order("created_at", { ascending: false }),
    supabase.from("student_documents").select("*").eq("student_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("v_student_balances").select("*").eq("student_id", id).maybeSingle(),
    supabase.from("v_student_credit").select("credit_balance").eq("student_id", id).maybeSingle(),
    supabase.from("student_consents").select("consent_type, granted, terms_version, recorded_at").eq("student_id", id).order("recorded_at", { ascending: false }),
    supabase.from("payments").select("id, receipt_number, amount, received_at, source, status, external_reference").eq("student_id", id).order("received_at", { ascending: false }).limit(50),
    supabase.from("audit_logs").select("id, occurred_at, action, actor_roles, new_values").eq("entity_id", id).order("occurred_at", { ascending: false }).limit(30),
  ]);
  const enrolmentIds = (enrolments.data ?? []).map((e) => e.id);
  const [balances, progress, instalments, ntsa] = enrolmentIds.length ? await Promise.all([
    supabase.from("v_enrolment_balances").select("*").in("enrolment_id", enrolmentIds),
    supabase.from("v_enrolment_progress").select("*").in("enrolment_id", enrolmentIds),
    supabase.from("v_instalments").select("*").in("enrolment_id", enrolmentIds).order("sequence"),
    supabase.from("ntsa_processes").select("*, attempts:ntsa_test_attempts(*)").in("enrolment_id", enrolmentIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  return {
    student,
    enrolments: (enrolments.data ?? []).map((e) => ({
      ...e,
      balance: (balances.data ?? []).find((b) => b.enrolment_id === e.id) ?? null,
      progress: (() => { const p = (progress.data ?? []).find((x) => x.enrolment_id === e.id); return p ? normalizeProgress(p) : null; })(),
      instalments: (instalments.data ?? []).filter((i) => i.enrolment_id === e.id),
      ntsa: (ntsa.data ?? []).find((n) => n.enrolment_id === e.id) ?? null,
    })),
    documents: docs.data ?? [],
    balance: balance.data,
    credit: credit.data?.credit_balance ?? 0,
    consents: consents.data ?? [],
    payments: payments.data ?? [],
    activity: leadAct.data ?? [],
  };
}

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudentDetail>>>;
