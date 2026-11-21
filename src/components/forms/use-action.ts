"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";

/** Run a server action with pending state, toast feedback and a data refresh. */
export function useAction<A extends unknown[], T>(action: (...args: A) => Promise<ActionResult<T>>, opts?: {
  successMessage?: string; onSuccess?: (data: T | undefined) => void; refresh?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  function run(...args: A) {
    setError(null);
    setFieldErrors({});
    return new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        try {
          const res = await action(...args);
          if (res.ok) {
            toast.success(res.message ?? opts?.successMessage ?? "Saved");
            if (opts?.refresh !== false) router.refresh();
            opts?.onSuccess?.(res.data);
          } else {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
          resolve(res);
        } catch {
          const msg = navigator.onLine ? "Something went wrong. Please try again." : "You're offline. Reconnect and try again.";
          setError(msg);
          toast.error(msg);
          resolve({ ok: false, error: msg });
        }
      });
    });
  }
  return { run, pending, error, fieldErrors };
}
