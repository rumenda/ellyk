import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Administrator", () => {
  test("registers a student, enrols them and records in-person fee acceptance", async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    await login(page, "admin@ellyk.test", /\/staff\/dashboard/);
    await page.goto("/staff/students/new", { waitUntil: "networkidle" });
    await page.getByLabel("First name").fill("Wanjiru");
    await page.getByLabel("Last name").fill(`Testnyam${suffix}`);
    await page.getByLabel("Date of birth").fill("2001-04-12");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("ID number").fill(`3${suffix}1`);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Mobile number").fill(`07${suffix.slice(0, 2)}${suffix}`.slice(0, 10).padEnd(10, "1"));
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Contact name").fill("Mama Wanjiru");
    await page.getByLabel("Relationship").fill("Parent");
    await page.getByLabel("Contact phone").fill("0700123456");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Home location").selectOption({ label: "Thika Road Campus" });
    await page.locator("#course_id").selectOption({ label: "Motorcycle Rider Training (Class A2)" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Platform service fee/).first()).toBeVisible();
    await expect(page.getByText("Payment plan (Weekly, no interest)")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Data protection consent").click();
    await page.getByRole("button", { name: "Register student" }).click();
    await expect(page).toHaveURL(/\/staff\/students\/[0-9a-f-]+\?registered=1/);
    await expect(page.getByText(`Testnyam${suffix}`).first()).toBeVisible();
    await expect(page.getByText("Awaiting deposit")).toBeVisible();

    await page.getByRole("button", { name: "Issue activation code" }).click();
    await expect(page.getByText("Activation code", { exact: true })).toBeVisible();
    await expect(page.locator("span.font-mono").filter({ hasText: /^\d{6}$/ })).toBeVisible();
  });

  test("schedules a lesson for an instructor", async ({ page }) => {
    await login(page, "manager@ellyk.test", /\/staff\/dashboard/);
    await page.goto("/staff/schedule", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Schedule session" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Location").selectOption({ label: "Kitengela Training Ground" });
    await dialog.getByLabel("Instructor").selectOption({ label: "Ruth Akinyi" });
    const d = new Date(Date.now() + (40 + Math.floor(Math.random() * 300)) * 86_400_000).toISOString().slice(0, 10);
    await dialog.getByLabel("Date").fill(d);
    const hh = String(5 + Math.floor(Math.random() * 2)).padStart(2, "0");
    const mm = ["00", "15", "30", "45"][Math.floor(Math.random() * 4)];
    await dialog.getByLabel("Start").fill(`${hh}:${mm}`);
    await dialog.getByLabel("End").fill(`${String(Number(hh) + 1).padStart(2, "0")}:${mm}`);
    await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page).toHaveURL(/\/staff\/schedule\/[0-9a-f-]+$/);
    await expect(page.getByText("Ruth Akinyi").first()).toBeVisible();
    await expect(page.getByText("Attendance opens 30 minutes")).toBeVisible();
  });
});
