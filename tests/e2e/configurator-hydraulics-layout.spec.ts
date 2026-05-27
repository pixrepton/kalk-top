import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import {
  gotoCalculator,
  reachConfiguratorHydraulicsStep,
  readHydraulicsLayoutMetrics,
  shot,
} from "./helpers/calculator-flow";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "test-results",
  "hydraulics-layout-screenshots"
);

test.describe("configurator hydraulics mini-form layout @soft", () => {
  test.setTimeout(480_000);

  test("krok 3/10 — stabilny układ i brak przesuwania przy kliknięciach", async ({
    page,
  }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    await page.setViewportSize({ width: 1440, height: 2200 });
    await gotoCalculator(page);

    await reachConfiguratorHydraulicsStep(page);
    await shot(page, "hydraulics-step-initial");

    const initial = await readHydraulicsLayoutMetrics(page);
    expect(initial.gridWidth).toBeGreaterThan(400);
    expect(initial.mosaicWidth).toBeGreaterThan(initial.gridWidth * 0.85);
    expect(Math.abs(initial.mosaicLeft - initial.gridLeft)).toBeLessThan(24);
    expect(initial.labelMarkerHidden).toBe(true);

    const bivalentCheckbox = page.locator("#hydraulics-bivalent-enabled");
    await expect(bivalentCheckbox).toBeVisible();
    const scrollBeforeEnable = await page.evaluate(() => window.scrollY);

    await bivalentCheckbox.check({ force: true });
    await page.waitForTimeout(400);

    const afterEnable = await readHydraulicsLayoutMetrics(page);
    const scrollAfterEnable = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfterEnable - scrollBeforeEnable)).toBeLessThan(120);
    expect(afterEnable.mosaicWidth).toBeGreaterThan(afterEnable.gridWidth * 0.85);
    expect(Math.abs(afterEnable.mosaicLeft - afterEnable.gridLeft)).toBeLessThan(24);
    await expect(page.locator("#hydraulics-bivalent-type-wrap")).toBeVisible();

    await page.locator("#hydraulics-bivalent-source-type").selectOption("solid_fuel");
    await page.waitForTimeout(400);

    const afterSelect = await readHydraulicsLayoutMetrics(page);
    const scrollAfterSelect = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfterSelect - scrollAfterEnable)).toBeLessThan(80);
    expect(afterSelect.mosaicWidth).toBeGreaterThan(afterSelect.gridWidth * 0.85);
    expect(Math.abs(afterSelect.mosaicLeft - afterSelect.gridLeft)).toBeLessThan(24);
    await expect(page.locator("#hydraulics-bivalent-power-wrap")).toBeVisible();

    await page.locator("#hydraulics-bivalent-source-power").fill("19");
    await page.waitForTimeout(300);

    const afterPower = await readHydraulicsLayoutMetrics(page);
    expect(afterPower.mosaicWidth).toBeGreaterThan(afterPower.gridWidth * 0.85);
    expect(Math.abs(afterPower.mosaicLeft - afterPower.gridLeft)).toBeLessThan(24);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "hydraulics-after-interactions.png"),
      fullPage: true,
    });

    const bivalentCard = page
      .locator('[data-step-key="hydraulics_inputs"] .form-field-item')
      .filter({ has: page.locator("#hydraulics-bivalent-enabled") });
    const cardBox = await bivalentCard.boundingBox();
    const typeWrapBox = await page.locator("#hydraulics-bivalent-type-wrap").boundingBox();
    expect(cardBox).not.toBeNull();
    expect(typeWrapBox).not.toBeNull();
    if (cardBox && typeWrapBox) {
      expect(typeWrapBox.x).toBeGreaterThanOrEqual(cardBox.x - 4);
      expect(typeWrapBox.x + typeWrapBox.width).toBeLessThanOrEqual(
        cardBox.x + cardBox.width + 4
      );
    }
  });
});
