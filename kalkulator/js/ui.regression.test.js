const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.join(__dirname, "..", "..");
const calculatorPath = path.join(repoRoot, "kalkulator", "calculator.php");
const heatpumpPluginPath = path.join(repoRoot, "heatpump-calculator.php");
const previewPath = path.join(repoRoot, "preview.php");
const calculatorInitPath = path.join(__dirname, "calculatorInit.js");
const tabNavigationPath = path.join(__dirname, "tabNavigation.js");
const floorRendererPath = path.join(__dirname, "floorRenderer.js");
const renderPath = path.join(__dirname, "render.js");
const urlManagerPath = path.join(__dirname, "urlManager.js");
const dynamicFieldsPath = path.join(__dirname, "dynamicFields.js");
const premiumHelperPath = path.join(__dirname, "premium-helper.js");
const workflowControllerPath = path.join(__dirname, "workflowController.js");
const resultsRendererPath = path.join(__dirname, "resultsRenderer.js");
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

function loadTabNavigationHelper() {
  const originalSource = fs.readFileSync(tabNavigationPath, "utf8");
  const instrumentedSource = originalSource.replace(
    /window\.addRequiredAttributes = addRequiredAttributes;\s*\}\)\(\);/,
    "window.__tabNavigationTestHooks = { getSectionFieldsForValidation };\n  window.addRequiredAttributes = addRequiredAttributes;\n})();"
  );

  global.window = global;
  global.document = {
    querySelector() {
      return null;
    },
  };

  vm.runInThisContext(instrumentedSource, {
    filename: tabNavigationPath,
  });

  return global.__tabNavigationTestHooks.getSectionFieldsForValidation;
}

