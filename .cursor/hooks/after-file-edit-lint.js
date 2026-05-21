/**
 * afterFileEdit — fast syntax checks for kalk-top PHP/JS on canonical paths.
 * Fails open if php/node missing.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    process.stdout.write("{}\n");
    return;
  }

  const filePath = String(payload.file_path || payload.path || "").trim();
  const roots = Array.isArray(payload.workspace_roots) ? payload.workspace_roots : [];
  const root = roots[0] ? path.resolve(roots[0]) : process.cwd();

  if (!filePath) {
    process.stdout.write("{}\n");
    return;
  }

  const abs = path.resolve(filePath);
  const rootResolved = path.resolve(root);
  const absLow = abs.toLowerCase();
  const rootLow = rootResolved.toLowerCase();
  if (absLow !== rootLow && !absLow.startsWith(rootLow + path.sep)) {
    process.stdout.write("{}\n");
    return;
  }

  const norm = filePath.replace(/\\/g, "/");
  let extra = "";
  const relNorm = path.relative(root, abs).replace(/\\/g, "/");

  const touchesAgentGovernance =
    relNorm === "AGENTS.md" ||
    relNorm === "LOCAL_WORKSPACE_RULES.md" ||
    relNorm.startsWith("memory-bank/") ||
    relNorm.startsWith(".cursor/rules/") ||
    relNorm.startsWith(".cursor/hooks/") ||
    relNorm.startsWith(".cursor/mcp.json") ||
    relNorm === ".cursor/mcp.json" ||
    relNorm.startsWith(".agents/SKILL_ROUTER.md") ||
    relNorm === ".agents/SKILL_ROUTER.md" ||
    relNorm.startsWith("docs/dev/KALK_TOP_");

  if (touchesAgentGovernance) {
    const preflight = path.join(root, "scripts", "agent-harness-preflight.mjs");
    if (fs.existsSync(preflight)) {
      const r = spawnSync("node", [preflight], {
        cwd: root,
        encoding: "utf8",
        timeout: 15000,
        maxBuffer: 2 * 1024 * 1024,
      });
      if (!r.error && r.status !== 0) {
        extra = `Agent harness preflight failed after editing ${relNorm}:\n${(r.stdout || r.stderr || "").slice(0, 6000)}`;
      }
    }
  }

  if (filePath.endsWith(".php")) {
    const inCanonicalPhp =
      norm.includes("/core/") ||
      norm.includes("/wp-adapter/") ||
      norm.includes("/kalkulator/");
    if (inCanonicalPhp) {
      const r = spawnSync("php", ["-l", abs], {
        encoding: "utf8",
        timeout: 20000,
        maxBuffer: 2 * 1024 * 1024,
      });
      if (r.error) {
        process.stdout.write("{}\n");
        return;
      }
      if (r.status !== 0) {
        extra = `php -l failed (${relNorm}):\n${(r.stderr || r.stdout || "").slice(0, 6000)}`;
      }
    }
  }

  if (filePath.endsWith(".js")) {
    const inCanonicalJs =
      norm.includes("/kalkulator/js/") ||
      norm.includes("/frontend/") ||
      norm.includes("/konfigurator/");
    if (inCanonicalJs) {
      const r = spawnSync("node", ["--check", abs], {
        encoding: "utf8",
        timeout: 20000,
        maxBuffer: 2 * 1024 * 1024,
      });
      if (r.error) {
        process.stdout.write("{}\n");
        return;
      }
      if (r.status !== 0) {
        extra = `node --check failed (${relNorm}):\n${(r.stderr || r.stdout || "").slice(0, 6000)}`;
      }
    }
  }

  if (extra) {
    process.stdout.write(JSON.stringify({ additional_context: extra }) + "\n");
    return;
  }

  process.stdout.write("{}\n");
});
