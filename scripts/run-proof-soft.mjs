import { execSync } from "child_process";

const runOpts = { stdio: "inherit", cwd: process.cwd(), env: process.env };

let softOk = true;

try {
  execSync('npx playwright test --grep "@soft" --project=chromium-soft', runOpts);
} catch {
  softOk = false;
  console.warn("[proof] soft desktop E2E had failures — see playwright-report/");
}

try {
  execSync('npx playwright test --grep "@mobile" --project=chromium-mobile', runOpts);
} catch {
  softOk = false;
  console.warn("[proof] soft mobile E2E had failures — see playwright-report/");
}

if (softOk) {
  console.log("[proof] soft E2E suites passed");
}

try {
  execSync("node scripts/verify-rest-optional.mjs", runOpts);
} catch {
  // verify-rest-optional always exits 0
}

console.log("[proof] soft tier finished (non-blocking for proof exit code)");
