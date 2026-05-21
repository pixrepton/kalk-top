import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const catalogPath = path.join(
  root,
  "core",
  "infrastructure",
  "master-data",
  "equipment-catalog.json"
);
const inventoryMdPath = path.join(
  root,
  "docs",
  "konfigurator",
  "BUSINESS_PRICE_INVENTORY.md"
);
const inventoryCsvPath = path.join(
  root,
  "docs",
  "konfigurator",
  "BUSINESS_PRICE_INVENTORY.csv"
);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countObjectEntries(value) {
  return value && typeof value === "object" ? Object.keys(value).length : 0;
}

function sumNestedEntryCounts(record) {
  if (!record || typeof record !== "object") {
    return 0;
  }
  return Object.values(record).reduce((sum, value) => {
    if (!value || typeof value !== "object") {
      return sum;
    }
    return sum + Object.keys(value).length;
  }, 0);
}

function main() {
  const catalog = readJson(catalogPath);
  const markdown = readText(inventoryMdPath);
  const csv = readText(inventoryCsvPath);

  const pricingSections =
    catalog.pricing_sections && typeof catalog.pricing_sections === "object"
      ? catalog.pricing_sections
      : {};
  const cwuSections =
    pricingSections.cwu && typeof pricingSections.cwu === "object"
      ? pricingSections.cwu
      : {};
  const drainageSections =
    pricingSections.drainage && typeof pricingSections.drainage === "object"
      ? pricingSections.drainage
      : {};

  const pumpCount = Array.isArray(catalog.pumps) ? catalog.pumps.length : 0;
  const cwuCount =
    Object.entries(cwuSections).reduce((sum, [material, capacities]) => {
      if (material === "none" || !capacities || typeof capacities !== "object") {
        return sum;
      }
      return sum + Object.keys(capacities).length;
    }, 0) + 1;
  const bufferCount = sumNestedEntryCounts(pricingSections.buffer);
  const visibleChoiceCount = 11;
  const systemCount = 3;
  const backendOnlyCount = 7;
  const inactiveCatalogCount = countObjectEntries(drainageSections);
  const expectedRowCount =
    pumpCount +
    cwuCount +
    bufferCount +
    visibleChoiceCount +
    systemCount +
    backendOnlyCount +
    inactiveCatalogCount;

  assertCondition(
    markdown.includes(`wersja danych ${catalog.data_version}`),
    "BUSINESS_PRICE_INVENTORY.md does not mention the current equipment-catalog data_version."
  );
  assertCondition(
    markdown.includes(`- Pompy: ${pumpCount}`),
    "BUSINESS_PRICE_INVENTORY.md summary has an unexpected pump count."
  );
  assertCondition(
    markdown.includes(`- Zbiorniki CWU: ${cwuCount}`),
    "BUSINESS_PRICE_INVENTORY.md summary has an unexpected CWU count."
  );
  assertCondition(
    markdown.includes(`- Bufory / warianty hydrauliczne: ${bufferCount}`),
    "BUSINESS_PRICE_INVENTORY.md summary has an unexpected buffer count."
  );
  assertCondition(
    csv.trim().split(/\r?\n/).length === expectedRowCount + 1,
    "BUSINESS_PRICE_INVENTORY.csv row count no longer matches the canonical catalog export."
  );

  const forbiddenSnippets = [
    {
      filePath: path.join(root, "konfigurator", "configurator-unified.js"),
      snippet: "const PRICING_CATALOG = {",
      reason: "hardcoded JS retail price catalog must not reappear in configurator runtime",
    },
    {
      filePath: path.join(root, "konfigurator", "configurator-unified.js"),
      snippet: "PRICING_SOURCE_REASON_FALLBACK",
      reason: "old fallback pricing reason code must stay removed from configurator runtime",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "offerPayload.js"),
      snippet: "configurator.pricing.items.map",
      reason: "offer payload must not rebuild line items from configurator.pricing",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "offerPayload.js"),
      snippet: "(!strictBackendMode ? configurator?.pricing : null)",
      reason: "PDF payload must not fall back to configurator.pricing",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "uiSummary.js"),
      snippet: "gross * 0.9",
      reason: "UI summary must not derive a synthetic lower bound from backend gross",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "uiSummary.js"),
      snippet: "gross * 1.1",
      reason: "UI summary must not derive a synthetic upper bound from backend gross",
    },
    {
      filePath: path.join(root, "konfigurator", "configurator-unified.js"),
      snippet: "magneticFilterOptionId",
      reason: "hidden magnetic-filter pricing seams must stay removed from configurator runtime",
    },
    {
      filePath: path.join(root, "konfigurator", "configurator-unified.js"),
      snippet: "hydroSafetyOptionId",
      reason: "hidden hydro-safety pricing seams must stay removed from configurator runtime",
    },
    {
      filePath: path.join(root, "konfigurator", "configurator-unified.js"),
      snippet: "flushingOptionId",
      reason: "hidden flushing pricing seams must stay removed from configurator runtime",
    },
    {
      filePath: path.join(root, "konfigurator", "configurator-unified.js"),
      snippet: "electricalOptionId",
      reason: "hidden electrical pricing seams must stay removed from configurator runtime",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "mapUiStateToCalcRequestDTO.js"),
      snippet: "magneticFilterOptionId",
      reason: "legacy hidden option ids must not re-enter calculator DTO mapping",
    },
    {
      filePath: path.join(root, "frontend", "api", "mapUiStateToCalcRequestDTO.js"),
      snippet: "magneticFilterOptionId",
      reason: "legacy hidden option ids must not re-enter frontend DTO mapping",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "offerSummary.js"),
      snippet: "ACCESSORY_MAGNETIC_FILTER",
      reason: "summary expected-SKU checks must not resurrect hidden magnetic-filter pricing",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "offerSummary.js"),
      snippet: "ACCESSORY_HYDRO_SAFETY",
      reason: "summary expected-SKU checks must not resurrect hidden hydro-safety pricing",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "offerSummary.js"),
      snippet: "ACCESSORY_FLUSHING",
      reason: "summary expected-SKU checks must not resurrect hidden flushing pricing",
    },
    {
      filePath: path.join(root, "kalkulator", "js", "offerSummary.js"),
      snippet: "ACCESSORY_ELECTRICAL",
      reason: "summary expected-SKU checks must not resurrect hidden electrical pricing",
    },
  ];

  for (const entry of forbiddenSnippets) {
    const source = readText(entry.filePath);
    assertCondition(
      !source.includes(entry.snippet),
      `${path.relative(root, entry.filePath)} still contains forbidden snippet: ${entry.reason}`
    );
  }

  console.log(
    `[guard-canonical-pricebook] OK (${expectedRowCount} inventory rows, catalog ${catalog.data_version})`
  );
}

main();
