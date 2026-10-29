import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import {
  boxStl,
  escapeRe,
  exact,
  expectNoHorizontalOverflow,
  localeOf,
  msg,
  one,
  passMfa,
  signIn,
  watchErrors,
} from "./support";

/** A fresh browser context with the project's device settings (one per surface: separate sessions). */
async function surfacePage(browser: Browser, info: TestInfo): Promise<Page> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale } = info.project.use;
  const ctx = await browser.newContext({
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    locale,
  });
  return ctx.newPage();
}

test("Flow A, full loop: customer pays → ops routes → partner prints → QC passes → shipped → delivered", async ({
  page,
  browser,
}, info) => {
  const L = localeOf(info);
  const m = (key: string) => msg(L, key);
  const errors = watchErrors(page);
  const customerEmail = `e2e-${info.project.name}-${Date.now()}@example.com`;
  const next = page.getByRole("button", { name: exact(m("common.actions.continue")) });

  await test.step("customer: upload, answer usage, see a firm price", async () => {
    await page.goto(`/${L}`);
    await page.locator("main button").first().click();
    await page.waitForURL(/\/new\//);
    await page.setInputFiles("input[type=file]", {
      name: "bracket.stl",
      mimeType: "model/stl",
      buffer: boxStl(),
    });
    await expect(next).toBeEnabled({ timeout: 60_000 });
    await next.click();
    for (const q of ["environment", "heat", "load", "flexibility", "appearance", "foodContact"]) {
      // Click the card (its label) like a user; the sticky action bar can cover a forced click on phones.
      await page.locator(`label:has(input[name=${q}])`).first().click();
      await expect(page.locator(`input[name=${q}]`).first()).toBeChecked();
    }
    await next.click();
    await page.locator("input[name=units]").first().waitFor({ state: "attached" });
    await next.click();
    await next.click();
    await expect(page.locator("input[name=urgency]").first()).toBeAttached();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: m("customer.wizard.price.continue") }).click();
  });

  await test.step("customer: sign in with an emailed code and submit (progress kept)", async () => {
    await page.waitForURL(/\/sign-in/);
    await signIn(page, page.url(), customerEmail);
    await page.waitForURL(/\/new\//);
    await page.getByRole("button", { name: m("customer.wizard.price.continue") }).click();
    await page.waitForURL(/\/orders\//);
  });

  const order = await one<{ id: string; order_number: string }>(
    "SELECT o.id, o.order_number FROM orders o JOIN users u ON u.id = o.customer_user_id WHERE u.email = $1",
    [customerEmail],
  );

  await test.step("customer: address and payment on the provider page", async () => {
    await page.fill("input[autocomplete=name]", "Dana Cohen");
    await page.fill("input[autocomplete=tel]", "0501234567");
    await page.fill("input[autocomplete=address-line1]", "Herzl 1");
    await page.fill("input[autocomplete=address-level2]", "Haifa");
    // "Pay {total}": match the fixed part of the label; the amount is asserted by the quote tests.
    const [before, after] = m("quotes.pay").split("{total}");
    await page
      .getByRole("button", { name: new RegExp(`^${escapeRe(before!)}.+${escapeRe(after!)}$`) })
      .click();
    await page.waitForURL(/\/dev\/pay\//);
    await page.getByRole("button", { name: m("payments.devPay.approve") }).click();
    await page.waitForURL(/\/orders\//);
    await expect
      .poll(
        async () =>
          (await one<{ status: string }>("SELECT status FROM orders WHERE id = $1", [order.id]))
            .status,
        { timeout: 30_000 },
      )
      .toBe("ROUTING");
  });

  const ops = await surfacePage(browser, info);
  const opsErrors = watchErrors(ops);
  await test.step("ops: sign in with MFA, rank suppliers, send the offer", async () => {
    await signIn(ops, `/${L}/ops/sign-in`, "admin@mfg.local");
    await passMfa(ops, "admin@mfg.local", L);
    await ops.goto(`/${L}/ops/orders/${order.id}`);
    await expectNoHorizontalOverflow(ops);
    const send = ops.getByRole("button", { name: exact(m("admin.order.confirm")) });
    if (!(await send.isVisible()))
      await ops.getByRole("button", { name: m("admin.order.propose") }).click();
    await send.click();
    await expect
      .poll(
        async () =>
          (
            await one<{ n: number }>(
              "SELECT count(*)::int AS n FROM job_offers o JOIN production_jobs j ON j.id = o.job_id WHERE j.order_id = $1",
              [order.id],
            )
          ).n,
      )
      .toBe(1);
  });

  const { contact_email: supplierEmail } = await one<{ contact_email: string }>(
    "SELECT s.contact_email FROM job_offers o JOIN production_jobs j ON j.id = o.job_id JOIN suppliers s ON s.id = o.supplier_id WHERE j.order_id = $1",
    [order.id],
  );
  const partner = await surfacePage(browser, info);
  const partnerErrors = watchErrors(partner);
  await test.step("partner: accept the offer, print, submit QC evidence from the phone", async () => {
    await signIn(partner, `/${L}/partners/sign-in`, supplierEmail);
    const offer = partner
      .locator("li", { hasText: order.order_number })
      .filter({ has: partner.getByRole("button", { name: m("supplier.offer.accept") }) });
    await offer.getByRole("button", { name: m("supplier.offer.accept") }).click();
    await partner.locator("a[href*='/partners/jobs/']", { hasText: order.order_number }).click();
    await expectNoHorizontalOverflow(partner);
    await partner.getByRole("button", { name: m("supplier.job.start") }).click();
    const photo = await page.screenshot();
    await partner.setInputFiles("input[type=file]", [
      { name: "front.png", mimeType: "image/png", buffer: photo },
      { name: "side.png", mimeType: "image/png", buffer: photo },
    ]);
    await expect(partner.locator("main ul img")).toHaveCount(2, { timeout: 30_000 });
    for (const [i, value] of ["60", "40", "25"].entries())
      await partner.locator("input[inputmode=decimal]").nth(i).fill(value);
    for (const box of await partner.locator("main input[type=checkbox]").all()) await box.check();
    await partner.getByRole("button", { name: m("supplier.job.submitEvidence") }).click();
    await expect(partner.getByText(m("supplier.job.waiting"))).toBeVisible();
  });

  await test.step("ops: QC pass, manual shipment, delivery", async () => {
    const { id: jobId } = await one<{ id: string }>(
      "SELECT id FROM production_jobs WHERE order_id = $1 AND status = 'QC_PENDING'",
      [order.id],
    );
    await ops.goto(`/${L}/ops/qc/${jobId}`);
    await expectNoHorizontalOverflow(ops);
    await ops.getByRole("button", { name: exact(m("admin.qc.pass")) }).click();
    await expect
      .poll(
        async () =>
          (await one<{ status: string }>("SELECT status FROM orders WHERE id = $1", [order.id]))
            .status,
      )
      .toBe("READY_FOR_SHIPMENT");
    await ops.goto(`/${L}/ops/orders/${order.id}`);
    await ops.getByRole("button", { name: m("admin.order.shipManual") }).click();
    const dialog = ops.getByRole("dialog");
    await dialog.locator("input").nth(0).fill("Israel Post");
    await dialog.locator("input").nth(1).fill("RR123456789IL");
    await dialog.getByRole("button", { name: m("admin.order.shipManual") }).click();
    await ops.getByRole("button", { name: m("admin.order.markDelivered") }).click();
    await ops
      .getByRole("dialog")
      .getByRole("button", { name: m("admin.order.markDelivered") })
      .click();
    await expect
      .poll(
        async () =>
          (await one<{ status: string }>("SELECT status FROM orders WHERE id = $1", [order.id]))
            .status,
      )
      .toBe("DELIVERED");
  });

  await test.step("customer sees delivery; supplier earned the payout", async () => {
    await page.goto(`/${L}/orders/${order.id}`);
    await expect(page.getByText(m("orders.status.DELIVERED")).first()).toBeVisible();
    const earned = await one<{ n: number }>(
      "SELECT count(*)::int AS n FROM payout_ledger_entries e JOIN production_jobs j ON j.id = e.job_id WHERE j.order_id = $1 AND e.kind = 'earning'",
      [order.id],
    );
    expect(earned.n).toBe(1);
  });

  expect([...errors, ...opsErrors, ...partnerErrors]).toEqual([]);
});
