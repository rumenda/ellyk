import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { toNumber } from "@/lib/format";
import type { Component } from "@/lib/finance/allocation";

const OPEN = ["pending_acceptance", "awaiting_deposit", "active", "training_complete", "suspended", "completed"] as const;

/** Everything the student home needs, fetched in parallel and RLS-scoped to the student. */
export const getStudentOverview = cache(async (studentId: string) => {
  const supabase = await createClient();
  const [studentRes, enrolmentsRes, settingsRes, unreadRes, announcementRes] = await Promise.all([
    supabase.from("students").select("id, student_number, first_name, middle_name, last_name, phone, alt_phone, email, residence, status, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, id_type, id_number_last4, date_of_birth, home_location_id").eq("id", studentId).single(),
    supabase.from("enrolments").select("id, enrolment_number, status, start_date, expected_end_date, certificate_number, completed_at, course:courses(id, name, theory_sessions, practical_sessions, duration_weeks), location:locations(id, name, address, phone), instructor:instructors(id, user_id, profile:profiles(full_name, phone))")
      .eq("student_id", studentId).in("status", [...OPEN]).order("created_at", { ascending: false }),
    supabase.from("school_settings").select("paybill_number, paybill_account_hint, phone, email, trading_name").eq("id", 1).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("announcements").select("id, title, body, is_important, published_at").order("published_at", { ascending: false }).limit(1),
  ]);
  if (studentRes.error || !studentRes.data) throw new Error("Could not load your profile");

  const enrolments = enrolmentsRes.data ?? [];
  // The "current" enrolment: an open one first, else the most recent completed one.
  const current = enrolments.find((e) => e.status !== "completed") ?? enrolments[0] ?? null;

  let balance = null, instalments: InstalmentRow[] = [], progress: Progress | null = null, ntsa = null, nextLessons: LessonRow[] = [];
  if (current) {
    const [b, i, p, n, l] = await Promise.all([
      supabase.from("v_enrolment_balances").select("*").eq("enrolment_id", current.id).maybeSingle(),
      supabase.from("v_instalments").select("id, sequence, label, due_date, amount, waived_amount, amount_paid, amount_outstanding, status").eq("enrolment_id", current.id).order("sequence"),
      supabase.from("v_enrolment_progress").select("*").eq("enrolment_id", current.id).maybeSingle(),
      supabase.from("ntsa_processes").select("id, status, test_date, test_centre, booking_reference, status_changed_at, attempts:ntsa_test_attempts(attempt_number, test_date, test_centre, result)").eq("enrolment_id", current.id).maybeSingle(),
      getLessons(studentId, "upcoming", 3),
    ]);
    balance = b.data;
    instalments = (i.data ?? []) as InstalmentRow[];
    progress = p.data ? normalizeProgress(p.data) : null;
    ntsa = n.data;
    nextLessons = l;
  }

  return {
    student: studentRes.data,
    current,
    enrolments,
    balance,
    instalments,
    nextInstalment: instalments.find((x) => toNumber(x.amount_outstanding) > 0) ?? null,
    progress,
    ntsa,
    nextLessons,
    settings: settingsRes.data,
    unread: unreadRes.count ?? 0,
    announcement: announcementRes.data?.[0] ?? null,
  };
});

export interface InstalmentRow {
  id: string; sequence: number; label: string; due_date: string; amount: number; waived_amount: number;
  amount_paid: number; amount_outstanding: number; status: string;
}

export interface LessonRow {
  booking_id: string; session_id: string; title: string; lesson_type: string; starts_at: string; ends_at: string;
  status: string; location: string; location_address: string | null; instructor: string | null; vehicle: string | null;
  attendance: string | null; attendance_notes: string | null;
}

