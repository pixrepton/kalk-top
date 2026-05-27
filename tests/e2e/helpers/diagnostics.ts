import fs from "fs";
import path from "path";
import { expect, type Page } from "@playwright/test";

const CONSOLE_ERRORS_PATH = path.join(process.cwd(), "test-results", "console-errors.json");

const CRITICAL_CONSOLE_PATTERNS = [
  /BŁĄD PIPELINE/i,
  /displayResults failed/i,
  /Invalid backend result/i,
];

const CONSOLE_ALLOWLIST = [
  /speak:\s*none/i,
  /mega-menu/i,
  /elementor/i,
  /jquery\.migrate/i,
  /favicon/i,
  /Failed to load resource.*\.woff/i,
];

export type DiagnosticHandlers = {
  consoleErrors: string[];
  assertCriticalConsoleBudget: () => void;
  writeConsoleErrorsReport: () => void;
};

export function attachDiagnosticHandlers(page: Page): DiagnosticHandlers {
  const consoleErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (CONSOLE_ALLOWLIST.some((pattern) => pattern.test(text))) return;
    consoleErrors.push(text);
  });

  const assertCriticalConsoleBudget = () => {
    const critical = consoleErrors.filter((line) =>
      CRITICAL_CONSOLE_PATTERNS.some((pattern) => pattern.test(line))
    );
    expect(critical, `critical console errors: ${critical.join(" | ")}`).toEqual([]);
  };

  const writeConsoleErrorsReport = () => {
    if (consoleErrors.length === 0) return;
    fs.mkdirSync(path.dirname(CONSOLE_ERRORS_PATH), { recursive: true });
    fs.writeFileSync(
      CONSOLE_ERRORS_PATH,
      JSON.stringify({ capturedAt: new Date().toISOString(), consoleErrors }, null, 2),
      "utf8"
    );
  };

  return { consoleErrors, assertCriticalConsoleBudget, writeConsoleErrorsReport };
}
