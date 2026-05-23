/**
 * Static + logic regression: hydraulics_inputs changes must invalidate offer cache
 * and reach calculate-offer via dto.context.configurator (same path as runtime).
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const configuratorSource = fs.readFileSync(
  path.join(root, "konfigurator", "configurator-unified.js"),
  "utf8"
);
const calculateOfferSource = fs.readFileSync(
  path.join(root, "core", "application", "CalculateOfferUseCase.php"),
  "utf8"
);
const bufferEngineSource = fs.readFileSync(
  path.join(root, "core", "domain", "buffer", "BufferEngine.php"),
  "utf8"
);

function buildHydraulicsSignature(hydraulicsInputs) {
  return JSON.stringify({
    hydraulicsInputs: hydraulicsInputs || {},
  });
}

assert.notEqual(
  buildHydraulicsSignature({ has_underfloor_actuators: false }),
  buildHydraulicsSignature({ has_underfloor_actuators: true }),
  "toggling actuators must change hydraulics request signature"
);
assert.notEqual(
  buildHydraulicsSignature({ bivalent_enabled: false }),
  buildHydraulicsSignature({
    bivalent_enabled: true,
    bivalent_source_type: "gas",
  }),
  "enabling bivalent gas must change hydraulics request signature"
);

const chainMarkers = [
  "function setHydraulicsInputs(partial)",
  "invalidateHydraulicsDependentState",
  "requestRecompute();",
  "scheduleOfferRefresh({ delayMs: 250 })",
  "hydraulics_inputs:",
  "buildConfiguratorParityContext",
  "dto.context.configurator = Object.assign",
  "hydraulicsRequestSignature === lastBackendHydraulicsSignature",
  "await window.topinstalApi.calculateOffer(dto",
];
for (const marker of chainMarkers) {
  assert.equal(
    configuratorSource.includes(marker),
    true,
    `configurator-unified.js missing chain marker: ${marker}`
  );
}

assert.equal(
  calculateOfferSource.includes("'context' => isset($calc_request['context'])"),
  true,
  "CalculateOfferUseCase must pass request context into BufferEngine input"
);
assert.equal(
  bufferEngineSource.includes("configurator_context['hydraulics_inputs']"),
  true,
  "BufferEngine must read hydraulics_inputs from context.configurator"
);

console.log("[configurator-hydraulics-calculate-offer-chain] all checks passed");
