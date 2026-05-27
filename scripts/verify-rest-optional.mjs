import { execSync } from "child_process";

if (!process.env.TOPINSTAL_REST_BASE_URL) {
  console.log("[verify:ui:soft] skipping test:rest (TOPINSTAL_REST_BASE_URL not set)");
  process.exit(0);
}

try {
  execSync("npm run test:rest", { stdio: "inherit" });
} catch (error) {
  console.warn("[verify:ui:soft] test:rest failed — soft tier only");
  process.exit(0);
}
