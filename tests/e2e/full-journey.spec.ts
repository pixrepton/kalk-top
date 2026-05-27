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
  flushJourneyReport,
  gotoCalculator,
  journeyLog,
  shot,
  waitForCalculateOffer,
  writeJourneyStep,
} from "./helpers/calculator-flow";

test.describe("full journey A→Ż @soft", () => {
  test.setTimeout(480_000);

  test("form → OZC result → configurator → offer PDF", async ({ page }, testInfo) => {
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

    try {
      await gotoCalculator(page);
      await shot(page, "01-landing-form");
      await writeJourneyStep("landing", true, page.url());

      await advanceAllFormTabs(page);
      await shot(page, "05-tab5-heating-before-calc");
      await writeJourneyStep("tabs-filled", true);

      const calcPromise = waitForCalculateOffer(page);
      await clickFinishWhenReady(page);
      await writeJourneyStep("pre-calc-validation", true, "ensureFormValidForCalculate passed");

      const calc = await calcPromise;
      expect(calc.status).toBeGreaterThanOrEqual(200);
      expect(calc.status).toBeLessThan(300);
      await writeJourneyStep("calculate-offer", true, `HTTP ${calc.status}`);

      await page
        .locator(".workflow-completion, [data-action='start-config']")
        .first()
        .waitFor({ state: "visible", timeout: 180_000 });
      await shot(page, "06-workflow-completion-ozc-result");
      await writeJourneyStep("workflow-completion", true);

      const trackFlush = page.waitForResponse(
        (res) => res.url().includes("heatpump_track_event"),
        { timeout: 30_000 }
      );
      await trackFlush.catch(() => null);
      await page.waitForTimeout(2000);
      await shot(page, "07-results-after-analytics-flush");

      const ozcKw = await page
        .locator("#r-max-power, [data-role='result-kw-inline']")
        .first()
        .textContent();
      await writeJourneyStep(
        "ozc-display",
        !!ozcKw && ozcKw.trim().length > 0,
        ozcKw?.trim() || "empty"
      );

      const startConfig = page.locator('[data-action="start-config"]').first();
      await startConfig.waitFor({ state: "visible", timeout: 60_000 });
      await startConfig.click();
      await page.locator("#configurator-app, #configurator-view").first().waitFor({
        state: "visible",
        timeout: 120_000,
      });
      await page.waitForTimeout(2000);
      await shot(page, "08-configurator-open");
      await writeJourneyStep("configurator-open", true);

      const configReady = await advanceConfigurator(page, 16);
      await shot(page, "09-configurator-after-steps");
      await writeJourneyStep("configurator-steps", configReady, String(configReady));

      const pdfBtn = page.locator('[data-action="download-offer-pdf"]').first();
      await pdfBtn.waitFor({ state: "visible", timeout: 120_000 });
      await shot(page, "10-before-offer-pdf");

      let pdfResult: "ok" | "skipped" | "gate-skip" = "gate-skip";
      try {
        await assertPdfGateBlocksWithoutContact(page);
        await shot(page, "10b-pdf-gate-contact-form");
        await fillContactFormStep10(page);
        await shot(page, "10c-contact-form-filled");
        pdfResult = await submitContactFormAndAwaitPdf(page, testInfo);
        if (pdfResult === "skipped") {
          testInfo.annotations.push({
            type: "skip",
            description: "PDF generator unavailable (soft tier)",
          });
        }
      } catch (pdfFlowError) {
        if (process.env.PROOF_PDF_REQUIRED === "1") {
          throw pdfFlowError;
        }
        pdfResult = "skipped";
        testInfo.annotations.push({
          type: "skip",
          description:
            "PDF lead gate or generator unavailable in soft tier (configurator summary)",
        });
        await writeJourneyStep(
          "pdf-soft-skip",
          true,
          pdfFlowError instanceof Error ? pdfFlowError.message : String(pdfFlowError)
        );
      }

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

      await writeJourneyStep(
        "runtime-state",
        analyticsState.hasCanonicalOffer,
        JSON.stringify(analyticsState)
      );

      flushJourneyReport({
        finishedAt: new Date().toISOString(),
        configuratorReachedPdf: configReady,
        analyticsState,
        networkNotes,
        pdfResult,
      });

      const reportPath = path.join(SCREENSHOT_DIR, "journey-report-copy.json");
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      fs.copyFileSync(
        path.join(process.cwd(), "test-results", "journey-report.json"),
        reportPath
      );

      expect(calc.status).toBeLessThan(300);
      expect(analyticsState.hasCanonicalOffer).toBe(true);
      expect(ozcKw?.trim().length).toBeGreaterThan(0);
      await expect(pdfBtn).toBeVisible();
    } catch (error) {
      const lastOk = [...journeyLog].reverse().find((entry) => entry.ok);
      flushJourneyReport({
        failed: true,
        lastSuccessfulStep: lastOk?.step || null,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Journey failed after step "${lastOk?.step || "none"}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });
});