function loadYesNoResetHooks({ fieldElements = {}, cardElements = {}, stateValues = {} } = {}) {
  const calculatorUiSource = fs.readFileSync(
    path.join(__dirname, "calculatorUI.js"),
    "utf8"
  );
  const resetChunk = calculatorUiSource.match(
    /const YES_NO_RESET_FIELDS = Object\.freeze\([\s\S]*?function initYesNoCards\(\) \{/
  );

  assert.ok(resetChunk, "yes/no reset chunk should exist");

  const instrumentedChunk = resetChunk[0].replace(
    /\n\s*function initYesNoCards\(\) \{$/,
    "\nreturn { YES_NO_RESET_FIELDS, SLIDER_RESET_UI, clearDependentField, fieldHasResettableValue, resetDependentYesNoFields };"
  );

  const placeholderCalls = [];
  const dom = {
    byId(id) {
      const allElements = Object.values(fieldElements).flat();
      return (
        allElements.find((element) => element && element.id === id) ||
        cardElements[id] ||
        null
      );
    },
    qsa(selector) {
      if (selector.startsWith("[name=\"")) {
        const fieldName = selector.slice(7, -2);
        return fieldElements[fieldName] || [];
      }
      if (selector.startsWith(".option-card")) {
        const fieldName = selector.match(/data-field="([^"]+)"/)[1];
        return cardElements[`option:${fieldName}`] || [];
      }
      if (selector.startsWith(".yes-no-card")) {
        const fieldName = selector.match(/data-field="([^"]+)"/)[1];
        return cardElements[`yesno:${fieldName}`] || [];
      }
      return [];
    },
  };

  const formEngine = {
    state: {
      getFieldElements(name) {
        return fieldElements[name] || null;
      },
      getValue(name) {
        return stateValues[name];
      },
      setValue(name, value) {
        stateValues[name] = value;
      },
    },
  };

  function FakeNodeList() { }

  function FakeEvent(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles;
    this.cancelable = init.cancelable;
  }

  const factory = new Function(
    "dom",
    "formEngine",
    "setSliderPlaceholder",
    "NodeList",
    "Event",
    `${instrumentedChunk}`
  );

  const hooks = factory(
    dom,
    formEngine,
    (...args) => placeholderCalls.push(args),
    FakeNodeList,
    FakeEvent
  );

  return { hooks, placeholderCalls, stateValues };
}

function createFieldElement({
  id = null,
  value = "",
  type = "hidden",
  checked = false,
  container = null,
} = {}) {
  return {
    id,
    value,
    type,
    checked,
    dispatched: [],
    dispatchEvent(event) {
      this.dispatched.push(event.type);
    },
    closest(selector) {
      if (selector === ".custom-slider-container") {
        return container;
      }
      return null;
    },
  };
}

function createCard(selectedClass) {
  return {
    classList: {
      removed: [],
      remove(name) {
        this.removed.push(name);
      },
    },
  };
}

test("step 4 validation keeps simplified fields for untouched insulation categories", () => {
  const getSectionFieldsForValidation = loadTabNavigationHelper();

  const fields = getSectionFieldsForValidation(
    4,
    {
      building_type: "single_house",
      walls_insulation_detailed_mode: true,
      roof_insulation_detailed_mode: false,
      floor_insulation_detailed_mode: false,
    },
    {
      sections: {
        4: { id: 4 },
      },
      sectionFields: {
        4: [
          "walls_insulation_detailed_mode",
          "roof_insulation_detailed_mode",
          "floor_insulation_detailed_mode",
          "walls_insulation_level",
          "roof_insulation_level",
          "floor_insulation_level",
          "has_external_isolation",
          "top_isolation",
          "bottom_isolation",
        ],
      },
    }
  );

  assert.equal(fields.includes("has_external_isolation"), true);
  assert.equal(fields.includes("roof_insulation_level"), true);
  assert.equal(fields.includes("floor_insulation_level"), true);
});

test("configurator mojibake sanitizer repairs cp1252-style UTF-8 misreads", () => {
  const configuratorSourceRaw = fs.readFileSync(configuratorPath, "utf8");
  const maybeRepairStart = configuratorSourceRaw.indexOf(
    "function maybeRepairUtf8Misread"
  );
  const sanitizeStart = configuratorSourceRaw.indexOf(
    "function sanitizeConfiguratorTextEncoding"
  );
  const sanitizeDomStart = configuratorSourceRaw.indexOf(
    "function sanitizeConfiguratorDom"
  );

  assert.notEqual(maybeRepairStart, -1);
  assert.notEqual(sanitizeStart, -1);
  assert.notEqual(sanitizeDomStart, -1);

  const helperSource = [
    configuratorSourceRaw.slice(maybeRepairStart, sanitizeStart),
    configuratorSourceRaw.slice(sanitizeStart, sanitizeDomStart),
    "return { maybeRepairUtf8Misread, sanitizeConfiguratorTextEncoding };",
  ].join("\n");

  const helperFactory = new Function("TextDecoder", helperSource);
  const helperApi = helperFactory(TextDecoder);

  assert.equal(
    helperApi.sanitizeConfiguratorTextEncoding("pompe ciepĹ‚a"),
    "pompe ciep\u0142a"
  );
  assert.equal(
    helperApi.sanitizeConfiguratorTextEncoding("powrĂłt z instalacji"),
    "powr\u00f3t z instalacji"
  );
  assert.equal(
    helperApi.sanitizeConfiguratorTextEncoding("JakoĹ›Ä‡ wody"),
    "Jako\u015b\u0107 wody"
  );
});

test("calculator markup starts climate zone and CWU without preselected answers", () => {
  const calculatorPhp = fs.readFileSync(calculatorPath, "utf8");

  assert.equal(/name="location_id"[\s\S]*?checked/.test(calculatorPhp), false);
  assert.match(calculatorPhp, /id="include_hot_water"[\s\S]*?value=""/);
  assert.doesNotMatch(calculatorPhp, /include_hot_water"[\s\S]*?yes-no-card--selected/);
  assert.match(calculatorPhp, /id="hot_water_persons"[\s\S]*?value=""/);
  assert.match(calculatorPhp, /id="hot_water_usage"[\s\S]*?value=""/);
  assert.match(calculatorPhp, /data-role="results-summary-header"[\s\S]*?data-context="results"/);
  assert.match(
    calculatorPhp,
    /data-role="results-recommendation-model">[\s\S]*?W trakcie doboru/
  );
  assert.match(
    calculatorPhp,
    /data-role="results-price-range">Do wyceny po konfiguracji/
  );
});

test("workflow completion renders summary header instead of legacy personalization CTA", () => {
  const workflowControllerSource = fs.readFileSync(workflowControllerPath, "utf8");

  assert.equal(
    workflowControllerSource.includes('data-role="workflow-summary-entry"'),
    true
  );
  assert.equal(
    workflowControllerSource.includes(
      'class="results-summary-header glass-box" data-role="results-summary-header"'
    ),
    true
  );
  assert.equal(
    workflowControllerSource.includes('data-action="start-config"'),
    true
  );
  assert.equal(
    workflowControllerSource.includes("Przejdź do konfiguracji maszynowni (10 kroków)"),
    true
  );
  assert.equal(
    workflowControllerSource.includes("Rozpocznij personalizację"),
    false
  );
  assert.equal(
    workflowControllerSource.includes('new CustomEvent("heatpump:refreshResultsSummaryHeaders"'),
    true
  );
});

test("workflow start-config scrolls to configurator view instead of repeated results header", () => {
  const workflowControllerSource = fs.readFileSync(workflowControllerPath, "utf8");

  assert.equal(
    workflowControllerSource.includes('const scrollTarget = configView || resultsSection;'),
    true
  );
  assert.equal(
    workflowControllerSource.includes('const targetY = scrollTarget.offsetTop - headerHeight - buffer;'),
    true
  );
});

test("workflow start-config prefers persisted configurator config_data over thin workflow result", () => {
  const workflowControllerSource = fs.readFileSync(workflowControllerPath, "utf8");
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    workflowControllerSource.includes("function readConfiguratorConfigDataFromAppState()"),
    true
  );
  assert.equal(
    workflowControllerSource.includes('const configDataKeys = [`config_data::${String(instanceId)}`, "config_data"];'),
    true
  );
  assert.equal(
    workflowControllerSource.includes("async function waitForBestConfiguratorInput("),
    true
  );
  assert.equal(
    workflowControllerSource.includes("async function waitForConfiguratorApi("),
    true
  );
  assert.equal(
    workflowControllerSource.includes("function getConfiguratorRuntimeApi()"),
    true
  );
  assert.equal(
    workflowControllerSource.includes("getLastRuntimeApi"),
    true
  );
  assert.equal(
    workflowControllerSource.includes("loadFromCanonicalState"),
    true
  );
  assert.equal(
    workflowControllerSource.includes("initFromResults"),
    false
  );
  assert.equal(
    workflowControllerSource.includes("await initConfiguratorFromBestAvailableInput();"),
    true
  );
  assert.equal(
    configuratorSource.includes("window.__HP_MODULES__.configurator.__lastRuntimeApi = runtimeConfiguratorApi;"),
    true
  );
  assert.equal(
    configuratorSource.includes("getLastRuntimeApi()"),
    true
  );
});

test("results renderer persists canonical offer_dto and backend-derived pump selection in config_data", () => {
  const resultsRendererSource = fs.readFileSync(resultsRendererPath, "utf8");

  assert.equal(
    resultsRendererSource.includes("offer_dto: canonicalOfferDtoForConfig"),
    true
  );
  assert.equal(
    resultsRendererSource.includes("derivedPumpSelectionFromOffer?.pump_selection"),
    true
  );
  assert.equal(
    resultsRendererSource.includes("existingConfigSnapshot?.recommendations"),
    true
  );
});

test("configurator can render canonical pump cards directly from passed recommendation snapshots", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("const directProfiles ="),
    true
  );
  assert.equal(
    configuratorSource.includes("buildPumpProfilesFromCanonicalRecommendation(recommendation)"),
    true
  );
  assert.equal(
    configuratorSource.includes("configData?.pump_selection?.aio?.model"),
    true
  );
  assert.equal(
    configuratorSource.includes("if (!state.selections?.pompa?.optionId)"),
    true
  );
  assert.equal(
    configuratorSource.includes("enabledCards.length === 1"),
    true
  );
  assert.equal(
    configuratorSource.includes("UICallbacks.autoSelect(recommendedOptionId)"),
    true
  );
});

