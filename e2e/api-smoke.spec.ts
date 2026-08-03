// API smoke: logs in through the real form, then exercises the HTTP surface
// end-to-end (read-only — no rows are created, so it's safe to run repeatedly).
// Needs SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD in .env.local pointing at an
// admin created with `pnpm create-admin` — the whole file skips otherwise.
import { expect, test } from "@playwright/test";

const email = process.env.SMOKE_ADMIN_EMAIL;
const password = process.env.SMOKE_ADMIN_PASSWORD;

test.describe("API smoke", () => {
  test.skip(!email || !password, "SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD not set");

  test("unauthenticated API calls get the 401 envelope, not a redirect", async ({ request }) => {
    const res = await request.get("/api/volunteers");
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  test("logged-in admin can read every collection and error shapes hold", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/overview");

    // Every list endpoint responds 200 with the { data } envelope.
    for (const path of [
      "/api/volunteers",
      "/api/volunteers?status=active&hasRoute=true",
      "/api/captains",
      "/api/territories",
      "/api/routes",
      "/api/routes?vacancy=vacant",
      "/api/financial-years",
    ]) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
      expect(Array.isArray((await res.json()).data), path).toBe(true);
    }

    // Unknown id → 404 envelope.
    const missing = await page.request.get("/api/volunteers/00000000-0000-4000-8000-000000000000");
    expect(missing.status()).toBe(404);
    expect((await missing.json()).error.code).toBe("not_found");

    // Malformed id → 422, not a 500.
    const malformed = await page.request.get("/api/volunteers/not-a-uuid");
    expect(malformed.status()).toBe(422);

    // Body validation → 422 with issue details.
    const invalid = await page.request.post("/api/volunteers", { data: { firstName: "" } });
    expect(invalid.status()).toBe(422);
    expect((await invalid.json()).error.code).toBe("validation_failed");

    // Address validation flows through the Maps provider (fake until keys exist).
    const validate = await page.request.post("/api/addresses/validate", {
      data: { address: { addressLines: ["12 Willow Ave"], regionCode: "CA" } },
    });
    expect(validate.status()).toBe(200);
    expect((await validate.json()).data.placeId).toBeTruthy();
  });
});
