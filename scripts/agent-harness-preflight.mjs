#!/usr/bin/env node
/**
 * Lightweight agent harness preflight for kalk-top.
 * Exit 0 = OK, 1 = missing or misconfigured harness files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function mustExist(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) errors.push(`Missing: ${rel}`);
}

mustExist("AGENTS.md");
mustExist("LOCAL_WORKSPACE_RULES.md");
mustExist(".agents/SKILL_ROUTER.md");
mustExist(".cursor/rules/00-kalk-top-core-router.mdc");
mustExist("docs/dev/KALK_TOP_AGENT_HARNESS.md");

const mcpPath = path.join(root, ".cursor", "mcp.json");
if (!fs.existsSync(mcpPath)) {
  errors.push("Missing: .cursor/mcp.json");
} else {
  try {
    const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    const servers = mcp.mcpServers || {};
    if (!servers["kalk-top-repo-assistant"]) {
      errors.push("mcp.json: kalk-top-repo-assistant not registered");
    }
    if (servers["framer-motion"] || servers["gsap-animation"]) {
      errors.push("mcp.json: remove framer-motion/gsap-animation from project MCP (use npm run mcp:* instead)");
    }
  } catch (e) {
    errors.push(`mcp.json parse error: ${e.message}`);
  }
}

const rulesDir = path.join(root, ".cursor", "rules");
if (fs.existsSync(rulesDir)) {
  for (const name of fs.readdirSync(rulesDir)) {
    if (!name.endsWith(".mdc")) continue;
    const text = fs.readFileSync(path.join(rulesDir, name), "utf8");
    if (name !== "00-kalk-top-core-router.mdc" && /alwaysApply:\s*true/.test(text)) {
      errors.push(`Rule ${name} has alwaysApply:true (only 00-kalk-top-core-router should)`);
    }
  }
}

if (errors.length) {
  console.error("[agent-harness-preflight] FAIL\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log("[agent-harness-preflight] OK");
process.exit(0);