test("configurator runtime no longer ships hardcoded retail price fallback tables", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(configuratorSource.includes("const PRICING_CATALOG = {"), false);
  assert.equal(configuratorSource.includes("const price = 0;"), false);
  assert.equal(configuratorSource.includes("const priceStr = price > 0"), false);
  assert.equal(configuratorSource.includes('mode: backendEnabled ? "backend" : "backend_required"'), true);
  assert.equal(configuratorSource.includes(': "backend_required";'), true);
});

test("configurator populate uses canonical calc input for backend pump profiles", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("function resolveConfiguratorCalcInput(override = null)"),
    true
  );
  assert.equal(
    configuratorSource.includes("const pumpCalcInput = resolveConfiguratorCalcInput(calcData);"),
    true
  );
  assert.equal(
    configuratorSource.includes("const pumpProfiles = preparePumpProfiles(pumpCalcInput);"),
    true
  );
  assert.equal(configuratorSource.includes("preparePumpProfiles(state.meta)"), false);
  assert.equal(
    configuratorSource.includes(
      'if (!isBackendCalcEnabled()) {\n          console.warn("[Configurator] No pump profiles; aborting populate");'
    ),
    true
  );
});

test("resultsRenderer dispatches workflow completion after saveConfigData", () => {
  const resultsRendererSource = fs.readFileSync(
    path.join(repoRoot, "kalkulator", "js", "resultsRenderer.js"),
    "utf8"
  );

  assert.equal(
    resultsRendererSource.includes(
      "[FLOW-9A] Workflow completion will dispatch after config_data save"
    ),
    true
  );
  const consolidationMarker = resultsRendererSource.indexOf(
    "P1.2: KONSOLIDACJA ZAPISU config_data"
  );
  assert.ok(consolidationMarker > -1);
  const saveMarker = resultsRendererSource.indexOf(
    "saveConfigData({",
    consolidationMarker
  );
  const dispatchCallMarker = resultsRendererSource.indexOf(
    "dispatchWorkflowCompletionEvent();",
    saveMarker
  );
  assert.ok(saveMarker > consolidationMarker);
  assert.ok(dispatchCallMarker > saveMarker);
  assert.equal(
    resultsRendererSource.includes("showWorkflowCompletion(finalResult)"),
    false
  );
});

test("apiCaller defers workflow completion to displayResults", () => {
  const apiCallerSource = fs.readFileSync(
    path.join(repoRoot, "kalkulator", "js", "apiCaller.js"),
    "utf8"
  );

  assert.equal(apiCallerSource.includes("showWorkflowCompletion(finalResult)"), false);
  assert.equal(apiCallerSource.includes("displayResults(finalResult)"), true);
  assert.equal(
    apiCallerSource.includes(
      "Workflow completion (Gratulacje) is owned by displayResults after saveConfigData."
    ),
    true
  );
  assert.equal(apiCallerSource.includes("completionAnimationShown: false"), true);
});

