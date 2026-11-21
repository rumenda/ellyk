import Link from "next/link";
import { ChevronRight } from "lucide-react";
import * as React from "react";

export interface Crumb { label: string; href?: string }

export function PageHeader({ title, description, actions, breadcrumbs }: {
  title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="text-sm">
          <ol className="flex flex-wrap items-center gap-1 text-muted">
            {breadcrumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                {c.href ? <Link href={c.href} className="hover:text-text hover:underline">{c.label}</Link> : <span aria-current="page" className="text-text">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
