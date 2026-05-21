(function (global) {
  'use strict';

  function getConfig() {
    return global.HEATPUMP_CONFIG || {};
  }

  function resolveNonce(options) {
    if (options && typeof options.nonce === 'string' && options.nonce.trim() !== '') {
      return options.nonce.trim();
    }
    const configNonce = getConfig().nonce;
    return typeof configNonce === 'string' ? configNonce : '';
  }

  function resolveWpNonce(options) {
    if (options && typeof options.wpNonce === 'string' && options.wpNonce.trim() !== '') {
      return options.wpNonce.trim();
    }
    const configWpNonce = getConfig().restNonce;
    return typeof configWpNonce === 'string' ? configWpNonce : '';
  }

  function isTruthyFlag(value) {
    if (value === true || value === 1) {
      return true;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
    }
    return false;
  }

  function shouldIncludeWpNonce(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'includeWpNonce')) {
      return isTruthyFlag(options.includeWpNonce);
    }
    return isTruthyFlag(getConfig().restCookieAuthEnabled);
  }

  function resolveTimeout(options) {
    const fromOptions = options && Number(options.timeoutMs);
    if (Number.isFinite(fromOptions) && fromOptions > 0) return fromOptions;
    const fromConfig = Number(getConfig().calculateOfferTimeoutMs);
    if (Number.isFinite(fromConfig) && fromConfig > 0) return fromConfig;
    return 15000;
  }

  function resolveOfferDocumentTimeout(options) {
    const fromOptions = options && Number(options.timeoutMs);
    if (Number.isFinite(fromOptions) && fromOptions > 0) return fromOptions;
    const fromConfig = Number(getConfig().offerDocumentTimeoutMs);
    if (Number.isFinite(fromConfig) && fromConfig > 0) return fromConfig;
    return 150000;
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

  async function parseJsonResponse(response) {
    const text = await response.text().catch(function () {
      return '';
    });
    const normalized = typeof text === 'string' ? text.replace(/^\uFEFF+/, '').trim() : '';
    if (!normalized) {
      return null;
    }
    try {
      return JSON.parse(normalized);
    } catch (_) {
      return null;
    }
  }

  /**
   * Wyciąga pola błędu z odpowiedzi generatora PDF (WordPress / generator — różne kształty).
   */
  function extractOfferDocumentErrorFields(source) {
    if (!source || typeof source !== 'object') {
      return { message: '', errorCode: null, traceId: null, details: null };
    }
    var message =
      (typeof source.message === 'string' && source.message) ||
      (typeof source.error === 'string' && source.error) ||
      (typeof source.reason === 'string' && source.reason) ||
      '';
    var errorCode =
      source.errorCode != null
        ? source.errorCode
        : source.code != null
          ? source.code
          : source.error_code != null
            ? source.error_code
            : null;
    var traceId =
      source.traceId != null
        ? source.traceId
        : source.trace_id != null
          ? source.trace_id
          : null;
    var details =
      source.details && typeof source.details === 'object'
        ? source.details
        : null;
    return { message: message || '', errorCode: errorCode, traceId: traceId, details: details };
  }

  function buildOfferDocumentErrorMessage(fields, httpStatus) {
    var parts = [];
    if (fields.message) {
      parts.push(String(fields.message));
    } else {
      parts.push('Nie udało się wygenerować dokumentu PDF oferty.');
    }
    if (fields.errorCode != null && fields.errorCode !== '') {
      parts.push('Kod: ' + String(fields.errorCode));
    }
    if (fields.traceId != null && fields.traceId !== '') {
      parts.push('Trace: ' + String(fields.traceId));
    }
    if (!fields.message && httpStatus) {
      parts.push('HTTP ' + String(httpStatus));
    }
    return parts.join(' ');
  }

  async function calculateOffer(dto, options) {
    const opts = options || {};
    const endpoint =
      opts.endpoint ||
      getConfig().calculateOfferEndpoint ||
      '/wp-json/topinstal/v1/calculate-offer';
    const timeoutMs = resolveTimeout(opts);
    const retryCount = Number.isFinite(Number(opts.retryCount)) ? Number(opts.retryCount) : 1;
    const nonce = resolveNonce(opts);
    const wpNonce = resolveWpNonce(opts);
    const payload = Object.assign({}, dto || {});
    if (typeof global.ensureTraceId === 'function') {
      payload.traceId = global.ensureTraceId(payload.traceId);
    }

    const headers = {
      'Content-Type': 'application/json',
    };
    if (nonce) {
      headers['X-Topinstal-Nonce'] = nonce;
    }
    if (wpNonce && shouldIncludeWpNonce(opts)) {
      // Logged-in REST requests need a real wp_rest nonce so WordPress keeps the
      // cookie-authenticated user context before our controller verifies the custom nonce.
      headers['X-WP-Nonce'] = wpNonce;
    }

    let lastError = null;
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
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

        const data = await parseJsonResponse(response);

        if (!response.ok) {
          const error = new Error('calculate-offer request failed');
          error.status = response.status;
          error.data = data;
          throw error;
        }

        return data;
      } catch (error) {
        lastError = error;
        const canRetry = attempt < retryCount && (!error.status || error.status >= 500);
        if (!canRetry) {
          break;
        }
      }
    }

    throw lastError || new Error('calculate-offer request failed');
  }

  async function generateOfferDocument(payload, options) {
    const opts = options || {};
    const endpoint =
      opts.endpoint ||
      getConfig().offerDocumentEndpoint ||
      getConfig().ajaxUrl ||
      '/wp-admin/admin-ajax.php';
    const action =
      opts.action ||
      getConfig().offerDocumentAction ||
      'heatpump_generate_offer_document';
    const timeoutMs = resolveOfferDocumentTimeout(opts);
    const nonce = resolveNonce(opts);
    const wpNonce = resolveWpNonce(opts);
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    };

    if (nonce) {
      headers['X-Topinstal-Nonce'] = nonce;
    }
    if (wpNonce && shouldIncludeWpNonce(opts)) {
      headers['X-WP-Nonce'] = wpNonce;
    }

    const requestPayload = Object.assign({}, payload || {});
    if (
      requestPayload.offerDto &&
      typeof global.ensureTraceId === 'function'
    ) {
      requestPayload.traceId = global.ensureTraceId(
        requestPayload.traceId || requestPayload.offerDto.traceId
      );
    }

    const body = new URLSearchParams();
    body.set('action', action);
    if (nonce) {
      body.set('nonce', nonce);
    }
    body.set('payload', JSON.stringify(requestPayload));

    const response = await fetchWithTimeout(
      String(endpoint),
      {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: body.toString(),
      },
      timeoutMs
    );

    const data = await parseJsonResponse(response);
    const normalizedData =
      data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'data')
        ? data.data
        : data;

    if (!response.ok || (data && data.success === false)) {
      var rawPayload = normalizedData != null ? normalizedData : data;
      var fields = extractOfferDocumentErrorFields(
        typeof rawPayload === 'object' && rawPayload ? rawPayload : {}
      );
      var err = new Error(buildOfferDocumentErrorMessage(fields, response.status));
      err.status = response.status;
      err.data = data;
      err.errorCode = fields.errorCode;
      err.traceId = fields.traceId;
      err.details = fields.details;
      throw err;
    }

    return normalizedData || null;
  }

  global.topinstalApi = global.topinstalApi || {};
  global.topinstalApi.calculateOffer = calculateOffer;
  global.topinstalApi.generateOfferDocument = generateOfferDocument;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      calculateOffer: calculateOffer,
      generateOfferDocument: generateOfferDocument,
      extractOfferDocumentErrorFields: extractOfferDocumentErrorFields,
      buildOfferDocumentErrorMessage: buildOfferDocumentErrorMessage,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
