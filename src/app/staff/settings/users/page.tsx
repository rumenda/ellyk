import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { CreateUserDialog, UserAccessForm } from "@/components/staff/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { setUserActive } from "@/features/settings/actions";
import { getLocations } from "@/features/staff/lookups";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersSettings() {
  const me = await requireRole("manager");
  const supabase = await createClient();
  const [locations, { data: staff }] = await Promise.all([
    getLocations(),
    supabase.from("profiles").select("id, full_name, email, phone, is_active, last_seen_at, user_roles!user_roles_user_id_fkey(role), staff_locations(location_id)").order("full_name"),
  ]);
  const rows = (staff ?? []).filter((p) => p.user_roles.some((r) => r.role !== "student"));
  return (
    <div className="max-w-5xl">
      <PageHeader title="Users & roles" breadcrumbs={[{ label: "Settings", href: "/staff/settings" }, { label: "Users" }]}
        description="Role changes are audited. The platform owner role is managed by the system provider and can't be granted here."
        actions={<CreateUserDialog locations={locations.map((l) => ({ id: l.id, name: l.name }))} />} />
      <Card><ul className="divide-y divide-border">
        {rows.map((u) => (
          <li key={u.id} className={`grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.4fr_auto] ${u.is_active ? "" : "opacity-60"}`}>
            <div className="text-sm">
              <p className="font-medium">{u.full_name}{u.id === me.id && <span className="text-muted"> (you)</span>}</p>
              <p className="text-muted">{u.email}</p>
              <p className="mt-1 flex flex-wrap gap-1">{u.user_roles.map((r) => <Badge key={r.role} tone={r.role === "platform_owner" ? "accent" : "brand"}>{humanize(r.role)}</Badge>)}</p>
              <p className="mt-1 text-xs text-subtle">Last seen {u.last_seen_at ? formatDateTime(u.last_seen_at) : "never"}</p>
            </div>
            {u.user_roles.some((r) => r.role === "platform_owner") ? <p className="text-sm text-muted">Platform owner – no school data access unless a school role is granted.</p>
              : <UserAccessForm userId={u.id} roles={u.user_roles.map((r) => r.role)} locationIds={u.staff_locations.map((l) => l.location_id)} locations={locations.map((l) => ({ id: l.id, name: l.name }))} />}
            <div>{u.id !== me.id && <ActionButton size="sm" variant={u.is_active ? "ghost" : "secondary"} className={u.is_active ? "text-danger-700" : ""}
              action={async () => { "use server"; return setUserActive(u.id, !u.is_active); }}
              confirm={{ title: u.is_active ? `Deactivate ${u.full_name}?` : `Reactivate ${u.full_name}?`, destructive: u.is_active, confirmLabel: u.is_active ? "Deactivate" : "Reactivate" }}>{u.is_active ? "Deactivate" : "Reactivate"}</ActionButton>}</div>
          </li>
        ))}
      </ul></Card>
    </div>
  );
}
