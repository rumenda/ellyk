import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toNumber, fullName } from "@/lib/format";
import type { ReceiptData } from "@/components/receipt";
import type { Component } from "@/lib/finance/allocation";

/** Loads a receipt the current user is allowed to see (RLS decides). */
export async function loadReceipt(paymentId: string): Promise<ReceiptData | null> {
  const supabase = await createClient();
  const { data: p } = await supabase.from("payments")
    .select("id, receipt_number, amount, received_at, source, external_reference, status, student_id, student:students(student_number, first_name, middle_name, last_name), allocations:payment_allocations(amount, line:invoice_lines(component, description))")
    .eq("id", paymentId).maybeSingle();
  if (!p || !p.student) return null;
  const [{ data: school }, { data: bal }] = await Promise.all([
    supabase.from("school_settings").select("legal_name, kra_pin, physical_address, phone, vat_registered").eq("id", 1).single(),
    supabase.from("v_student_balances").select("total_outstanding").eq("student_id", p.student_id!).maybeSingle(),
  ]);
  const grouped = new Map<string, { component: Component; description: string; amount: number }>();
  for (const a of p.allocations ?? []) {
    const key = a.line?.component ?? "other";
    const cur = grouped.get(key) ?? { component: key as Component, description: a.line?.description ?? "", amount: 0 };
    cur.amount = Math.round((cur.amount + toNumber(a.amount)) * 100) / 100;
    grouped.set(key, cur);
  }
  return {
    receipt_number: p.receipt_number, amount: toNumber(p.amount), received_at: p.received_at, source: p.source,
    external_reference: p.external_reference, status: p.status,
    student: { student_number: p.student.student_number, name: fullName(p.student) },
    allocations: [...grouped.values()].filter((a) => a.amount !== 0),
    balanceAfter: bal ? toNumber(bal.total_outstanding) : null,
    school: school ?? { legal_name: "Elly K Driving School", kra_pin: null, physical_address: null, phone: null, vat_registered: false },
  };
}
