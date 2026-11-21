import { expect, test } from "@playwright/test";
import { isMobile, login } from "./helpers";

test.describe("Manager", () => {
  test("views the dashboard and filters by location", async ({ page }) => {
    await login(page, "manager@ellyk.test", /\/staff\/dashboard/);
    await expect(page.getByText("Active students", { exact: true })).toBeVisible();
    await expect(page.getByText("Collections", { exact: true })).toBeVisible();
    await page.getByLabel("All locations").selectOption({ label: "Kitengela Training Ground" });
    await expect(page).toHaveURL(/location=/);
    await expect(page.getByText(/Kitengela Training Ground ·/)).toBeVisible();
  });

  test("opens a report", async ({ page }) => {
    await login(page, "manager@ellyk.test", /\/staff\/dashboard/);
    await page.goto("/staff/reports", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Location comparison/ }).click();
    await expect(page.getByRole("heading", { name: "Location comparison" })).toBeVisible();
    await expect(page.getByText("Thika Road Campus").locator("visible=true").first()).toBeVisible();
  });

  test("uses the responsive navigation", async ({ page }) => {
    await login(page, "manager@ellyk.test", /\/staff\/dashboard/);
    if (isMobile(page)) {
      await page.getByRole("navigation", { name: "Shortcuts" }).getByRole("link", { name: "Students" }).click();
      await expect(page).toHaveURL(/\/staff\/students/);
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "NTSA" }).click();
    } else {
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "NTSA" }).click();
    }
    await expect(page.getByRole("heading", { name: "NTSA work queue" })).toBeVisible();
  });
});