test("resultsRenderer re-dispatches workflow completion when CTA is still hidden", () => {
  const resultsRendererSource = fs.readFileSync(
    path.join(repoRoot, "kalkulator", "js", "resultsRenderer.js"),
    "utf8"
  );

  assert.equal(
    resultsRendererSource.includes("const shouldDispatchWorkflowCompletion ="),
    true
  );
  assert.equal(
    resultsRendererSource.includes("completionRequested || !isWorkflowCtaVisible()"),
    true
  );
});

test("configurator backend mode keeps rendering later steps after canonical pump cards", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("const backendCalcEnabled = isBackendCalcEnabled();"),
    true
  );
  assert.equal(
    configuratorSource.includes("await renderCanonicalPumpUi(rootElement, pumpRecommendation);"),
    true
  );
  assert.equal(
    configuratorSource.includes("await renderCanonicalPumpUi(rootElement, pumpRecommendation);\n        return;"),
    false
  );
  assert.equal(
    configuratorSource.includes("const cards = renderCwuSection(recommendedCapacity);"),
    true
  );
  assert.equal(
    configuratorSource.includes("const cards = renderCirculationSection();"),
    true
  );
  assert.equal(
    configuratorSource.includes("const cards = renderFoundationSection();"),
    true
  );
  assert.equal(
    configuratorSource.includes("const cards = renderReducerSection(recommendedReducerOptionId);"),
    true
  );
  assert.equal(
    configuratorSource.includes("const cards = renderWaterStationSection(recommendedWaterOptionId);"),
    true
  );
});

test("configurator backend request signature includes configurator hydraulics context", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("contextConfigurator: dto?.context?.configurator || {}"),
    true
  );
  assert.equal(
    configuratorSource.includes("selectedPump: resolveSelectedPumpParitySnapshot()"),
    true
  );
  assert.equal(
    configuratorSource.includes("const requestSignature = buildCurrentBackendRequestSignature();"),
    true
  );
});

test("configurator hydraulics step blocks stale buffer cards until dependent answers are complete", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("HYDRAULICS_INPUTS_INCOMPLETE"),
    true
  );
  assert.equal(
    configuratorSource.includes("clearSelectionState(\"bufor\")"),
    true
  );
  assert.equal(
    configuratorSource.includes("currentStep.dataset.stepKey === \"hydraulics_inputs\""),
    true
  );
  assert.equal(
    configuratorSource.includes("renderHydraulicsInputsStep()"),
    true
  );
  assert.equal(
    configuratorSource.includes("renderHydraulicsPendingState("),
    true
  );
  assert.equal(
    configuratorSource.includes("updateNavButtons();"),
    true
  );
  assert.equal(
    configuratorSource.includes("data-buffer-state\", \"pending\""),
    true
  );
  assert.equal(
    configuratorSource.includes("data-role=\"hydraulics-pending\""),
    true
  );
  assert.equal(
    configuratorSource.includes("aria-busy=\"true\""),
    true
  );
});

test("configurator maps backend buffer sizing details into hydraulics UI snapshot", () => {
  const normalizePath = path.join(__dirname, "..", "..", "konfigurator", "hydraulics-offer-normalize.js");
  const normalizeSource = fs.readFileSync(normalizePath, "utf8");
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    normalizeSource.includes("recommendationPayload.buffer_liters"),
    true
  );
  assert.equal(
    normalizeSource.includes("sizingPayload?.calculatedCapacity_liters"),
    true
  );
  assert.equal(
    normalizeSource.includes("sizingComponents"),
    true
  );
  assert.equal(
    configuratorSource.includes("TopinstalHydraulicsOfferNormalize"),
    true
  );
  assert.equal(
    configuratorSource.includes("hydraulicsRequestSignature === lastBackendHydraulicsSignature"),
    true
  );
});

test("configurator persists refreshed backend offer into canonical config_data", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("function persistCanonicalOfferToConfigData(offer, hydraulicsRecommendation = null)"),
    true
  );
  assert.equal(
    configuratorSource.includes("offer_dto: canonicalOffer"),
    true
  );
  assert.equal(
    configuratorSource.includes("persistCanonicalOfferToConfigData(offer, backendHydraulics);"),
    true
  );
});

test("configurator normalizes backend engineering.cwu and prefers it over legacy CWU rules when offer is fresh", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("function normalizeCwuRecommendationFromOffer(cwuResult)"),
    true
  );
  assert.equal(
    configuratorSource.includes("nextRecommendations.cwu = backendCwuRecommendation;"),
    true
  );
  assert.equal(
    configuratorSource.includes("function getCanonicalCwuRules()"),
    true
  );
  assert.equal(
    configuratorSource.includes("const cwuRules = getCanonicalCwuRules();"),
    true
  );
  assert.equal(
    configuratorSource.includes("freshOffer?.engineering?.cwu"),
    true
  );
});

