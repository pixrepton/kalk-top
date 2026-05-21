const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.join(__dirname, "..", "..");
const offerPayloadModule = require(path.join(__dirname, "offerPayload.js"));

const emailSenderPath = path.join(__dirname, "emailSender.js");
const resultsRendererPath = path.join(__dirname, "resultsRenderer.js");
const downloadPdfPath = path.join(__dirname, "downloadPDF.js");
const apiCallerPath = path.join(__dirname, "apiCaller.js");
const uiSummaryPath = path.join(__dirname, "uiSummary.js");
const offerPayloadPath = path.join(__dirname, "offerPayload.js");
const calculatorPath = path.join(repoRoot, "kalkulator", "calculator.php");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function withGlobalOverrides(overrides, fn) {
  const previous = new Map();
  Object.keys(overrides).forEach((key) => {
    previous.set(key, global[key]);
    global[key] = overrides[key];
  });

  try {
    fn();
  } finally {
    Object.keys(overrides).forEach((key) => {
      if (previous.get(key) === undefined) {
        delete global[key];
      } else {
        global[key] = previous.get(key);
      }
    });
  }
}

function loadWindowScript(scriptPath, initialWindow = {}) {
  const context = {
    console,
    Date,
    setTimeout,
    clearTimeout,
    alert: () => {},
    document: {},
    ...initialWindow,
  };
  context.window = context;
  context.globalThis = context;
  context.self = context;

  vm.runInNewContext(fs.readFileSync(scriptPath, "utf8"), context, {
    filename: scriptPath,
  });

  return context;
}

test("document projection blocks when offer_dto is missing", () => {
  const events = [];

  withGlobalOverrides(
    {
      HEATPUMP_CONFIG: { useBackendCalc: true },
      topinstalTrackEvent: (name, payload) => events.push({ name, payload }),
      getCanonicalOffer: () => null,
      getAppState: () => null,
    },
    () => {
      const configData = offerPayloadModule.buildPdfConfigData(
        {
          state: {
            getAppState: () => ({
              draftRequest: {
                building: { building_type: "single_house" },
              },
              formData: {},
            }),
          },
        },
        { channel: "pdf", target: "document" }
      );

      assert.equal(configData.offer_dto, null);
      assert.equal(configData.projection_blocked_reason, "missing_offer_dto");
      assert.equal(
        events.some((event) => event.name === "offer_projection_missing_offer_dto"),
        true
      );
    }
  );
});

test("document projection prefers canonical offer pricing over configurator fallback", () => {
  const offerDto = {
    pricing: {
      source: "backend_pricebook",
      catalogVersion: "2026-03-01",
      totals: { net: 12000, gross: 12960 },
      items: [
        {
          code: "HP",
          name: "Pompa",
          quantity: 1,
          unit: "szt.",
          unitPriceNet: 12000,
          totalNet: 12000,
          vatRate: 0.08,
          totalGross: 12960,
        },
      ],
    },
    engineering: {
      ozc: {
        heatedArea_m2: 132,
        designHeatLoss_kW: 8.4,
        recommendedPower_kW: 8.4,
      },
      selection: {
        type: "underfloor",
        pumpModel: "PANASONIC Aquarea T-CAP 9kW",
      },
      buffer: {
        setupType: "BUFFER",
        liters: 100,
      },
    },
  };

  const configData = offerPayloadModule.buildPdfConfigData(
    {
      state: {
        getAppState: () => ({
          offer: offerDto,
          draftRequest: {
            building: {
              building_type: "single_house",
              floor_area: 132,
            },
          },
          formData: {},
          configuratorSelection: {
            pricing: {
              total_netto_pln: 99999,
              total_brutto_pln: 107998,
              items: [{ name: "Legacy line" }],
            },
          },
        }),
      },
    },
    { channel: "pdf", target: "document" }
  );

  assert.equal(configData.projection_blocked_reason, null);
  assert.equal(configData.machine_room.source, "offer_dto");
  assert.equal(configData.machine_room.total_netto_pln, 12000);
  assert.equal(configData.machine_room.total_brutto_pln, 12960);
  assert.equal(configData.pricing, offerDto.pricing);
  assert.equal(configData.offer_payload.pricing.source, "backend_pricebook");
  assert.equal(configData.offer_payload.pricing.catalog_version, "2026-03-01");
});