export async function getLessons(studentId: string, when: "upcoming" | "past", limit = 30): Promise<LessonRow[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let q = supabase.from("session_bookings")
    .select("id, vehicle:vehicles(registration, make, model), session:training_sessions!inner(id, title, lesson_type, starts_at, ends_at, status, location:locations(name, address), instructor:instructors(profile:profiles(full_name)))")
    .eq("student_id", studentId).eq("status", "booked");
  q = when === "upcoming"
    ? q.gte("session.ends_at", now).not("session.status", "in", "(cancelled,rescheduled)").order("session(starts_at)", { ascending: true })
    : q.lt("session.ends_at", now).order("session(starts_at)", { ascending: false });
  const { data } = await q.limit(limit);
  const ids = (data ?? []).map((b) => b.session!.id);
  const att = ids.length
    ? (await supabase.from("attendance").select("session_id, status, notes").eq("student_id", studentId).in("session_id", ids)).data ?? []
    : [];
  return (data ?? []).map((b) => {
    const s = b.session!;
    const a = att.find((x) => x.session_id === s.id);
    return {
      booking_id: b.id, session_id: s.id, title: s.title, lesson_type: s.lesson_type, starts_at: s.starts_at, ends_at: s.ends_at,
      status: s.status, location: s.location?.name ?? "", location_address: s.location?.address ?? null,
      instructor: s.instructor?.profile?.full_name ?? null,
      vehicle: b.vehicle ? `${b.vehicle.make} ${b.vehicle.model} · ${b.vehicle.registration}` : null,
      attendance: a?.status ?? null, attendance_notes: a?.notes ?? null,
    };
  });
}

export async function getStudentPayments(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("payments")
    .select("id, receipt_number, source, status, amount, received_at, external_reference, allocations:payment_allocations(amount, line:invoice_lines(component))")
    .eq("student_id", studentId).in("status", ["confirmed", "reversed", "pending_verification"]).order("received_at", { ascending: false }).limit(100);
  return (data ?? []).map((p) => ({
    ...p,
    breakdown: (p.allocations ?? []).reduce<Record<string, number>>((acc, a) => {
      const k = a.line?.component as Component;
      acc[k] = (acc[k] ?? 0) + toNumber(a.amount);
      return acc;
    }, {}),
  }));
}

export async function getFeeLines(enrolmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("v_invoice_line_balances")
    .select("invoice_line_id, component, description, amount_due, allocated, outstanding, sort_order, invoice_kind")
    .eq("enrolment_id", enrolmentId).order("sort_order");
  return data ?? [];
}

export async function getCompetencies(enrolmentId: string) {
  const supabase = await createClient();
  const [comps, latest] = await Promise.all([
    supabase.from("competencies").select("id, name, category, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("v_competency_latest").select("competency_id, rating, comment, assessed_at").eq("enrolment_id", enrolmentId),
  ]);
  return (comps.data ?? []).map((c) => {
    const l = (latest.data ?? []).find((x) => x.competency_id === c.id);
    return { ...c, rating: l?.rating ?? "not_assessed", comment: l?.comment ?? null, assessed_at: l?.assessed_at ?? null };
  });
}

export interface Progress {
  enrolment_id: string; theory_required: number; practical_required: number; theory_attended: number; practical_attended: number;
  missed_sessions: number; sessions_marked: number; competencies_required: number; competencies_competent: number;
  competencies_ready: number; attendance_progress_pct: number; competency_progress_pct: number; competencies_complete: boolean;
}

type Nullable<T> = { [K in keyof T]: T[K] | null };

/** View columns are typed nullable; coerce to plain numbers for rendering. */
export function normalizeProgress(r: Partial<Nullable<Progress>>): Progress {
  const n = (v: number | null | undefined) => v ?? 0;
  return {
    enrolment_id: r.enrolment_id ?? "", theory_required: n(r.theory_required), practical_required: n(r.practical_required),
    theory_attended: n(r.theory_attended), practical_attended: n(r.practical_attended), missed_sessions: n(r.missed_sessions),
    sessions_marked: n(r.sessions_marked), competencies_required: n(r.competencies_required),
    competencies_competent: n(r.competencies_competent), competencies_ready: n(r.competencies_ready),
    attendance_progress_pct: n(r.attendance_progress_pct), competency_progress_pct: n(r.competency_progress_pct),
    competencies_complete: r.competencies_complete ?? false,
  };
}
