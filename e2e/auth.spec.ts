import { expect, test } from "@playwright/test";

test("the login page renders the sign-in form", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page.getByRole("heading", { name: /beach metro/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
