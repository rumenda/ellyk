import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FeeQuote, type Quote } from "@/components/fee-quote";
import { ActionButton } from "@/components/forms/action-button";
import { Card } from "@/components/ui/card";
import { acceptMyAgreement } from "@/features/student/actions";
import { requireStudent } from "@/lib/auth/session";
import { buildSchedule } from "@/lib/finance/schedule";
import { todayKE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Review fee plan" };

export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;
  const supabase = await createClient();
  const { data: enr } = await supabase.from("enrolments").select("id, status, student_id, price_version_id, course:courses(name), location:locations(name)").eq("id", id).maybeSingle();
  if (!enr || enr.student_id !== user.studentId) notFound();
  if (enr.status !== "pending_acceptance") redirect("/app/payments");
  const [{ data: q }, { data: settings }] = await Promise.all([
    supabase.rpc("quote_price_version", { p_price_version: enr.price_version_id }),
    supabase.from("school_settings").select("terms_text, terms_version").eq("id", 1).single(),
  ]);
  const quote = q as unknown as Quote;
  const schedule = buildSchedule({ total: quote.total, deposit: quote.deposit, mode: quote.instalment_mode, count: quote.instalment_count,
    amount: quote.instalment_amount, frequency: quote.frequency, depositDueDate: todayKE() });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Review your fee plan</h1>
        <p className="text-sm text-muted">{enr.course?.name} · {enr.location?.name}</p>
      </div>
      <FeeQuote quote={quote} schedule={schedule} />
      <Card className="p-4 text-sm">
        <p className="font-semibold">Terms (version {settings?.terms_version})</p>
        <p className="mt-1 text-muted">{settings?.terms_text}</p>
      </Card>
      <ActionButton size="lg" className="w-full" action={async () => { "use server"; return acceptMyAgreement(id); }}
        confirm={{ title: "Accept this fee plan?", description: "You agree to the total, the deposit and the weekly instalments shown. There is no interest.", confirmLabel: "Yes, I accept" }}>
        I accept this fee plan
      </ActionButton>
    </div>
  );
}
