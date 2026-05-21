/**
 * Regresja: ta sama logika co resolveIntegratedCwuLabel w configurator-unified.js
 * (bez getPumpDataFromDB — w teście tylko pumpTable i selectedPump.cwu_tank).
 */
const assert = require("assert");

function resolveIntegratedCwuLabel(selectedPump, pumpTable) {
  if (!selectedPump || typeof selectedPump !== "object") return null;
  const oid = selectedPump.optionId || "";
  const isAIO =
    selectedPump.type === "aio" ||
    selectedPump.type === "all-in-one" ||
    (typeof oid === "string" && oid.indexOf("aio") !== -1);
  if (!isAIO) return null;
  const model = selectedPump.model || null;
  let tankLiters = null;
  if (model && pumpTable && pumpTable[model] && pumpTable[model].cwu_tank != null) {
    tankLiters = pumpTable[model].cwu_tank;
  }
  if (tankLiters == null && selectedPump.cwu_tank != null) {
    tankLiters = selectedPump.cwu_tank;
  }
  const n = Number(tankLiters);
  if (Number.isFinite(n) && n > 0) {
    return `Zintegrowany ${Math.round(n)} l`;
  }
  return "Zintegrowany zbiornik CWU (w zestawie)";
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

(async function run() {
  await test("CWU AIO: brak danych zbiornika → ogólny label", async () => {
    assert.equal(
      resolveIntegratedCwuLabel(
        { type: "aio", model: "X", optionId: "aio-1" },
        { X: {} }
      ),
      "Zintegrowany zbiornik CWU (w zestawie)"
    );
  });
  await test("CWU AIO: cwu_tank na pompie → litry", async () => {
    assert.equal(
      resolveIntegratedCwuLabel(
        { type: "aio", model: "KIT-WC", cwu_tank: 185.4, optionId: "aio-1" },
        {}
      ),
      "Zintegrowany 185 l"
    );
  });
  await test("CWU AIO: cwu_tank w tabeli dopasowań → litry", async () => {
    assert.equal(
      resolveIntegratedCwuLabel(
        { type: "aio", model: "KIT-WC", optionId: "aio-1" },
        { "KIT-WC": { cwu_tank: 260 } }
      ),
      "Zintegrowany 260 l"
    );
  });
  await test("CWU: split → null", async () => {
    assert.equal(resolveIntegratedCwuLabel({ type: "split", model: "Y" }, {}), null);
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
