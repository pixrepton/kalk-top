#!/usr/bin/env node
/**
 * Scan kalk-top PHP sources for UTF-8 BOM (EF BB BF).
 * Usage:
 *   node scripts/scan-php-bom.mjs          # report only
 *   node scripts/scan-php-bom.mjs --fix    # rewrite files without BOM
 */

import fs from "fs";
import path from "path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const fix = process.argv.includes("--fix");

const scanRoots = [
  "heatpump-calculator.php",
  path.join("wp-adapter"),
  path.join("core"),
];

const bom = Buffer.from([0xef, 0xbb, 0xbf]);
const hits = [];

function walk(entryPath) {
  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entryPath)) {
      walk(path.join(entryPath, name));
    }
    return;
  }
  if (!entryPath.endsWith(".php")) {
    return;
  }
  const buf = fs.readFileSync(entryPath);
  if (buf.length >= 3 && buf.subarray(0, 3).equals(bom)) {
    hits.push(entryPath);
    if (fix) {
      fs.writeFileSync(entryPath, buf.subarray(3));
    }
  }
}

for (const rel of scanRoots) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    continue;
  }
  walk(abs);
}

if (hits.length === 0) {
  console.log("[scan-php-bom] OK — no UTF-8 BOM in scanned PHP files");
  process.exit(0);
}

console.log(`[scan-php-bom] found ${hits.length} file(s) with BOM:`);
for (const file of hits) {
  console.log(`  ${path.relative(repoRoot, file)}`);
}

if (!fix) {
  console.log("[scan-php-bom] re-run with --fix to strip BOM");
  process.exit(1);
}

console.log("[scan-php-bom] BOM stripped from listed files");
process.exit(0);
