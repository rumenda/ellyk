import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { Receipt } from "@/components/receipt";
import { loadReceipt } from "@/features/student/receipt";
import { requireStudent } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Receipt" };

export default async function StudentReceipt({ params }: { params: Promise<{ id: string }> }) {
  await requireStudent();
  const { id } = await params;
  const r = await loadReceipt(id);
  if (!r) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <Link href="/app/payments" className="flex items-center gap-1 text-sm font-medium text-brand-700"><ArrowLeft className="size-4" />Payments</Link>
        <PrintButton />
      </div>
      <Receipt r={r} />
    </div>
  );
}
