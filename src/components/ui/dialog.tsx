"use client";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Centered dialog on desktop, bottom sheet on phones. */
export function DialogContent({ title, description, children, className, wide }: {
  title: string; description?: React.ReactNode; children: React.ReactNode; className?: string; wide?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in" />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface shadow-pop focus:outline-none",
          "inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
              : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="-mr-2 grid size-9 place-items-center rounded-md text-muted hover:bg-surface-muted" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-safe">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/** Side drawer (mobile navigation). */
export function Drawer({ open, onOpenChange, children, title }: {
  open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode; title: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-xs flex-col bg-surface shadow-pop focus:outline-none">
          <D.Title className="sr-only">{title}</D.Title>
          <D.Description className="sr-only">{title}</D.Description>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
