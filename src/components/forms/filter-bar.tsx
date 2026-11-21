"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterDef {
  name: string;
  label: string;
  options?: { value: string; label: string }[];
  type?: "select" | "date";
}

/**
 * URL-driven filters (shareable, back-button friendly). Search is debounced;
 * selects apply immediately. Resets pagination on change.
 */
export function FilterBar({ filters = [], searchPlaceholder, className }: {
  filters?: FilterDef[]; searchPlaceholder?: string; className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  function apply(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value); else next.delete(name);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => apply("q", q.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={cn("flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5", pending && "opacity-70", className)}>
      {searchPlaceholder !== undefined && (
        <div className="relative sm:min-w-64 sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder}
            aria-label={searchPlaceholder} className="pl-9" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {filters.map((f) =>
          f.type === "date" ? (
            <label key={f.name} className="relative block sm:w-44">
              <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-medium uppercase tracking-wide text-subtle">{f.label}</span>
              <Input type="date" aria-label={f.label} defaultValue={params.get(f.name) ?? ""}
                onChange={(e) => apply(f.name, e.target.value)} className="pt-4 text-sm" />
            </label>
          ) : (
            <Select key={f.name} aria-label={f.label} value={params.get(f.name) ?? ""} onChange={(e) => apply(f.name, e.target.value)} className="sm:w-auto sm:min-w-40">
              <option value="">{f.label}</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ),
        )}
      </div>
    </div>
  );
}
