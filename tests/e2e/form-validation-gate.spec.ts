import { test, expect } from "@playwright/test";
import {
  advanceAllFormTabs,
  clickFinishWhenReady,
  goToTab,
  gotoCalculator,
} from "./helpers/calculator-flow";

test.describe("form validation gate @critical", () => {
  test.setTimeout(180_000);

  test("finish without valid form does not call calculate-offer", async ({ page }) => {
    await gotoCalculator(page);
    await goToTab(page, 5);

    let calculateOfferCalled = false;
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        req.url().includes("calculate-offer")
      ) {
        calculateOfferCalled = true;
      }
    });

    const finish = page.locator(".btn-finish").first();
    await finish.click({ timeout: 10_000 }).catch(() => null);
    await page.waitForTimeout(2000);

    expect(calculateOfferCalled).toBe(false);

    const invalidVisible =
      (await page.locator(".form-field--invalid:visible, .ti-toast--error").count()) > 0 ||
      (await page.locator("#heatCalcFormFull .error-message:visible").count()) > 0;
    expect(invalidVisible || !(await page.locator(".workflow-completion").isVisible())).toBe(
      true
    );
  });

  test("finish after full form triggers calculate-offer", async ({ page }) => {
    await gotoCalculator(page);
    await advanceAllFormTabs(page);

    const calcPromise = page.waitForResponse(
      (res) =>
        res.url().includes("calculate-offer") && res.request().method() === "POST",
      { timeout: 180_000 }
    );

    await clickFinishWhenReady(page);
    const calc = await calcPromise;
    expect(calc.status()).toBeGreaterThanOrEqual(200);
    expect(calc.status()).toBeLessThan(300);
  });
});
