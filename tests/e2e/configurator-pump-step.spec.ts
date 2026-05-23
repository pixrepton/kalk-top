import { test, expect } from "@playwright/test";
import {
  advanceAllFormTabs,
  clickFinishWhenReady,
  shot,
  waitForCalculateOffer,
} from "./helpers/calculator-flow";

const calculatorPath =
  process.env.PLAYWRIGHT_CALCULATOR_PATH || "/?page_id=5";

test.describe("configurator pump step (regression)", () => {
  test.setTimeout(300_000);

  test("workflow CTA opens configurator with pump cards on step 1", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1440, height: 1200 });
    const landing = await page.goto(calculatorPath, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    expect(landing?.ok()).toBeTruthy();
    await page.locator("#heatCalcFormFull").waitFor({
      state: "visible",
      timeout: 60_000,
    });

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
    await shot(page, "workflow-cta-visible");

    const configSnapshot = await page.evaluate(() => {
      const readKey = (key: string) => {
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) return null;
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return null;
        }
      };

      const keys = Object.keys(sessionStorage).filter((key) =>
        key.includes("config_data")
      );
      const payloads = keys
        .map((key) => ({ key, data: readKey(key) }))
        .filter((entry) => entry.data && typeof entry.data === "object");

      const primary = payloads[0]?.data || null;
      const selection =
        (primary?.offer_dto as { engineering?: { selection?: unknown } } | undefined)
          ?.engineering?.selection || null;
      const pumpSelection = primary?.pump_selection || null;

      return {
        keys: payloads.map((entry) => entry.key),
        maxHeatingPower: primary?.max_heating_power ?? null,
        hasOfferDto: !!primary?.offer_dto,
        hasPumpSelection: !!pumpSelection,
        hasEngineeringSelection: !!selection,
        hpModel:
          (pumpSelection as { hp?: { model?: string } } | null)?.hp?.model ||
          (
            selection as {
              pumpSelection?: { hp?: { model?: string } };
              pumpModel?: string;
            } | null
          )?.pumpSelection?.hp?.model ||
          (selection as { pumpModel?: string } | null)?.pumpModel ||
          null,
      };
    });

    expect(configSnapshot.hasOfferDto || configSnapshot.hasPumpSelection).toBe(
      true
    );

    await startConfig.click();
    await page
      .locator("#configurator-view, #configurator-app")
      .first()
      .waitFor({ state: "visible", timeout: 120_000 });

    const pumpStep = page
      .locator(
        '.config-step:visible[data-step-key="pompa"], [data-step-key="pompa"].config-step:visible'
      )
      .first();
    await pumpStep.waitFor({ state: "visible", timeout: 60_000 });
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

    const criticalConfiguratorErrors = consoleErrors.filter(
      (line) =>
        line.includes("[Configurator]") ||
        line.includes("[WORKFLOW]") ||
        line.includes("config_data")
    );
    expect(criticalConfiguratorErrors).toEqual([]);
  });
});
