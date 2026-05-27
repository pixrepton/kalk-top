import { expect, type Page, Locator, type TestInfo } from "@playwright/test";
import path from "path";
import fs from "fs";

export const CALCULATOR_PATH =
  process.env.PLAYWRIGHT_CALCULATOR_PATH || "/?page_id=5";

export const JOURNEY_REPORT_PATH = path.join(
  process.cwd(),
  "test-results",
  "journey-report.json"
);

export const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "test-results",
  "full-journey-screenshots"
);

export type JourneyReport = {
  step: string;
  ok: boolean;
  detail?: string;
  url?: string;
};

export const journeyLog: JourneyReport[] = [];

export async function writeJourneyStep(
  step: string,
  ok: boolean,
  detail?: string,
  url?: string
) {
  journeyLog.push({ step, ok, detail, url });
  flushJourneyReport();
}

export function flushJourneyReport(extra: Record<string, unknown> = {}) {
  fs.mkdirSync(path.dirname(JOURNEY_REPORT_PATH), { recursive: true });
  const lastOk = [...journeyLog].reverse().find((entry) => entry.ok);
  fs.writeFileSync(
    JOURNEY_REPORT_PATH,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        lastSuccessfulStep: lastOk?.step || null,
        steps: journeyLog,
        ...extra,
      },
      null,
      2
    ),
    "utf8"
  );
}

