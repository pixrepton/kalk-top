import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "..", "konfigurator", "configurator-unified.js");
let t = fs.readFileSync(target, "utf8");

/** @type {Array<[RegExp, string]>} */
const rules = [
  [/ciep\u0105\u00e2\u20ac\u0161a/g, "ciepła"],
  [/ciep\u0105\u00e2\u20ac\u0161/g, "ciepł"],
  [/Pompa ciep\u0142a/g, "Pompa ciepła"], // idempotent noop if already fixed
  [/Niedost\u0102\u201e\u00e2\u201e\u02d8pne/g, "Niedostępne"],
  [/zewn\u0102\u201e\u00e2\u201e\u02d8trzn/g, "zewnętrzn"],
  [/ci\u0105\u201e\u00e2\u201anienia/g, "ciśnienia"],
  [/ci\u0105\u201e\u00e2\u201anieniu/g, "ciśnieniu"],
  [/Reduktor ci\u015bnienia/g, "Reduktor ciśnienia"],
  [/P\u0142ukanie/g, "Płukanie"],
  [/sprz\u0104\u201e\u02d8g\u0105\u201e\u00e2\u201ao/g, "sprzęgło"],
  [/sprz\u0104\u201e\u02d8g\u0105\u201e\u00e2\u201ao/g, "sprzęgła"],
  [/Rekomendowana \u00e2\u20ac\u201d split/g, "Rekomendowana — split"],
  [/Ă˘â€”/g, "—"],
  // Hydraulika / bufor copy (user-visible)
  [/Wlaczona biwalencja/g, "Włączona biwalencja"],
  [/drugiego zrodla/g, "drugiego źródła"],
  [/pojemnosc bufora/g, "pojemność bufora"],
  [/sposob wpiecia/g, "sposób wpięcia"],
  [
    /Odpowiedzi z tego kroku bezposrednio zmieniaja pojemnosc bufora, potrzebe sprzegla hydraulicznego i sposob wpiecia instalacji\./g,
    "Odpowiedzi z tego kroku bezpośrednio zmieniają pojemność bufora, potrzebę sprzęgła hydraulicznego i sposób wpięcia instalacji.",
  ],
  [/Uzupelnij dane hydrauliki/g, "Uzupełnij dane hydrauliki"],
  [/policzyc bufor/g, "policzyć bufor"],
  [/backendowa rekomendacje/g, "backendową rekomendację"],
  [/odswiezenie kanonicznego/g, "odświeżenie kanonicznego"],
];

let n = 0;
for (const [re, rep] of rules) {
  const next = t.replace(re, rep);
  if (next !== t) {
    const hits = (t.match(re) || []).length;
    n += hits;
    t = next;
  }
}

fs.writeFileSync(target, t, "utf8");
console.log("fix-pl-mojibake: applied rules, total matches (approx):", n);
