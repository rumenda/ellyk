import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import { DB_URL, expectToast, login } from "./helpers";

test.describe("Instructor", () => {
  test("sees their day and marks attendance for an assigned session", async ({ page }) => {
    await login(page, "john.mwangi@ellyk.test", /\/staff\/my-day/);
    await expect(page.getByText("Today's sessions")).toBeVisible();
    const sessionId = execSync(`psql "${DB_URL}" -tAc "select s.id from training_sessions s join instructors i on i.id = s.instructor_id join session_bookings b on b.session_id = s.id and b.status = 'booked' where i.employee_number = 'EKI-101' and s.starts_at < now() - interval '1 hour' and s.status not in ('cancelled','rescheduled') order by s.starts_at desc limit 1"`).toString().trim();
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    await page.goto(`/staff/schedule/${sessionId}`, { waitUntil: "networkidle" });
    const group = page.getByRole("radiogroup").first();
    await group.getByRole("radio", { name: "Late" }).click();
    await page.getByRole("button", { name: /Save attendance/ }).click();
    await expectToast(page, /Attendance saved/);
  });

  test("updates a competency rating", async ({ page }) => {
    await login(page, "john.mwangi@ellyk.test", /\/staff\/my-day/);
    await page.goto("/staff/training?view=all", { waitUntil: "networkidle" });
    await page.locator('a[href^="/staff/training/"]:visible').first().click();
    await expect(page.getByText("Rate each skill")).toBeVisible();
    await page.getByRole("radiogroup").first().getByRole("radio", { name: "Developing" }).click();
    await page.getByRole("button", { name: /Save 1 rating/ }).click();
    await expectToast(page, /Assessment saved/);
  });

  test("has no access to finance", async ({ page }) => {
    await login(page, "john.mwangi@ellyk.test", /\/staff\/my-day/);
    await page.goto("/staff/finance");
    await expect(page).toHaveURL(/\/staff\/my-day/);
  });
});
