const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.join(__dirname, "..", "..");
const offerSummaryPath = path.join(__dirname, "offerSummary.js");
const configuratorPath = path.join(repoRoot, "konfigurator", "configurator-unified.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadOfferSummaryHooks(appState = {}) {
  const originalSource = fs.readFileSync(offerSummaryPath, "utf8");
  const instrumentedSource = originalSource.replace(
    "return function disposeOfferSummary() {",
    `globalThis.__offerSummaryTestHooks = {
      resolvePricingVisibilityState,
      resolveExpectedPricingSkus,
      getRuntimePricingState,
      buildPendingRepriceUserMessage,
    };

    return function disposeOfferSummary() {`
  );

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.HEATPUMP_CONFIG = { useBackendCalc: true };
  sandbox.getAppState = () => appState;
  sandbox.document = {
    createElement() {
      let text = "";
      return {
        set textContent(value) {
          text = String(value || "");
        },
        get textContent() {
          return text;
        },
        get innerHTML() {
          return text;
        },
      };
    },
  };

  const root = {
    ownerDocument: {
      defaultView: sandbox,
      createElement: sandbox.document.createElement,
    },
    querySelector() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const dom = {
    qs() {
      return null;
    },
    qsa() {
      return [];
    },
    byId() {
      return null;
    },
  };

  vm.runInNewContext(instrumentedSource, sandbox, {
    filename: offerSummaryPath,
  });

  sandbox.__HP_MODULES__.offerSummary.init({
    root,
    dom,
    state: {
      getAppState: () => appState,
    },
  });

  return sandbox.__offerSummaryTestHooks;
}

function createSummaryOffer({
  items,
  selections,
  pricingState,
  pumpType = "split",
  totalGross = 12960,
}) {
  const offerDto = {
    pricing: {
      totals: {
        gross: totalGross,
      },
      items,
    },
    engineering: {
      selection: {
        type: pumpType,
        pumpModel: "PANASONIC Test 9kW",
      },
    },
  };

  return {
    offerDto,
    totalGross,
    totalGrossLabel: "12 960",
    __summaryInput: {
      offerDto,
      configuratorSelection: {
        selections,
        products: {
          pump: {
            type: pumpType,
          },
        },
      },
      uiContext: {
        runtimeMeta: {
          configuratorPricingState: pricingState,
        },
      },
    },
  };
}

test("stale backend offer is marked as pending reprice instead of fake missing pricing", () => {
  const hooks = loadOfferSummaryHooks();
  const visibility = hooks.resolvePricingVisibilityState(
    createSummaryOffer({
      items: [
        { sku: "PUMP" },
        { sku: "HYDRAULIC" },
        { sku: "INSTALLATION" },
      ],
      selections: {
        pompa: { optionId: "hp-9kw" },
        cwu: { optionId: "cwu-200" },
      },
      pricingState: {
        offerFresh: false,
        needsReprice: true,
      },
    })
  );

  assert.equal(visibility.visible, false);
  assert.equal(visibility.reason, "pending_reprice");
  assert.equal(visibility.missingSkus.includes("CWU"), true);
  assert.match(visibility.message, /ponownym przeliczeniu/i);
});

test("fresh backend offer ignores hidden legacy selections when checking expected priced items", () => {
  const hooks = loadOfferSummaryHooks();
  const visibility = hooks.resolvePricingVisibilityState(
    createSummaryOffer({
      items: [
        { sku: "PUMP" },
        { sku: "HYDRAULIC" },
        { sku: "INSTALLATION" },
      ],
      selections: {
        pompa: { optionId: "hp-9kw" },
        magnetic_filter: { optionId: "magnetic_filter_premium" },
        hydro_safety: { optionId: "hydro_safety_extended" },
        flushing: { optionId: "flushing_standard" },
        electrical: { optionId: "electrical_standard" },
      },
      pricingState: {
        offerFresh: true,
        needsReprice: false,
      },
    })
  );

  assert.equal(visibility.visible, true);
  assert.equal(visibility.reason, "ready");
  assert.equal(visibility.missingSkus.length, 0);
});

test("only active visible accessories remain part of expected priced-item checks", () => {
  const hooks = loadOfferSummaryHooks();
  const visibility = hooks.resolvePricingVisibilityState(
    createSummaryOffer({
      items: [
        { sku: "PUMP" },
        { sku: "HYDRAULIC" },
        { sku: "INSTALLATION" },
      ],
      selections: {
        pompa: { optionId: "hp-9kw" },
        posadowienie: { optionId: "posadowienie-eko" },
      },
      pricingState: {
        offerFresh: true,
        needsReprice: false,
      },
    })
  );

  assert.equal(visibility.visible, false);
  assert.equal(visibility.reason, "missing_expected_items");
  assert.equal(visibility.missingSkus.includes("ACCESSORY_FOUNDATION_ECO"), true);
});

test("summary refresh contract is wired between configurator and summary badge runtime", () => {
  const offerSummarySource = fs.readFileSync(offerSummaryPath, "utf8");
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(offerSummarySource.includes('on(root, "hp:summaryDataChanged"'), true);
  assert.equal(configuratorSource.includes('new CustomEvent("hp:summaryDataChanged"'), true);
  assert.equal(configuratorSource.includes("configuratorPricingState"), true);
});
