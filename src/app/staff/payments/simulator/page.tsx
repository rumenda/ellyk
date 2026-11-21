import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, humanize } from "@/lib/format";
import { mpesaEnv } from "@/lib/mpesa/service";
import { createClient } from "@/lib/supabase/server";
import { SimulatorForm } from "./simulator-form";

export const metadata: Metadata = { title: "M-Pesa sandbox" };

export default async function SimulatorPage() {
  await requireRole("manager", "accountant", "platform_owner");
  if (mpesaEnv() !== "sandbox") notFound();
  const supabase = await createClient();
  const { data: logs } = await supabase.from("mpesa_webhook_logs").select("id, received_at, endpoint, trans_id, amount, outcome, result_code, error_message").order("received_at", { ascending: false }).limit(15);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="M-Pesa sandbox simulator" breadcrumbs={[{ label: "Payments", href: "/staff/payments" }, { label: "Sandbox" }]} />
      <Alert tone="warning" title="Sandbox mode – no real money" className="mb-4">
        This sends a Daraja-format C2B confirmation through the same validation, idempotency, matching and allocation code as live callbacks.
        Transactions are marked &quot;sandbox&quot;. The simulator is disabled when MPESA_ENV=production.
      </Alert>
      <Card className="mb-5"><CardHeader title="Simulate a Paybill payment" /><CardBody><SimulatorForm paybill={process.env.MPESA_SHORTCODE ?? "600999"} /></CardBody></Card>
      <Card>
        <CardHeader title="Recent callbacks" description="Integration log (all endpoints)" />
        <ul className="divide-y divide-border text-sm">
          {(logs ?? []).map((l) => (
            <li key={l.id} className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
              <span><span className="font-mono text-xs">{l.trans_id ?? "—"}</span> <span className="text-muted">· {humanize(l.endpoint)} · {formatDateTime(l.received_at)}</span>{l.error_message && <span className="block text-xs text-danger-700">{l.error_message}</span>}</span>
              <span className="text-xs font-medium">{humanize(l.outcome)}{l.result_code ? ` (${l.result_code})` : ""}</span>
            </li>
          ))}
          {(logs ?? []).length === 0 && <li className="px-5 py-4 text-muted">No callbacks yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
