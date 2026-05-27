import fs from "fs";
import path from "path";

export default async function globalTeardown() {
  const statePath = path.join(process.cwd(), "test-results", "e2e-runtime-state.json");
  if (!fs.existsSync(statePath)) {
    return;
  }

  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as {
      startedBySetup?: boolean;
      keepServerRunning?: boolean;
    };
    if (state.startedBySetup && state.keepServerRunning === false) {
      console.log(
        "[e2e teardown] PLAYWRIGHT_KEEP_RUNTIME=0 — leave runtime management to operator"
      );
    }
  } catch {
    // ignore parse errors
  }
}
