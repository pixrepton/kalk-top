import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const personas = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "personas.json"), "utf8")
) as Array<{ id: string; label: string; maxDurationMs: number }>;
import {
  advanceFormForPersona,
  clickFinishWhenReady,
  gotoCalculator,
  type PersonaId,
  waitForCalculateOffer,
} from "./helpers/calculator-flow";

test.describe("business personas @critical", () => {
  test.setTimeout(240_000);

  for (const persona of personas) {
    test(`${persona.label}`, async ({ page }) => {
      const started = Date.now();
      await page.setViewportSize({ width: 1440, height: 1200 });
      await gotoCalculator(page);

      await advanceFormForPersona(page, persona.id as PersonaId);
      const calcPromise = waitForCalculateOffer(page);
      await clickFinishWhenReady(page, persona.id as PersonaId);
      const calc = await calcPromise;

      expect(calc.status).toBeGreaterThanOrEqual(200);
      expect(calc.status).toBeLessThan(300);

      await page
        .locator(".workflow-completion, [data-action='start-config']")
        .first()
        .waitFor({ state: "visible", timeout: 180_000 });

      const elapsed = Date.now() - started;
      expect(elapsed).toBeLessThan(persona.maxDurationMs);
    });
  }
});
