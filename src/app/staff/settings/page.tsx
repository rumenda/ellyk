import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookOpen, Building2, ChevronRight, ClipboardList, MapPin, Plug, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { hasRole, requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsIndex() {
  const user = await requireRole("manager", "accountant", "platform_owner");
  const items = [
    { href: "/staff/settings/school", icon: Building2, title: "School, tax & payments", desc: "Legal name, KRA PIN, VAT, Paybill, allocation order, numbering, security, privacy", roles: ["manager", "accountant"] },
    { href: "/staff/settings/courses", icon: BookOpen, title: "Courses & pricing", desc: "Courses, versioned fee structures, deposits, instalments and payment gates", roles: ["manager", "accountant"] },
    { href: "/staff/locations", icon: MapPin, title: "Locations", desc: "Training locations, opening hours and capacity", roles: ["manager"] },
    { href: "/staff/settings/competencies", icon: ClipboardList, title: "Training competencies", desc: "Skills instructors assess before the NTSA test", roles: ["manager"] },
    { href: "/staff/settings/notifications", icon: Bell, title: "Notifications & announcements", desc: "Message templates for in-app, SMS, email and push", roles: ["manager"] },
    { href: "/staff/settings/users", icon: Users, title: "Users & roles", desc: "Staff accounts, roles and location access", roles: ["manager"] },
    { href: "/staff/settings/integrations", icon: Plug, title: "Integrations", desc: "M-Pesa Daraja, SMS/email providers, eTIMS status, callback logs", roles: ["manager", "platform_owner"] },
  ].filter((i) => hasRole(user, ...(i.roles as never[])));
  return (
    <div>
      <PageHeader title="Settings" description="Everyday business configuration – no code changes needed." />
      <Card><ul className="divide-y divide-border">
        {items.map(({ href, icon: Icon, title, desc }) => (
          <li key={href}><Link href={href} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/60">
            <span className="grid size-10 place-items-center rounded-md bg-brand-50 text-brand-600"><Icon className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="block text-sm text-muted">{desc}</span></span>
            <ChevronRight className="size-4 text-subtle" />
          </Link></li>
        ))}
      </ul></Card>
    </div>
  );
}
