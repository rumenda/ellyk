"use client";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Android Chrome install banner (shown once until dismissed). */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem("ek.install.dismissed") === "1"; } catch { /* ignore */ }
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      if (!dismissed) setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !evt) return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem("ek.install.dismissed", "1"); } catch { /* ignore */ }
  };
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
      <Download className="size-5 shrink-0 text-brand-600" />
      <p className="flex-1 text-brand-800">Install Elly K on your phone for quick access – it uses very little data.</p>
      <Button size="sm" onClick={async () => { await evt.prompt(); await evt.userChoice; dismiss(); }}>Install</Button>
      <button onClick={dismiss} aria-label="Dismiss" className="grid size-8 place-items-center rounded-md text-brand-700"><X className="size-4" /></button>
    </div>
  );
}
