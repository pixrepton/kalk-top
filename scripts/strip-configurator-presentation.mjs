/**
 * One-off maintenance: remove panasonic_kits duplicate and display-only price fields
 * from konfigurator/configurator-presentation.json (plan: ceny i katalogi).
 * Run: node scripts/strip-configurator-presentation.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const target = path.join(root, "konfigurator", "configurator-presentation.json");

const raw = fs.readFileSync(target, "utf8");
const j = JSON.parse(raw);

delete j.panasonic_kits;

function stripDisplayPrices(obj) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach(stripDisplayPrices);
    return;
  }
  delete obj.display_price_pln;
  delete obj.display_prices_pln_note;
  for (const k of Object.keys(obj)) {
    stripDisplayPrices(obj[k]);
  }
}

stripDisplayPrices(j);

j._meta = j._meta || {};
j._meta.purpose =
  "Jedno źródło treści i metadanych prezentacyjnych warstwy konfiguratora (karty, copy, nazwy plików graficznych). Bez cen oferty i bez kopii panasonic.json.";
j._meta.not_canonical_pricing =
  "Ceny końcowej oferty wyłącznie w core/infrastructure/master-data/equipment-catalog.json oraz PricingEngine. Ten plik nie zawiera kwot cenowych.";
j._meta.technical_specs =
  "Dane techniczne pomp: wyłącznie konfigurator/panasonic.json w runtime (fetch). Pole technical_specs_ref wskazuje ścieżkę w paczce wtyczki.";
j._meta.technical_specs_ref = "konfigurator/panasonic.json";
j._meta.runtime_note =
  "Konfigurator ładuje ten plik przez loadPresentationData() w configurator-unified.js; przy błędzie sieci używany jest fallback inline.";
j._meta.coverage =
  "Copy kart (CWU, bufor, cyrkulacja, Service Cloud, posadowienie, reduktor, woda), schematy bufora, etykiety wykresu. Bez duplikatu panasonic_kits i bez pól display_price.";
j.data_version = "2026-03-26-presentation-v2";

fs.writeFileSync(target, JSON.stringify(j, null, 2) + "\n", "utf8");
console.log("Updated:", target);
