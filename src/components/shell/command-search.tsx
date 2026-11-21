"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Dialog as D } from "radix-ui";
import { Receipt, Search, User, UserPlus } from "lucide-react";
import { globalSearch, type SearchHit } from "@/features/search/actions";
import { cn } from "@/lib/utils";

const KIND_ICON = { student: User, payment: Receipt, lead: UserPlus } as Record<string, typeof User>;

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(() => start(async () => {
      const r = await globalSearch(q);
      if (id === seq.current) { setHits(r); setActive(0); }
    }), 200);
    return () => clearTimeout(t);
  }, [q]);

  function go(h: SearchHit) {
    onOpenChange(false);
    setQ("");
    router.push(h.href);
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <D.Content className="fixed inset-x-3 top-[10vh] z-50 mx-auto max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-pop focus:outline-none">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search students, payments and leads</D.Description>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 text-subtle" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, student no. or M-Pesa code…"
              className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle" aria-label="Search"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter" && q.trim().length >= 2 && hits[active]) go(hits[active]);
              }} />
            {pending && <span className="size-4 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />}
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-1" role="listbox">
            {q.trim().length >= 2 && !pending && hits.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">No matches. Try a phone number or student number.</li>
            )}
            {q.trim().length < 2 && <li className="px-3 py-5 text-center text-sm text-muted">Type at least 2 characters.</li>}
            {(q.trim().length >= 2 ? hits : []).map((h, i) => {
              const Icon = KIND_ICON[h.kind] ?? User;
              return (
                <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}>
                  <button onClick={() => go(h)} onMouseEnter={() => setActive(i)}
                    className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left", i === active && "bg-surface-muted")}>
                    <span className="grid size-8 place-items-center rounded-md bg-brand-50 text-brand-600"><Icon className="size-4" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{h.title}</span>
                      <span className="block truncate text-xs text-muted">{h.subtitle}</span>
                    </span>
                    <span className="ml-auto text-xs capitalize text-subtle">{h.kind}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
