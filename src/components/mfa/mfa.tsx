"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { createClient } from "@/lib/supabase/client";

/** Step-up challenge for staff with a verified TOTP factor. */
export function MfaChallenge({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (!factor) { router.replace(next); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) { setError("That code didn't work. Check the time on your phone and try again."); return; }
    router.replace(next);
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="6-digit code from your authenticator app" htmlFor="code">
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>Verify</Button>
    </form>
  );
}

/** Enrol / remove an authenticator app (TOTP). */
export function MfaManager({ onDoneHref }: { onDoneHref?: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verified, setVerified] = useState<{ id: string; created_at: string }[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await createClient().auth.mfa.listFactors();
    setVerified((data?.totp ?? []).filter((f) => f.status === "verified").map((f) => ({ id: f.id, created_at: f.created_at })));
  }
  // Fetch-on-mount from the auth API (an external system); state is set after the await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  async function start() {
    setBusy(true);
    const supabase = createClient();
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Elly K ${Date.now()}` });
    setBusy(false);
    if (error || !data) { toast.error("Couldn't start set-up. Try again."); return; }
    setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) { toast.error("Incorrect code – try the next one shown in your app."); return; }
    toast.success("Two-step verification is on");
    setFactorId(null); setQr(null); setSecret(null); setCode("");
    await load();
    if (onDoneHref) router.replace(onDoneHref); else router.refresh();
  }
  async function remove(id: string) {
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id });
    if (error) toast.error("Sign in again with your code before removing it.");
    else { toast.success("Authenticator removed"); await load(); router.refresh(); }
  }

  return (
    <div className="space-y-4">
      {verified.length > 0 ? (
        <Alert tone="success" title="Two-step verification is on">
          <ul className="mt-1 space-y-1">
            {verified.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <span>Authenticator added {new Date(f.created_at).toLocaleDateString("en-KE")}</span>
                <Button size="sm" variant="secondary" onClick={() => remove(f.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        </Alert>
      ) : !qr && (
        <Alert tone="info" title="Protect your account">Add an authenticator app (Google Authenticator, Microsoft Authenticator) so a stolen password is not enough to sign in.</Alert>
      )}
      {!qr && verified.length === 0 && <Button onClick={start} loading={busy}>Set up authenticator app</Button>}
      {qr && (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm">1. Scan this QR code with your authenticator app.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code for authenticator app" className="size-44 rounded-md border border-border bg-white p-2" />
          <p className="text-xs text-muted">Can&apos;t scan? Enter this key: <code className="break-all font-mono">{secret}</code></p>
          <Field label="2. Enter the 6-digit code" htmlFor="totp">
            <Input id="totp" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Button type="submit" loading={busy} disabled={code.length !== 6}>Verify and turn on</Button>
        </form>
      )}
    </div>
  );
}
