import type { Metadata } from "next";
import { RecordForm } from "@/components/forms/record-form";
import { SequenceRow, TaxRateForm } from "@/components/staff/settings-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { saveSchoolSettings } from "@/features/settings/actions";
import { hasRole, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "School settings" };

function Check({ name, label, checked, hint, disabled }: { name: string; label: string; checked: boolean; hint?: string; disabled?: boolean }) {
  return <label className="flex items-start gap-3 text-sm"><Checkbox name={name} defaultChecked={checked} disabled={disabled} className="mt-0.5" /><span><span className="font-medium">{label}</span>{hint && <span className="block text-muted">{hint}</span>}</span></label>;
}

export default async function SchoolSettings() {
  const user = await requireRole("manager", "accountant");
  const mgr = hasRole(user, "manager");
  const supabase = await createClient();
  const [{ data: s }, { data: seqs }, { data: taxes }] = await Promise.all([
    supabase.from("school_settings").select("*").eq("id", 1).single(),
    supabase.from("document_sequences").select("*").order("key"),
    supabase.from("tax_rates").select("*").order("code"),
  ]);
  if (!s) return null;
  return (
    <div className="max-w-4xl">
      <PageHeader title="School, tax & payments" breadcrumbs={[{ label: "Settings", href: "/staff/settings" }, { label: "School" }]} />
      <RecordForm action={saveSchoolSettings} submitLabel="Save settings" className="space-y-5">
        <Card><CardHeader title="School profile" description={mgr ? undefined : "Only a manager can change these."} /><CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name" htmlFor="legal_name"><Input id="legal_name" name="legal_name" defaultValue={s.legal_name} disabled={!mgr} /></Field>
          <Field label="Trading name" htmlFor="trading_name"><Input id="trading_name" name="trading_name" defaultValue={s.trading_name} disabled={!mgr} /></Field>
          <Field label="Physical address" htmlFor="physical_address"><Input id="physical_address" name="physical_address" defaultValue={s.physical_address ?? ""} disabled={!mgr} /></Field>
          <Field label="Postal address" htmlFor="postal_address"><Input id="postal_address" name="postal_address" defaultValue={s.postal_address ?? ""} disabled={!mgr} /></Field>
          <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={s.phone ?? ""} disabled={!mgr} /></Field>
          <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={s.email ?? ""} disabled={!mgr} /></Field>
        </CardBody></Card>
        <Card><CardHeader title="Tax & eTIMS" /><CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="KRA PIN" htmlFor="kra_pin"><Input id="kra_pin" name="kra_pin" defaultValue={s.kra_pin ?? ""} placeholder="P051234567X" /></Field>
          <Field label="Fiscal year starts" htmlFor="fiscal_year_start_month"><Select id="fiscal_year_start_month" name="fiscal_year_start_month" defaultValue={s.fiscal_year_start_month}>
            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Field>
          <Check name="vat_registered" label="Registered for VAT" checked={s.vat_registered} hint="When on, taxable fee items carry their configured tax rate. NTSA and the service fee are never taxed as school income." />
          <Check name="prices_tax_inclusive" label="Course prices include tax" checked={s.prices_tax_inclusive} />
          <Check name="etims_enabled" label="Queue invoices for eTIMS" checked={s.etims_enabled} hint="Requires an eTIMS provider adapter (see docs). Invoices are never marked submitted without confirmation." />
        </CardBody></Card>
        <Card><CardHeader title="Payments" /><CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="M-Pesa Paybill number" htmlFor="paybill_number" hint="Callbacks for any other shortcode are rejected"><Input id="paybill_number" name="paybill_number" defaultValue={s.paybill_number ?? ""} inputMode="numeric" /></Field>
          <Field label="Unknown account numbers" htmlFor="mpesa_unknown_account_policy"><Select id="mpesa_unknown_account_policy" name="mpesa_unknown_account_policy" defaultValue={s.mpesa_unknown_account_policy}>
            <option value="accept">Accept and queue for reconciliation (recommended)</option><option value="reject">Reject at validation</option></Select></Field>
          <Field label="Payment allocation order" htmlFor="allocation_priority" hint="Comma-separated; first is paid first"><Input id="allocation_priority" name="allocation_priority" defaultValue={s.allocation_priority.join(", ")} /></Field>
          <Field label="Default platform service fee (KES)" htmlFor="default_service_fee" hint="Suggested for new price versions"><Input id="default_service_fee" name="default_service_fee" type="number" min={0} defaultValue={s.default_service_fee} /></Field>
          <Field label="Payment reminder (days before due)" htmlFor="payment_due_reminder_days"><Input id="payment_due_reminder_days" name="payment_due_reminder_days" type="number" min={0} max={14} defaultValue={s.payment_due_reminder_days} /></Field>
          <Field label="Paybill instruction for students" htmlFor="paybill_account_hint"><Input id="paybill_account_hint" name="paybill_account_hint" defaultValue={s.paybill_account_hint} disabled={!mgr} /></Field>
        </CardBody></Card>
        {mgr && <Card><CardHeader title="Rules, security & privacy" /><CardBody className="grid gap-4 sm:grid-cols-2">
          <Check name="require_full_payment_for_completion" label="Require full payment before course completion" checked={s.require_full_payment_for_completion} />
          <Check name="require_staff_mfa" label="Require two-step verification for all staff" checked={s.require_staff_mfa} />
          <Field label="Minimum student age" htmlFor="minimum_student_age"><Input id="minimum_student_age" name="minimum_student_age" type="number" min={16} max={30} defaultValue={s.minimum_student_age} /></Field>
          <Field label="Data retention (years)" htmlFor="data_retention_years" hint="Records past this are eligible for anonymisation"><Input id="data_retention_years" name="data_retention_years" type="number" min={1} max={20} defaultValue={s.data_retention_years} /></Field>
          <Field label="Terms version" htmlFor="terms_version"><Input id="terms_version" name="terms_version" defaultValue={s.terms_version} /></Field>
          <Field label="Fee agreement terms" htmlFor="terms_text" className="sm:col-span-2"><Textarea id="terms_text" name="terms_text" defaultValue={s.terms_text} rows={3} /></Field>
        </CardBody></Card>}
      </RecordForm>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Document numbering" description="Applies to newly issued documents" />
          <ul className="divide-y divide-border">{(seqs ?? []).map((q) => <SequenceRow key={q.key} seq={q} />)}</ul>
        </Card>
        <Card><CardHeader title="Tax rates" />
          <ul className="divide-y divide-border text-sm">{(taxes ?? []).map((t) => <li key={t.id} className="px-5 py-2.5"><TaxRateForm rate={t} /></li>)}</ul>
          <CardBody className="border-t border-border"><TaxRateForm /></CardBody>
        </Card>
      </div>
    </div>
  );
}
