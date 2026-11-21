import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Phone } from "lucide-react";
import { DocumentUpload } from "@/components/documents/upload";
import { ActionButton } from "@/components/forms/action-button";
import { Money } from "@/components/money";
import { NtsaSteps } from "@/components/ntsa-steps";
import { StatusBadge } from "@/components/status-badge";
import { AdjustmentDialog, RecordPaymentDialog, RefundRequestDialog, WaiveDialog } from "@/components/staff/payment-dialogs";
import { AssignInstructorSelect, EnrolDialog, PortalAccessButtons, RevealId } from "@/components/staff/student-actions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { LinkTabs } from "@/components/ui/tabs";
import { Alert, EmptyState } from "@/components/ui/states";
import { verifyStudentDocument } from "@/features/documents/actions";
import { getCourses, getInstructors, getLocations } from "@/features/staff/lookups";
import { acceptAgreementInPerson, anonymizeStudent, enrolmentAction, setStudentStatus } from "@/features/students/actions";
import { getStudentDetail } from "@/features/students/queries";
import { hasRole, requireRole } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatPhone, fullName, humanize, todayKE, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Student" };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-0.5 text-sm">{children || "—"}</dd></div>;
}

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; registered?: string }> }) {
  const user = await requireRole("manager", "admin", "accountant", "instructor");
  const { id } = await params;
  const { tab = "overview", registered } = await searchParams;
  const d = await getStudentDetail(id);
  if (!d) notFound();
  const { student: s } = d;
  const office = hasRole(user, "manager", "admin");
  const finance = hasRole(user, "manager", "accountant");
  const seesMoney = office || finance;
  const [locations, courses, instructors] = office ? await Promise.all([getLocations(), getCourses(), getInstructors()]) : [[], [], []];
  const insOpts = instructors.map((i) => ({ id: i.id, name: i.name, locationIds: i.locationIds }));
  const supabase = await createClient();
  const lines = seesMoney && d.enrolments.length
    ? (await supabase.from("v_invoice_line_balances").select("invoice_line_id, enrolment_id, component, description, amount_due, allocated, outstanding").eq("student_id", id)).data ?? []
    : [];
  const refunds = seesMoney ? (await supabase.from("refunds").select("*").eq("student_id", id).order("requested_at", { ascending: false })).data ?? [] : [];
  const hasOpen = d.enrolments.some((e) => ["pending_acceptance", "awaiting_deposit", "active", "training_complete", "suspended"].includes(e.status));
  const base = `/staff/students/${id}`;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Students", href: "/staff/students" }, { label: fullName(s) }]}
        title={<span className="flex flex-wrap items-center gap-2">{fullName(s)} <StatusBadge status={s.status} /></span>}
        description={<span className="flex flex-wrap gap-x-3"><span className="tabular">{s.student_number}</span><span>{s.location?.name}</span><a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-brand-700"><Phone className="size-3.5" />{formatPhone(s.phone)}</a></span>}
        actions={office && !s.anonymized_at && <>
          <PortalAccessButtons studentId={id} hasAccount={!!s.user_id} />
          {seesMoney && <RecordPaymentDialog studentId={id} isFinance={finance} />}
          {!hasOpen && <EnrolDialog studentId={id} homeLocation={s.home_location_id} instructors={insOpts}
            locations={locations.filter((l) => l.is_active).map((l) => ({ id: l.id, name: l.name }))}
            courses={courses.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, locationIds: c.course_locations.map((x) => x.location_id) }))} />}
        </>}
      />
      {registered && <Alert tone="success" title="Student registered" className="mb-4">Next: upload their ID document and issue an app activation code.</Alert>}
      {s.anonymized_at && <Alert tone="warning" className="mb-4">This record was anonymised on {formatDate(s.anonymized_at)}. Financial history is retained.</Alert>}

      <LinkTabs active={tab} tabs={[
        { key: "overview", label: "Overview", href: base },
        ...(seesMoney ? [{ key: "finance", label: "Fees & payments", href: `${base}?tab=finance` }] : []),
        { key: "training", label: "Training", href: `${base}?tab=training` },
        ...(office || hasRole(user, "accountant") ? [{ key: "documents", label: "Documents", href: `${base}?tab=documents`, count: d.documents.length }] : []),
        ...(office || finance ? [{ key: "activity", label: "Activity", href: `${base}?tab=activity` }] : []),
      ]} />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="space-y-5 lg:col-span-2">
            {d.enrolments.length === 0 && <Card><EmptyState title="Not enrolled yet" description="Enrol the student on a course to create their fee plan and NTSA record." /></Card>}
            {d.enrolments.map((e) => (
              <Card key={e.id}>
                <CardHeader title={e.course?.name} description={`${e.enrolment_number} · ${e.location?.name} · started ${formatDate(e.start_date)}`} action={<StatusBadge status={e.status} />} />
                <CardBody className="space-y-4">
                  {e.status === "pending_acceptance" && office && (
                    <Alert tone="warning" title="Fee plan not yet accepted">
                      <p>The student can accept it in their app, or you can record acceptance in person after they review the fees.</p>
                      <div className="mt-2"><ActionButton size="sm" action={async () => { "use server"; return acceptAgreementInPerson(e.id, todayKE()); }}
                        confirm={{ title: "Record in-person acceptance?", description: "Confirm the student has seen the full fee breakdown and agrees. Deposit is due today.", confirmLabel: "Student accepts" }}>Record acceptance</ActionButton></div>
                    </Alert>
                  )}
                  <div className="grid gap-4 sm:grid-cols-3">
                    {seesMoney && e.balance && (
                      <div>
                        <p className="text-xs font-medium text-muted">Balance</p>
                        <p className="text-lg font-semibold"><Money value={e.balance.total_outstanding} /></p>
                        <ProgressBar value={toNumber(e.balance.total_due) ? (toNumber(e.balance.total_paid) / toNumber(e.balance.total_due)) * 100 : 0} className="mt-1.5" label="Paid" />
                        <p className="mt-1 text-xs text-muted"><Money value={e.balance.total_paid} /> of <Money value={e.balance.total_due} /> paid</p>
                      </div>
                    )}
                    {e.progress && (
                      <div>
                        <p className="text-xs font-medium text-muted">Training</p>
                        <p className="text-lg font-semibold">{e.progress.theory_attended + e.progress.practical_attended}/{e.progress.theory_required + e.progress.practical_required} lessons</p>
                        <ProgressBar value={e.progress.competency_progress_pct} tone="success" className="mt-1.5" label="Competencies" />
                        <p className="mt-1 text-xs text-muted">{e.progress.competencies_competent}/{e.progress.competencies_required} skills signed off</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted">Instructor</p>
                      {office && !["completed", "withdrawn", "cancelled"].includes(e.status)
                        ? <div className="mt-1"><AssignInstructorSelect enrolmentId={e.id} current={e.assigned_instructor_id} instructors={insOpts.filter((i) => i.locationIds.includes(e.location_id))} /></div>
                        : <p className="text-sm">{e.instructor?.profile?.full_name ?? "Unassigned"}</p>}
                    </div>
                  </div>
                  {e.ntsa && (
                    <div className="rounded-md border border-border p-3">
                      <div className="mb-3 flex items-center justify-between text-sm"><span className="font-medium">NTSA</span>
                        <Link href={`/staff/ntsa/${e.ntsa.id}`} className="font-medium text-brand-700 hover:underline">Open NTSA record</Link></div>
                      <NtsaSteps status={e.ntsa.status} />
                    </div>
                  )}
                  {e.certificate_number && <p className="text-sm">Certificate: <span className="font-medium">{e.certificate_number}</span> · completed {formatDate(e.completed_at)}</p>}
                  {office && (
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      {e.status === "active" && <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return enrolmentAction(e.id, "training_complete"); }}
                        confirm={{ title: "Mark training complete?", description: "All required competencies must be signed off." }}>Mark training complete</ActionButton>}
                      {e.status === "training_complete" && <ActionButton size="sm" action={async () => { "use server"; return enrolmentAction(e.id, "complete"); }}
                        confirm={{ title: "Complete course and issue certificate?", description: "Requires an NTSA pass and (by policy) a cleared balance." }}>Complete course</ActionButton>}
                      {hasRole(user, "manager") && !["completed", "withdrawn", "cancelled"].includes(e.status) && (
                        <ActionButton size="sm" variant="ghost" className="text-danger-700" requireReason action={async (reason) => { "use server"; return enrolmentAction(e.id, "withdraw", reason); }}
                          confirm={{ title: "Withdraw from course?", description: "Future lessons are cancelled. Fees already allocated stay on record; use adjustments or refunds as needed.", destructive: true, confirmLabel: "Withdraw" }}>Withdraw</ActionButton>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
          <div className="space-y-5">
            <Card>
              <CardHeader title="Personal details" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-4">
                  <Info label="Date of birth">{formatDate(s.date_of_birth)}</Info>
                  <Info label="Gender">{humanize(s.gender)}</Info>
                  <Info label={humanize(s.id_type ?? "ID")}>{office ? <RevealId studentId={id} last4={s.id_number_last4} /> : `••••${s.id_number_last4 ?? ""}`}</Info>
                  <Info label="Email">{s.email}</Info>
                  <Info label="Alt. phone">{s.alt_phone ? formatPhone(s.alt_phone) : null}</Info>
                  <Info label="Residence">{s.residence}</Info>
                  <Info label="Registered">{formatDate(s.registered_at)}</Info>
                  <Info label="App account">{s.user_id ? "Active" : "Not activated"}</Info>
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Emergency contact" />
              <CardBody>
                <p className="text-sm font-medium">{s.emergency_contact_name ?? "—"}</p>
                <p className="text-sm text-muted">{s.emergency_contact_relationship}</p>
                {s.emergency_contact_phone && <a className="text-sm text-brand-700" href={`tel:${s.emergency_contact_phone}`}>{formatPhone(s.emergency_contact_phone)}</a>}
              </CardBody>
            </Card>
            {office && (
              <Card>
                <CardHeader title="Consents" />
                <CardBody>
                  <ul className="space-y-1.5 text-sm">
                    {d.consents.map((c, i) => <li key={i} className="flex justify-between gap-2"><span>{humanize(c.consent_type)}</span><span className="text-muted">{c.granted ? "Yes" : "No"} · {formatDate(c.recorded_at)}</span></li>)}
                  </ul>
                </CardBody>
              </Card>
            )}
            {office && !s.anonymized_at && (
              <Card>
                <CardHeader title="Record status" />
                <CardBody className="flex flex-wrap gap-2">
                  {s.status === "suspended"
                    ? <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return setStudentStatus(id, "active"); }}>Reactivate</ActionButton>
                    : <ActionButton size="sm" variant="secondary" requireReason action={async (r) => { "use server"; return setStudentStatus(id, "suspended", r); }}
                        confirm={{ title: "Suspend student?", confirmLabel: "Suspend", destructive: true }}>Suspend</ActionButton>}
                  {hasRole(user, "manager") && (
                    <ActionButton size="sm" variant="ghost" className="text-danger-700" requireReason reasonLabel="Legal basis / request reference"
                      action={async (r) => { "use server"; return anonymizeStudent(id, r ?? ""); }}
                      confirm={{ title: "Anonymise this student?", description: "Permanently removes personal details and documents. Financial records are kept with the student number. This cannot be undone.", destructive: true, confirmLabel: "Anonymise" }}>
                      Anonymise (data protection)
                    </ActionButton>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "finance" && seesMoney && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4"><p className="text-xs text-muted">Total billed</p><p className="text-lg font-semibold"><Money value={d.balance?.total_due} /></p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Paid</p><p className="text-lg font-semibold text-success-700"><Money value={d.balance?.total_paid} /></p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Outstanding</p><p className="text-lg font-semibold"><Money value={d.balance?.total_outstanding} /></p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Credit (unapplied)</p><p className="text-lg font-semibold"><Money value={d.credit} /></p>
              {toNumber(d.credit) > 0 && office && <div className="mt-2"><RefundRequestDialog studentId={id} credit={toNumber(d.credit)} /></div>}</Card>
          </div>
          {d.enrolments.filter((e) => e.instalments.length > 0 || lines.some((l) => l.enrolment_id === e.id)).map((e) => (
            <div key={e.id} className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
              <Card>
                <CardHeader title="Fee lines" description={`${e.enrolment_number} · ${e.course?.name}`} action={finance && <AdjustmentDialog lines={lines.filter((l) => l.enrolment_id === e.id).map((l) => ({ id: l.invoice_line_id!, label: humanize(l.component), outstanding: toNumber(l.outstanding) }))} />} />
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs text-muted"><th className="px-4 py-2 font-medium">Component</th><th className="px-4 py-2 text-right font-medium">Due</th><th className="px-4 py-2 text-right font-medium">Paid</th><th className="px-4 py-2 text-right font-medium">Left</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {lines.filter((l) => l.enrolment_id === e.id).map((l) => (
                      <tr key={l.invoice_line_id}><td className="px-4 py-2.5">{humanize(l.component)}</td><td className="px-4 text-right"><Money value={l.amount_due} /></td>
                        <td className="px-4 text-right"><Money value={l.allocated} /></td><td className="px-4 text-right font-medium"><Money value={l.outstanding} /></td></tr>
                    ))}
                  </tbody>
                </table></div>
              </Card>
              <Card>
                <CardHeader title="Instalments" />
                <ul className="divide-y divide-border">
                  {e.instalments.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm sm:px-5">
                      <span>{i.label}<span className="block text-xs text-muted">Due {formatDate(i.due_date)}</span></span>
                      <span className="ml-auto flex items-center gap-3">
                        <span className="text-right"><Money value={i.effective_amount} /><span className="block text-xs text-muted">paid <Money value={i.amount_paid} /></span></span>
                        <StatusBadge status={i.status} />
                        {finance && toNumber(i.amount_outstanding) > 0 && <WaiveDialog instalmentId={i.id!} outstanding={toNumber(i.amount_outstanding)} label={i.label!} />}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
          <Card>
            <CardHeader title="Payments" />
            {d.payments.length === 0 ? <EmptyState title="No payments yet" description="M-Pesa payments with this student's number as the account appear automatically." /> : (
              <ul className="divide-y divide-border">
                {d.payments.map((p) => (
                  <li key={p.id}>
                    <Link href={`/staff/payments/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted/60 sm:px-5">
                      <span><span className="font-medium"><Money value={p.amount} /></span><span className="block text-xs text-muted">{formatDateTime(p.received_at)} · {p.receipt_number ?? "no receipt yet"} · {p.external_reference}</span></span>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {refunds.length > 0 && (
            <Card>
              <CardHeader title="Refunds" />
              <ul className="divide-y divide-border text-sm">{refunds.map((r) => <li key={r.id} className="flex justify-between px-4 py-2.5 sm:px-5"><span>{r.refund_number} · {r.reason}</span><span className="flex gap-2"><Money value={r.amount} /><StatusBadge status={r.status} /></span></li>)}</ul>
            </Card>
          )}
        </div>
      )}

      {tab === "training" && (
        <div className="space-y-5">
          {d.enrolments.filter((e) => e.progress).map((e) => (
            <Card key={e.id}>
              <CardHeader title={e.course?.name} description={e.enrolment_number} action={["active", "training_complete"].includes(e.status) && (hasRole(user, "manager", "admin", "instructor")) && <Link href={`/staff/training/${e.id}`} className={buttonVariants({ size: "sm" })}>Assess skills</Link>} />
              <CardBody className="grid gap-4 sm:grid-cols-4">
                <Info label="Theory">{e.progress!.theory_attended}/{e.progress!.theory_required}</Info>
                <Info label="Practical">{e.progress!.practical_attended}/{e.progress!.practical_required}</Info>
                <Info label="Missed">{e.progress!.missed_sessions}</Info>
                <Info label="Skills signed off">{e.progress!.competencies_competent}/{e.progress!.competencies_required}</Info>
              </CardBody>
            </Card>
          ))}
          {d.enrolments.length === 0 && <Card><EmptyState title="No training yet" /></Card>}
        </div>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader title="Documents" description="Private – opened through short-lived secure links." action={office && <DocumentUpload studentId={id} />} />
          {d.documents.length === 0 ? <EmptyState icon={FileText} title="No documents uploaded" description="Upload the student's ID to unlock the NTSA process." /> : (
            <ul className="divide-y divide-border">
              {d.documents.map((doc) => (
                <li key={doc.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <a href={`/api/documents/${doc.id}`} className="flex items-center gap-3">
                    <FileText className="size-5 text-muted" />
                    <span><span className="block text-sm font-medium">{humanize(doc.document_type)}</span><span className="block text-xs text-muted">{doc.file_name} · {formatDate(doc.uploaded_at)}{doc.rejection_reason ? ` · ${doc.rejection_reason}` : ""}</span></span>
                  </a>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={doc.status} />
                    {office && doc.status === "pending" && <>
                      <ActionButton size="sm" action={async () => { "use server"; return verifyStudentDocument(doc.id, true); }}>Verify</ActionButton>
                      <ActionButton size="sm" variant="secondary" requireReason action={async (r) => { "use server"; return verifyStudentDocument(doc.id, false, r); }} confirm={{ title: "Reject document", confirmLabel: "Reject" }}>Reject</ActionButton>
                    </>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader title="Activity" description="Audited changes to this student's record" />
          {d.activity.length === 0 ? <EmptyState title="No recorded activity" /> : (
            <ul className="divide-y divide-border text-sm">
              {d.activity.map((a) => (
                <li key={a.id} className="px-4 py-2.5 sm:px-5"><span className="font-medium">{humanize(a.action.replace(/\./g, " "))}</span>
                  <span className="block text-xs text-muted">{formatDateTime(a.occurred_at)} · {(a.actor_roles ?? []).map(humanize).join(", ") || "system"}</span></li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
