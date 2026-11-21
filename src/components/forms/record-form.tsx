"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions";
import { useAction } from "./use-action";

/** Submits all named fields as a string record to a server action. */
export function RecordForm({ action, children, submitLabel = "Save", className, onDone }: {
  action: (form: Record<string, string>) => Promise<ActionResult<unknown>>;
  children: React.ReactNode; submitLabel?: string; className?: string; onDone?: () => void;
}) {
  const { run, pending } = useAction(action, { onSuccess: onDone });
  return (
    <form className={className ?? "space-y-4"} onSubmit={(e) => { e.preventDefault(); run(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>); }}>
      {children}
      <div className="flex justify-end"><Button type="submit" loading={pending}>{submitLabel}</Button></div>
    </form>
  );
}
