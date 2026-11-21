"use client";
import { useState } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatKES } from "@/lib/format";

function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-3 py-2.5">
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="tabular text-lg font-semibold tracking-wide">{display ?? value}</p>
      </div>
      <Button variant="secondary" size="sm" aria-label={`Copy ${label}`} onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); toast.success(`${label} copied`); setTimeout(() => setCopied(false), 2000); }
        catch { toast.error("Couldn't copy – please write it down"); }
      }}>
        {copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** M-Pesa Paybill steps. No payment is "faked" here – the student pays from their phone and the callback updates the balance. */
export function PayInstructions({ paybill, account, amount, trigger }: {
  paybill: string | null; account: string; amount?: number; trigger?: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger ?? <Button size="lg" className="w-full"><Smartphone />Pay with M-Pesa</Button>}</DialogTrigger>
      <DialogContent title="Pay with M-Pesa" description="Payments reflect here automatically within a few minutes.">
        {!paybill ? (
          <p className="text-sm text-muted">The school&apos;s Paybill number has not been set up yet. Please pay at the office.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <CopyRow label="Business (Paybill) number" value={paybill} />
              <CopyRow label="Account number" value={account} />
              {amount ? <CopyRow label="Amount" value={String(Math.ceil(amount))} display={formatKES(amount)} /> : null}
            </div>
            <ol className="space-y-2 text-sm">
              {["Open M-Pesa on your phone and choose Lipa na M-Pesa → Pay Bill.",
                `Enter Business number ${paybill}.`,
                `Enter Account number ${account} (your student number).`,
                "Enter the amount and your M-Pesa PIN, then confirm.",
                "You'll get an SMS from M-Pesa, and your receipt will appear under Payments."].map((s, i) => (
                <li key={i} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{i + 1}</span>{s}</li>
              ))}
            </ol>
            <p className="rounded-md bg-accent-100 px-3 py-2 text-xs text-accent-700">
              You can pay any amount at any time. There is no interest on instalments. Wrong account number? Call the office with your M-Pesa message.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
