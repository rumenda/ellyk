import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** The login rate limiter is real; for local E2E runs we reset it so dozens of sign-ins don't trip it. */
function resetRateLimits() {
  if (process.env.E2E_RESET_RATE_LIMITS === "0" || !/127\.0\.0\.1|localhost/.test(DB_URL)) return;
  try { execSync(`psql "${DB_URL}" -qc "delete from private.rate_limits"`, { stdio: "ignore" }); } catch { /* psql unavailable */ }
}

export const PASSWORD = "EllyK-Demo-2026!";

export async function login(page: Page, identifier: string, expectPath: RegExp) {
  resetRateLimits();
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email, phone or student number").fill(identifier);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expectPath);
}

export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

/** Wait for a success toast (sonner). */
export async function expectToast(page: Page, text: RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
