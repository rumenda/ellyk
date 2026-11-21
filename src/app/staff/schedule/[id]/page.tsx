import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, User, Users } from "lucide-react";
import { ActionButton } from "@/components/forms/action-button";
import { AttendanceSheet } from "@/components/staff/attendance";
import { BookingForm } from "@/components/staff/booking-form";
import { ChangeRequestDialog, RescheduleDialog } from "@/components/staff/session-forms";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, EmptyState } from "@/components/ui/states";
import { cancelBooking, decideSessionChange, setSessionStatus } from "@/features/schedule/actions";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDateShort, formatDateTime, formatTime, fullName, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("manager", "admin", "instructor");
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase.from("training_sessions")
    .select("*, location:locations(id, name), instructor:instructors(id, profile:profiles(full_name))")
    .eq("id", id).maybeSingle();
  if (!s) notFound();
  const office = hasRole(user, "manager", "admin");
  const mine = s.instructor_id === user.instructorId;
  const [{ data: bookings }, { data: attendance }, { data: requests }] = await Promise.all([
    supabase.from("session_bookings").select("id, status, student_id, enrolment_id, vehicle:vehicles(registration, make, model), student:students(student_number, first_name, middle_name, last_name)").eq("session_id", id).eq("status", "booked"),
    supabase.from("attendance").select("student_id, status, notes").eq("session_id", id),
    supabase.from("session_change_requests").select("*, requester:profiles!session_change_requests_requested_by_fkey(full_name)").eq("session_id", id).order("created_at", { ascending: false }),
  ]);
  const booked = bookings ?? [];
  const started = new Date(s.starts_at).getTime() - 30 * 60_000 <= nowMs();
  const live = !["cancelled", "rescheduled"].includes(s.status);

  let candidates: { enrolmentId: string; label: string; gateMet: boolean }[] = [];
  let vehicles: { id: string; label: string }[] = [];
  if (office && live && booked.length < s.capacity) {
    const [{ data: enrs }, { data: vs }, { data: busy }] = await Promise.all([
      supabase.from("enrolments").select("id, student:students(id, student_number, first_name, last_name)").eq("location_id", s.location_id).in("status", ["active", "training_complete"]),
      supabase.from("vehicles").select("id, registration, make, model, insurance_expiry").eq("location_id", s.location_id).eq("is_active", true).not("status", "in", "(maintenance,out_of_service)"),
      supabase.from("session_bookings").select("vehicle_id").eq("is_live", true).not("vehicle_id", "is", null).overlaps("time_range", `[${s.starts_at},${s.ends_at})`),
    ]);
    const ids = (enrs ?? []).map((e) => e.id);
    const { data: gates } = ids.length ? await supabase.from("v_enrolment_balances").select("enrolment_id, training_gate_met").in("enrolment_id", ids) : { data: [] };
    const bookedStudents = new Set(booked.map((b) => b.student_id));
    candidates = (enrs ?? []).filter((e) => e.student && !bookedStudents.has(e.student.id)).map((e) => ({
      enrolmentId: e.id, label: `${e.student!.first_name} ${e.student!.last_name} (${e.student!.student_number})`,
      gateMet: (gates ?? []).find((g) => g.enrolment_id === e.id)?.training_gate_met ?? false,
    }));
    const busyIds = new Set((busy ?? []).map((b) => b.vehicle_id));
    vehicles = (vs ?? []).filter((v) => !busyIds.has(v.id)).map((v) => ({ id: v.id, label: `${v.registration} · ${v.make} ${v.model}` }));
  }
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date(s.starts_at));

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: hasRole(user, "manager", "admin") ? "Schedule" : "My day", href: office ? "/staff/schedule" : "/staff/my-day" }, { label: s.title }]}
        title={<span className="flex flex-wrap items-center gap-2">{s.title}<StatusBadge status={s.status} /></span>}
        description={<span className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1"><Clock className="size-4" />{formatDateShort(s.starts_at)} · {formatTime(s.starts_at)}–{formatTime(s.ends_at)}</span>
          <span className="flex items-center gap-1"><MapPin className="size-4" />{s.location?.name}</span>
          <span className="flex items-center gap-1"><User className="size-4" />{s.instructor?.profile?.full_name}</span>
          <span className="flex items-center gap-1"><Users className="size-4" />{booked.length}/{s.capacity} · {humanize(s.lesson_type)}</span>
        </span>}
        actions={live && <>
          {(office || mine) && s.status === "scheduled" && <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return setSessionStatus(id, "confirmed"); }}>Confirm</ActionButton>}
          {(office || mine) && ["scheduled", "confirmed"].includes(s.status) && started && <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return setSessionStatus(id, "in_progress"); }}>Start</ActionButton>}
          {office && <RescheduleDialog sessionId={id} date={dateKey} start={formatTime(s.starts_at)} end={formatTime(s.ends_at)} />}
          {!office && mine && <ChangeRequestDialog sessionId={id} />}
          {office && <ActionButton size="sm" variant="ghost" className="text-danger-700" requireReason action={async (r) => { "use server"; return setSessionStatus(id, "cancelled", r); }}
            confirm={{ title: "Cancel this session?", description: "Bookings are released. Let students know.", destructive: true, confirmLabel: "Cancel session" }}>Cancel</ActionButton>}
        </>} />
      {s.status === "rescheduled" && s.rescheduled_to && <Alert tone="info" className="mb-4">This session was moved. <Link className="underline" href={`/staff/schedule/${s.rescheduled_to}`}>Open the new session</Link></Alert>}
      {s.status === "cancelled" && <Alert tone="warning" className="mb-4">Cancelled: {s.cancellation_reason}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader title="Attendance" description={started ? "Tap once per student, then save." : "Attendance opens 30 minutes before the session starts."} />
          {booked.length === 0 ? <EmptyState icon={Users} title="No students booked" description={office ? "Book students below." : "The office hasn't booked anyone yet."} /> : (
            <AttendanceSheet sessionId={id} canMark={live && started && (office || mine)} students={booked.map((b) => {
              const a = (attendance ?? []).find((x) => x.student_id === b.student_id);
              return { id: b.student_id, name: b.student ? fullName(b.student) : "", number: b.student?.student_number ?? "", status: a?.status ?? null, notes: a?.notes ?? null,
                vehicle: b.vehicle ? b.vehicle.registration : null };
            })} />
          )}
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Booked students" />
            <ul className="divide-y divide-border text-sm">
              {booked.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0">
                    <Link href={`/staff/training/${b.enrolment_id}`} className="block truncate font-medium hover:underline">{b.student ? fullName(b.student) : ""}</Link>
                    <span className="block text-xs text-muted">{b.vehicle ? `${b.vehicle.registration} · ${b.vehicle.make} ${b.vehicle.model}` : "No motorcycle"}</span>
                  </span>
                  {office && live && !started && <ActionButton size="sm" variant="ghost" action={async () => { "use server"; return cancelBooking(b.id); }}>Remove</ActionButton>}
                </li>
              ))}
              {booked.length === 0 && <li className="px-4 py-3 text-muted">None yet</li>}
            </ul>
            {office && live && booked.length < s.capacity && (
              <CardBody className="border-t border-border">
                <BookingForm sessionId={id} candidates={candidates} vehicles={vehicles} needsVehicle={s.lesson_type !== "theory"} canOverride={hasRole(user, "manager")} />
              </CardBody>
            )}
          </Card>
          {(requests ?? []).length > 0 && (
            <Card>
              <CardHeader title="Change requests" />
              <ul className="divide-y divide-border text-sm">
                {requests!.map((r) => (
                  <li key={r.id} className="space-y-1 px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between"><span className="font-medium">{r.requester?.full_name}</span><StatusBadge status={r.status} /></div>
                    <p className="text-muted">{r.reason}</p>
                    {r.proposed_starts_at && <p className="text-xs">Suggested: {formatDateTime(r.proposed_starts_at)}</p>}
                    {office && r.status === "pending" && <div className="flex gap-2 pt-1">
                      <ActionButton size="sm" action={async () => { "use server"; return decideSessionChange(r.id, true); }}>Approve</ActionButton>
                      <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return decideSessionChange(r.id, false); }}>Decline</ActionButton>
                    </div>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {s.notes && <Card><CardHeader title="Notes" /><CardBody className="text-sm">{s.notes}</CardBody></Card>}
        </div>
      </div>
    </div>
  );
}