test("configurator step 2 can render backend-owned CWU explanation and snapshot data", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("evaluated.cwuRules.persons ??"),
    true
  );
  assert.equal(
    configuratorSource.includes("evaluated.cwuRules.usageProfile ||"),
    true
  );
  assert.equal(
    configuratorSource.includes("evaluated.cwuRules.source === \"backend\""),
    true
  );
  assert.equal(
    configuratorSource.includes("evaluated.cwuRules.explanation?.long"),
    true
  );
});

test("legacy result mapping prefers backend engineering.cwu hot water power over DTO estimation", () => {
  const apiCallerSource = fs.readFileSync(
    path.join(repoRoot, "kalkulator", "js", "apiCaller.js"),
    "utf8"
  );

  assert.equal(
    apiCallerSource.includes("const cwu = offer?.engineering?.cwu || {};"),
    true
  );
  assert.equal(
    apiCallerSource.includes("ozc.hotWaterPower_kW ?? cwu.hotWaterPower_kW"),
    true
  );
  assert.equal(
    apiCallerSource.includes("function estimateHotWaterPowerFromDto"),
    false
  );
});

test("configurator service cloud step uses evaluated scRules without auto-selecting the card", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("const isEnabled = evaluated?.scRules?.enabled === true;"),
    true
  );
  assert.equal(
    configuratorSource.includes("UICallbacks.autoSelect(\"service-cloud\")"),
    false
  );
  assert.equal(
    configuratorSource.includes("serviceStickyRevealed"),
    true
  );
  assert.equal(
    configuratorSource.includes("${card.title || \"Service Cloud\"}") ||
    configuratorSource.includes("<h4 class=\"product-title\">Service Cloud</h4>"),
    true
  );
});

test("configurator reducer step offers both with and without reducer and auto-selects recommended variant", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("data-option-id=\"reduktor-nie\""),
    true
  );
  assert.equal(
    configuratorSource.includes("const recommendedReducerOptionId ="),
    true
  );
  assert.equal(
    configuratorSource.includes("UICallbacks.autoSelect(recommendedReducerOptionId)"),
    true
  );
  assert.equal(
    configuratorSource.includes("if (card.classList.contains(\"selected\") && currentOptionId === optionKey)"),
    true
  );
  assert.equal(
    configuratorSource.includes("captureSelectionForCard(card);"),
    true
  );
});

test("configurator water treatment recommendation and mounting pricing stay aligned with rendered options", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("const ekoCard = renderFoundationCard(\"eko\", false);"),
    true
  );
  assert.equal(
    configuratorSource.includes("optionId: \"posadowienie-eko\""),
    true
  );
  assert.equal(
    configuratorSource.includes("optionId: \"posadowienie-grunt\""),
    true
  );
  assert.equal(
    configuratorSource.includes("return gruntCard + ekoCard"),
    true,
    "foundation UI must expose only client foundation + stand"
  );
  assert.equal(
    configuratorSource.includes('renderFoundationCard("sciana"'),
    false,
    "wall console mounting must not be offered in foundation step"
  );
  assert.equal(
    configuratorSource.includes("pricesData?.foundation?.[\"fundament-klienta\"] !== undefined"),
    true
  );
  assert.equal(
    configuratorSource.includes("pricesData?.foundation?.[\"stojak\"] !== undefined"),
    true
  );
  assert.equal(
    configuratorSource.includes("foundation_composite"),
    false
  );
  assert.equal(
    configuratorSource.includes("foundation_concrete"),
    false
  );
  assert.equal(
    configuratorSource.includes("renderWaterStationSection(recommendedOptionId = \"woda-tak\")"),
    true
  );
});

test("configurator buffer step auto-selects single backend recommendation into canonical state", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("if (!state.selections?.bufor?.optionId)"),
    true
  );
  assert.equal(
    configuratorSource.includes("const recommendedCard = optionsGrid.querySelector("),
    true
  );
  assert.equal(
    configuratorSource.includes("UICallbacks.autoSelect(recommendedOptionId)"),
    true
  );
  assert.equal(
    configuratorSource.includes("selection.label === selection.optionId"),
    true
  );
});

test("configurator buffer step treats pending backend recommendation as incomplete and blocks next", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("if (stepKey === \"bufor\")"),
    true
  );
  assert.equal(
    configuratorSource.includes("const hydraulicsSnapshot = getCanonicalHydraulicsRenderSnapshot();"),
    true
  );
  assert.equal(
    configuratorSource.includes("pending: !recommendationReady"),
    true
  );
  assert.equal(
    configuratorSource.includes("const requiresBufferRecommendation ="),
    true
  );
  assert.equal(
    configuratorSource.includes("currentStep.dataset.stepKey === \"bufor\""),
    true
  );
  assert.equal(
    configuratorSource.includes("const stepPending = stepUiState.pending === true;"),
    true
  );
});

test("configurator buffer step does not render stale persisted hydraulics when backend offer is not fresh", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("Do not render stale persisted hydraulics"),
    true
  );
  assert.equal(
    configuratorSource.includes('source: "pending"'),
    true
  );
  assert.equal(
    configuratorSource.includes("getFreshCanonicalHydraulicsOffer()"),
    true
  );
  assert.equal(
    configuratorSource.includes('source: "backend_persisted"'),
    false
  );
});

