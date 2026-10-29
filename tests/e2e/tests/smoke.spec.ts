import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, localeOf, msg, watchErrors } from "./support";

test.describe("shell and public pages", () => {
  test("home, legal, sign-in surfaces and 404 render in the project locale with the right direction", async ({
    page,
  }, info) => {
    const locale = localeOf(info);
    const errors = watchErrors(page);
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/${locale}/legal/terms`);
    await expect(page.getByText(msg(locale, "common.draftNotice"))).toBeVisible();

    for (const [path, title] of [
      ["sign-in", "auth.signIn.title"],
      ["partners/sign-in", "auth.staff.partnerTitle"],
      ["ops/sign-in", "auth.staff.title"],
    ] as const) {
      await page.goto(`/${locale}/${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(msg(locale, title));
      await expectNoHorizontalOverflow(page);
    }

    expect(errors).toEqual([]);
    const missing = await page.goto(`/${locale}/definitely-not-a-page`);
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      msg(locale, "common.notFound.title"),
    );
  });

  test("unprefixed URLs redirect to a locale and protected pages require sign-in", async ({
    page,
  }, info) => {
    const locale = localeOf(info);
    await page.goto("/");
    await expect(page).toHaveURL(/\/(he|en|ru)$/);
    for (const path of ["orders", "partners", "ops"]) {
      await page.goto(`/${locale}/${path}`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/(${path}/)?sign-in`));
    }
  });

  test("health endpoints report the stack as ready", async ({ request }) => {
    expect((await request.get("/api/healthz")).ok()).toBe(true);
    const ready = await (await request.get("/api/readyz")).json();
    expect(ready.checks).toEqual({ database: true, redis: true, geometry: true });
  });
});
