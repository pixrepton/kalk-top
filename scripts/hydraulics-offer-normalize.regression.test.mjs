/**
 * Regression tests for OfferDTO buffer → configurator hydraulics UI mapping.
 */
import assert from "assert";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const api = require(path.join(__dirname, "..", "konfigurator", "hydraulics-offer-normalize.js"));

const { normalizeHydraulicsRecommendationFromOffer, resolveBufferUiPresentation, pickPositiveBufferLiters } =
  api;

function norm(offerBuffer) {
  return normalizeHydraulicsRecommendationFromOffer(offerBuffer);
}

function ui(offerBuffer) {
  return resolveBufferUiPresentation(norm(offerBuffer));
}

// pickPositiveBufferLiters must not treat null as 0
assert.equal(pickPositiveBufferLiters(null, 0, 80), 80);
assert.equal(pickPositiveBufferLiters(null, undefined, ""), null);

// Case: sufficient system volume — no buffer
{
  const hr = norm({
    recommendation: { recommendation: "NONE", setupType: "NONE", reason_codes: [] },
    sizing: { systemVolume: { sufficient: true, required_liters: 50, estimated_liters: 120 } },
  });
  assert.equal(hr.recommendation, "NONE");
  assert.equal(hr.setupType, "NONE");
  assert.equal(hr.buffer_liters, null);
  assert.deepEqual(ui({ recommendation: hr }), {
    recommendation: "NONE",
    setupType: "NONE",
    liters: null,
  });
}

// Case: nested buffer_liters null but top-level liters + SERIES_BYPASS (actuators bug)
{
  const hr = norm({
    liters: 200,
    setupType: "SERIES_BYPASS",
    recommendation: {
      recommendation: "BUFOR_SZEREGOWO",
      setupType: "SERIES_BYPASS",
      buffer_liters: null,
      reason_codes: ["FLOW_RISK_UNDERFLOOR_ACTUATORS"],
      axes: { flow_protection: "REQUIRED", hydraulic_separation: null, energy_storage: null },
    },
  });
  assert.equal(hr.recommendation, "BUFOR_SZEREGOWO");
  assert.equal(hr.setupType, "SERIES_BYPASS");
  assert.equal(hr.buffer_liters, 200);
  const pres = ui({
    liters: 200,
    setupType: "SERIES_BYPASS",
    recommendation: hr,
  });
  assert.equal(pres.recommendation, "BUFOR_SZEREGOWO");
  assert.equal(pres.setupType, "SERIES_BYPASS");
  assert.equal(pres.liters, 200);
}

// Case: bivalent solid fuel — series buffer required even without liters yet
{
  const hr = norm({
    recommendation: {
      setupType: "SERIES_BYPASS",
      recommendation: "BUFOR_SZEREGOWO",
      buffer_liters: null,
      reason_codes: ["BIVALENT_SOLID_FUEL"],
      axes: { flow_protection: null, hydraulic_separation: "REQUIRED", energy_storage: null },
    },
    sizing: { bivalent: { liters: 150 } },
  });
  assert.equal(hr.setupType, "SERIES_BYPASS");
  assert.equal(hr.buffer_liters, 150);
  assert.equal(hr.recommendation, "BUFOR_SZEREGOWO");
}

// Case: parallel clutch / mixed circuits
{
  const hr = norm({
    recommendation: {
      setupType: "PARALLEL_CLUTCH",
      recommendation: "BUFOR_RÓWNOLEGLE",
      buffer_liters: 300,
      reason_codes: ["MIXED_CIRCUITS_SEPARATION"],
    },
  });
  assert.equal(hr.recommendation, "BUFOR_RÓWNOLEGLE");
  assert.equal(hr.setupType, "PARALLEL_CLUTCH");
  assert.equal(hr.buffer_liters, 300);
}

// Case: setupType SERIES but stale recommendation NONE — UI must follow setupType
{
  const hr = norm({
    setupType: "SERIES_BYPASS",
    recommendation: {
      recommendation: "NONE",
      setupType: "SERIES_BYPASS",
      buffer_liters: null,
      reason_codes: ["FLOW_RISK_UNDERFLOOR_ACTUATORS"],
      axes: { flow_protection: "REQUIRED" },
    },
    manufacturerPolicyMinimumLiters: 100,
  });
  assert.equal(hr.setupType, "SERIES_BYPASS");
  assert.notEqual(hr.recommendation, "NONE");
  const pres = resolveBufferUiPresentation(hr);
  assert.equal(pres.setupType, "SERIES_BYPASS");
  assert.equal(pres.recommendation, "BUFOR_SZEREGOWO");
  assert.equal(pres.liters, 100);
}

// Case: Number(null) trap on nested only — must not zero recommendation
{
  const hr = norm({
    recommendation: {
      recommendation: "BUFOR_SZEREGOWO",
      setupType: "SERIES_BYPASS",
      buffer_liters: null,
      roundedTo: null,
      marketCapacityLiters: null,
    },
    liters: 250,
    setupType: "SERIES_BYPASS",
  });
  assert.equal(hr.buffer_liters, 250);
}

// Case: manufacturer 3ph policy code without explicit setup
{
  const hr = norm({
    recommendation: {
      reason_codes: ["MANUFACTURER_3PH_K_200L"],
      axes: { energy_storage: "MANDATORY" },
    },
    manufacturerPolicyMinimumLiters: 200,
  });
  assert.notEqual(hr.recommendation, "NONE");
  assert.ok(hr.buffer_liters === 200 || hr.setupType !== "NONE");
}

console.log("[hydraulics-offer-normalize] all regression cases passed");