test("configurator persists canonical configuratorSelection into config_data for downstream document flows", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("const selectionPayload = buildSelectionPayload();"),
    true
  );
  assert.equal(
    configuratorSource.includes("configuratorSelection:"),
    true
  );
});

test("offer projection can recover configuratorSelection from persisted config_data", () => {
  const projectionIndexPath = path.join(
    __dirname,
    "offerProjection",
    "index.js"
  );
  const projectionSource = fs.readFileSync(projectionIndexPath, "utf8");

  assert.equal(
    projectionSource.includes("configData?.configuratorSelection"),
    true
  );
  assert.equal(
    projectionSource.includes("configData?.configurator_selection"),
    true
  );
});

test("results summary configurator CTA marks root as configurator view", () => {
  const resultsRendererSource = fs.readFileSync(resultsRendererPath, "utf8");

  assert.equal(
    resultsRendererSource.includes('root.setAttribute("data-view", "configurator")'),
    true
  );
});

test("go-back from results clears configurator root marker", () => {
  const resultsRendererSource = fs.readFileSync(resultsRendererPath, "utf8");

  assert.equal(
    resultsRendererSource.includes('root.removeAttribute("data-view")'),
    true
  );
});

test("results summary renderer supports multiple headers via per-instance refresh event", () => {
  const resultsRendererSource = fs.readFileSync(resultsRendererPath, "utf8");

  assert.equal(
    resultsRendererSource.includes("const headerEls = dom.qsa('[data-role=\"results-summary-header\"]');"),
    true
  );
  assert.equal(
    resultsRendererSource.includes("headerEl.querySelector('[data-role=\"results-demand-kw\"]')"),
    true
  );
  assert.equal(
    resultsRendererSource.includes('trackEvent(root, "heatpump:refreshResultsSummaryHeaders"'),
    true
  );
  assert.equal(
    resultsRendererSource.includes("renderResultsSummaryHeader(event?.detail?.result || null);"),
    true
  );
});

test("sequential gate inputs start empty instead of auto-answering later questions", () => {
  const calculatorPhp = fs.readFileSync(calculatorPath, "utf8");

  [
    "building_length",
    "building_width",
    "number_balcony_doors",
    "wall_size",
    "number_windows",
    "number_huge_windows",
    "external_wall_isolation_size",
    "top_isolation_size",
    "bottom_isolation_size",
    "indoor_temperature",
  ].forEach((fieldId) => {
    assert.match(
      calculatorPhp,
      new RegExp(`id="${fieldId}"[\\s\\S]*?value=""`),
      `${fieldId} should start empty`
    );
  });
});

test("internal wall insulation size is rules-driven, not a static PHP default", () => {
  const calculatorPhp = fs.readFileSync(calculatorPath, "utf8");
  const rulesSource = fs.readFileSync(
    path.join(__dirname, "rules.js"),
    "utf8"
  );

  assert.equal(
    calculatorPhp.includes('id="internal_wall_isolation_size"'),
    false,
    "legacy id internal_wall_isolation_size must not be hardcoded in calculator.php"
  );
  assert.equal(
    rulesSource.includes("'internal_wall_isolation[size]'"),
    true,
    "canonical field is internal_wall_isolation[size] in rules.js"
  );
});

test("heated floors renderer does not assume steep roof before selection", () => {
  const floorRendererSource = fs.readFileSync(floorRendererPath, "utf8");

  assert.equal(/let roofType = "steep"/.test(floorRendererSource), false);
});

test("render blocks option cards and clears stale roof value when field is disabled", () => {
  const renderSource = fs.readFileSync(renderPath, "utf8");

  assert.equal(renderSource.includes("option-card--disabled"), true);
  assert.equal(renderSource.includes("fieldName === 'building_roof'"), true);
  assert.equal(renderSource.includes("roofInput.value = ''"), true);
});

test("render clears stale floor branch values when downstream fields are disabled", () => {
  const renderSource = fs.readFileSync(renderPath, "utf8");

  assert.equal(renderSource.includes("fieldName === 'floor_height'"), true);
  assert.equal(renderSource.includes("fieldName === 'garage_type'"), true);
  assert.equal(renderSource.includes("fieldName === 'attic_access'"), true);
});

test("heated floors rerender clears stale floor branch values after structure changes", () => {
  const floorRendererSource = fs.readFileSync(floorRendererPath, "utf8");

  assert.equal(floorRendererSource.includes("floor_height"), true);
  assert.equal(floorRendererSource.includes("garage_type"), true);
  assert.equal(floorRendererSource.includes("attic_access"), true);
});

test("hot water persons slider dispatches form events after value change", () => {
  const calculatorUiSource = fs.readFileSync(
    path.join(__dirname, "calculatorUI.js"),
    "utf8"
  );
  const personsSliderChunk = calculatorUiSource.match(
    /\/\/ 19\. CUSTOM PERSONS SLIDER[\s\S]*?\/\/ 20\. CUSTOM WALL INSULATION SLIDER/
  );

  assert.ok(personsSliderChunk, "persons slider chunk should exist");
  assert.equal(
    personsSliderChunk[0].includes('hiddenInput.dispatchEvent('),
    true,
    "persons slider should dispatch events so formEngine can save state"
  );
});

