import { NextResponse, type NextRequest } from "next/server";
import { findReport, parseFilters, toCsv } from "@/features/reports/definitions";
import { getSessionUser, hasRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** CSV export. Same report code as the screen; RLS + role checks apply. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = slug.replace(/\.csv$/, "");
  const def = findReport(key === "trial-balance" ? "income-statement" : key);
  if (!def || !hasRole(user, ...def.roles)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const f = parseFilters(Object.fromEntries(req.nextUrl.searchParams));
  if (key === "trial-balance") {
    const { data } = await supabase.rpc("trial_balance", { p_as_of: req.nextUrl.searchParams.get("as_of") ?? f.to });
    const csv = toCsv({ columns: [{ key: "code", label: "Code" }, { key: "name", label: "Account" }, { key: "account_type", label: "Type" }, { key: "debit", label: "Debit" }, { key: "credit", label: "Credit" }, { key: "balance", label: "Balance" }], rows: (data ?? []) as never });
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="trial-balance-${f.to}.csv"`, "Cache-Control": "no-store" } });
  }
  const result = await def.run(supabase, f);
  return new NextResponse(toCsv(result), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${key}-${f.from}-to-${f.to}.csv"`, "Cache-Control": "no-store" },
  });
}
