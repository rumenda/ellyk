import Link from "next/link";
import { BrandName } from "@/components/brand";

export function AuthShell({ title, description, children, footer }: {
  title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg sm:items-center sm:justify-center sm:py-10">
      <div className="w-full px-5 pt-8 sm:max-w-md sm:rounded-xl sm:border sm:border-border sm:bg-surface sm:p-8 sm:shadow-card">
        <Link href="/" aria-label="Elly K home"><BrandName /></Link>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-border pt-5 text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}
