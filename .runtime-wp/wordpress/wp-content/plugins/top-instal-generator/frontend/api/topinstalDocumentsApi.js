(function (global) {
  'use strict';

  function getConfig() {
    return global.topInstalApiConfig || global.topInstal || {};
  }

  function resolveTimeout(options) {
    const fromOptions = Number(options && options.timeoutMs);
    if (Number.isFinite(fromOptions) && fromOptions > 0) return fromOptions;
    const fromConfig = Number(getConfig().documentsTimeoutMs);
    if (Number.isFinite(fromConfig) && fromConfig > 0) return fromConfig;
    return 20000;
  }

  async function fetchWithTimeout(url, init, timeoutMs) {
    if (typeof AbortController === 'undefined') {
      return fetch(url, init);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function generateOfferDocument(dto, options) {
    const opts = options || {};
    const config = getConfig();
    const endpoint =
      opts.endpoint ||
      config.offerDocumentsEndpoint ||
      '/wp-json/topinstal/v1/offer-documents/generate';
    const timeoutMs = resolveTimeout(opts);
    const nonce = opts.nonce || config.nonce || '';
    const agentKey = opts.agentKey || '';
    const payload = Object.assign({}, dto || {});

    if (typeof global.ensureTraceId === 'function') {
      payload.traceId = global.ensureTraceId(payload.traceId);
    } else if (!payload.traceId && typeof global.createTraceId === 'function') {
      payload.traceId = global.createTraceId();
    }

    const headers = {
      'Content-Type': 'application/json',
    };
    if (nonce) {
      headers['X-Topinstal-Nonce'] = nonce;
    }
    if (agentKey) {
      headers['X-Top-Instal-Agent-Key'] = agentKey;
    }

    const response = await fetchWithTimeout(
      String(endpoint),
      {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      },
      timeoutMs
    );

    const data = await response.json().catch(function () {
      return null;
    });
    if (!response.ok) {
      const error = new Error('offer-documents/generate request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  global.topinstalDocumentsApi = global.topinstalDocumentsApi || {};
  global.topinstalDocumentsApi.generateOfferDocument = generateOfferDocument;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateOfferDocument };
  }
})(typeof window !== 'undefined' ? window : globalThis);

