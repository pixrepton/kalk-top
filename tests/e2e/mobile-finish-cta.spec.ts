import { test, expect } from "@playwright/test";
import {
  advanceAllFormTabs,
  clickFinishWhenReady,
  gotoCalculator,
  waitForCalculateOffer,
} from "./helpers/calculator-flow";

test.describe("mobile finish CTA @mobile @soft", () => {
  test.setTimeout(240_000);

  test("finish shows workflow on mobile viewport", async ({ page }) => {
    await gotoCalculator(page);
    await advanceAllFormTabs(page);

    const calcPromise = waitForCalculateOffer(page);
    await clickFinishWhenReady(page);
    const calc = await calcPromise;
    expect(calc.status).toBeGreaterThanOrEqual(200);
    expect(calc.status).toBeLessThan(300);

    await page
      .locator(".workflow-completion, [data-action='start-config']")
      .first()
      .waitFor({ state: "visible", timeout: 180_000 });
  });
});
