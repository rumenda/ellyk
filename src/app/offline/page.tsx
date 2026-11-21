import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { BrandName } from "@/components/brand";
import { RetryButton } from "./retry";

export const metadata: Metadata = { title: "You're offline" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <BrandName />
      <div className="my-auto text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted text-muted"><WifiOff className="size-8" /></span>
        <h1 className="mt-4 text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted">This page hasn&apos;t been saved on your phone yet. Pages you opened recently – Home, Schedule, Training, Payments summary and Profile – still work offline.</p>
        <p className="mt-2 text-sm text-muted">Payments and changes need a connection.</p>
        <div className="mt-6"><RetryButton /></div>
      </div>
    </main>
  );
}
