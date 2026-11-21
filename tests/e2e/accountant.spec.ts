import { expect, test } from "@playwright/test";
import { expectToast, login } from "./helpers";

test.describe("Accountant", () => {
  test("reconciles an unmatched M-Pesa payment to a student", async ({ page }) => {
    await login(page, "accounts@ellyk.test", /\/staff\/finance/);
    const ref = `WRONG${Date.now().toString().slice(-5)}`;
    await page.goto("/staff/payments/simulator", { waitUntil: "networkidle" });
    await expect(page.getByText("Sandbox mode – no real money")).toBeVisible();
    await page.getByLabel("Account number").fill(ref);
    await page.getByLabel("Amount (KES)").fill("750");
    await page.getByRole("button", { name: "Send sandbox payment" }).click();
    await expectToast(page, /UNMATCHED/);

    await page.goto(`/staff/payments?tab=unmatched&q=`, { waitUntil: "networkidle" });
    await page.locator('a[href^="/staff/payments/"]:visible').filter({ hasText: /SBX/ }).first().click();
    await expect(page.getByText("This payment is not linked to a student")).toBeVisible();
    await page.getByRole("button", { name: "Match to student" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Find student").fill("EK00007");
    await dialog.getByRole("button", { name: /EK00007/ }).click();
    await dialog.getByLabel(/How did you confirm/).fill("Student brought the M-Pesa SMS to the office");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expectToast(page, /matched and allocated/);
    await expect(page.getByText("Allocation trail")).toBeVisible();
  });

  test("views outstanding balances and the finance dashboard", async ({ page }) => {
    await login(page, "accounts@ellyk.test", /\/staff\/finance/);
    await expect(page.getByText("NTSA funds held", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Developer fees collected", { exact: true })).toBeVisible();
    await page.goto("/staff/reports/outstanding", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Outstanding balances" })).toBeVisible();
    const csv = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    expect((await csv).suggestedFilename()).toMatch(/^outstanding-.*\.csv$/);
  });
});
