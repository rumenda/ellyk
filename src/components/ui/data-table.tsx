import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right";
}

/**
 * Desktop: a real table. Mobile (< md): stacked cards rendered by `mobile`,
 * so phones never get a sideways-scrolling spreadsheet.
 */
export function DataTable<T>({ rows, columns, mobile, rowHref, rowKey, empty, caption }: {
  rows: T[];
  columns: Column<T>[];
  mobile: (row: T) => React.ReactNode;
  rowHref?: (row: T) => string;
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  caption?: string;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-2.5 font-medium first:pl-5 last:pr-5", c.align === "right" && "text-right", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr key={rowKey(row)} className={cn("group", href && "hover:bg-surface-muted/60")}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", c.align === "right" && "text-right tabular", c.className)}>
                      {href && i === 0 ? <Link href={href} className="font-medium text-text hover:text-brand-700 hover:underline">{c.cell(row)}</Link> : c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => {
          const href = rowHref?.(row);
          return (
            <li key={rowKey(row)}>
              {href ? (
                <Link href={href} className="block px-4 py-3.5 active:bg-surface-muted">{mobile(row)}</Link>
              ) : (
                <div className="px-4 py-3.5">{mobile(row)}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: {
  page: number; pageSize: number; total: number; hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-muted";
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5" aria-label="Pagination">
      <p className="text-muted"><span className="tabular">{from}–{to}</span> of <span className="tabular">{total}</span></p>
      <div className="flex gap-2">
        {page > 1 ? <Link className={btn} href={hrefFor(page - 1)}>Previous</Link> : <span className={cn(btn, "opacity-50")} aria-disabled>Previous</span>}
        {page < pages ? <Link className={btn} href={hrefFor(page + 1)}>Next</Link> : <span className={cn(btn, "opacity-50")} aria-disabled>Next</span>}
      </div>
    </nav>
  );
}

/** Two-line mobile row helper. */
export function MobileRow({ title, subtitle, right, meta }: {
  title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{title}</p>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        {meta && <div className="mt-1.5 flex flex-wrap gap-1.5">{meta}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}
