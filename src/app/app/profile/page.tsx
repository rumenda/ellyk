import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, KeyRound, LogOut } from "lucide-react";
import { DocumentUpload } from "@/components/documents/upload";
import { StatusBadge } from "@/components/status-badge";
import { EnablePush, NotificationPreferences } from "@/components/student/preferences";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOut } from "@/features/auth/actions";
import { getStudentOverview } from "@/features/student/queries";
import { requireStudent } from "@/lib/auth/session";
import { formatDate, formatPhone, fullName, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireStudent();
  const o = await getStudentOverview(user.studentId);
  const s = o.student;
  const supabase = await createClient();
  const [{ data: docs }, { data: prefs }] = await Promise.all([
    supabase.from("student_documents").select("id, document_type, file_name, status, uploaded_at").eq("student_id", s.id).order("uploaded_at", { ascending: false }),
    supabase.from("notification_preferences").select("sms, email, push").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid size-14 place-items-center rounded-full bg-brand-600 text-lg font-semibold text-white">{s.first_name[0]}{s.last_name[0]}</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{fullName(s)}</h1>
          <p className="text-sm text-muted">Student no. <span className="font-medium text-text tabular">{s.student_number}</span></p>
        </div>
      </div>

      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">My details</h2>
        <dl className="divide-y divide-border">
          <Row label="Phone" value={formatPhone(s.phone)} />
          <Row label="Email" value={s.email} />
          <Row label="Date of birth" value={s.date_of_birth ? formatDate(s.date_of_birth) : null} />
          <Row label="ID" value={s.id_type ? `${humanize(s.id_type)} ••••${s.id_number_last4 ?? ""}` : null} />
          <Row label="Residence" value={s.residence} />
          <Row label="Course" value={o.current?.course?.name} />
          <Row label="Training location" value={o.current?.location?.name} />
          <Row label="Instructor" value={o.current?.instructor?.profile?.full_name} />
        </dl>
        <p className="border-t border-border px-4 py-3 text-xs text-muted">Something wrong? Ask the office to correct it – you have a right to accurate records.</p>
      </Card>

      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Emergency contact</h2>
        <dl className="divide-y divide-border">
          <Row label="Name" value={s.emergency_contact_name} />
          <Row label="Relationship" value={s.emergency_contact_relationship} />
          <Row label="Phone" value={s.emergency_contact_phone ? formatPhone(s.emergency_contact_phone) : null} />
        </dl>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">Documents</h2>
          <DocumentUpload studentId={s.id} label="Upload" />
        </div>
        {(docs ?? []).length === 0 ? <p className="px-4 py-4 text-sm text-muted">No documents yet. Upload your ID so we can start your NTSA process.</p> : (
          <ul className="divide-y divide-border">
            {docs!.map((d) => (
              <li key={d.id}>
                <a href={`/api/documents/${d.id}`} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="size-5 text-muted" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{humanize(d.document_type)}</p><p className="truncate text-xs text-muted">{d.file_name} · {formatDate(d.uploaded_at)}</p></div>
                  <StatusBadge status={d.status} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-semibold">Notifications</h2>
        <div className="px-4"><NotificationPreferences initial={{ sms: prefs?.sms ?? true, email: prefs?.email ?? true, push: prefs?.push ?? true }} /></div>
        <div className="px-4 pb-4"><EnablePush vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined} /></div>
      </Card>

      <Card>
        <Link href="/account/password" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium"><KeyRound className="size-5 text-muted" />Change password<ChevronRight className="ml-auto size-4 text-subtle" /></Link>
        <form action={signOut} className="border-t border-border">
          <Button type="submit" variant="ghost" className="h-12 w-full justify-start gap-3 rounded-none px-4 text-danger-700"><LogOut className="size-5" />Sign out</Button>
        </form>
      </Card>
      <p className="text-center text-xs text-muted">Help: call {formatPhone(o.settings?.phone)} · {o.settings?.email}</p>
    </div>
  );
}