test("document payload strips hidden legacy pricing selections before PDF snapshot export", () => {
  const offerDto = {
    pricing: {
      source: "backend_pricebook",
      catalogVersion: "2026-03-30",
      totals: { net: 15000, gross: 16200 },
      items: [
        {
          code: "HP",
          sku: "PUMP",
          name: "Pompa",
          quantity: 1,
          unit: "szt.",
          unitPriceNet: 15000,
          totalNet: 15000,
          vatRate: 0.08,
          totalGross: 16200,
        },
      ],
    },
    engineering: {
      ozc: {
        heatedArea_m2: 110,
        designHeatLoss_kW: 7.2,
        recommendedPower_kW: 7.2,
      },
      selection: {
        pumpModel: "PANASONIC Aquarea 7kW",
        type: "split",
      },
      buffer: {
        setupType: "BUFFER",
        liters: 100,
      },
    },
  };

  const configData = offerPayloadModule.buildPdfConfigData(
    {
      state: {
        getAppState: () => ({
          offer: offerDto,
          draftRequest: {
            building: {
              building_type: "single_house",
              floor_area: 110,
            },
          },
          formData: {},
          configuratorSelection: {
            selections: {
              pompa: { optionId: "KIT-WC07K3E5", label: "Pompa 7 kW" },
              service: { optionId: "service-cloud", label: "Service Cloud" },
              magnetic_filter: { optionId: "magnetic_filter_premium" },
              hydro_safety: { optionId: "hydro_safety_extended" },
              flushing: { optionId: "flushing_standard" },
              electrical: { optionId: "electrical_standard" },
            },
          },
        }),
      },
    },
    { channel: "pdf", target: "document" }
  );

  assert.deepEqual(configData.selections, {
    pompa: { optionId: "KIT-WC07K3E5", label: "Pompa 7 kW" },
    service: { optionId: "service-cloud", label: "Service Cloud" },
  });
  assert.equal("magnetic_filter" in configData.selections, false);
  assert.equal("hydro_safety" in configData.selections, false);
  assert.equal("flushing" in configData.selections, false);
  assert.equal("electrical" in configData.selections, false);
  assert.equal("magnetic_filter" in configData.machine_room.selections, false);
  assert.equal("hydro_safety" in configData.machine_room.selections, false);
  assert.equal("flushing" in configData.machine_room.selections, false);
  assert.equal("electrical" in configData.machine_room.selections, false);
});

test("energy PDF semantics avoid misleading metrics and add explanatory notes", () => {
  const downloadPdfApi = loadWindowScript(downloadPdfPath);
  const pdfGeneratorApi = loadWindowScript(path.join(__dirname, "pdfGenerator.js"));

  const energyPayload = downloadPdfApi.buildEnergyReportData({
    floor_area: 130,
    heated_area: 212,
    design_outdoor_temperature: -20,
    has_basement: "Tak",
    costs_assumptions: {
      annualKWhCO: 23000,
      annualKWhCWU: 1497,
      annualKWhTotal: 24497,
      electricityPLNperKWh: 1.12,
      woodPLNperKWh: 0.28,
      scopUsed: 4.0,
    },
    costs_comparison: [
      {
        label: "Pompa ciepła",
        annual_cost_co_pln: 8200,
        annual_cost_cwu_pln: 1300,
        annual_cost_total_pln: 9500,
        efficiency_display: "SCOP 4,0",
      },
      {
        label: "Drewno",
        annual_cost_co_pln: 6893,
        annual_cost_cwu_pln: 0,
        annual_cost_total_pln: 6893,
        efficiency_display: "85%",
      },
    ],
    energy_losses: [
      { name: "Ściany zewnętrzne", percent: 27.9 },
      { name: "Podłoga", percent: 21.2 },
      { name: "Okna i drzwi", percent: 20.9 },
    ],
    bivalent_points: [],
    offer_dto: {
      engineering: {
        ozc: {
          heatedArea_m2: 212,
          designHeatLoss_kW: 4.43,
          metrics: {
            annual_energy_consumption: 24497,
            avg_outdoor_temperature: 1.9,
            avg_heating_power: 2.12,
            design_outdoor_temperature: -20,
          },
        },
        selection: {
          capacity_kW: 5,
          phase: 1,
          pumpSelection: {
            hp: {
              model: "KIT-WC05",
              name: "Panasonic Aquarea T-CAP 5 kW",
              power: 5,
              phase: 1,
            },
          },
        },
      },
    },
  });

  const leftLabels = energyPayload.energy_ozc_rows_left.map((row) => row.label);
  const rightLabels = energyPayload.energy_ozc_rows_right.map((row) => row.label);

  assert.equal(leftLabels.includes("Pow. całkowita"), false);
  assert.equal(leftLabels.includes("Moc CWU (szac.)"), false);
  assert.equal(rightLabels.includes("Temp. średnioroczna (szac.)"), false);
  assert.equal(rightLabels.includes("Moc średnia (szac.)"), false);
  assert.equal(rightLabels.includes("Zużycie dzienne (szac.)"), false);
  assert.equal(energyPayload.pump_selection_summary.secondary_line, null);
  assert.equal(energyPayload.pump_selection_summary.note, "");

  const markup = pdfGeneratorApi.createPDFContent(energyPayload, { mode: "energy" });

  assert.equal(markup.includes("Pow. całkowita"), false);
  assert.equal(markup.includes("Moc CWU (szac.)"), false);
  assert.equal(markup.includes("Temp. średnioroczna (szac.)"), false);
  assert.equal(markup.includes("Moc średnia (szac.)"), false);
  assert.equal(markup.includes("Zużycie dzienne (szac.)"), false);
  assert.equal(markup.includes("najniższy koszt energii"), false);
  assert.equal(markup.includes("Powierzchnia zabudowy"), false);
  assert.equal(markup.includes("Model dobranej pompy:"), false);
  assert.equal(markup.includes("W tym scenariuszu dodatkowe źródło szczytowe nie jest wymagane."), true);
  assert.equal(markup.includes("Powierzchnia ogrzewana obejmuje wszystkie strefy uwzględnione"), false);
  assert.equal(markup.includes("Porównanie dotyczy szacunkowego kosztu energii lub paliwa."), false);
});

