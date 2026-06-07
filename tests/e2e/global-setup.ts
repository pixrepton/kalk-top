import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8091";
const calculatorPath = process.env.PLAYWRIGHT_CALCULATOR_PATH || "/?page_id=5";
const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "test-results", "e2e-runtime-state.json");

function parsePort(url: string): number {
  try {
    const parsed = new URL(url);
    return parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return 8091;
  }
}

async function isPortListening(port: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function healthcheckCalculator(): Promise<void> {
  const url = new URL(calculatorPath, baseURL).toString();
  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`E2E healthcheck failed: GET ${url} -> HTTP ${response.status}`);
  }
  const html = await response.text();
  if (!html.includes("heatCalcFormFull") && !html.includes('id="heatCalcFormFull"')) {
    throw new Error(
      `E2E healthcheck failed: calculator form not found in HTML from ${url}`
    );
  }
}

function configureRuntimeWp(port: number) {
  execSync("php scripts/configure-runtime-wp.php", {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      KALK_TOP_RUNTIME_PORT: String(port),
      KALK_TOP_RUNTIME_BASE_URL: baseURL,
    },
  });
}

export default async function globalSetup() {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  const port = parsePort(baseURL);
  const wasListening = await isPortListening(port);
  let startedBySetup = false;

  if (!wasListening) {
    execSync("npm run runtime:sync", {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        KALK_TOP_RUNTIME_PORT: String(port),
        KALK_TOP_RUNTIME_BASE_URL: baseURL,
      },
    });
    execSync("npm run runtime:start", {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        KALK_TOP_RUNTIME_PORT: String(port),
        KALK_TOP_RUNTIME_BASE_URL: baseURL,
      },
    });
    startedBySetup = true;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  try {
    await healthcheckCalculator();
  } catch (firstError) {
    configureRuntimeWp(port);
    try {
      await healthcheckCalculator();
    } catch {
      throw firstError;
    }
  }

  fs.writeFileSync(
    statePath,
    JSON.stringify(
      {
        baseURL,
        calculatorPath,
        port,
        startedBySetup,
        keepServerRunning: process.env.PLAYWRIGHT_KEEP_RUNTIME !== "0",
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `[e2e setup] runtime ready at ${baseURL}${calculatorPath} (startedBySetup=${startedBySetup})`
  );
}