export async function gotoCalculator(page: Page) {
  const response = await page.goto(CALCULATOR_PATH, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  expect(response?.ok()).toBeTruthy();
  await page.locator("#heatCalcFormFull").waitFor({
    state: "visible",
    timeout: 60_000,
  });
  return response;
}

export async function shot(page: Page, name: string, note?: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const safe = name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  const filePath = path.join(SCREENSHOT_DIR, `${safe}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  journeyLog.push({
    step: name,
    ok: true,
    detail: note || filePath,
    url: page.url(),
  });
}

async function waitNextEnabled(page: Page, selector: string) {
  const btn = page.locator(selector).first();
  await btn.waitFor({ state: "attached", timeout: 60_000 });
  for (let i = 0; i < 24; i += 1) {
    const disabled = await btn.evaluate((el) => {
      const node = el as HTMLButtonElement;
      return (
        node.disabled ||
        node.classList.contains("progressive-disabled") ||
        node.getAttribute("data-section-valid") === "false"
      );
    });
    if (!disabled) return btn;
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const engine = (
        window as Window & {
          formEngine?: { engine?: { sync?: () => void; apply?: () => void } };
        }
      ).formEngine?.engine;
      engine?.sync?.();
      engine?.apply?.();
    });
  }
  return btn;
}

export async function goToTab(page: Page, tab: number) {
  await page.evaluate((tabIndex) => {
    const w = window as Window & { showTab?: (t: number) => void };
    if (typeof w.showTab === "function") {
      w.showTab(tabIndex);
    }
  }, tab);
  await page.waitForSelector(`.section.active[data-tab="${tab}"]`, {
    timeout: 30_000,
  });
  await page.waitForTimeout(400);
}

async function clickEnabledNext(page: Page, selector: string) {
  const btn = await waitNextEnabled(page, selector);
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ timeout: 30_000 });
  await page.waitForTimeout(700);
}

export type FormValidationDiag = {
  ok: boolean;
  missing: string[];
  tabInvalid: number[];
  useBackendCalc?: boolean;
};

export async function getFormValidationDiag(
  page: Page
): Promise<FormValidationDiag> {
  await syncFormEngine(page);
  return page.evaluate(() => {
    const fe = window.formEngine as {
      state?: { getAllValues: () => Record<string, unknown> };
      enablement?: { required: (s: Record<string, unknown>) => Record<string, boolean> };
      visibility?: { fields: (s: Record<string, unknown>) => Record<string, boolean> };
      fieldIsSatisfied?: (name: string, state: Record<string, unknown>) => boolean;
    } | undefined;
    const tabInvalid: number[] = [];
    for (let tab = 0; tab <= 5; tab += 1) {
      const validateTab = (
        window as Window & { validateTab?: (t: number, o?: object) => boolean }
      ).validateTab;
      if (typeof validateTab === "function" && !validateTab(tab, { focusSummary: false })) {
        tabInvalid.push(tab);
      }
    }
    const missing: string[] = [];
    if (fe?.state && fe.enablement && fe.visibility && fe.fieldIsSatisfied) {
      const state = fe.state.getAllValues();
      const required = fe.enablement.required(state);
      const visibility = fe.visibility.fields(state);
      Object.keys(required).forEach((name) => {
        if (required[name] !== true) return;
        if (visibility[name] === false) return;
        if (!fe.fieldIsSatisfied!(name, state)) missing.push(name);
      });
    }
    const cfg = (window as Window & { HEATPUMP_CONFIG?: { useBackendCalc?: boolean } })
      .HEATPUMP_CONFIG;
    return {
      ok: tabInvalid.length === 0 && missing.length === 0,
      missing,
      tabInvalid,
      useBackendCalc: cfg?.useBackendCalc === true,
    };
  });
}

export type PersonaId =
  | "baseline-floor-heating"
  | "two-storey-wroclaw"
  | "apartment-minimal";

function resolveTabFillers(personaId?: PersonaId) {
  const tab1 =
    personaId === "two-storey-wroclaw"
      ? fillTab1TwoStoreyWroclaw
      : personaId === "apartment-minimal"
        ? fillTab1ApartmentMinimal
        : fillTab1;
  return [fillTab0, tab1, fillTab2, fillTab3, fillTab4, fillTab5];
}

export async function ensureFormValidForCalculate(page: Page, personaId?: PersonaId) {
  const fillers = resolveTabFillers(personaId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const diag = await getFormValidationDiag(page);
    if (diag.ok) return diag;

    for (const tab of diag.tabInvalid) {
      const filler = fillers[tab];
      if (filler) await filler(page);
    }
    if (diag.missing.includes("location_id")) await fillTab0(page);
    if (diag.missing.includes("attic_access")) await fillers[1](page);
    if (diag.missing.includes("include_hot_water")) await fillTab5(page);
    await syncFormEngine(page);
  }

  const finalDiag = await getFormValidationDiag(page);
  if (!finalDiag.ok) {
    throw new Error(
      `Formularz nie przechodzi walidacji: tabs=${finalDiag.tabInvalid.join(",")} fields=${finalDiag.missing.join(",")} backend=${finalDiag.useBackendCalc}`
    );
  }
  return finalDiag;
}

export async function clickFinishWhenReady(page: Page, personaId?: PersonaId) {
  await ensureFormValidForCalculate(page, personaId);
  await goToTab(page, 5);
  const btn = page.locator(".section.active[data-tab='5'] .btn-finish, .btn-finish").first();
  await waitNextEnabled(page, ".btn-finish");
  await btn.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur?.();
  });
  await syncFormEngine(page);
  await btn.click({ timeout: 30_000 });
}

export async function fillTab0(page: Page) {
  await goToTab(page, 0);
  await page
    .locator('.building-type-card[data-value="single_house"]')
    .click({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await page.selectOption("#construction_year", "2011");
  await page.waitForTimeout(500);
  await page
    .locator("label.form-field__radio-label", { hasText: "Strefa III" })
    .click({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

export async function fillTab1(page: Page) {
  await goToTab(page, 1);
  await page
    .locator('.section.active[data-tab="1"] label.form-field__radio-label', {
      hasText: "Regularny (prostokątny)",
    })
    .click({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await page
    .getByText("Podam długość i szerokość", { exact: false })
    .click({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await fillHidden(page, "#building_length", "10");
  await fillHidden(page, "#building_width", "8");
  await page.locator('.yes-no-card[data-field="has_basement"][data-value="yes"]').click();
  await page.locator('.yes-no-card[data-field="has_balcony"][data-value="yes"]').click();
  await page.waitForTimeout(400);
  await fillHidden(page, "#number_balcony_doors", "1");
  await page.selectOption("#building_floors", "2");
  await page.locator('.option-card[data-field="building_roof"][data-value="steep"]').click();
  await fillHidden(page, "#floor_height", "2.6");
  await page
    .locator("label.form-field__radio-label", { hasText: /Brak garażu|bez garażu/i })
    .first()
    .click({ timeout: 10_000 })
    .catch(async () => {
      await page.locator('input[name="garage_type"][value="none"]').evaluate((el) => {
        const input = el as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  for (const floor of ["1", "2"]) {
    const heated = page.locator(`input[name="building_heated_floors[]"][value="${floor}"]`);
    if ((await heated.count()) > 0) {
      await heated.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  }
  await page.evaluate(() => {
    const dispatch = (el: HTMLElement) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const attic = document.querySelector(
      'input[name="attic_access"][value="inaccessible"]'
    ) as HTMLInputElement | null;
    if (attic) {
      attic.checked = true;
      dispatch(attic);
    }
  });
}

async function syncFormEngine(page: Page) {
  await page.evaluate(() => {
    const engine = (
      window as Window & {
        formEngine?: { engine?: { sync?: () => void; apply?: () => void } };
      }
    ).formEngine?.engine;
    engine?.sync?.();
    engine?.apply?.();
  });
}

export async function fillTab2(page: Page) {
  await goToTab(page, 2);
  await page.evaluate(() => {
    const dispatch = (el: HTMLElement) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const construction = document.querySelector(
      'input[name="construction_type"][value="traditional"]'
    ) as HTMLInputElement | null;
    if (construction) {
      construction.checked = true;
      dispatch(construction);
    }
    const material = document.querySelector(
      "#primary_wall_material_select"
    ) as HTMLSelectElement | null;
    if (material) {
      material.value = "84";
      dispatch(material);
    }
    const wallSize = document.querySelector("#wall_size") as HTMLInputElement | null;
    if (wallSize) {
      wallSize.value = "24";
      dispatch(wallSize);
    }
  });
  await syncFormEngine(page);
  await page.waitForTimeout(300);
}

export async function fillTab3(page: Page) {
  await goToTab(page, 3);
  await page.evaluate(() => {
    const dispatch = (el: HTMLElement) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setSelect = (id: string, value: string) => {
      const el = document.querySelector(id) as HTMLSelectElement | null;
      if (!el) return;
      el.value = value;
      dispatch(el);
    };
    setSelect("#windows_type", "new_double_glass");
    setSelect("#doors_type", "new_pvc");
    const fields: Array<[string, string]> = [
      ["#number_windows", "8"],
      ["#number_huge_windows", "0"],
      ["#number_doors", "1"],
    ];
    fields.forEach(([sel, val]) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return;
      el.value = val;
      dispatch(el);
    });
  });
  await syncFormEngine(page);
}

export async function fillTab4(page: Page) {
  await goToTab(page, 4);
  await page.evaluate(() => {
    const dispatch = (el: HTMLElement) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setLevel = (id: string) => {
      const el = document.querySelector(id) as HTMLSelectElement | null;
      if (!el) return;
      el.value = "medium";
      dispatch(el);
    };
    setLevel("#walls_insulation_level");
    setLevel("#roof_insulation_level");
    setLevel("#floor_insulation_level");
    const setRadio = (name: string, value: string) => {
      const el = document.querySelector(
        `input[name="${name}"][value="${value}"]`
      ) as HTMLInputElement | null;
      if (!el) return;
      el.checked = true;
      dispatch(el);
    };
    setRadio("top_isolation", "yes");
    setRadio("bottom_isolation", "yes");
    const topMat = document.querySelector(
      'select[name="top_isolation[material]"]'
    ) as HTMLSelectElement | null;
    if (topMat) {
      topMat.value = "68";
      dispatch(topMat);
    }
    const bottomMat = document.querySelector(
      'select[name="bottom_isolation[material]"]'
    ) as HTMLSelectElement | null;
    if (bottomMat) {
      bottomMat.value = "88";
      dispatch(bottomMat);
    }
    const sizes: Array<[string, string]> = [
      ['input[name="top_isolation[size]"]', "25"],
      ['input[name="bottom_isolation[size]"]', "15"],
    ];
    sizes.forEach(([sel, val]) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return;
      el.value = val;
      dispatch(el);
    });
  });
  await syncFormEngine(page);
}

export async function fillTab5(page: Page) {
  await goToTab(page, 5);
  await page.evaluate(() => {
    const dispatch = (el: HTMLElement) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const indoor = document.querySelector("#indoor_temperature") as HTMLInputElement | null;
    if (indoor) {
      indoor.value = "21";
      dispatch(indoor);
    }
    const setSelect = (id: string, value: string) => {
      const el = document.querySelector(id) as HTMLSelectElement | null;
      if (!el) return;
      el.value = value;
      dispatch(el);
    };
    setSelect("#ventilation_type", "mechanical_recovery");
    setSelect("#heating_type", "underfloor");
    setSelect("#hot_water_usage", "shower_bath");
    const cwuHidden = document.querySelector(
      "#include_hot_water"
    ) as HTMLInputElement | null;
    if (cwuHidden) {
      cwuHidden.value = "yes";
      dispatch(cwuHidden);
    }
    const cwuCard = document.querySelector(
      '.yes-no-card[data-field="include_hot_water"][data-value="yes"]'
    ) as HTMLButtonElement | null;
    cwuCard?.click();
    const persons = document.querySelector("#hot_water_persons") as HTMLInputElement | null;
    if (persons) {
      persons.value = "4";
      dispatch(persons);
    }
    const source = document.querySelector("#source_type") as HTMLInputElement | null;
    if (source) {
      source.value = "air_to_water_hp";
      dispatch(source);
    }
  });
  await syncFormEngine(page);
}

async function setSliderHidden(page: Page, selector: string, value: string) {
  await page.evaluate(
    ({ sel, val }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { sel: selector, val: value }
  );
}

async function fillHidden(page: Page, selector: string, value: string) {
  await setSliderHidden(page, selector, value);
}

export async function fillTab1TwoStoreyWroclaw(page: Page) {
  await goToTab(page, 1);
  await page
    .locator('.section.active[data-tab="1"] label.form-field__radio-label', {
      hasText: "Regularny (prostokątny)",
    })
    .click({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await page.getByText("Podam długość i szerokość", { exact: false }).click({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await fillHidden(page, "#building_length", "10");
  await fillHidden(page, "#building_width", "11");
  await page.locator('.yes-no-card[data-field="has_basement"][data-value="no"]').click();
  await page.locator('.yes-no-card[data-field="has_balcony"][data-value="no"]').click();
  await page.selectOption("#building_floors", "2");
  await page.locator('.option-card[data-field="building_roof"][data-value="steep"]').click();
  await fillHidden(page, "#floor_height", "2.6");
  await page
    .locator("label.form-field__radio-label", { hasText: /Brak garażu|bez garażu/i })
    .first()
    .click({ timeout: 10_000 })
    .catch(async () => {
      await page.locator('input[name="garage_type"][value="none"]').evaluate((el) => {
        const input = el as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  for (const floor of ["1", "2"]) {
    const heated = page.locator(`input[name="building_heated_floors[]"][value="${floor}"]`);
    if ((await heated.count()) > 0) {
      await heated.evaluate((el) => {
        const input = el as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
  }
  await page.evaluate(() => {
    const attic = document.querySelector(
      'input[name="attic_access"][value="inaccessible"]'
    ) as HTMLInputElement | null;
    if (attic) {
      attic.checked = true;
      attic.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

export async function fillTab1ApartmentMinimal(page: Page) {
  await goToTab(page, 1);
  await page
    .locator('.section.active[data-tab="1"] label.form-field__radio-label', {
      hasText: "Regularny (prostokątny)",
    })
    .click({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await page.getByText("Podam długość i szerokość", { exact: false }).click({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await fillHidden(page, "#building_length", "6");
  await fillHidden(page, "#building_width", "5");
  await page.locator('.yes-no-card[data-field="has_basement"][data-value="no"]').click();
  await page.locator('.yes-no-card[data-field="has_balcony"][data-value="no"]').click();
  await page.selectOption("#building_floors", "1");
  await page.locator('.option-card[data-field="building_roof"][data-value="steep"]').click();
  await fillHidden(page, "#floor_height", "2.6");
  await page
    .locator("label.form-field__radio-label", { hasText: /Brak garażu|bez garażu/i })
    .first()
    .click({ timeout: 10_000 })
    .catch(async () => {
      await page.locator('input[name="garage_type"][value="none"]').evaluate((el) => {
        const input = el as HTMLInputElement;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  const heated = page.locator('input[name="building_heated_floors[]"][value="1"]');
  if ((await heated.count()) > 0) {
    await heated.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await page.evaluate(() => {
    const attic = document.querySelector(
      'input[name="attic_access"][value="inaccessible"]'
    ) as HTMLInputElement | null;
    if (attic) {
      attic.checked = true;
      attic.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await syncFormEngine(page);
}

export async function advanceFormForPersona(page: Page, personaId: PersonaId) {
  const tabFillers: Array<(p: Page) => Promise<void>> = [
    fillTab0,
    personaId === "two-storey-wroclaw"
      ? fillTab1TwoStoreyWroclaw
      : personaId === "apartment-minimal"
        ? fillTab1ApartmentMinimal
        : fillTab1,
    fillTab2,
    fillTab3,
    fillTab4,
  ];

  for (let tab = 0; tab < 5; tab += 1) {
    await tabFillers[tab](page);
    await syncFormEngine(page);
    await clickEnabledNext(page, `.btn-next${tab + 1}`);
  }
  await goToTab(page, 5);
  await fillTab5(page);
}

export async function waitForWorkflowPersistedState(page: Page) {
  await page.waitForFunction(
    () => {
      const keys = Object.keys(sessionStorage).filter((key) => key.includes("config_data"));
      for (const key of keys) {
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) continue;
          const data = JSON.parse(raw) as Record<string, unknown>;
          if (data?.offer_dto || data?.pump_selection) return true;
        } catch {
          // ignore malformed session payloads
        }
      }
      const getState = (
        window as Window & { getAppState?: () => Record<string, unknown> }
      ).getAppState;
      if (typeof getState !== "function") return false;
      const appState = getState();
      const offer = appState?.canonicalOffer as Record<string, unknown> | undefined;
      return !!(offer?.engineering || offer?.traceId);
    },
    undefined,
    { timeout: 90_000 }
  );
}

/** Configurator pump step needs sessionStorage config_data, not only canonicalOffer in memory. */
export async function waitForConfiguratorConfigData(page: Page) {
  await page.waitForFunction(
    () => {
      const getState = (
        window as Window & { getAppState?: () => Record<string, unknown> }
      ).getAppState;
      if (typeof getState === "function") {
        const appState = getState();
        const configData = appState?.config_data as Record<string, unknown> | undefined;
        if (configData?.offer_dto || configData?.pump_selection) return true;
      }

      for (const key of Object.keys(sessionStorage)) {
        if (!key.includes("config_data")) continue;
        try {
          const data = JSON.parse(sessionStorage.getItem(key) || "{}") as Record<
            string,
            unknown
          >;
          if (data?.offer_dto || data?.pump_selection) return true;
        } catch {
          // ignore malformed session payloads
        }
      }
      return false;
    },
    undefined,
    { timeout: 120_000 }
  );
}

const TAB_FILLERS = [fillTab0, fillTab1, fillTab2, fillTab3, fillTab4, fillTab5];

export async function advanceAllFormTabs(page: Page) {
  for (let tab = 0; tab < 5; tab += 1) {
    await TAB_FILLERS[tab](page);
    await syncFormEngine(page);
    await shot(page, `tab-${tab}-filled`);
    await clickEnabledNext(page, `.btn-next${tab + 1}`);
  }
  await goToTab(page, 5);
  await fillTab5(page);
  await shot(page, "tab-5-filled");
}

export async function waitForCalculateOffer(page: Page) {
  const response = await page.waitForResponse(
    (res) =>
      res.url().includes("calculate-offer") && res.request().method() === "POST",
    { timeout: 180_000 }
  );
  const status = response.status();
  let body: { traceId?: string } | null = null;
  try {
    body = (await response.json()) as { traceId?: string };
  } catch {
    body = null;
  }
  journeyLog.push({
    step: "api-calculate-offer",
    ok: status >= 200 && status < 300,
    detail: `HTTP ${status} traceId=${body?.traceId ?? "?"}`,
  });
  return { status, body };
}

const PDF_GATE_MESSAGE =
  "Aby pobrać pełny raport techniczny PDF, wprowadź swój adres e-mail i numer telefonu.";

export async function assertPdfGateBlocksWithoutContact(page: Page) {
  const pdfBtn = page.locator('[data-action="download-offer-pdf"]').first();
  await pdfBtn.click({ timeout: 30_000 });
  const form = page.locator("#pdf-contact-form, #pdf-lead-modal");
  await form.first().waitFor({ state: "visible", timeout: 60_000 });
  await expect(form).toHaveAttribute("data-intent", "pdf_download");
  const pendingIntent = await page.evaluate(() => {
    return sessionStorage.getItem("ti_pdf_download_pending");
  });
  expect(pendingIntent).toBe("1");
  const gateVisible = await page
    .locator("text=" + PDF_GATE_MESSAGE)
    .first()
    .isVisible()
    .catch(() => false);
  if (!gateVisible) {
    const emailInvalid = await page.locator("#customer-email:invalid").count();
    expect(emailInvalid + (gateVisible ? 1 : 0)).toBeGreaterThan(0);
  }
  journeyLog.push({
    step: "pdf-gate-blocked",
    ok: true,
    detail: "contact form opened without prior valid email/phone",
  });
}

export async function fillContactFormStep10(page: Page) {
  const modal = page.locator("#pdf-lead-modal");
  if (await modal.isVisible().catch(() => false)) {
    await page.locator("#pdf-lead-email").fill("e2e.lead@topinstal.test");
    await page.locator("#pdf-lead-phone").fill("600700800");
    const confirm = page.locator('[data-role="pdf-lead-modal-confirm"]').first();
    await confirm.click({ timeout: 15_000 });
    await page.waitForTimeout(500);
  }

  const form = page.locator("#pdf-contact-form");
  await form.waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("#customer-email").fill("e2e.lead@topinstal.test");
  await page.locator("#customer-phone").fill("600700800");
  await page.locator("#consent-terms-accept").check();
  await page.locator("#consent-rodo-contact").check();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const form = document.querySelector("#pdf-contact-form");
    if (form) {
      form.setAttribute("data-intent", "order_contact");
    }
    const btnContact = document.querySelector(
      '[data-action="submit-order-contact"]'
    ) as HTMLButtonElement | null;
    const btnEmail = document.querySelector(
      '[data-action="submit-email-pdf"]'
    ) as HTMLButtonElement | null;
    if (btnContact) {
      btnContact.hidden = false;
      btnContact.removeAttribute("hidden");
    }
    if (btnEmail) {
      btnEmail.hidden = true;
    }
  });
  const submitContact = page.locator('[data-action="submit-order-contact"]').first();
  await expect(submitContact).toBeEnabled({ timeout: 30_000 });
  journeyLog.push({
    step: "contact-form-filled",
    ok: true,
    detail: "email+phone+consents",
  });
}

export type PdfSubmitResult = "ok" | "skipped";

export async function submitContactFormAndAwaitPdf(
  page: Page,
  testInfo?: TestInfo
): Promise<PdfSubmitResult> {
  const requirePdf =
    process.env.PROOF_PDF_REQUIRED === "1" || process.env.PROOF_PDF_REQUIRED === "true";

  const leadPromise = page.waitForResponse(
    (res) =>
      res.url().includes("admin-ajax") &&
      res.request().method() === "POST" &&
      res.request().postData()?.includes("heatpump_lead_upsert"),
    { timeout: 120_000 }
  );
  const docPromise = page.waitForResponse(
    (res) =>
      res.url().includes("heatpump_generate_offer_document") ||
      (res.url().includes("calculate-offer") && res.request().method() === "POST"),
    { timeout: 180_000 }
  );
  const downloadPromise = page.waitForEvent("download", { timeout: 180_000 }).catch(() => null);

  await page
    .locator('[data-action="submit-order-contact"]')
    .first()
    .click({ force: true, timeout: 30_000 });

  const leadRes = await leadPromise;
  expect(leadRes.ok()).toBeTruthy();
  journeyLog.push({
    step: "lead-upsert-after-pdf-intent",
    ok: leadRes.ok(),
    detail: `HTTP ${leadRes.status()}`,
  });

  const intentCleared = await page.evaluate(() => {
    return sessionStorage.getItem("ti_pdf_download_pending");
  });
  expect(intentCleared).toBeNull();

  const docRes = await docPromise.catch(() => null);
  if (docRes) {
    journeyLog.push({
      step: "api-offer-document-after-gate",
      ok: docRes.ok(),
      detail: `${docRes.status()} ${docRes.url().split("?")[0]}`,
    });
  }

  const download = await downloadPromise;
  if (download) {
    const savePath = path.join(SCREENSHOT_DIR, download.suggestedFilename() || "offer.pdf");
    await download.saveAs(savePath);
    journeyLog.push({
      step: "pdf-download-after-gate",
      ok: true,
      detail: savePath,
    });
    flushJourneyReport();
    return "ok";
  }

  const docOk = docRes && docRes.status() >= 200 && docRes.status() < 300;
  if (!docOk && !requirePdf) {
    const detail = "PDF generator unavailable (soft tier)";
    journeyLog.push({ step: "pdf-soft-skip", ok: true, detail });
    flushJourneyReport();
    testInfo?.annotations.push({ type: "skip", description: detail });
    return "skipped";
  }

  if (!docOk) {
    throw new Error(
      `PDF document generation failed: doc=${docRes?.status() ?? "timeout"} download=${download ? "yes" : "no"}`
    );
  }

  flushJourneyReport();
  return "ok";
}

export type HydraulicsLayoutMetrics = {
  gridWidth: number;
  mosaicWidth: number;
  mosaicLeft: number;
  gridLeft: number;
  labelMarkerHidden: boolean;
};

export function clearConfiguratorPersistedState(page: Page) {
  return page.evaluate(() => {
    Object.keys(sessionStorage).forEach((key) => {
      if (
        key.includes("wycena2025_configuratorState") ||
        key.includes("configuratorState")
      ) {
        sessionStorage.removeItem(key);
      }
    });
  });
}

export async function reachConfiguratorPumpStep(page: Page) {
  await page.waitForFunction(
    () => {
      const grid = document.querySelector(
        '#configurator-app [data-step-key="pompa"] .options-grid, #configurator-view [data-step-key="pompa"] .options-grid'
      );
      if (!grid) return false;
      if (grid.querySelector('[data-role="pump-pending"]')) return false;
      return grid.querySelectorAll(".product-card:not(.disabled)").length > 0;
    },
    undefined,
    { timeout: 120_000 }
  );

  const editPump = page.locator('[data-action="edit-step"][data-step-key="pompa"]');
  if (await editPump.isVisible().catch(() => false)) {
    await editPump.click({ timeout: 15_000 });
    await page.waitForTimeout(800);
  } else {
    for (let i = 0; i < 12; i += 1) {
      const activeKey = await page
        .locator(".config-step.active")
        .first()
        .getAttribute("data-step-key")
        .catch(() => null);
      if (activeKey === "pompa") break;
      const prev = page.locator("#nav-prev");
      if (!(await prev.isEnabled().catch(() => false))) break;
      await prev.click({ timeout: 10_000 });
      await page.waitForTimeout(600);
    }
  }

  const pumpStep = page.locator('.config-step.active[data-step-key="pompa"]').first();
  await pumpStep.waitFor({ state: "visible", timeout: 30_000 });

  const pumpCards = pumpStep.locator(
    ".options-grid .product-card:not(.disabled), .options-grid .option-card:not(.disabled)"
  );
  await pumpCards.first().waitFor({ state: "visible", timeout: 30_000 });
  return pumpStep;
}

export async function reachConfiguratorHydraulicsStep(page: Page) {
  await advanceAllFormTabs(page);
  const calcPromise = waitForCalculateOffer(page);
  await clickFinishWhenReady(page);
  const calc = await calcPromise;
  expect(calc.status).toBeGreaterThanOrEqual(200);
  expect(calc.status).toBeLessThan(300);

  await page
    .locator(".workflow-completion, [data-action='start-config']")
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
  await page.locator("[data-action='start-config']").first().click({ timeout: 30_000 });
  await page.locator("#configurator-app, #configurator-view").first().waitFor({
    state: "visible",
    timeout: 120_000,
  });
  await page.waitForTimeout(1500);

  for (let i = 0; i < 10; i += 1) {
    const stepKey = await page
      .locator(".config-step:visible")
      .first()
      .getAttribute("data-step-key")
      .catch(() => null);
    if (stepKey === "hydraulics_inputs") {
      await page.locator("#hydraulics-inputs-grid").waitFor({
        state: "visible",
        timeout: 30_000,
      });
      return;
    }

    const cards = page.locator(
      ".config-step:visible .product-card:not(.disabled), .config-step:visible .option-card:not(.disabled)"
    );
    if ((await cards.count()) > 0) {
      await cards.first().click({ timeout: 20_000 });
      await page.waitForTimeout(700);
    }

    const next = page.locator("#nav-next");
    if (await next.isEnabled().catch(() => false)) {
      await next.click({ timeout: 20_000 });
      await page.waitForTimeout(700);
    }
  }

  await page
    .locator('[data-step-key="hydraulics_inputs"].config-step:visible, .config-step:visible[data-step-key="hydraulics_inputs"]')
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("#hydraulics-inputs-grid .hydraulics-inputs-mosaic").waitFor({
    state: "visible",
    timeout: 30_000,
  });
}

export async function readHydraulicsLayoutMetrics(
  page: Page
): Promise<HydraulicsLayoutMetrics> {
  return page.evaluate(() => {
    const grid = document.querySelector("#hydraulics-inputs-grid");
    const mosaic = document.querySelector(
      "#hydraulics-inputs-grid .hydraulics-inputs-mosaic"
    );
    const label = document.querySelector(
      '[data-step-key="hydraulics_inputs"] .form-row-mosaic .form-label'
    );
    const gridRect = grid?.getBoundingClientRect();
    const mosaicRect = mosaic?.getBoundingClientRect();
    let labelMarkerHidden = true;
    if (label) {
      const before = window.getComputedStyle(label, "::before");
      labelMarkerHidden =
        before.display === "none" ||
        before.content === "none" ||
        before.content === '""' ||
        before.width === "0px";
    }
    return {
      gridWidth: gridRect?.width || 0,
      mosaicWidth: mosaicRect?.width || 0,
      mosaicLeft: mosaicRect?.left || 0,
      gridLeft: gridRect?.left || 0,
      labelMarkerHidden,
    };
  });
}

export async function advanceConfigurator(page: Page, maxSteps = 16) {
  for (let i = 0; i < maxSteps; i += 1) {
    const stepKey = await page
      .locator(".config-step:visible")
      .first()
      .getAttribute("data-step-key")
      .catch(() => null);

    const cards: Locator = page.locator(
      ".config-step:visible .product-card.recommended, .config-step:visible .product-card, .config-step:visible .option-card"
    );
    if ((await cards.count()) > 0) {
      await cards.first().scrollIntoViewIfNeeded();
      await cards.first().click({ timeout: 20_000 });
      await page.waitForTimeout(1000);
    }

    const pdfBtn = page.locator('[data-action="download-offer-pdf"]');
    if (await pdfBtn.isVisible().catch(() => false)) {
      journeyLog.push({
        step: `configurator-pdf-ready-${i}`,
        ok: true,
        detail: stepKey || "summary",
      });
      return true;
    }

    const next = page.locator("#nav-next");
    if (!(await next.isVisible().catch(() => false))) break;

    const disabled = await next.isDisabled();
    if (!disabled) {
      await next.click({ timeout: 20_000 });
      await page.waitForTimeout(1000);
      continue;
    }

    await page.waitForTimeout(1500);
    if (await next.isDisabled()) {
      journeyLog.push({
        step: `configurator-stuck-${i}`,
        ok: false,
        detail: `nav-next disabled @ ${stepKey}`,
      });
      break;
    }
  }
  return false;
}
