#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const CONFIGURATOR_PATH = path.join(ROOT, 'konfigurator', 'configurator-unified.js');
const ENGINEERING_POLICY_PATH = path.join(ROOT, 'core', 'infrastructure', 'master-data', 'engineering-policy.json');

function stripBom(raw) {
  return typeof raw === 'string' && raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function extractFunctionBody(source, signaturePattern) {
  const match = signaturePattern.exec(source);
  if (!match || typeof match.index !== 'number') {
    throw new Error('Unable to locate canonical JS CWU function.');
  }

  const start = source.indexOf('{', match.index);
  if (start === -1) {
    throw new Error('Unable to locate CWU function opening brace.');
  }

  let depth = 0;
  let end = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error('Unable to locate CWU function closing brace.');
  }

  return source.slice(start + 1, end);
}

function buildResolveIntegratedCwuLabel() {
  return function resolveIntegratedCwuLabel(selectedPump, pumpTable) {
    if (!selectedPump || typeof selectedPump !== 'object') return null;
    const oid = selectedPump.optionId || '';
    const isAio =
      selectedPump.type === 'aio' ||
      selectedPump.type === 'all-in-one' ||
      (typeof oid === 'string' && oid.indexOf('aio') !== -1);
    if (!isAio) return null;

    const model = selectedPump.model || null;
    let tankLiters = null;
    if (model && pumpTable && pumpTable[model] && pumpTable[model].cwu_tank != null) {
      tankLiters = pumpTable[model].cwu_tank;
    }
    if (tankLiters == null && selectedPump.cwu_tank != null) {
      tankLiters = selectedPump.cwu_tank;
    }
    const n = Number(tankLiters);
    if (Number.isFinite(n) && n > 0) {
      return `Zintegrowany ${Math.round(n)} l`;
    }
    return 'Zintegrowany zbiornik CWU (w zestawie)';
  };
}

async function main() {
  const rawInput = await readStdin();
  const parsed = rawInput.trim() !== '' ? JSON.parse(rawInput) : {};
  const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];

  const configuratorSource = stripBom(fs.readFileSync(CONFIGURATOR_PATH, 'utf8'));
  const engineeringPolicy = JSON.parse(stripBom(fs.readFileSync(ENGINEERING_POLICY_PATH, 'utf8')));
  const body = extractFunctionBody(configuratorSource, /cwu\(state\)\s*\{/);

  const cwuFn = new Function(
    'state',
    'deps',
    `
      const resolveIntegratedCwuLabel = deps.resolveIntegratedCwuLabel;
      const getBufferRules = deps.getBufferRules;
      const pumpMatchingTable = deps.pumpMatchingTable || {};
      ${body}
    `
  );

  const resolveIntegratedCwuLabel = buildResolveIntegratedCwuLabel();
  const results = scenarios.map((scenario) => {
    const state = {
      meta: scenario.meta || {},
      selectedPump: scenario.selectedPump || {},
    };
    const result = cwuFn(state, {
      resolveIntegratedCwuLabel,
      getBufferRules: () => engineeringPolicy,
      pumpMatchingTable: scenario.pumpMatchingTable || {},
    });
    return {
      name: scenario.name || 'unnamed',
      result,
    };
  });

  process.stdout.write(JSON.stringify({ results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