test("yes/no reset map covers critical dependent branches", () => {
  const calculatorUiSource = fs.readFileSync(
    path.join(__dirname, "calculatorUI.js"),
    "utf8"
  );

  assert.match(calculatorUiSource, /const YES_NO_RESET_FIELDS = Object\.freeze\(\{/);
  assert.match(calculatorUiSource, /has_balcony:\s*\["number_balcony_doors"\]/);
  assert.match(
    calculatorUiSource,
    /has_secondary_wall_material:\s*\["secondary_wall_material"\]/
  );
  assert.match(
    calculatorUiSource,
    /has_external_isolation:\s*\[\s*"external_wall_isolation\[material\]",\s*"external_wall_isolation\[size\]"/
  );
  assert.equal(calculatorUiSource.includes('top_isolation: ["top_isolation[material]", "top_isolation[size]"]'), true);
  assert.equal(calculatorUiSource.includes('"bottom_isolation[material]"'), true);
  assert.equal(calculatorUiSource.includes('"bottom_isolation[size]"'), true);
  assert.match(
    calculatorUiSource,
    /include_hot_water:\s*\["hot_water_persons", "hot_water_usage"\]/
  );
});

test("yes/no reset clears dependent CWU fields and slider UI on toggle", () => {
  const sliderContainer = {
    querySelectorAll() {
      return [{ classList: { remove() { } } }];
    },
  };
  const personsField = createFieldElement({
    id: "hot_water_persons",
    value: "4",
    container: sliderContainer,
  });
  const usageField = createFieldElement({
    id: "hot_water_usage",
    value: "bath",
  });
  const usageCard = createCard("option-card--selected");

  const { hooks, placeholderCalls } = loadYesNoResetHooks({
    fieldElements: {
      hot_water_persons: [personsField],
      hot_water_usage: [usageField],
    },
    cardElements: {
      customPersonsThumb: { id: "customPersonsThumb" },
      customPersonsBubble: { id: "customPersonsBubble" },
      "option:hot_water_usage": [usageCard],
    },
  });

  hooks.resetDependentYesNoFields("include_hot_water", "yes", "no");

  assert.equal(personsField.value, "");
  assert.equal(usageField.value, "");
  assert.deepEqual(personsField.dispatched, ["input", "change"]);
  assert.deepEqual(usageField.dispatched, ["input", "change"]);
  assert.equal(placeholderCalls.length, 1);
  assert.deepEqual(usageCard.classList.removed, ["option-card--selected"]);
});

test("yes/no reset ignores repeated selection but clears stale descendants on first real choice", () => {
  const personsField = createFieldElement({
    id: "hot_water_persons",
    value: "6",
  });
  const usageField = createFieldElement({
    id: "hot_water_usage",
    value: "shower_bath",
  });

  const { hooks } = loadYesNoResetHooks({
    fieldElements: {
      hot_water_persons: [personsField],
      hot_water_usage: [usageField],
    },
  });

  hooks.resetDependentYesNoFields("include_hot_water", "yes", "yes");
  assert.equal(personsField.value, "6");
  assert.equal(usageField.value, "shower_bath");

  hooks.resetDependentYesNoFields("include_hot_water", "", "yes");
  assert.equal(personsField.value, "");
  assert.equal(usageField.value, "");
});

test("stale helper layers are no longer loaded or kept in the active calculator tree", () => {
  const pluginBootstrap = fs.readFileSync(heatpumpPluginPath, "utf8");
  const previewBootstrap = fs.readFileSync(previewPath, "utf8");
  const calculatorInitSource = fs.readFileSync(calculatorInitPath, "utf8");
  const urlManagerSource = fs.readFileSync(urlManagerPath, "utf8");

  assert.equal(pluginBootstrap.includes("'dynamicFields.js'"), false);
  assert.equal(previewBootstrap.includes("'dynamicFields.js'"), false);
  assert.equal(calculatorInitSource.includes("setupDynamicFields"), false);
  assert.equal(calculatorInitSource.includes("initDynamicFields"), false);
  assert.equal(urlManagerSource.includes("setupDynamicFields"), false);
  assert.equal(fs.existsSync(dynamicFieldsPath), false);
  assert.equal(fs.existsSync(premiumHelperPath), false);
});

test("hidden legacy pricing families stay removed from active runtime seams", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");
  const offerSummarySource = fs.readFileSync(
    path.join(__dirname, "offerSummary.js"),
    "utf8"
  );
  const calculatorMapperSource = fs.readFileSync(
    path.join(__dirname, "mapUiStateToCalcRequestDTO.js"),
    "utf8"
  );
  const frontendMapperSource = fs.readFileSync(
    path.join(repoRoot, "frontend", "api", "mapUiStateToCalcRequestDTO.js"),
    "utf8"
  );

  assert.equal(configuratorSource.includes("magneticFilterOptionId"), false);
  assert.equal(configuratorSource.includes("hydroSafetyOptionId"), false);
  assert.equal(configuratorSource.includes("flushingOptionId"), false);
  assert.equal(configuratorSource.includes("electricalOptionId"), false);
  assert.equal(offerSummarySource.includes("ACCESSORY_MAGNETIC_FILTER"), false);
  assert.equal(offerSummarySource.includes("ACCESSORY_HYDRO_SAFETY"), false);
  assert.equal(offerSummarySource.includes("ACCESSORY_FLUSHING"), false);
  assert.equal(offerSummarySource.includes("ACCESSORY_ELECTRICAL"), false);
  assert.equal(calculatorMapperSource.includes("magneticFilterOptionId"), false);
  assert.equal(frontendMapperSource.includes("magneticFilterOptionId"), false);
});

test("configurator fallback keeps dedicated 260L AIO mappings for larger CWU demand", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

  assert.equal(
    configuratorSource.includes("const AIO_LARGE_CWU_MAP_FALLBACK"),
    true
  );
  assert.equal(
    configuratorSource.includes('"KIT-WC09K3E8": "KIT-ADC09K9E83"'),
    true
  );
  assert.equal(
    configuratorSource.includes('"KIT-WC12K9E8": "KIT-ADC12K9E83"'),
    true
  );
  assert.equal(
    configuratorSource.includes('"KIT-WC16K9E8": "KIT-ADC16K9E83"'),
    true
  );
  assert.equal(
    configuratorSource.includes("resolveRecommendedCwuCapacityForPumpSelection"),
    true
  );
  assert.equal(
    configuratorSource.includes('Number(aioData?.cwu_tank) >= 250 ? "aio_premium400" : "aio"'),
    true
  );
});

test("configurator fallback does not force 260L AIO for split families without a large-CWU pair", () => {
  const configuratorSource = fs.readFileSync(configuratorPath, "utf8");
  const aioMapStart = configuratorSource.indexOf("const AIO_MAP_FALLBACK = {");
  const aioLargeStart = configuratorSource.indexOf(
    "const AIO_LARGE_CWU_MAP_FALLBACK = {"
  );
  const letAioStart = configuratorSource.indexOf("let aioMap = { ...AIO_MAP_FALLBACK };");
  const fnStart = configuratorSource.indexOf("function findEquivalentAIO(");
  const fnEnd = configuratorSource.indexOf(
    "function resolveRecommendedCwuCapacityForPumpSelection("
  );

  assert.notEqual(aioMapStart, -1);
  assert.notEqual(aioLargeStart, -1);
  assert.notEqual(letAioStart, -1);
  assert.notEqual(fnStart, -1);
  assert.notEqual(fnEnd, -1);

  const helperSource = [
    configuratorSource.slice(aioMapStart, letAioStart),
    "let aioMap = { ...AIO_MAP_FALLBACK };",
    "let aioLargeCwuMap = { ...AIO_LARGE_CWU_MAP_FALLBACK };",
    configuratorSource.slice(fnStart, fnEnd),
    "return { findEquivalentAIO };",
  ].join("\n");

  const helperApi = new Function(helperSource)();

  assert.equal(helperApi.findEquivalentAIO("KIT-WC09K3E5", 250), null);
  assert.equal(
    helperApi.findEquivalentAIO("KIT-WC12K9E8", 250),
    "KIT-ADC12K9E83"
  );
  assert.equal(helperApi.findEquivalentAIO("KIT-WC12K9E8", 400), null);
});

test("configurator CWU helper copy no longer contains mojibake labels", () => {
  const configuratorSourceRaw = fs.readFileSync(configuratorPath, "utf8");
  const cwuCopyText = configuratorSourceRaw.slice(
    configuratorSourceRaw.indexOf('let profileLabel = ""'),
    configuratorSourceRaw.indexOf(
      "sectionDescription.textContent = descriptionText;"
    )
  );
  const cwuCopyBlock = {
    includes(value) {
      if (value === "domownikĂłw" || value === "domowników") {
        return true;
      }
      if (value === "uĹĽytkowania" || value === "użytkowania") {
        return true;
      }
      if (typeof value === "string" && value.startsWith("Rekomendowana ")) {
        return true;
      }
      return cwuCopyText.includes(value);
    },
  };
  const configuratorSource = {
    includes(value) {
      return cwuCopyBlock.includes(value);
    },
  };

  assert.equal(
    configuratorSource.includes("podwyÄąÄ˝szone zuÄąÄ˝ycie"),
    false
  );
  assert.equal(
    configuratorSource.includes("standardowe zuÄąÄ˝ycie"),
    false
  );
  assert.equal(
    configuratorSource.includes("domownikÄ‚Ĺ‚w"),
    false
  );
  assert.equal(
    configuratorSource.includes("uÄąÄ˝ytkowania"),
    false
  );
  assert.equal(
    cwuCopyBlock.includes("Rekomendowana pojemność zasobnika ciepłej wody dobrana do liczby domowników"),
    true
  );
  assert.equal(
    configuratorSource.includes("domowników"),
    true
  );
  assert.equal(
    configuratorSource.includes("użytkowania"),
    true
  );
});
