(function (global) {
  'use strict';

  function createTraceId() {
    if (typeof global.crypto !== 'undefined' && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return (
      'trace-' +
      Date.now().toString(16) +
      '-' +
      Math.floor(Math.random() * 1e9).toString(16)
    );
  }

  function ensureTraceId(value) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    return createTraceId();
  }

  global.createTraceId = global.createTraceId || createTraceId;
  global.ensureTraceId = global.ensureTraceId || ensureTraceId;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createTraceId, ensureTraceId };
  }
})(typeof window !== 'undefined' ? window : globalThis);

