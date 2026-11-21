import { expect, test } from "@playwright/test";

test("serves an installable manifest, service worker and offline page", async ({ request, page }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toContain("/app");
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain("CLEAR_USER_CACHE");
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
});

test("public enquiry form creates a lead", async ({ page }) => {
  await page.goto("/apply", { waitUntil: "networkidle" });
  await page.getByLabel("Your name").fill("Kamau Enquirer");
  await page.getByLabel("Phone number").fill(`07${Date.now().toString().slice(-8)}`);
  await page.getByLabel("Where would you like to train?").selectOption({ label: "Ruiru Branch" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByText("Enquiry received")).toBeVisible();
});
