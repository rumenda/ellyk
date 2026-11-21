"use client";
import * as React from "react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions";
import { useAction } from "./use-action";

/**
 * Button that calls a server action. With `confirm`, shows a dialog first;
 * with `requireReason`, the dialog collects a reason that is passed to the action.
 */
export function ActionButton({ action, children, confirm, requireReason, reasonLabel = "Reason", successMessage, ...props }: {
  action: (reason?: string) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  confirm?: { title: string; description?: React.ReactNode; confirmLabel?: string; destructive?: boolean };
  requireReason?: boolean;
  reasonLabel?: string;
  successMessage?: string;
} & Omit<ButtonProps, "onClick" | "action">) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending } = useAction(action, { successMessage, onSuccess: () => { setOpen(false); setReason(""); } });

  if (!confirm && !requireReason) {
    return <Button {...props} loading={pending} onClick={() => run()}>{children}</Button>;
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button {...props}>{children}</Button></DialogTrigger>
      <DialogContent title={confirm?.title ?? "Confirm"} description={confirm?.description}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(requireReason ? reason : undefined); }}>
          {requireReason && (
            <Field label={reasonLabel} htmlFor="action-reason" required hint="This is recorded in the audit log.">
              <Textarea id="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />
            </Field>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant={confirm?.destructive ? "danger" : "primary"} loading={pending}
              disabled={requireReason && reason.trim().length < 5}>
              {confirm?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
