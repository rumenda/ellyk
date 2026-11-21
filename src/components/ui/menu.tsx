"use client";
import { DropdownMenu as M } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 shadow-pop">
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item className={cn("flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-muted", className)} {...props} />
  );
}

export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <M.Label className="px-2.5 py-1.5 text-xs font-medium text-muted">{children}</M.Label>;
}
