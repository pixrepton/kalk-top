(function (global) {
  "use strict";

  const SESSION_STORAGE_KEY = "ti_calc_session_id";
  const QUEUE_STORAGE_KEY = "ti_calc_track_queue_v1";
  const ONCE_STORAGE_KEY = "ti_calc_once_flags_v1";

  function isDev() {
    try {
      if (global.__HP_DEBUG__ === true) return true;
      if (global.location && /(?:\?|&)hp_debug=1\b/.test(global.location.search || "")) {
        return true;
      }
    } catch (_) { }
    return false;
  }

  function safeJsonParse(input, fallback) {
    try {
      const parsed = JSON.parse(input);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }

  function getStorage() {
    try {
      if (global.localStorage) return global.localStorage;
    } catch (_) { }
    return null;
  }

  function uuidV4() {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === "function") {
        return global.crypto.randomUUID();
      }
    } catch (_) { }
    const tpl = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    return tpl.replace(/[xy]/g, function (char) {
      const random = Math.floor(Math.random() * 16);
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function getOrCreateSessionId() {
    const storage = getStorage();
    if (!storage) return uuidV4();
    const existing = String(storage.getItem(SESSION_STORAGE_KEY) || "").trim();
    if (existing) return existing;
    const created = uuidV4();
    storage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  }

  function pushDataLayer(payload) {
    try {
      if (!Array.isArray(global.dataLayer)) {
        global.dataLayer = [];
      }
      global.dataLayer.push(payload);
    } catch (_) { }
  }

  function createEmitter(ctx) {
    const root = ctx?.root || null;
    const state = ctx?.state || {};
    const cfg = global.HEATPUMP_CONFIG || {};
    const endpoint = typeof cfg.trackEventEndpoint === "string" ? cfg.trackEventEndpoint : cfg.ajaxUrl;
    const action = typeof cfg.trackEventAction === "string" ? cfg.trackEventAction : "heatpump_track_event";
    const nonce = typeof cfg.nonce === "string" ? cfg.nonce : "";
    const batchSize = Number.isFinite(Number(cfg.trackEventBatchSize)) ? Math.max(1, Number(cfg.trackEventBatchSize)) : 10;
    const flushMs = Number.isFinite(Number(cfg.trackEventFlushMs)) ? Math.max(500, Number(cfg.trackEventFlushMs)) : 5000;

    const runtimeOnce = new Set();
    const throttleMap = new Map();
    const onceFlags = safeJsonParse(getStorage()?.getItem(ONCE_STORAGE_KEY) || "{}", {});

    let queue = safeJsonParse(getStorage()?.getItem(QUEUE_STORAGE_KEY) || "[]", []);
    if (!Array.isArray(queue)) queue = [];
    let flushTimer = null;
    let flushing = false;

    function readState() {
      try {
        if (typeof state.getAppState === "function") return state.getAppState() || {};
        if (typeof global.getAppState === "function") return global.getAppState() || {};
      } catch (_) { }
      return {};
    }

    function isStrictBackendMode() {
      const runtimeCfg = global.HEATPUMP_CONFIG || {};
      return runtimeCfg.useBackendCalc === true;
    }

    function getCanonicalOffer(appState) {
      try {
        if (typeof state.getCanonicalOffer === "function") {
          const fromState = state.getCanonicalOffer(appState);
          if (fromState) return fromState;
        }
      } catch (_) { }
      try {
        if (typeof global.getCanonicalOffer === "function") {
          const fromGlobal = global.getCanonicalOffer(appState);
          if (fromGlobal) return fromGlobal;
        }
      } catch (_) { }
      return appState?.canonicalOffer || appState?.offer || null;
    }

    function currentTab() {
      const appState = readState();
      if (Number.isFinite(Number(appState?.currentTab))) {
        return Number(appState.currentTab);
      }
      if (Number.isFinite(Number(global.currentTab))) {
        return Number(global.currentTab);
      }
      if (root?.querySelector) {
        const activeSection = root.querySelector(".section.active[data-tab]");
        if (activeSection) {
          const tab = Number(activeSection.getAttribute("data-tab"));
          if (Number.isFinite(tab)) return tab;
        }
      }
      return null;
    }

    function resolveTraceId(appState, offer) {
      return (
        offer?.traceId ||
        appState?.canonicalOffer?.traceId ||
        appState?.draftRequest?.traceId ||
        appState?.offer?.traceId ||
        null
      );
    }

    function pullLeadIdFromState(appState) {
      return (
        state?.offerIds?.lead_id ||
        appState?.offerIds?.lead_id ||
        appState?.leadId ||
        null
      );
    }

    function mapLegacyEventName(eventName) {
      const map = {
        session_start: "calc_session_start",
        summary_viewed: "calc_result_view",
        results_view_profil: "calc_result_view",
        results_view_maszynownia: "calc_result_view",
        pdf_generation_started: "pdf_generate_start",
        pdf_generated_success: "pdf_generate_success",
        pdf_download_clicked: "pdf_download_click",
        email_submit_clicked: "lead_submit",
        contact_submit_clicked: "lead_submit",
        crm_lead_upsert_success: "lead_success",
        crm_lead_upsert_error: "lead_error",
        email_sent_success: "lead_success",
        email_sent_error: "lead_error",
        validation_error: "calc_validation_error",
        calc_success: "calc_result_view",
        configurator_offer_ready: "calc_result_view",
      };
      return map[eventName] || eventName;
    }

    function splitKnownFields(input) {
      const payload = input && typeof input === "object" ? { ...input } : {};
      const meta = payload.meta && typeof payload.meta === "object" ? { ...payload.meta } : {};
      delete payload.meta;
      const knownKeys = [
        "sessionId",
        "session_id",
        "leadId",
        "lead_id",
        "traceId",
        "trace_id",
        "source",
        "tab",
        "stepKey",
        "step_key",
        "event",
        "ts",
      ];
      knownKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          delete payload[key];
        }
      });
      return { base: input || {}, meta: { ...meta, ...payload } };
    }

    function normalizePayload(eventName, partial = {}) {
      const appState = readState();
      const offer = getCanonicalOffer(appState);
      const parts = splitKnownFields(partial);
      const sourceRaw = partial?.source || "calc";
      const source = sourceRaw === "configurator" ? "configurator" : "calc";
      const sessionId = String(partial?.sessionId || partial?.session_id || getOrCreateSessionId());
      const leadId = partial?.leadId || partial?.lead_id || pullLeadIdFromState(appState) || null;
      const traceId = partial?.traceId || partial?.trace_id || resolveTraceId(appState, offer) || null;
      const tab = Number.isFinite(Number(partial?.tab)) ? Number(partial.tab) : currentTab();
      const stepKey = partial?.stepKey || partial?.step_key || null;
      const ts = Number.isFinite(Number(partial?.ts)) ? Number(partial.ts) : Date.now();

      return {
        sessionId,
        leadId,
        ts,
        source,
        event: eventName,
        tab: Number.isFinite(Number(tab)) ? Number(tab) : null,
        stepKey: stepKey ? String(stepKey) : null,
        traceId: traceId ? String(traceId) : null,
        meta: parts.meta || {},
      };
    }

    function saveQueue() {
      const storage = getStorage();
      if (!storage) return;
      try {
        storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-500)));
      } catch (_) { }
    }

    function saveOnceFlags() {
      const storage = getStorage();
      if (!storage) return;
      try {
        const entries = Object.entries(onceFlags)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, 500);
        const compact = {};
        entries.forEach(([key, value]) => {
          compact[key] = value;
        });
        storage.setItem(ONCE_STORAGE_KEY, JSON.stringify(compact));
      } catch (_) { }
    }

    function dedupeKey(payload) {
      const eventName = payload.event;
      const dayKey = new Date(payload.ts).toISOString().slice(0, 10);
      if (eventName === "calc_session_start") {
        return `once:${eventName}:${payload.sessionId}`;
      }
      if (eventName === "calc_result_view") {
        if (payload.traceId) {
          return `once:${eventName}:trace:${payload.traceId}`;
        }
        return `once:${eventName}:session:${payload.sessionId}:${dayKey}`;
      }
      if (eventName === "pdf_generate_success") {
        const type = payload?.meta?.type || "default";
        const ref = payload.traceId || payload.sessionId;
        return `once:${eventName}:${ref}:${type}`;
      }
      if (eventName === "lead_success") {
        if (!payload.leadId) return null;
        return `once:${eventName}:${payload.leadId}`;
      }
      return null;
    }

    function shouldThrottle(payload) {
      if (payload.event !== "calc_tab_view") return false;
      const key = `throttle:${payload.sessionId}:tab:${payload.tab}`;
      const now = Date.now();
      const previous = throttleMap.get(key) || 0;
      if (now - previous < 5000) {
        return true;
      }
      throttleMap.set(key, now);
      return false;
    }

    function shouldEmit(payload) {
      if (shouldThrottle(payload)) {
        return false;
      }
      const key = dedupeKey(payload);
      if (!key) {
        return true;
      }
      if (runtimeOnce.has(key)) {
        return false;
      }
      if (onceFlags[key]) {
        return false;
      }
      runtimeOnce.add(key);
      onceFlags[key] = Date.now();
      saveOnceFlags();
      return true;
    }

    function scheduleFlush() {
      if (flushTimer) return;
      flushTimer = global.setTimeout(() => {
        flushTimer = null;
        flush();
      }, flushMs);
    }

    async function parseJsonResponse(response) {
      const text = await response.text().catch(() => "");
      const normalized = typeof text === "string" ? text.replace(/^\uFEFF+/, "").trim() : "";
      if (!normalized) {
        return null;
      }
      try {
        return JSON.parse(normalized);
      } catch (_) {
        return null;
      }
    }

    async function sendBatch(batch) {
      if (!endpoint || !batch.length) return false;
      const form = new FormData();
      form.append("action", action);
      if (nonce) form.append("nonce", nonce);
      form.append("events", JSON.stringify(batch));

      const response = await fetch(String(endpoint), {
        method: "POST",
        credentials: "same-origin",
        headers: nonce ? { "X-Topinstal-Nonce": nonce } : undefined,
        body: form,
      });
      const json = await parseJsonResponse(response);
      return !!(response.ok && json && json.success === true);
    }

    async function flush() {
      if (flushing || queue.length === 0) return;
      if (!endpoint || !nonce) return;
      if (global.navigator && global.navigator.onLine === false) return;

      flushing = true;
      const batch = queue.slice(0, batchSize);
      try {
        const ok = await sendBatch(batch);
        if (!ok) return;
        queue.splice(0, batch.length);
        saveQueue();
      } catch (error) {
        if (isDev()) {
          // eslint-disable-next-line no-console
          console.warn("[HP][analytics] flush failed", error);
        }
      } finally {
        flushing = false;
        if (queue.length > 0) scheduleFlush();
      }
    }

    function flushWithBeacon() {
      if (!queue.length || !endpoint || !nonce) return;
      if (!global.navigator || typeof global.navigator.sendBeacon !== "function") return;
      const batch = queue.slice(0, batchSize);
      const params = new URLSearchParams();
      params.append("action", action);
      params.append("nonce", nonce);
      params.append("events", JSON.stringify(batch));
      const sent = global.navigator.sendBeacon(String(endpoint), params);
      if (sent) {
        queue.splice(0, batch.length);
        saveQueue();
      }
    }

    function track(eventName, partial = {}) {
      const normalizedEvent = mapLegacyEventName(String(eventName || "").trim());
      if (!normalizedEvent) return null;
      const payload = normalizePayload(normalizedEvent, partial || {});
      if (!shouldEmit(payload)) {
        return null;
      }

      pushDataLayer({
        event: payload.event,
        sessionId: payload.sessionId,
        leadId: payload.leadId,
        traceId: payload.traceId,
        source: payload.source,
        tab: payload.tab,
        stepKey: payload.stepKey,
        meta: payload.meta,
        ts: payload.ts,
      });

      queue.push(payload);
      saveQueue();
      if (queue.length >= batchSize) {
        flush();
      } else {
        scheduleFlush();
      }

      try {
        if (root && root.dispatchEvent) {
          root.dispatchEvent(
            new CustomEvent("topinstal:tracked", {
              detail: payload,
              bubbles: true,
            })
          );
        }
      } catch (_) { }

      if (isDev()) {
        // eslint-disable-next-line no-console
        console.debug("[HP][analytics]", payload.event, payload);
      }

      return payload;
    }

    function emit(eventName, params = {}) {
      return track(eventName, params);
    }

    function emitOnce(key, eventName, params = {}) {
      const runtimeKey = String(key || eventName || "");
      if (!runtimeKey) return null;
      if (runtimeOnce.has(`manual:${runtimeKey}`)) {
        return null;
      }
      runtimeOnce.add(`manual:${runtimeKey}`);
      return track(eventName, params);
    }

    function onOnline() {
      flush();
    }

    function onBeforeUnload() {
      flushWithBeacon();
    }

    if (global.addEventListener) {
      global.addEventListener("online", onOnline);
      global.addEventListener("pagehide", onBeforeUnload);
      global.addEventListener("beforeunload", onBeforeUnload);
    }

    if (queue.length > 0) {
      scheduleFlush();
    }

    return {
      emit,
      emitOnce,
      track,
      flush,
      getOrCreateSessionId,
      dispose: function dispose() {
        if (flushTimer) {
          global.clearTimeout(flushTimer);
          flushTimer = null;
        }
        if (global.removeEventListener) {
          global.removeEventListener("online", onOnline);
          global.removeEventListener("pagehide", onBeforeUnload);
          global.removeEventListener("beforeunload", onBeforeUnload);
        }
      },
    };
  }

  function init(ctx) {
    const state = ctx?.state || (ctx.state = {});
    const emitter = createEmitter(ctx || {});
    state.analytics = emitter;
    state.sessionId = emitter.getOrCreateSessionId();

    global.topinstalTrackEvent = function topinstalTrackEvent(eventName, payload) {
      if (!state.analytics || typeof state.analytics.track !== "function") {
        return null;
      }
      return state.analytics.track(eventName, payload || {});
    };

    emitter.track("calc_session_start", {
      source: "calc",
      tab: 0,
      stepKey: "session_start",
      meta: { origin: "bootstrap" },
    });

    return function disposeAnalytics() {
      try {
        if (state.analytics && typeof state.analytics.dispose === "function") {
          state.analytics.dispose();
        }
      } catch (_) { }
      try {
        delete state.analytics;
      } catch (_) { }
    };
  }

  global.__HP_MODULES__ = global.__HP_MODULES__ || {};
  global.__HP_MODULES__.analytics = { init };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { isDev, getOrCreateSessionId };
  }
})(typeof window !== "undefined" ? window : globalThis);
