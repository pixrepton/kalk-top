import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  SCREENSHOT_DIR,
  advanceAllFormTabs,
  advanceConfigurator,
  assertPdfGateBlocksWithoutContact,
  fillContactFormStep10,
  submitContactFormAndAwaitPdf,
  clickFinishWhenReady,
  journeyLog,
  shot,
  waitForCalculateOffer,
} from "./helpers/calculator-flow";

const calculatorPath =
  process.env.PLAYWRIGHT_CALCULATOR_PATH || "/?page_id=5";

test.describe("full journey A→Ż", () => {
  test.setTimeout(480_000);

  test("form → OZC result → configurator → offer PDF", async ({ page }) => {
    journeyLog.length = 0;
    const networkNotes: string[] = [];

    page.on("response", async (res) => {
      const url = res.url();
      if (
        url.includes("calculate-offer") ||
        url.includes("heatpump_track_event") ||
        url.includes("heatpump_generate_offer_document")
      ) {
        networkNotes.push(`${res.status()} ${res.request().method()} ${url.split("?")[0]}`);
      }
    });

    await page.setViewportSize({ width: 1440, height: 2200 });

    const landing = await page.goto(calculatorPath, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    expect(landing?.ok()).toBeTruthy();
    await page.locator("#heatCalcFormFull").waitFor({ state: "visible", timeout: 60_000 });
    await shot(page, "01-landing-form");

    await advanceAllFormTabs(page);
    await shot(page, "05-tab5-heating-before-calc");
    const calcPromise = waitForCalculateOffer(page);
    await clickFinishWhenReady(page);
    journeyLog.push({
      step: "pre-calc-validation",
      ok: true,
      detail: "ensureFormValidForCalculate passed",
    });
    const calc = await calcPromise;
    expect(calc.status).toBeGreaterThanOrEqual(200);
    expect(calc.status).toBeLessThan(300);

    await page
      .locator(".workflow-completion, [data-action='start-config']")
      .first()
      .waitFor({ state: "visible", timeout: 180_000 });
    await shot(page, "06-workflow-completion-ozc-result");

    const trackFlush = page.waitForResponse(
      (res) => res.url().includes("heatpump_track_event"),
      { timeout: 30_000 }
    );
    await trackFlush.catch(() => null);
    await page.waitForTimeout(2000);
    await shot(page, "07-results-after-analytics-flush");

    const ozcKw = await page.locator("#r-max-power, [data-role='result-kw-inline']").first().textContent();
    journeyLog.push({
      step: "ozc-display",
      ok: !!ozcKw && ozcKw.trim().length > 0,
      detail: ozcKw?.trim() || "empty",
    });

    const startConfig = page.locator('[data-action="start-config"]').first();
    await startConfig.waitFor({ state: "visible", timeout: 60_000 });
    await startConfig.click();
    await page.locator("#configurator-app, #configurator-view").first().waitFor({
      state: "visible",
      timeout: 120_000,
    });
    await page.waitForTimeout(2000);
    await shot(page, "08-configurator-open");

    const configReady = await advanceConfigurator(page, 16);
    await shot(page, "09-configurator-after-steps");

    const pdfBtn = page.locator('[data-action="download-offer-pdf"]').first();
    await pdfBtn.waitFor({ state: "visible", timeout: 120_000 });
    await shot(page, "10-before-offer-pdf");

    await assertPdfGateBlocksWithoutContact(page);
    await shot(page, "10b-pdf-gate-contact-form");

    await fillContactFormStep10(page);
    await shot(page, "10c-contact-form-filled");

    await submitContactFormAndAwaitPdf(page);

    await page.waitForTimeout(3000);
    await shot(page, "11-after-pdf-attempt");

    const analyticsState = await page.evaluate(async () => {
      const cfg = (window as Window & { HEATPUMP_CONFIG?: Record<string, unknown> })
        .HEATPUMP_CONFIG;
      const appState =
        typeof (window as Window & { getAppState?: () => Record<string, unknown> })
          .getAppState === "function"
          ? (window as Window & { getAppState: () => Record<string, unknown> }).getAppState()
          : {};
      return {
        traceId:
          (appState?.canonicalOffer as { traceId?: string } | undefined)?.traceId ||
          (appState?.offer as { traceId?: string } | undefined)?.traceId ||
          null,
        hasCanonicalOffer: !!(appState?.canonicalOffer || appState?.offer),
        sessionId: (window as Window & { localStorage?: Storage }).localStorage?.getItem(
          "ti_calc_session_id"
        ),
        trackQueued: (window as Window & { localStorage?: Storage }).localStorage?.getItem(
          "ti_calc_track_queue_v1"
        ),
        useBackendCalc: cfg?.useBackendCalc === true,
      };
    });

    journeyLog.push({
      step: "runtime-state",
      ok: analyticsState.hasCanonicalOffer,
      detail: JSON.stringify(analyticsState),
    });

    const reportPath = path.join(SCREENSHOT_DIR, "journey-report.json");
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          finishedAt: new Date().toISOString(),
          calculatorPath,
          configuratorReachedPdf: configReady,
          analyticsState,
          networkNotes,
          steps: journeyLog,
        },
        null,
        2
      ),
      "utf8"
    );

    expect(calc.status).toBeLessThan(300);
    expect(analyticsState.hasCanonicalOffer).toBe(true);
    expect(ozcKw?.trim().length).toBeGreaterThan(0);
    await expect(pdfBtn).toBeVisible();
  });
});
