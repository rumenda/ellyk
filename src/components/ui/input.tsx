import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-border-strong bg-surface px-3 text-[15px] text-text placeholder:text-subtle shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/25 disabled:bg-surface-muted disabled:text-muted aria-[invalid=true]:border-danger-600";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-24 py-2.5", className)} {...props} />;
}

/** Native select: fastest and most accessible on Android. */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(field, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%23556274%22 stroke-width=%222%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-10", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-text", className)} {...props} />;
}

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | string[];
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error with correct aria wiring by convention (id-hint, id-error). */
export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-danger-600"> *</span>}
      </Label>
      {children}
      {err ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger-700" role="alert">{err}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("size-5 rounded border-border-strong accent-brand-600", className)} {...props} />;
}