test("energy PDF pump summary follows the same recommended model snapshot as configurator", () => {
  const downloadPdfApi = loadWindowScript(downloadPdfPath);

  const energyPayload = downloadPdfApi.buildEnergyReportData({
    offer_dto: {
      engineering: {
        ozc: {
          designHeatLoss_kW: 7.2,
        },
        selection: {
          capacity_kW: 9,
          phase: 3,
          recommendedModels: [
            {
              name: "Panasonic Aquarea High Performance 7 kW",
              power_kw: 7,
              phase: 1,
            },
          ],
          pumpSelection: {
            hp: {
              model: "KIT-WC09",
              power: 9,
              phase: 3,
            },
          },
        },
      },
    },
  });

  assert.equal(energyPayload.pump_selection_summary.primary_line, "7 kW, 1-fazowa");
  assert.equal(energyPayload.pump_selection_summary.secondary_line, null);
  assert.equal(energyPayload.pump_selection_summary.note, "");
});

test("P0 source guards remain in email, PDF, header, and runtime telemetry seams", () => {
  const emailSource = fs.readFileSync(emailSenderPath, "utf8");
  const rendererSource = fs.readFileSync(resultsRendererPath, "utf8");
  const downloadPdfSource = fs.readFileSync(downloadPdfPath, "utf8");
  const apiCallerSource = fs.readFileSync(apiCallerPath, "utf8");
  const uiSummarySource = fs.readFileSync(uiSummaryPath, "utf8");
  const offerPayloadSource = fs.readFileSync(offerPayloadPath, "utf8");
  const calculatorPhp = fs.readFileSync(calculatorPath, "utf8");

  assert.equal(emailSource.includes("email_blocked_no_offer_dto"), true);
  assert.equal(emailSource.includes("area < 100"), false);
  assert.equal(emailSource.includes("0.08"), false);
  assert.equal(emailSource.includes("getRecommendedPumpModel"), false);
  assert.equal(emailSource.includes("createSimplifiedPDFContent"), false);

  assert.equal(rendererSource.includes("totalGross * 0.9"), false);
  assert.equal(rendererSource.includes("totalGross * 1.1"), false);
  assert.equal(rendererSource.includes("getResultsHeaderPriceLabel"), true);
  assert.equal(rendererSource.includes("offer_projection_missing_offer_dto"), true);

  assert.equal(downloadPdfSource.includes("pdf_generation_blocked_no_offer_dto"), true);
  assert.equal(downloadPdfSource.includes("buildJsonData"), false);
  assert.equal(downloadPdfSource.includes("lastResult"), false);

  assert.equal(apiCallerSource.includes("legacy_path_used"), false);
  assert.equal(apiCallerSource.includes("backend_fallback_used"), true);
  assert.equal(apiCallerSource.includes("localCalcLegacy"), false);

  assert.equal(uiSummarySource.includes("gross * 0.9"), false);
  assert.equal(uiSummarySource.includes("gross * 1.1"), false);
  assert.equal(uiSummarySource.includes("priceGross: gross"), true);
  assert.equal(uiSummarySource.includes("Cena brutto:"), true);

  assert.equal(offerPayloadSource.includes("configurator.pricing.items.map"), false);
  assert.equal(offerPayloadSource.includes("(!strictBackendMode ? configurator?.pricing : null)"), false);

  assert.equal(calculatorPhp.includes("Cena brutto"), true);
  assert.equal(calculatorPhp.includes("Wycena orientacyjna"), false);
});
