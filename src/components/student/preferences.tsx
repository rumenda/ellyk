"use client";
import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/forms/use-action";
import { savePushSubscription, updateNotificationPreferences } from "@/features/student/actions";

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted">{description}</span></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand-600 checked:before:translate-x-5" />
    </label>
  );
}

export function NotificationPreferences({ initial }: { initial: { sms: boolean; email: boolean; push: boolean } }) {
  const [prefs, setPrefs] = useState(initial);
  const { run } = useAction(updateNotificationPreferences, { refresh: false });
  const set = (k: keyof typeof prefs) => (v: boolean) => { const next = { ...prefs, [k]: v }; setPrefs(next); run(next); };
  return (
    <div className="divide-y divide-border">
      <Toggle label="SMS" description="Payment confirmations, reminders and test dates" checked={prefs.sms} onChange={set("sms")} />
      <Toggle label="Email" description="Only if you gave us an email address" checked={prefs.email} onChange={set("email")} />
      <Toggle label="Phone notifications" description="Alerts from the installed app" checked={prefs.push} onChange={set("push")} />
    </div>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Web Push opt-in (only shown when VAPID keys are configured). */
export function EnablePush({ vapidKey }: { vapidKey: string | undefined }) {
  const { run, pending } = useAction(savePushSubscription, { refresh: false });
  if (!vapidKey) return null;
  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { toast.error("This browser doesn't support notifications"); return; }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Notifications were not allowed"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      run(json);
    }}><BellRing />Enable phone notifications</Button>
  );
}
