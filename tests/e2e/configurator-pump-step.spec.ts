import { test, expect } from "@playwright/test";
import { attachDiagnosticHandlers } from "./helpers/diagnostics";
import {
  advanceAllFormTabs,
  clickFinishWhenReady,
  clearConfiguratorPersistedState,
  gotoCalculator,
  reachConfiguratorPumpStep,
  shot,
  waitForCalculateOffer,
  waitForConfiguratorConfigData,
  waitForWorkflowPersistedState,
} from "./helpers/calculator-flow";

test.describe("configurator pump step @critical", () => {
  test.setTimeout(240_000);

  test("workflow CTA opens configurator with pump cards on step 1", async ({ page }) => {
    const diagnostics = attachDiagnosticHandlers(page);
    await page.setViewportSize({ width: 1440, height: 1200 });

    await gotoCalculator(page);

    await advanceAllFormTabs(page);
    const calcPromise = waitForCalculateOffer(page);
    await clickFinishWhenReady(page);
    const calc = await calcPromise;
    expect(calc.status).toBeGreaterThanOrEqual(200);
    expect(calc.status).toBeLessThan(300);

    await page
      .locator(".workflow-completion")
      .first()
      .waitFor({ state: "visible", timeout: 180_000 });

    const startConfig = page.locator('[data-action="start-config"]').first();
    await startConfig.waitFor({ state: "visible", timeout: 90_000 });
    await waitForWorkflowPersistedState(page);
    await waitForConfiguratorConfigData(page);
    await shot(page, "workflow-cta-visible");

    const pipeline = await page.evaluate(() => {
      const appState =
        typeof (window as Window & { getAppState?: () => Record<string, unknown> })
          .getAppState === "function"
          ? (window as Window & { getAppState: () => Record<string, unknown> }).getAppState()
          : {};
      const canonical = appState?.canonicalOffer as Record<string, unknown> | undefined;
      return {
        traceId: (canonical?.traceId as string | undefined) || null,
        hasCanonicalOffer: !!canonical,
        hasEngineering: !!(canonical?.engineering as Record<string, unknown> | undefined),
      };
    });

    expect(pipeline.traceId).toBeTruthy();
    expect(pipeline.hasCanonicalOffer).toBe(true);

    await clearConfiguratorPersistedState(page);
    await startConfig.click();
    await page
      .locator("#configurator-view, #configurator-app")
      .first()
      .waitFor({ state: "visible", timeout: 120_000 });
    await page.waitForTimeout(1500);

    const pumpStep = await reachConfiguratorPumpStep(page);
    await shot(page, "configurator-step-pompa");

    const pendingCard = pumpStep.locator('[data-role="pump-pending"]');
    await expect(pendingCard).toHaveCount(0);

    const pumpCards = pumpStep.locator(
      ".options-grid .product-card:not(.disabled), .options-grid .option-card:not(.disabled)"
    );
    await expect(pumpCards.first()).toBeVisible({ timeout: 60_000 });
    expect(await pumpCards.count()).toBeGreaterThan(0);

    const sectionDescription = pumpStep.locator(".section-description");
    await expect(sectionDescription).not.toHaveText(/^\s*$/);
    const descriptionText = (await sectionDescription.textContent())?.trim() || "";
    expect(descriptionText.length).toBeGreaterThan(10);

    diagnostics.assertCriticalConsoleBudget();
    diagnostics.writeConsoleErrorsReport();
  });
});
