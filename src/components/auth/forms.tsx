"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { activateStudent, changePassword, requestPasswordReset, signIn } from "@/features/auth/actions";

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface-muted"
        aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email, phone or student number" htmlFor="identifier" hint="Students: use your student number (e.g. EK00012) or phone.">
        <Input id="identifier" name="identifier" autoComplete="username" autoCapitalize="none" required aria-describedby="identifier-hint" />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Sign in</Button>
      <div className="flex justify-between text-sm">
        <Link href="/activate" className="font-medium text-brand-700 hover:underline">New student? Activate</Link>
        <Link href="/forgot-password" className="text-muted hover:underline">Forgot password?</Link>
      </div>
    </form>
  );
}

export function ActivateForm() {
  const [state, action, pending] = useActionState(activateStudent, null);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Student number" htmlFor="studentNumber" error={fe.studentNumber} hint="On your registration slip, e.g. EK00012">
        <Input id="studentNumber" name="studentNumber" autoCapitalize="characters" required aria-invalid={!!fe.studentNumber} />
      </Field>
      <Field label="Phone number" htmlFor="phone" error={fe.phone}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" required aria-invalid={!!fe.phone} />
      </Field>
      <Field label="Activation code" htmlFor="code" error={fe.code} hint="6 digits from the school office (valid 14 days)">
        <Input id="code" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required aria-invalid={!!fe.code} />
      </Field>
      <Field label="Create a password" htmlFor="password" error={fe.password} hint="At least 8 characters">
        <PasswordInput id="password" name="password" autoComplete="new-password" required aria-invalid={!!fe.password} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={fe.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required aria-invalid={!!fe.confirm} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Activate account</Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      {state && (state.ok ? <Alert tone="success">{state.message}</Alert> : <Alert tone="danger">{state.error}</Alert>)}
      <Field label="Staff email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Send reset link</Button>
    </form>
  );
}

export function ChangePasswordForm({ backHref }: { backHref: string }) {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="space-y-4">
      {state && (state.ok ? <Alert tone="success" title="Password updated"><Link className="underline" href={backHref}>Continue</Link></Alert>
        : <Alert tone="danger">{state.error}</Alert>)}
      <Field label="New password" htmlFor="password" hint="At least 8 characters">
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Update password</Button>
    </form>
  );
}
