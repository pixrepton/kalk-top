const assert = require("assert");
const fs = require("fs");
const path = require("path");

const core = require(path.join(__dirname, "offerProjection", "core.js"));
const summary = require(path.join(__dirname, "offerProjection", "summary.js"));
const resultsHeader = require(path.join(
  __dirname,
  "offerProjection",
  "resultsHeader.js"
));
const documentProjection = require(path.join(
  __dirname,
  "offerProjection",
  "document.js"
));
const emailProjection = require(path.join(
  __dirname,
  "offerProjection",
  "email.js"
));

const repoRoot = path.join(__dirname, "..", "..");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function withTrackedEvents(fn) {
  const previousTrack = global.topinstalTrackEvent;
  const previousOnce = global.__HP_OFFER_PROJECTION_ONCE__;
  const events = [];
  global.topinstalTrackEvent = (name, payload) => events.push({ name, payload });
  global.__HP_OFFER_PROJECTION_ONCE__ = new Set();
  try {
    fn(events);
  } finally {
    global.topinstalTrackEvent = previousTrack;
    global.__HP_OFFER_PROJECTION_ONCE__ = previousOnce;
  }
}

function createFixtureInput() {
  const offerDto = {
    traceId: "trace-offer-projection",
    context: {
      buildingType: "single_house",
    },
    engineering: {
      ozc: {
        heatedArea_m2: 132,
        designHeatLoss_kW: 8.4,
        recommendedPower_kW: 9.0,
        metrics: {
          design_outdoor_temperature: -20,
        },
        extended: {
          energy_losses: [
            { name: "Sciany zewnetrzne", percent: 31.4 },
            { name: "Wentylacja", percent: 24.8 },
          ],
          improvements: [
            { title: "Docieplenie stropu", saving_percent: 12 },
          ],
          heating_costs: [
            {
              label: "Pompa ciepla",
              annual_cost_co_pln: 2200,
              annual_cost_cwu_pln: 420,
              annual_cost_total_pln: 2620,
              efficiency_display: "SCOP 4.0",
            },
            {
              label: "Gaz ziemny",
              annual_cost_co_pln: 3550,
              annual_cost_cwu_pln: 510,
              annual_cost_total_pln: 4060,
              efficiency_display: "90%",
            },
          ],
          heating_costs_assumptions: {
            annualKWhCO: 4578,
            annualKWhCWU: 980,
            scopUsed: 4,
            displayLine: "CO: 4578 kWh | CWU: 980 kWh | SCOP: 4.0",
          },
          bivalent_points: [
            { temp: -7, power_kw: 5.2 },
            { temp: 2, power_kw: 3.4 },
          ],
        },
      },
      selection: {
        type: "underfloor",
        pumpModel: "PANASONIC Aquarea T-CAP 9kW",
        pumpSelection: {
          hp: {
            model: "PANASONIC Aquarea T-CAP 9kW",
            power: 9,
            phase: 3,
          },
        },
      },
      buffer: {
        setupType: "BUFFER",
        liters: 100,
      },
    },
    pricing: {
      source: "backend_pricebook",
      catalogVersion: "2026-03-01",
      totals: {
        net: 12000,
        vat: 960,
        gross: 12960,
      },
      items: [
        {
          code: "HP",
          name: "Pompa ciepla",
          qty: 1,
          unitPriceNet: 12000,
          totalNet: 12000,
          vatRate: 0.08,
          totalGross: 12960,
        },
      ],
    },
  };

  return {
    offerDto,
    leadData: {
      name: "Jan Kowalski",
      email: "jan@example.com",
      phone: "123456789",
      city: "Warszawa",
      postal_code: "00-001",
    },
    configuratorSelection: {
      recommendations: {
        hydraulics: {
          recommendation: "BUFOR_ROWNOLEGLE",
          setupType: "PARALLEL_CLUTCH",
          axes: {
            hydraulic_separation: "LEGACY_OVERRIDE",
          },
          explanation: {
            short: "Legacy configurator hydraulics",
          },
        },
      },
      selections: {
        pump: {
          optionId: "pump-main",
          label: "Pompa glowna",
        },
        service: {
          optionId: "service-cloud",
        },
      },
      products: {
        pump: {
          model: "PANASONIC Aquarea T-CAP 9kW",
        },
      },
    },
    uiContext: {
      locale: "pl-PL",
      target: "projection_test",
      channel: "test",
      documentMode: "offer",
      requestBuildingSnapshot: {
        building_type: "single_house",
        heated_area: 132,
        design_outdoor_temperature: -20,
      },
      formData: {
        indoor_temperature: 21,
      },
    },
  };
}

