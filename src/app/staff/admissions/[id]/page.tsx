import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone, UserCheck } from "lucide-react";
import { LeadActivityForm, LeadStageSelect } from "@/components/staff/lead-forms";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatPhone, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("manager", "admin");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: lead }, { data: acts }] = await Promise.all([
    supabase.from("leads").select("*, course:courses(name), location:locations(name), assignee:profiles!leads_assigned_to_fkey(full_name)").eq("id", id).maybeSingle(),
    supabase.from("lead_activities").select("*, author:profiles(full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);
  if (!lead) notFound();
  const wa = `https://wa.me/${lead.phone.replace("+", "")}`;
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: "Admissions", href: "/staff/admissions" }, { label: lead.full_name }]}
        title={<span className="flex items-center gap-2">{lead.full_name}<StatusBadge status={lead.stage} /></span>}
        description={`${humanize(lead.source)} enquiry · ${formatDate(lead.created_at)}`}
        actions={<>
          <a href={`tel:${lead.phone}`} className={buttonVariants({ variant: "secondary", size: "sm" })}><Phone />Call</a>
          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}><MessageCircle />WhatsApp</a>
          {lead.stage !== "converted" && lead.stage !== "lost" && <Link href={`/staff/students/new?lead=${lead.id}`} className={buttonVariants({ size: "sm" })}><UserCheck />Convert to student</Link>}
          {lead.converted_student_id && <Link href={`/staff/students/${lead.converted_student_id}`} className={buttonVariants({ size: "sm" })}>Open student</Link>}
        </>} />
      <div className="grid gap-5 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader title="Activity" />
          <CardBody className="space-y-5">
            {lead.stage !== "converted" && <LeadActivityForm leadId={lead.id} />}
            <ol className="space-y-4 border-l border-border pl-4">
              {(acts ?? []).map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand-500 ring-4 ring-surface" />
                  <p className="text-sm">
                    <span className="font-medium">{humanize(a.activity_type)}</span>
                    {a.activity_type === "stage_change" && <> · {humanize(a.from_stage)} → {humanize(a.to_stage)}</>}
                  </p>
                  {a.body && <p className="text-sm text-muted">{a.body}</p>}
                  <p className="text-xs text-subtle">{formatDateTime(a.created_at)} · {a.author?.full_name ?? "Website"}</p>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Details" />
          <CardBody className="space-y-3 text-sm">
            <div><p className="text-xs font-medium text-muted">Stage</p><div className="mt-1"><LeadStageSelect leadId={lead.id} stage={lead.stage} /></div></div>
            {[["Phone", formatPhone(lead.phone)], ["Alt. phone", lead.alt_phone ? formatPhone(lead.alt_phone) : null], ["Email", lead.email],
              ["Location", lead.location?.name], ["Course", lead.course?.name], ["Referred by", lead.referral_name],
              ["Assigned to", lead.assignee?.full_name], ["Next follow-up", lead.follow_up_at ? formatDateTime(lead.follow_up_at) : null],
              ["Lost reason", lead.lost_reason], ["Notes", lead.notes]].map(([k, v]) => v ? (
              <div key={k as string}><p className="text-xs font-medium text-muted">{k}</p><p>{v}</p></div>) : null)}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
