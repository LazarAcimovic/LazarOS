import { test, expect } from "@playwright/test";

test("a new user can register and lands on Today", async ({ page }) => {
  const email = `smoke-${Date.now()}@lazaros.test`;

  await page.goto("/register");
  await expect(page.getByText("Create your account")).toBeVisible();

  await page.getByLabel("First Name").fill("Smoke");
  await page.getByLabel("Last Name").fill("Tester");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("Passw0rd!x");
  await page.locator("#confirm_password").fill("Passw0rd!x");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});
