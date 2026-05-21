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
const presentationPath = path.join(
  root,
  "konfigurator",
  "configurator-presentation.json"
);
const outMdPath = path.join(
  root,
  "docs",
  "konfigurator",
  "BUSINESS_PRICE_INVENTORY.md"
);
const outCsvPath = path.join(
  root,
  "docs",
  "konfigurator",
  "BUSINESS_PRICE_INVENTORY.csv"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function grossFromNet(net, vatRate) {
  return round2(Number(net || 0) * (1 + Number(vatRate || 0)));
}

function formatPln(value) {
  return Number(value || 0).toFixed(2);
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function resolveCwuPresentation(material) {
  const key = material === "inox" ? "inox" : "emalia";
  const entry = presentation.cwu_cards?.types?.[key] || {};
  return {
    productName: entry.product_name || (key === "inox" ? "Viqtis" : "Galmet SG(S)"),
    materialLabel: entry.material || (key === "inox" ? "stal nierdzewna" : "emalia"),
  };
}

function resolveBufferTitle(capacity) {
  return (
    presentation.buffer_cards?.by_capacity_liters?.[String(capacity)]?.title ||
    `Bufor ${capacity}L`
  );
}

function sectionTable(rows) {
  const header =
    "| Rodzaj | Status biznesowy | ID / wariant | Nazwa | Cena netto PLN | Cena brutto PLN | Uwagi |\n" +
    "|---|---|---|---|---:|---:|---|\n";
  const body = rows
    .map(
      (row) =>
        `| ${escapeCell(row.kind)} | ${escapeCell(row.status)} | ${escapeCell(
          row.id
        )} | ${escapeCell(row.name)} | ${escapeCell(
          formatPln(row.net)
        )} | ${escapeCell(formatPln(row.gross))} | ${escapeCell(row.notes)} |`
    )
    .join("\n");
  return header + body + "\n";
}

function resolvePumpPrice(pump, pricingPolicy) {
  const pricing = pump?.pricing || {};
  const type = String(pump?.type || "split").toLowerCase();
  const phase = Number(pump?.phase || 1);
  const defaults = pricingPolicy?.pump?.default_candidates || {};

  let candidates = [];
  if (type.startsWith("split")) {
    candidates = phase === 3 ? defaults.split_3ph || [] : defaults.split_1ph || [];
  } else {
    candidates = phase === 3 ? defaults.aio_3ph || [] : defaults.aio_1ph || [];
  }

  for (const key of candidates) {
    if (typeof pricing[key] === "number") {
      return { key, net: pricing[key] };
    }
  }

  for (const [key, value] of Object.entries(pricing)) {
    if (typeof value === "number") {
      return { key, net: value };
    }
  }

  return { key: "", net: 0 };
}

const catalog = readJson(catalogPath);
const presentation = readJson(presentationPath);
const vatRate = Number(catalog.vat_rate || 0.08);
const pricing = catalog.pricing_sections || {};
const pricingPolicy = catalog.pricing_policy || {};

const pumpRows = (catalog.pumps || []).map((pump) => {
  const canonicalPrice = resolvePumpPrice(pump, pricingPolicy);
  const pair = pump?.pair?.aio_model ? `, para AIO: ${pump.pair.aio_model}` : "";
  return {
    section: "Pompy ciepła",
    kind: "Pompa ciepła",
    status: "dobór systemu + wybór klienta",
    id: pump.model,
    name: pump.model,
    net: canonicalPrice.net,
    gross: grossFromNet(canonicalPrice.net, vatRate),
    notes: `seria ${pump.series}, ${pump.type}, ${pump.power_kw} kW, ${pump.phase}-fazowa, klucz ceny ${canonicalPrice.key}${pair}`,
  };
});

const cwuRows = [];
for (const [material, capacities] of Object.entries(pricing.cwu || {})) {
  if (material === "none") continue;
  const cwuPresentation = resolveCwuPresentation(material);
  for (const [capacity, net] of Object.entries(capacities || {})) {
    const optionId = `cwu-${material}-${capacity}`;
    cwuRows.push({
      section: "Zbiorniki CWU",
      kind: "Zbiornik CWU",
      status: "dobór systemu + wybór klienta",
      id: optionId,
      name: `${cwuPresentation.productName} ${capacity} l`,
      net,
      gross: grossFromNet(net, vatRate),
      notes: `materiał: ${cwuPresentation.materialLabel}; pozycja line item \`CWU\` dla pomp split`,
    });
  }
}
cwuRows.push({
  section: "Zbiorniki CWU",
  kind: "Zbiornik CWU",
  status: "wariant zerowy / brak",
  id: "cwu-none",
  name: "Brak zasobnika CWU",
  net: 0,
  gross: 0,
  notes: "używane dla braku CWU lub AIO z wbudowanym zbiornikiem",
});

const bufferRows = [];
for (const [capacity, variants] of Object.entries(pricing.buffer || {})) {
  for (const [variant, net] of Object.entries(variants || {})) {
    const optionId =
      capacity === "0" ? "buffer-0 / bufor-nie" : `buffer-${capacity}`;
    const variantLabel =
      variant === "sprzeglo" ? "sprzęgło hydrauliczne" : "na powrocie";
    bufferRows.push({
      section: "Bufory CO",
      kind: "Bufor / sprzęgło",
      status: capacity === "0" ? "wariant zerowy / brak" : "dobór systemu + wybór klienta",
      id: `${optionId} :: ${variant}`,
      name:
        capacity === "0"
          ? `Brak bufora (${variantLabel})`
          : `${resolveBufferTitle(capacity)} (${variantLabel})`,
      net,
      gross: grossFromNet(net, vatRate),
      notes: "cena zależy od hydrauliki backendowej (`setupType`)",
    });
  }
}

const visibleChoiceRows = [
  {
    section: "Widoczne opcje klienta",
    kind: "Cyrkulacja CWU",
    status: "wybór klienta",
    id: "cyrkulacja-tak",
    name: presentation.circulation_cwu?.tak?.title || "Z cyrkulacją CWU",
    net: pricing.options?.["cyrkulacja-tak"] || 0,
    gross: grossFromNet(pricing.options?.["cyrkulacja-tak"] || 0, vatRate),
    notes: "line item `ACCESSORY_CIRCULATION`",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Cyrkulacja CWU",
    status: "wybór klienta",
    id: "cyrkulacja-nie",
    name: presentation.circulation_cwu?.nie?.title || "Bez cyrkulacji",
    net: pricing.options?.["cyrkulacja-nie"] || 0,
    gross: grossFromNet(pricing.options?.["cyrkulacja-nie"] || 0, vatRate),
    notes: "wariant zerowy",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Service",
    status: "wybór klienta",
    id: "service-cloud",
    name: presentation.service_cloud?.card?.title || "Service Cloud",
    net: pricing.options?.["service-cloud"] || 0,
    gross: grossFromNet(pricing.options?.["service-cloud"] || 0, vatRate),
    notes: "line item `ACCESSORY_SERVICE_CLOUD`",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Posadowienie",
    status: "wybór klienta",
    id: presentation.foundation?.cards?.grunt?.option_id || "posadowienie-grunt",
    name: presentation.foundation?.cards?.grunt?.title || "Fundament przygotowany samodzielnie",
    net: pricing.foundation?.["fundament-klienta"] || 0,
    gross: grossFromNet(pricing.foundation?.["fundament-klienta"] || 0, vatRate),
    notes: "wariant bez dopłaty; fundament po stronie inwestora",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Posadowienie",
    status: "wybór klienta",
    id: presentation.foundation?.cards?.sciana?.option_id || "posadowienie-sciana",
    name: presentation.foundation?.cards?.sciana?.title || "Montaż na konsoli ściennej",
    net: pricing.foundation?.["fundament-nasz"] || 0,
    gross: grossFromNet(pricing.foundation?.["fundament-nasz"] || 0, vatRate),
    notes: "line item `ACCESSORY_FOUNDATION_WALL`",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Posadowienie",
    status: "wybór klienta",
    id: presentation.foundation?.cards?.eko?.option_id || "posadowienie-eko",
    name: presentation.foundation?.cards?.eko?.title || "Montaż na stojaku",
    net: pricing.foundation?.stojak || 0,
    gross: grossFromNet(pricing.foundation?.stojak || 0, vatRate),
    notes: "line item `ACCESSORY_FOUNDATION_ECO`",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Reduktor ciśnienia",
    status: "wybór klienta",
    id: presentation.pressure_reducer?.with?.option_id || "reduktor-tak",
    name: presentation.pressure_reducer?.with?.title || "Z reduktorem ciśnienia",
    net: pricing.water?.pressure?.["z-reduktorem-cisnienia"] || 0,
    gross: grossFromNet(pricing.water?.pressure?.["z-reduktorem-cisnienia"] || 0, vatRate),
    notes: "line item `ACCESSORY_PRESSURE`",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Reduktor ciśnienia",
    status: "wybór klienta",
    id: presentation.pressure_reducer?.without?.option_id || "reduktor-nie",
    name: presentation.pressure_reducer?.without?.title || "Bez reduktora ciśnienia",
    net: pricing.water?.pressure?.["bez-reduktora"] || 0,
    gross: grossFromNet(pricing.water?.pressure?.["bez-reduktora"] || 0, vatRate),
    notes: "wariant zerowy",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Uzdatnianie wody",
    status: "wybór klienta",
    id: presentation.water_treatment?.stations?.kompleksowa?.option_id || "woda-tak",
    name: presentation.water_treatment?.stations?.kompleksowa?.title || "Stacja kompleksowa",
    net: pricing.water?.filters?.["filtry-zmiekczacz"] || 0,
    gross: grossFromNet(pricing.water?.filters?.["filtry-zmiekczacz"] || 0, vatRate),
    notes: "line item `ACCESSORY_WATER_SOFTENER`",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Uzdatnianie wody",
    status: "wybór klienta",
    id: presentation.water_treatment?.stations?.podstawowa?.option_id || "woda-filtr",
    name: presentation.water_treatment?.stations?.podstawowa?.title || "Filtracja podstawowa",
    net: pricing.water?.filters?.["filtry-podstawowe"] || 0,
    gross: grossFromNet(pricing.water?.filters?.["filtry-podstawowe"] || 0, vatRate),
    notes: "line item `ACCESSORY_WATER_FILTER`",
  },
  {
    section: "Widoczne opcje klienta",
    kind: "Uzdatnianie wody",
    status: "wybór klienta",
    id: presentation.water_treatment?.stations?.brak?.option_id || "woda-nie",
    name: presentation.water_treatment?.stations?.brak?.title || "Bez uzdatniania",
    net: pricing.water?.filters?.["bez-filtrow"] || 0,
    gross: grossFromNet(pricing.water?.filters?.["bez-filtrow"] || 0, vatRate),
    notes: "wariant zerowy",
  },
];

const systemRows = [
  {
    section: "Narzuty systemowe",
    kind: "Część narzucana przez system",
    status: "backend / automatycznie doliczane",
    id: "HYDRAULIC :: split",
    name: "Komponenty hydrauliczne dla split",
    net: pricing.hydraulic_components_split || 0,
    gross: grossFromNet(pricing.hydraulic_components_split || 0, vatRate),
    notes: "line item `HYDRAULIC` dla pomp split",
  },
  {
    section: "Narzuty systemowe",
    kind: "Część narzucana przez system",
    status: "backend / automatycznie doliczane",
    id: "HYDRAULIC :: all-in-one",
    name: "Komponenty hydrauliczne dla AIO",
    net: pricing.hydraulic_components_aio || 0,
    gross: grossFromNet(pricing.hydraulic_components_aio || 0, vatRate),
    notes: "line item `HYDRAULIC` dla pomp AIO",
  },
  {
    section: "Narzuty systemowe",
    kind: "Robocizna",
    status: "backend / automatycznie doliczane",
    id: "INSTALLATION",
    name: "Montaż instalacji",
    net: pricing.installation_net || 0,
    gross: grossFromNet(pricing.installation_net || 0, vatRate),
    notes: "line item `INSTALLATION` przy wybranej pompie",
  },
];

const latentRows = [
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Akcesorium",
    status: "katalog only / poza aktywnym runtime",
    id: "magnetic_filter_standard",
    name: "Filtr magnetyczny standard",
    net: pricing.options?.magnetic_filter_standard || 0,
    gross: grossFromNet(pricing.options?.magnetic_filter_standard || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie bierze juz udzialu w aktywnym runtime kalkulatora",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Akcesorium",
    status: "katalog only / poza aktywnym runtime",
    id: "magnetic_filter_premium",
    name: "Filtr magnetyczny premium",
    net: pricing.options?.magnetic_filter_premium || 0,
    gross: grossFromNet(pricing.options?.magnetic_filter_premium || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie bierze juz udzialu w aktywnym runtime kalkulatora",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Akcesorium",
    status: "katalog only / poza aktywnym runtime",
    id: "hydro_safety_standard",
    name: "Zabezpieczenia hydrauliczne standard",
    net: pricing.options?.hydro_safety_standard || 0,
    gross: grossFromNet(pricing.options?.hydro_safety_standard || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie bierze juz udzialu w aktywnym runtime kalkulatora",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Akcesorium",
    status: "katalog only / poza aktywnym runtime",
    id: "hydro_safety_extended",
    name: "Zabezpieczenia hydrauliczne extended",
    net: pricing.options?.hydro_safety_extended || 0,
    gross: grossFromNet(pricing.options?.hydro_safety_extended || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie bierze juz udzialu w aktywnym runtime kalkulatora",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Usługa / chemia",
    status: "katalog only / poza aktywnym runtime",
    id: "flushing_standard",
    name: "Płukanie instalacji + inhibitor standard",
    net: pricing.options?.flushing_standard || 0,
    gross: grossFromNet(pricing.options?.flushing_standard || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie bierze juz udzialu w aktywnym runtime kalkulatora",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Usługa / chemia",
    status: "katalog only / poza aktywnym runtime",
    id: "flushing_premium",
    name: "Płukanie instalacji + inhibitor premium",
    net: pricing.options?.flushing_premium || 0,
    gross: grossFromNet(pricing.options?.flushing_premium || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie bierze juz udzialu w aktywnym runtime kalkulatora",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Elektryka",
    status: "katalog only / poza aktywnym runtime",
    id: "electrical_standard",
    name: "Zasilanie elektryczne standard",
    net: pricing.options?.electrical_standard || 0,
    gross: grossFromNet(pricing.options?.electrical_standard || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie bierze juz udzialu w aktywnym runtime kalkulatora",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Odwodnienie",
    status: "katalog only / poza aktywnym runtime",
    id: "skropliny-z-grzalka",
    name: "Odprowadzenie skroplin z grzałką",
    net: pricing.drainage?.["skropliny-z-grzalka"] || 0,
    gross: grossFromNet(pricing.drainage?.["skropliny-z-grzalka"] || 0, vatRate),
    notes: "pozycja pozostaje w kanonicznym pricebooku, ale nie ma aktywnej sciezki runtime ani mapowania DTO",
  },
  {
    section: "Pozycje w katalogu, dziś niewystawione w aktualnym UI",
    kind: "Odwodnienie",
    status: "katalog only / poza aktywnym runtime",
    id: "bez",
    name: "Brak odwodnienia / bez grzałki",
    net: pricing.drainage?.bez || 0,
    gross: grossFromNet(pricing.drainage?.bez || 0, vatRate),
    notes: "wariant katalogowy poza aktywnym runtime; brak mapowania DTO i brak wplywu na oferte",
  },
];

const groupedSections = [
  ["Pompy ciepła", pumpRows],
  ["Zbiorniki CWU", cwuRows],
  ["Bufory CO", bufferRows],
  ["Widoczne opcje klienta", visibleChoiceRows],
  ["Narzuty systemowe", systemRows],
  ["Pozycje w katalogu, dziś niewystawione w aktualnym UI", latentRows],
];

const allRows = groupedSections.flatMap(([, rows]) => rows);

const markdown = [
  "# Tabela pozycji biznesowych i cen",
  "",
  `Wygenerowano: ${new Date().toISOString()}`,
  "",
  `Źródła prawdy: \`core/infrastructure/master-data/equipment-catalog.json\` (wersja danych ${catalog.data_version}), \`konfigurator/configurator-presentation.json\`.`,
  "",
  `VAT: ${Math.round(vatRate * 100)}%`,
  "",
  "Ten dokument rozróżnia:",
  "",
  "- `dobór systemu + wybór klienta` — system rekomenduje, ale klient może zmienić w konfiguratorze",
  "- `wybór klienta` — świadomy wybór w widocznym kroku konfiguratora",
  "- `backend / automatycznie doliczane` — pozycje doliczane przez pricing backendu",
  "- `katalog only / poza aktywnym runtime` — pozycje pozostajace w kanonicznym pricebooku, ale usuniete z aktywnego flow kalkulatora",
  "",
  "## Podsumowanie",
  "",
  `- Pompy: ${pumpRows.length}`,
  `- Zbiorniki CWU: ${cwuRows.length}`,
  `- Bufory / warianty hydrauliczne: ${bufferRows.length}`,
  `- Widoczne opcje klienta: ${visibleChoiceRows.length}`,
  `- Narzuty systemowe: ${systemRows.length}`,
  `- Pozycje katalogowe niewystawione w aktualnym UI: ${latentRows.length}`,
  "",
];

for (const [section, rows] of groupedSections) {
  markdown.push(`## ${section}`, "", sectionTable(rows));
}

const csvHeader = [
  "section",
  "kind",
  "status",
  "id",
  "name",
  "net_pln",
  "gross_pln",
  "notes",
];
const csvLines = [csvHeader.map(csvEscape).join(",")];
for (const row of allRows) {
  csvLines.push(
    [
      row.section,
      row.kind,
      row.status,
      row.id,
      row.name,
      formatPln(row.net),
      formatPln(row.gross),
      row.notes,
    ]
      .map(csvEscape)
      .join(",")
  );
}

fs.writeFileSync(outMdPath, markdown.join("\n"), "utf8");
fs.writeFileSync(outCsvPath, csvLines.join("\n") + "\n", "utf8");

console.log(
  `[business-price-inventory] wrote ${allRows.length} rows to ${path.relative(
    root,
    outMdPath
  )} and ${path.relative(root, outCsvPath)}`
);
