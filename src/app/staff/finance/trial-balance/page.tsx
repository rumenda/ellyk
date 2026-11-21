import type { Metadata } from "next";
import { FilterBar } from "@/components/forms/filter-bar";
import { Money } from "@/components/money";
import { PrintButton } from "@/components/print-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/states";
import { getLocations, locationOptions } from "@/features/staff/lookups";
import { formatDate, humanize, toNumber, todayKE } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trial balance" };

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<{ as_of?: string; location?: string }> }) {
  const sp = await searchParams;
  const asOf = sp.as_of || todayKE();
  const supabase = await createClient();
  const [locations, { data }] = await Promise.all([getLocations(), supabase.rpc("trial_balance", { p_as_of: asOf, p_location: sp.location || undefined })]);
  const rows = (data ?? []).filter((r) => toNumber(r.debit) || toNumber(r.credit));
  const nets = rows.map((r) => toNumber(r.debit) - toNumber(r.credit));
  const dr = nets.filter((n) => n > 0).reduce((s, n) => s + n, 0);
  const cr = -nets.filter((n) => n < 0).reduce((s, n) => s + n, 0);
  const groups = ["asset", "liability", "equity", "revenue", "expense"] as const;
  return (
    <div>
      <PageHeader title="Trial balance" description={`As of ${formatDate(asOf)}`} actions={<><PrintButton /><a className="text-sm font-medium text-brand-700 hover:underline" href={`/api/reports/trial-balance.csv?as_of=${asOf}`}>CSV</a></>} />
      <Card className="mb-4"><FilterBar className="border-b-0" filters={[{ name: "as_of", label: "As of", type: "date" }, { name: "location", label: "All locations", options: locationOptions(locations) }]} /></Card>
      {!sp.location && Math.abs(dr - cr) > 0.005 && <Alert tone="danger" className="mb-4">Debits and credits do not balance – contact support immediately.</Alert>}
      <Card className="overflow-x-auto">
        <table className="w-full text-[13px] sm:text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted"><th className="px-4 py-2.5 font-medium sm:px-5">Account</th><th className="px-4 py-2.5 text-right font-medium">Debit</th><th className="px-4 py-2.5 text-right font-medium sm:px-5">Credit</th></tr></thead>
          {groups.map((g) => {
            const gr = rows.filter((r) => r.account_type === g);
            if (!gr.length) return null;
            return (
              <tbody key={g} className="divide-y divide-border">
                <tr className="bg-surface-muted"><td colSpan={3} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted sm:px-5">{humanize(g)}</td></tr>
                {gr.map((r) => {
                  const net = toNumber(r.debit) - toNumber(r.credit);
                  return <tr key={r.code}><td className="px-4 py-2 sm:px-5"><span className="tabular text-muted">{r.code}</span> {r.name}</td>
                    <td className="px-4 text-right">{net > 0 && <Money value={net} />}</td><td className="px-4 text-right sm:px-5">{net < 0 && <Money value={-net} />}</td></tr>;
                })}
              </tbody>
            );
          })}
          <tfoot><tr className="border-t-2 border-border-strong font-semibold"><td className="px-4 py-3 sm:px-5">Total</td><td className="px-4 text-right"><Money value={dr} /></td><td className="px-4 text-right sm:px-5"><Money value={cr} /></td></tr></tfoot>
        </table>
      </Card>
    </div>
  );
}
