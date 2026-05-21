/**
 * Ensures option_id values referenced in configurator-presentation.json
 * are known to equipment-catalog.json (pricing_sections.options or pricing_policy.option_mapping).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function collectOptionIds(obj, ids = new Set()) {
  if (!obj || typeof obj !== "object") return ids;
  if (Array.isArray(obj)) {
    obj.forEach((v) => collectOptionIds(v, ids));
    return ids;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "option_id" && typeof v === "string" && v.trim() !== "") {
      ids.add(v.trim());
    }
    collectOptionIds(v, ids);
  }
  return ids;
}

function flattenOptionMapping(mapping) {
  const s = new Set();
  if (!mapping || typeof mapping !== "object") return s;
  for (const v of Object.values(mapping)) {
    if (typeof v === "string") s.add(v);
    else if (Array.isArray(v)) {
      v.forEach((x) => {
        if (typeof x === "string") s.add(x);
      });
    }
  }
  return s;
}

const catalogPath = path.join(
  root,
  "core/infrastructure/master-data/equipment-catalog.json"
);
const presentationPath = path.join(
  root,
  "konfigurator/configurator-presentation.json"
);

function readJsonNoBom(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

const catalog = readJsonNoBom(catalogPath);
const presentation = readJsonNoBom(presentationPath);

const optionKeys = new Set(
  Object.keys(catalog.pricing_sections?.options || {})
);
const mappedIds = flattenOptionMapping(catalog.pricing_policy?.option_mapping);

/** IDs used in UI but priced indirectly (0 PLN / water.pressure / etc.) */
const EXTRA_UI_OPTION_IDS = new Set(["reduktor-nie", "woda-nie"]);

const allowed = new Set([...optionKeys, ...mappedIds, ...EXTRA_UI_OPTION_IDS]);

const presIds = collectOptionIds(presentation);
const missing = [...presIds].filter((id) => !allowed.has(id));

if (missing.length) {
  console.error(
    "[pricing-option-presentation-parity] Unknown option_id in presentation vs catalog:",
    missing
  );
  process.exit(1);
}

const foundationCards = presentation.foundation?.cards || {};
const foundationExpectations = [
  ["grunt", "posadowienie-grunt"],
  ["sciana", "posadowienie-sciana"],
  ["eko", "posadowienie-eko"],
];

for (const [cardKey, expectedOptionId] of foundationExpectations) {
  const actualOptionId = foundationCards?.[cardKey]?.option_id || null;
  if (actualOptionId !== expectedOptionId) {
    console.error(
      `[pricing-option-presentation-parity] Foundation card "${cardKey}" must use ${expectedOptionId}, got ${actualOptionId}`
    );
    process.exit(1);
  }
}

console.log(
  `[pricing-option-presentation-parity] OK (${presIds.size} option_id refs)`
);
