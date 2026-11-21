import Link from "next/link";
import { redirect } from "next/navigation";
import { Bike, CalendarCheck, ShieldCheck, Wallet } from "lucide-react";
import { BrandName } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser, homeFor } from "@/lib/auth/session";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-10">
      <BrandName />
      <section className="mt-12">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">Learn to ride safely. Pay weekly, no interest.</h1>
        <p className="mt-3 text-muted">Track your lessons, payments and NTSA test progress from your phone.</p>
      </section>
      <ul className="mt-8 space-y-3 text-sm">
        {[
          [Bike, "Motorcycle rider training at Thika Road, Kitengela and Ruiru"],
          [Wallet, "Clear fees – every shilling shown, M-Pesa Paybill"],
          [CalendarCheck, "See your next lesson and progress any time"],
          [ShieldCheck, "We handle your NTSA booking and payments"],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Bike;
          return (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <span className="grid size-9 place-items-center rounded-md bg-brand-50 text-brand-600"><I className="size-5" /></span>
              {text as string}
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col gap-3 pt-10">
        <Link href="/login" className={buttonVariants({ size: "lg" })}>Sign in</Link>
        <Link href="/apply" className={buttonVariants({ variant: "secondary", size: "lg" })}>I want to enrol</Link>
        <Link href="/activate" className="text-center text-sm font-medium text-brand-700 hover:underline">Activate my student account</Link>
      </div>
    </main>
  );
}
