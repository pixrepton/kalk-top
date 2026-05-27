import { test, expect } from "@playwright/test";
import { attachDiagnosticHandlers } from "./helpers/diagnostics";
import {
  advanceAllFormTabs,
  clickFinishWhenReady,
  gotoCalculator,
  shot,
  waitForCalculateOffer,
} from "./helpers/calculator-flow";

test.describe("finish CTA @critical", () => {
  test.setTimeout(240_000);

  test("Policz dobór + ofertę shows workflow completion", async ({ page }) => {
    const diagnostics = attachDiagnosticHandlers(page);
    await page.setViewportSize({ width: 1440, height: 2200 });

    await gotoCalculator(page);
    await shot(page, "finish-01-landing");

    await advanceAllFormTabs(page);
    await shot(page, "finish-02-tab5-ready");

    const calcPromise = waitForCalculateOffer(page);
    await clickFinishWhenReady(page);
    const calc = await calcPromise;
    expect(calc.status).toBeGreaterThanOrEqual(200);
    expect(calc.status).toBeLessThan(300);

    const completion = page.locator(".workflow-completion").first();
    await completion.waitFor({ state: "visible", timeout: 180_000 });
    await expect(page.locator('[data-action="start-config"]').first()).toBeVisible();
    await shot(page, "finish-03-workflow-completion");

    const pipeline = await page.evaluate(() => {
      const appState =
        typeof (window as Window & { getAppState?: () => Record<string, unknown> })
          .getAppState === "function"
          ? (window as Window & { getAppState: () => Record<string, unknown> }).getAppState()
          : {};
      const keys = Object.keys(sessionStorage).filter((key) => key.includes("config_data"));
      return {
        traceId:
          (appState?.canonicalOffer as { traceId?: string } | undefined)?.traceId || null,
        hasCanonicalOffer: !!appState?.canonicalOffer,
        configDataKeys: keys,
      };
    });

    expect(pipeline.traceId).toBeTruthy();
    expect(pipeline.hasCanonicalOffer).toBe(true);

    diagnostics.assertCriticalConsoleBudget();
    diagnostics.writeConsoleErrorsReport();
  });
});
