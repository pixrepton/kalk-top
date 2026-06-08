import { chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

async function fillMinimalForm(page) {
  await page.goto("http://127.0.0.1:8091/?page_id=5", {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForSelector("#heatCalcFormFull", { timeout: 60_000 });

  const showTab = async (tab) => {
    await page.evaluate((t) => window.showTab?.(t), tab);
    await page.waitForSelector(`.section.active[data-tab="${tab}"]`, {
      timeout: 30_000,
    });
    await page.waitForTimeout(400);
  };

  await showTab(0);
  await page.locator('.building-type-card[data-value="single_house"]').click();
  await page.selectOption("#construction_year", "2011");
  await page.locator('label.form-field__radio-label', { hasText: "Strefa III" }).click();

  for (let tab = 1; tab <= 4; tab += 1) {
    await showTab(tab);
    const next = page.locator(`.btn-next${tab + 1}`).first();
    for (let i = 0; i < 30; i += 1) {
      if (!(await next.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        window.formEngine?.engine?.sync?.();
        window.formEngine?.engine?.apply?.();
      });
    }
    await next.click();
  }

  await showTab(5);
  await page.locator('.yes-no-card[data-field="include_hot_water"][data-value="yes"]').click();
  await page.locator('.option-card[data-field="hot_water_usage"][data-value="shower_bath"]').click();
  await setSlider(page, "#hot_water_persons", "4");
  await page.locator('.option-card[data-field="heating_type"][data-value="radiators"]').click();
}

async function setSlider(page, selector, value) {
  await page.evaluate(
    ({ sel, val }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { sel: selector, val: value }
  );
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

try {
  await fillMinimalForm(page);
  const calcPromise = page.waitForResponse(
    (res) =>
      res.url().includes("calculate-offer") && res.request().method() === "POST",
    { timeout: 180_000 }
  );
  await page.locator(".btn-finish").first().click({ timeout: 30_000 });
  const calcRes = await calcPromise;
  console.log("calculate-offer:", calcRes.status(), calcRes.url().split("?")[0]);

  await page.waitForTimeout(8000);

  const diag = await page.evaluate(() => {
    const cfg = window.HEATPUMP_CONFIG || {};
    const appState =
      typeof window.getAppState === "function" ? window.getAppState() : {};
    const configKeys = Object.keys(sessionStorage).filter((k) =>
      k.includes("config_data")
    );
    const configPayloads = {};
    for (const key of configKeys) {
      try {
        configPayloads[key] = JSON.parse(sessionStorage.getItem(key) || "null");
      } catch {
        configPayloads[key] = "parse-error";
      }
    }
    return {
      useBackendCalc: cfg.useBackendCalc === true,
      hasDisplayResults: typeof window.displayResults === "function",
      completionShown: !!document.querySelector(".workflow-completion"),
      completionDisplay: document.querySelector(".workflow-completion")?.style?.display,
      startConfigCount: document.querySelectorAll('[data-action="start-config"]').length,
      startConfigVisible: Array.from(
        document.querySelectorAll('[data-action="start-config"]')
      ).some((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      }),
      completionAnimationShown:
        appState?.uiFlags?.completionAnimationShown ||
        appState?.completionAnimationShown,
      configKeys,
      hasOfferInConfig: configKeys.some((key) => {
        const data = configPayloads[key];
        return data && typeof data === "object" && !!data.offer_dto;
      }),
      rMaxPowerText: document.querySelector("#r-max-power")?.textContent?.trim(),
      activeTab: document.querySelector(".section.active")?.getAttribute("data-tab"),
    };
  });

  console.log(JSON.stringify(diag, null, 2));
  console.log("--- console (last 40) ---");
  for (const line of logs.slice(-40)) console.log(line);
} finally {
  await browser.close();
}
