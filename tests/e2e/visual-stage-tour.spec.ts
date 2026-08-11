/**
 * Visual tour: screenshot every calculator form stage top→bottom.
 * Run: npx playwright test tests/e2e/visual-stage-tour.spec.ts --project=chromium-critical
 */
import { test } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  gotoCalculator,
  goToTab,
  fillTab0,
  fillTab1,
  fillTab2,
  fillTab3,
  fillTab4,
  fillTab5,
} from "./helpers/calculator-flow";

const OUT = path.join(
  process.cwd(),
  "docs/ui-ux/proof/visual-iter/stages"
);

async function captureStage(page: import("@playwright/test").Page, stageNum: number) {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = await page.evaluate(() => {
    const sec = document.querySelector(".section.active");
    return {
      tab: sec?.getAttribute("data-tab"),
      title: (sec?.querySelector(".stage-header__title, h3")?.textContent || "")
        .trim()
        .replace(/\s+/g, " "),
      stage: (document.querySelector("#progress-stage")?.textContent || "").trim(),
      label: (document.querySelector("#progress-label")?.textContent || "").trim(),
      pct: (document.querySelector("#progress-percentage")?.textContent || "").trim(),
      scrollH: document.documentElement.scrollHeight,
    };
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT, `stage${stageNum}-full.png`),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(OUT, `stage${stageNum}-top.png`),
    fullPage: false,
  });

  const viewport = 900;
  const step = 750;
  const maxScroll = Math.max(0, meta.scrollH - viewport);
  let idx = 1;
  for (let y = step; y <= maxScroll; y += step) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(OUT, `stage${stageNum}-scroll${idx}.png`),
      fullPage: false,
    });
    idx += 1;
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  await page.screenshot({
    path: path.join(OUT, `stage${stageNum}-bottom.png`),
    fullPage: false,
  });

  fs.writeFileSync(
    path.join(OUT, `stage${stageNum}-meta.json`),
    JSON.stringify(meta, null, 2),
    "utf8"
  );
  return meta;
}

test.describe("visual stage tour @critical", () => {
  test.setTimeout(300_000);

  test("screenshot all 6 form stages top to bottom", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoCalculator(page);

    const fillers = [fillTab0, fillTab1, fillTab2, fillTab3, fillTab4, fillTab5];
    const report: unknown[] = [];

    for (let tab = 0; tab < 6; tab += 1) {
      await fillers[tab](page);
      await goToTab(page, tab);
      await page.waitForTimeout(400);
      const meta = await captureStage(page, tab + 1);
      report.push({ stage: tab + 1, ...meta });
    }

    fs.writeFileSync(
      path.join(OUT, "tour-report.json"),
      JSON.stringify({ at: new Date().toISOString(), stages: report }, null, 2),
      "utf8"
    );
  });
});
