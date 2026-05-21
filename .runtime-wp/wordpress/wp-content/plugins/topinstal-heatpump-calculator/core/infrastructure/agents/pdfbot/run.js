#!/usr/bin/env node

const fs = require('fs');

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Missing input JSON path argument.');
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const input = JSON.parse(raw);
  const params = input.params || {};
  const url = input.url || 'https://www.topinstal.com.pl/pdf/';
  const screenshotPath = input.screenshotPath || 'fail.png';
  const htmlDumpPath = input.htmlDumpPath || 'fail.html';
  const timeoutMs = Number(input.timeoutMs || 120000);

  let playwright;
  try {
    playwright = require('playwright');
  } catch (error) {
    throw new Error('Missing `playwright` package. Install with `npm i playwright`.');
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForSelector('form#generatorForm', { timeout: 20000 });

    const pumpKw = String(params.pumpKw || '7');
    await page.check(`input[name="power_kw"][value="${pumpKw}"]`);

    const outputFormat = params.output || 'pdf';
    await page.check(`input[name="output_format"][value="${outputFormat}"]`);

    const hasCwu = params.cwuLiters !== null && params.cwuLiters !== undefined;
    if (hasCwu) {
      await ensureChecked(page, '#has_cwu', true);
      await selectClosestOption(page, 'select#tank_capacity', String(params.cwuLiters));
      const producer = params.cwuProducer ? String(params.cwuProducer) : 'THERMATEC';
      await page.selectOption('select#tank-manufacturer-select', producer);
    } else {
      await ensureChecked(page, '#has_cwu', false);
    }

    const hasBuffer = Boolean(params.bufferEnabled);
    if (hasBuffer) {
      await ensureChecked(page, '#has_buffer', true);
      if (params.bufferLiters !== null && params.bufferLiters !== undefined) {
        const value = String(params.bufferLiters);
        await selectClosestOption(page, 'select#buffer_capacity', value);
      }
    } else {
      await ensureChecked(page, '#has_buffer', false);
    }

    await waitForKitModelReady(page, timeoutMs);
    await selectRequiredKitModel(page, 'select#kit_model', params.kitModel ? String(params.kitModel) : null);

    await page.click('button#generateBtn');

    await page.waitForFunction(() => {
      const results = document.querySelector('#results');
      const link = document.querySelector('a#downloadLink');
      if (!results || !link) return false;
      const style = window.getComputedStyle(results);
      const href = (link.getAttribute('href') || '').trim();
      return style.display !== 'none' && href !== '' && href !== '#';
    }, { timeout: timeoutMs });

    const downloadLink = await page.getAttribute('a#downloadLink', 'href');
    const customPrice = await page.inputValue('input#custom_price').catch(() => '');
    const resultText = await page.textContent('#resultText').catch(() => '');

    const payload = {
      ok: true,
      pdf_url: downloadLink || '',
      generator_price_brutto: parsePrice(customPrice),
      filename: (downloadLink || '').split('/').pop() || '',
      resultText: resultText ? resultText.trim() : '',
    };

    console.log(JSON.stringify(payload));
  } catch (error) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    const html = await page.content().catch(() => '');
    if (html) {
      fs.writeFileSync(htmlDumpPath, html, 'utf8');
    }
    const errorText = await page.textContent('#errorText').catch(() => '');
    const errorMessage = errorText && errorText.trim() ? `${error.message} | ${errorText.trim()}` : error.message;
    console.log(JSON.stringify({ ok: false, error: errorMessage, screenshot: screenshotPath, htmlDump: htmlDumpPath }));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

async function ensureChecked(page, selector, desired) {
  const isChecked = await page.isChecked(selector).catch(() => false);
  if (desired && !isChecked) {
    await page.check(selector);
  }
  if (!desired && isChecked) {
    await page.uncheck(selector);
  }
}

async function selectIfExists(page, selector, value) {
  const exists = await page.$(selector);
  if (!exists) return;

  const options = await page.$$eval(`${selector} option`, list => list.map(o => o.value));
  if (options.includes(value)) {
    await page.selectOption(selector, value);
  }
}

async function waitForKitModelReady(page, timeoutMs) {
  await page.waitForSelector('select#kit_model', { timeout: Math.min(timeoutMs, 30000) });
  await page.waitForFunction(() => {
    const loading = document.querySelector('#kit-loading');
    const select = document.querySelector('select#kit_model');
    if (!select) return false;
    const options = select.querySelectorAll('option');
    const loadingHidden = !loading || window.getComputedStyle(loading).display === 'none';
    return loadingHidden && options.length > 1;
  }, { timeout: timeoutMs });
}

async function selectRequiredKitModel(page, selector, requestedValue) {
  const options = await page.$$eval(`${selector} option`, list =>
    list.map(o => ({ value: o.value, disabled: o.disabled, text: (o.textContent || '').trim() }))
  );
  if (!options.length) {
    throw new Error('Brak opcji #kit_model.');
  }

  const valid = options.filter(o => !o.disabled && String(o.value || '').trim() !== '');
  if (!valid.length) {
    throw new Error('Brak poprawnej opcji #kit_model.');
  }

  let selected = null;
  if (requestedValue) {
    const requested = valid.find(o => o.value === requestedValue);
    if (requested) {
      selected = requested.value;
    }
  }
  if (!selected) {
    selected = valid[0].value;
  }
  await page.selectOption(selector, selected);
}

async function selectClosestOption(page, selector, desired) {
  const options = await page.$$eval(`${selector} option`, list => list.map(o => o.value));
  if (!options.length) return;

  if (options.includes(desired)) {
    await page.selectOption(selector, desired);
    return;
  }

  const desiredNum = Number(String(desired).replace(',', '.'));
  if (Number.isNaN(desiredNum)) {
    await page.selectOption(selector, options[0]);
    return;
  }

  let best = options[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const option of options) {
    const raw = String(option).split('-')[0];
    const num = Number(raw.replace(',', '.'));
    if (Number.isNaN(num)) continue;
    const diff = Math.abs(num - desiredNum);
    if (diff < bestDiff) {
      best = option;
      bestDiff = diff;
    }
  }

  await page.selectOption(selector, best);
}

function parsePrice(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

main().catch(error => {
  console.log(JSON.stringify({ ok: false, error: error.message || String(error) }));
  process.exit(1);
});
