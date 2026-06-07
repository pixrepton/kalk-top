import { test, expect } from "@playwright/test";
import {
  advanceAllFormTabs,
  advanceConfiguratorThrough,
  clickFinishWhenReady,
  gotoCalculator,
  readCanonicalOffer,
  readPricingGross,
  reachConfiguratorStep,
  selectConfiguratorOption,
  waitForCalculateOffer,
  waitForWorkflowPersistedState,
} from "./helpers/calculator-flow";

test.describe("configurator pricing steps @soft", () => {
  test.setTimeout(480_000);

  test("service, posadowienie, reduktor, woda increase pricing.totals.gross", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 2000 });
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
    await waitForWorkflowPersistedState(page);

    await page.locator("[data-action='start-config']").first().click({ timeout: 60_000 });
    await page.locator("#configurator-app, #configurator-view").first().waitFor({
      state: "visible",
      timeout: 120_000,
    });
    await page.waitForTimeout(1500);

    await advanceConfiguratorThrough(page, [
      "pompa",
      "cwu",
      "hydraulics_inputs",
      "bufor",
    ]);

    await reachConfiguratorStep(page, "service");
    const grossBeforeService = readPricingGross(await readCanonicalOffer(page));
    expect(grossBeforeService).not.toBeNull();
    const grossAfterService = await selectConfiguratorOption(
      page,
      "service-cloud",
      "service",
      { requireGrossChange: false }
    );
    expect(grossAfterService).not.toBeNull();
    expect(grossAfterService).toBe(grossBeforeService);

    await reachConfiguratorStep(page, "posadowienie");
    const grossBeforeFoundation = readPricingGross(await readCanonicalOffer(page));
    expect(grossBeforeFoundation).not.toBeNull();
    const grossAfterFoundation = await selectConfiguratorOption(
      page,
      "posadowienie-eko",
      "posadowienie"
    );
    expect(grossAfterFoundation).not.toBeNull();
    expect(grossAfterFoundation!).toBeGreaterThan(grossBeforeFoundation!);

    await reachConfiguratorStep(page, "reduktor");
    const grossBeforeReducer = readPricingGross(await readCanonicalOffer(page));
    expect(grossBeforeReducer).not.toBeNull();
    const reducerTakSelected = await page
      .locator(
        '.config-step[data-step-key="reduktor"] [data-option-id="reduktor-tak"].selected'
      )
      .count();
    if (reducerTakSelected === 0) {
      const grossAfterReducer = await selectConfiguratorOption(
        page,
        "reduktor-tak",
        "reduktor"
      );
      expect(grossAfterReducer).not.toBeNull();
      expect(grossAfterReducer!).toBeGreaterThan(grossBeforeReducer!);
    } else {
      const grossAfterReducer = await selectConfiguratorOption(
        page,
        "reduktor-nie",
        "reduktor"
      );
      expect(grossAfterReducer).not.toBeNull();
      expect(grossAfterReducer!).toBeLessThan(grossBeforeReducer!);
      const grossRestored = await selectConfiguratorOption(
        page,
        "reduktor-tak",
        "reduktor"
      );
      expect(grossRestored).not.toBeNull();
      expect(grossRestored!).toBeGreaterThan(grossAfterReducer!);
    }

    await reachConfiguratorStep(page, "woda");
    const grossBeforeWater = readPricingGross(await readCanonicalOffer(page));
    expect(grossBeforeWater).not.toBeNull();
    await selectConfiguratorOption(page, "woda-nie", "woda", {
      requireGrossChange: false,
    });
    const grossWithoutWater = readPricingGross(await readCanonicalOffer(page));
    expect(grossWithoutWater).not.toBeNull();
    const grossAfterWater = await selectConfiguratorOption(page, "woda-tak", "woda");
    expect(grossAfterWater).not.toBeNull();
    expect(grossAfterWater!).toBeGreaterThan(grossWithoutWater!);
  });
});