test("summary projection builds deterministic summary view model from OfferDTO", () => {
  withTrackedEvents((events) => {
    const input = createFixtureInput();
    const viewModel = summary.buildSummaryViewModel(input);

    assert.equal(viewModel.traceId, "trace-offer-projection");
    assert.equal(viewModel.heatLoadKw, 8.4);
    assert.equal(viewModel.heatLoadLabel, "8.4");
    assert.equal(viewModel.pumpModel, "PANASONIC Aquarea T-CAP 9kW");
    assert.equal(viewModel.totalGross, 12960);
    assert.equal(viewModel.vatNoteVisible, true);
    assert.equal(Array.isArray(viewModel.breakdown.items), true);
    assert.equal(viewModel.breakdown.items.length, 1);
    assert.equal(
      events.some((event) => event.name === "summary_projection_used"),
      true
    );
  });
});

test("results header projection uses backend price and model", () => {
  withTrackedEvents((events) => {
    const input = createFixtureInput();
    const viewModel = resultsHeader.buildResultsHeaderViewModel(input);

    assert.equal(viewModel.demandKw, "8.4");
    assert.equal(viewModel.recommendedModel, "PANASONIC Aquarea T-CAP 9kW");
    assert.equal(viewModel.priceLabel.includes("12"), true);
    assert.equal(
      events.some((event) => event.name === "results_header_projection_used"),
      true
    );
  });
});

test("document projection stays anchored in OfferDTO and explicit context", () => {
  withTrackedEvents((events) => {
    const input = createFixtureInput();
    const payload = documentProjection.buildDocumentPayload(input);

    assert.strictEqual(payload.offer_dto, input.offerDto);
    assert.equal(payload.projection_blocked_reason, null);
    assert.strictEqual(payload.pricing, input.offerDto.pricing);
    assert.equal(payload.pricing.source, "backend_pricebook");
    assert.equal(payload.pricing.catalogVersion, "2026-03-01");
    assert.equal(payload.machine_room.source, "offer_dto");
    assert.equal(payload.heated_area, 132);
    assert.equal(payload.building_type_label, "Dom jednorodzinny");
    assert.equal(payload.heating_type_label, "Ogrzewanie podlogowe");
    assert.equal(
      payload.machine_room.recommendations.hydraulics.setupType,
      "SERIES_BYPASS"
    );
    assert.equal(
      payload.machine_room.recommendations.hydraulics.axes || null,
      null
    );
    assert.equal(payload.costs_comparison.length, 2);
    assert.equal(payload.energy_losses.length, 2);
    assert.equal(payload.improvements.length, 1);
    assert.equal(payload.bivalent_points.length, 2);
    assert.equal(payload.costs_assumptions.displayLine.includes("SCOP"), true);
    assert.equal(Array.isArray(payload.machine_room.summary_rows), true);
    assert.equal(payload.machine_room.selected_components.service.optionId, "service-cloud");
    assert.equal(payload.machine_room.selected_components.service.label, "Service Cloud");
    assert.equal(
      payload.machine_room.summary_rows.some(
        (row) => row.key === "service" && row.value === "Service Cloud"
      ),
      true
    );
    assert.equal(
      events.some((event) => event.name === "document_projection_used"),
      true
    );
  });
});

test("document projection falls back to backend design outdoor temperature when request snapshot is thin", () => {
  withTrackedEvents(() => {
    const input = createFixtureInput();
    input.uiContext.requestBuildingSnapshot = {
      building_type: "single_house",
      heated_area: 132,
    };

    const payload = documentProjection.buildDocumentPayload(input);

    assert.equal(payload.design_outdoor_temperature, -20);
    assert.equal(
      payload.energy_profile_rows.some(
        (row) => row.label === "Temp. projektowa" && row.value.includes("-20")
      ),
      true
    );
  });
});

