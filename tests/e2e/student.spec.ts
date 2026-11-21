import { expect, test } from "@playwright/test";
import { isMobile, login } from "./helpers";

test.describe("Student PWA", () => {
  test("signs in with student number and understands their status at a glance", async ({ page }) => {
    await login(page, "EK00004", /\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mercy");
    await expect(page.getByText("Motorcycle Rider Training (Class A2)")).toBeVisible();
    await expect(page.getByText("Next lesson")).toBeVisible();
    await expect(page.getByText("Balance").first()).toBeVisible();
    await expect(page.getByText(/KES \d/).first()).toBeVisible();
    await expect(page.getByText("NTSA licence progress")).toBeVisible();
  });

  test("navigates with the bottom bar (phone) and sees payments, schedule and progress", async ({ page }) => {
    await login(page, "+254700100513", /\/app$/); // sign in by phone
    const nav = isMobile(page) ? page.locator('nav[aria-label="Main"]').last() : page.locator('nav[aria-label="Main"]').first();
    await nav.getByRole("link", { name: "Payments" }).click();
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
    await expect(page.getByText("Fee breakdown")).toBeVisible();
    await expect(page.getByText("Platform service fee")).toBeVisible();
    await expect(page.getByText(/NTSA fees/).first()).toBeVisible();
    await expect(page.getByText("Payment plan")).toBeVisible();
    await page.getByRole("button", { name: "Pay with M-Pesa" }).click();
    await expect(page.getByText("Business (Paybill) number")).toBeVisible();
    await expect(page.getByText("EK00004").first()).toBeVisible();
    await page.keyboard.press("Escape");

    await nav.getByRole("link", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await page.getByRole("tab", { name: "past" }).click();
    await expect(page).toHaveURL(/tab=past/);

    await nav.getByRole("link", { name: "Training" }).click();
    await expect(page.getByText("Riding skills")).toBeVisible();
    await expect(page.getByText("Lessons attended")).toBeVisible();
  });

  test("opens a receipt showing how the payment was allocated", async ({ page }) => {
    await login(page, "EK00004", /\/app$/);
    await page.goto("/app/payments");
    await page.locator('a[href^="/app/receipts/"]').first().click();
    await expect(page.getByText("Official")).toBeVisible();
    await expect(page.getByText("Allocated to")).toBeVisible();
    await expect(page.getByText("Amount received")).toBeVisible();
  });

  test("cannot open staff pages", async ({ page }) => {
    await login(page, "EK00004", /\/app$/);
    await page.goto("/staff/payments");
    await expect(page).toHaveURL(/\/app$/);
  });
});
