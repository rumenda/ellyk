import type { AppRole } from "@/lib/auth/constants";

export type IconName =
  | "dashboard" | "sun" | "users" | "user-plus" | "graduation" | "calendar" | "id-card" | "bike" | "wallet"
  | "landmark" | "clipboard" | "map-pin" | "chart" | "settings" | "code" | "scroll" | "home" | "bell";

export interface NavItem { href: string; label: string; icon: IconName; roles: AppRole[] }

export const STAFF_NAV: NavItem[] = [
  { href: "/staff/dashboard", label: "Dashboard", icon: "dashboard", roles: ["manager", "admin"] },
  { href: "/staff/my-day", label: "My day", icon: "sun", roles: ["instructor"] },
  { href: "/staff/students", label: "Students", icon: "users", roles: ["manager", "admin", "accountant", "instructor"] },
  { href: "/staff/admissions", label: "Admissions", icon: "user-plus", roles: ["manager", "admin"] },
  { href: "/staff/training", label: "Training", icon: "graduation", roles: ["manager", "admin", "instructor"] },
  { href: "/staff/schedule", label: "Schedule", icon: "calendar", roles: ["manager", "admin", "instructor"] },
  { href: "/staff/instructors", label: "Instructors", icon: "id-card", roles: ["manager", "admin"] },
  { href: "/staff/fleet", label: "Fleet", icon: "bike", roles: ["manager", "admin", "instructor"] },
  { href: "/staff/payments", label: "Payments", icon: "wallet", roles: ["manager", "admin", "accountant"] },
  { href: "/staff/finance", label: "Finance", icon: "landmark", roles: ["manager", "accountant"] },
  { href: "/staff/ntsa", label: "NTSA", icon: "clipboard", roles: ["manager", "admin", "accountant"] },
  { href: "/staff/locations", label: "Locations", icon: "map-pin", roles: ["manager"] },
  { href: "/staff/reports", label: "Reports", icon: "chart", roles: ["manager", "admin", "accountant"] },
  { href: "/staff/platform", label: "Platform fees", icon: "code", roles: ["platform_owner"] },
  { href: "/staff/audit", label: "Audit log", icon: "scroll", roles: ["manager", "accountant", "platform_owner"] },
  { href: "/staff/settings", label: "Settings", icon: "settings", roles: ["manager", "accountant", "platform_owner"] },
];

/** Bottom-bar shortcuts on phones, by primary role. */
export function mobileShortcuts(roles: AppRole[]): string[] {
  if (roles.includes("instructor") && !roles.includes("manager")) return ["/staff/my-day", "/staff/schedule", "/staff/students", "/staff/training"];
  if (roles.includes("accountant") && !roles.includes("manager")) return ["/staff/finance", "/staff/payments", "/staff/students", "/staff/reports"];
  if (roles.includes("platform_owner") && roles.length === 1) return ["/staff/platform", "/staff/audit", "/staff/settings"];
  return ["/staff/dashboard", "/staff/students", "/staff/schedule", "/staff/payments"];
}

export function navFor(roles: AppRole[]): NavItem[] {
  return STAFF_NAV.filter((n) => n.roles.some((r) => roles.includes(r)));
}