test("document projection keeps footprint separate from heated area in building info", () => {
  withTrackedEvents(() => {
    const input = createFixtureInput();
    input.uiContext.requestBuildingSnapshot = {
      building_type: "single_house",
      heated_area: 212,
      building_length: 10,
      building_width: 13,
      has_basement: true,
    };

    const payload = documentProjection.buildDocumentPayload(input);

    assert.equal(payload.heated_area, 132);
    assert.equal(payload.floor_area, 130);
  });
});

test("document projection does not invent footprint from heated area when geometry is unknown", () => {
  withTrackedEvents(() => {
    const input = createFixtureInput();
    input.uiContext.requestBuildingSnapshot = {
      building_type: "single_house",
      heated_area: 212,
    };

    const payload = documentProjection.buildDocumentPayload(input);

    assert.equal(payload.heated_area, 132);
    assert.equal(payload.floor_area, null);
  });
});

test("email projection builds transport payload without local business guesses", () => {
  withTrackedEvents((events) => {
    const input = createFixtureInput();
    const payload = emailProjection.buildEmailPayload(input);

    assert.strictEqual(payload.offerDto, input.offerDto);
    assert.equal(payload.subject.includes("Oferta pompy ciepla TOP-INSTAL"), true);
    assert.equal(payload.messageHtml.includes("PANASONIC Aquarea T-CAP 9kW"), true);
    assert.equal(payload.clientData.buildingArea, 132);
    assert.equal(payload.clientData.priceGrossPln, 12960);
    assert.equal(
      events.some((event) => event.name === "email_projection_used"),
      true
    );
  });
});

test("missing-offer projection guard emits telemetry once per target", () => {
  withTrackedEvents((events) => {
    const input = {
      offerDto: null,
      leadData: null,
      configuratorSelection: null,
      uiContext: {
        target: "summary",
        channel: "test",
      },
    };

    const first = summary.buildSummaryViewModel(input);
    const second = summary.buildSummaryViewModel(input);

    assert.equal(first.offerDto, null);
    assert.equal(second.offerDto, null);
    assert.equal(
      events.filter((event) => event.name === "offer_projection_missing_offer_dto")
        .length,
      1
    );
  });
});

test("consumers now read offerProjection seam instead of local projection logic", () => {
  const offerSummarySource = fs.readFileSync(
    path.join(__dirname, "offerSummary.js"),
    "utf8"
  );
  const resultsRendererSource = fs.readFileSync(
    path.join(__dirname, "resultsRenderer.js"),
    "utf8"
  );
  const downloadPdfSource = fs.readFileSync(
    path.join(__dirname, "downloadPDF.js"),
    "utf8"
  );
  const emailSenderSource = fs.readFileSync(
    path.join(__dirname, "emailSender.js"),
    "utf8"
  );
  const heatpumpCalculatorPhp = fs.readFileSync(
    path.join(repoRoot, "heatpump-calculator.php"),
    "utf8"
  );
  const configuratorSource = fs.readFileSync(
    path.join(repoRoot, "konfigurator", "configurator-unified.js"),
    "utf8"
  );

  assert.equal(offerSummarySource.includes("projectionApi.buildSummaryViewModel"), true);
  assert.equal(
    resultsRendererSource.includes("projectionApi.buildResultsHeaderViewModel"),
    true
  );
  assert.equal(
    downloadPdfSource.includes("projectionApi.buildDocumentPayload"),
    true
  );
  assert.equal(emailSenderSource.includes("emailPayload"), true);
  assert.equal(emailSenderSource.includes("documentPayload"), true);
  assert.equal(
    configuratorSource.includes("getCanonicalHydraulicsRenderSnapshot"),
    true
  );
  assert.equal(configuratorSource.includes("buildCanonicalRecommendationsSnapshot"), true);
  assert.equal(configuratorSource.includes("renderHydraulicsPendingState"), true);
  assert.equal(configuratorSource.includes("renderCanonicalHydraulicsUi(evaluated)"), true);
  assert.equal(
    configuratorSource.includes("resolveCanonicalPumpRecommendationSnapshot"),
    true
  );
  assert.equal(
    configuratorSource.includes("resolveRecommendedPumpProfile"),
    true
  );
  assert.equal(
    configuratorSource.includes('badge-recommended">Rekomendowane</span>'),
    true
  );
  assert.equal(
    configuratorSource.includes("Hydraulics UI is rendered canonically in recompute()."),
    true
  );
  assert.equal(
    heatpumpCalculatorPhp.includes("offerProjection/resultsHeader.js"),
    true
  );
});
