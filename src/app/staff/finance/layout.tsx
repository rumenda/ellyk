import { FinanceNav } from "@/components/staff/finance-nav";
import { requireRole } from "@/lib/auth/session";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireRole("manager", "accountant");
  return <><FinanceNav />{children}</>;
}
