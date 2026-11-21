/**
 * Students sign in with their student number or phone; the auth layer still
 * needs an email, so portal accounts use this non-routable domain. Nothing is
 * ever emailed to these addresses.
 */
export const STUDENT_EMAIL_DOMAIN = "students.ellyk.local";

export const STAFF_ROLES = ["platform_owner", "manager", "admin", "accountant", "instructor"] as const;
export type AppRole = (typeof STAFF_ROLES)[number] | "student";
