import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { registerUrls } from "@/features/payments/mpesa-actions";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, humanize } from "@/lib/format";
import { darajaConfigured } from "@/lib/mpesa/daraja";
import { mpesaEnv } from "@/lib/mpesa/service";
import { providerStatus } from "@/lib/notifications/providers";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";

export const metadata: Metadata = { title: "Integrations" };

function Status({ ok, label }: { ok: boolean; label: string }) {
  return <Badge tone={ok ? "success" : "warning"} dot>{label}</Badge>;
}

export default async function IntegrationsPage() {
  await requireRole("manager", "platform_owner");
  const supabase = await createClient();
  const [{ data: logs }, { data: settings }] = await Promise.all([
    supabase.from("mpesa_webhook_logs").select("id, received_at, endpoint, outcome, http_status, trans_id, error_message, auth_ok").order("received_at", { ascending: false }).limit(25),
    supabase.from("school_settings").select("paybill_number, etims_enabled, vat_registered").eq("id", 1).single(),
  ]);
  const last24 = (logs ?? []).filter((l) => Date.parse(l.received_at) > nowMs() - 86_400_000);
  const errors = last24.filter((l) => ["error", "unauthorized"].includes(l.outcome)).length;
  const p = providerStatus();
  const app = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Integrations" breadcrumbs={[{ label: "Settings", href: "/staff/settings" }, { label: "Integrations" }]}
        description="Secrets live in environment variables, never in the database or this screen." />
      <Card><CardHeader title="M-Pesa Daraja (C2B Paybill)" action={<Status ok={mpesaEnv() === "production"} label={humanize(mpesaEnv())} />} />
        <CardBody className="space-y-3 text-sm">
          <p>Paybill: <b>{settings?.paybill_number ?? "not set"}</b> · Daraja credentials: <Status ok={darajaConfigured()} label={darajaConfigured() ? "Configured" : "Missing"} /> · Callback token: <Status ok={(process.env.MPESA_CALLBACK_TOKEN ?? "").length >= 24} label={(process.env.MPESA_CALLBACK_TOKEN ?? "").length >= 24 ? "Set" : "Missing/weak"} /></p>
          <p className="break-all text-xs text-muted">Confirmation URL: {app}/api/mpesa/c2b/confirmation?token=•••• · Validation URL: {app}/api/mpesa/c2b/validation?token=••••</p>
          <p>Last 24h: {last24.length} callbacks, <span className={errors ? "font-semibold text-danger-700" : ""}>{errors} errors/unauthorised</span></p>
          <ActionButton size="sm" variant="secondary" action={async () => { "use server"; return registerUrls(); }} confirm={{ title: "Register callback URLs with Safaricom?", description: "Sends the URLs above to Daraja for this shortcode." }}>Register C2B URLs</ActionButton>
        </CardBody>
      </Card>
      <Card><CardHeader title="Notifications" /><CardBody className="flex flex-wrap gap-3 text-sm">
        <span>SMS (Africa&apos;s Talking): <Status ok={p.sms} label={p.sms ? "Live" : "Sandbox – logged only"} /></span>
        <span>Email: <Status ok={p.email} label={p.email ? "Live" : "Sandbox – logged only"} /></span>
        <span>Web push: <Status ok={p.push} label={p.push ? "Configured" : "VAPID keys missing"} /></span>
      </CardBody></Card>
      <Card><CardHeader title="KRA eTIMS" /><CardBody className="text-sm">
        <p>Invoice queueing: <Status ok={!!settings?.etims_enabled} label={settings?.etims_enabled ? "On" : "Off"} /> · VAT registered: {settings?.vat_registered ? "Yes" : "No"}</p>
        <p className="mt-2 text-muted">No eTIMS provider is connected. Invoices are queued in <code>etims_submissions</code> and are only marked submitted when an adapter receives KRA confirmation. See docs/FINANCE.md.</p>
      </CardBody></Card>
      <Card><CardHeader title="Callback log" description="Payloads are stored sanitised (masked phone numbers)" />
        <ul className="divide-y divide-border text-sm">{(logs ?? []).map((l) => (
          <li key={l.id} className="flex justify-between gap-3 px-5 py-2"><span><span className="font-mono text-xs">{l.trans_id ?? "—"}</span> <span className="text-muted">· {l.endpoint} · {formatDateTime(l.received_at)}</span>{l.error_message && <span className="block text-xs text-danger-700">{l.error_message}</span>}</span>
            <span className="text-xs">{humanize(l.outcome)} · {l.http_status}</span></li>
        ))}</ul>
      </Card>
    </div>
  );
}
