import { test, expect } from "@playwright/test";

const calculatorPath = process.env.PLAYWRIGHT_CALCULATOR_PATH || "/?page_id=5";

test.describe("kalk-top calculator smoke", () => {
  test("loads calculator shell without removed assistant UI", async ({ page }) => {
    const response = await page.goto(calculatorPath, { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();

    await expect(page.locator('[data-role="ai-coach-dock"]')).toHaveCount(0);
    await expect(page.locator('[data-role="ai-coach-panel"]')).toHaveCount(0);
    await expect(page.locator("#heatCalcFormFull")).toBeVisible();
  });

  test("keeps heating source suppressed with air-to-water default", async ({ page }) => {
    await page.goto(calculatorPath, { waitUntil: "domcontentloaded" });

    const sourceType = page.locator("#source_type");
    await expect(sourceType).toHaveCount(1);
    await expect(sourceType).toHaveAttribute("type", "hidden");
    await expect(sourceType).toHaveValue("air_to_water_hp");
    await expect(page.getByText("Główne źródło ogrzewania")).toHaveCount(0);
  });

  test("exposes analytics bootstrap for funnel tracking", async ({ page }) => {
    await page.goto(calculatorPath, { waitUntil: "domcontentloaded" });

    const bootstrap = await page.evaluate(() => {
      const cfg = (window as Window & { HEATPUMP_CONFIG?: Record<string, unknown> })
        .HEATPUMP_CONFIG;
      return {
        hasConfig: !!cfg,
        trackAction: cfg?.trackEventAction,
        hasNonce: typeof cfg?.nonce === "string" && cfg.nonce.length > 0,
        useBackendCalc: cfg?.useBackendCalc === true,
      };
    });

    expect(bootstrap.hasConfig).toBe(true);
    expect(bootstrap.trackAction).toBe("heatpump_track_event");
    expect(bootstrap.hasNonce).toBe(true);
  });
});
