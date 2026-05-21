(function (window) {
  "use strict";

  const formEngine = window.formEngine || (window.formEngine = {});
  const instances = formEngine.__instances || (formEngine.__instances = new Map());
  let activeInstanceId = formEngine.__activeInstanceId || "default";
  formEngine.__activeInstanceId = activeInstanceId;

  formEngine.__setActiveInstance = function (id) {
    if (!id) return;
    activeInstanceId = String(id);
    formEngine.__activeInstanceId = activeInstanceId;
  };

  function getInstance(id) {
    const key = String(id || "default");
    let inst = instances.get(key);
    if (!inst) {
      inst = {
        id: key,
        values: Object.create(null),
        fieldElements: Object.create(null),
        appState: null,
        saveTimeout: null,
      };
      instances.set(key, inst);
    }
    return inst;
  }

  function getActiveInstance() {
    return getInstance(activeInstanceId);
  }

  const SAVE_DEBOUNCE_MS = 400;

  function appStateKey(instanceId) {
    return `wycena2025_appState::${String(instanceId || "default")}`;
  }

  function defaultUiFlags() {
    return {
      completionAnimationShown: false,
      activeView: null,
    };
  }

  function getStateEventStore() {
    if (!window.__HP_STATE_EVENT_ONCE__) {
      window.__HP_STATE_EVENT_ONCE__ = new Set();
    }
    return window.__HP_STATE_EVENT_ONCE__;
  }

  function emitStateEvent(eventName, meta = {}, options = {}) {
    const details = meta && typeof meta === "object" ? meta : {};
    const onceKey =
      options && typeof options === "object" ? options.onceKey || null : null;

    if (onceKey) {
      const onceStore = getStateEventStore();
      if (onceStore.has(onceKey)) {
        return false;
      }
      onceStore.add(onceKey);
    }

    try {
      if (typeof window.topinstalTrackEvent === "function") {
        window.topinstalTrackEvent(eventName, {
          source: "calc",
          tab: 5,
          stepKey: "state",
          meta: details,
        });
      }
    } catch (_) {}

    try {
      const logger =
        eventName.indexOf("legacy") >= 0 || eventName.indexOf("missing") >= 0
          ? console.warn
          : console.info;
      if (typeof logger === "function") {
        logger(`[state] ${eventName}`, details);
      }
    } catch (_) {}

    return true;
  }

  function normalizeAppStateShape(state) {
    const next = state && typeof state === "object" ? state : {};

    if ("configuratorOffer" in next) {
      delete next.configuratorOffer;
    }
    if ("lastCalculationResult" in next) {
      delete next.lastCalculationResult;
    }

    if (!next.formData || typeof next.formData !== "object") {
      next.formData = {};
    }
    if (!next.uiFlags || typeof next.uiFlags !== "object") {
      next.uiFlags = defaultUiFlags();
    } else {
      next.uiFlags = Object.assign(defaultUiFlags(), next.uiFlags);
    }
    if (!("draftRequest" in next)) {
      next.draftRequest = null;
    }
    if (!("canonicalOffer" in next)) {
      next.canonicalOffer = null;
    }
    if (!("offer" in next)) {
      next.offer = null;
    }
    if (!("configuratorSelection" in next)) {
      next.configuratorSelection = null;
    }
    if (!("currentTab" in next)) {
      next.currentTab = 0;
    }
    if (typeof next.completionAnimationShown === "boolean") {
      next.uiFlags.completionAnimationShown = next.completionAnimationShown;
    } else {
      next.completionAnimationShown = !!next.uiFlags.completionAnimationShown;
    }
    if (!("timestamp" in next) || !Number.isFinite(Number(next.timestamp))) {
      next.timestamp = Date.now();
    }

    return next;
  }

  function ensureAppState(inst) {
    if (!inst.appState) {
      inst.appState = normalizeAppStateShape({
        formData: {},
        currentTab: 0,
        draftRequest: null,
        canonicalOffer: null,
        offer: null,
        configuratorSelection: null,
        uiFlags: defaultUiFlags(),
        completionAnimationShown: false,
        timestamp: Date.now(),
      });
      return inst.appState;
    }

    inst.appState = normalizeAppStateShape(inst.appState);
    return inst.appState;
  }

  function getAppState() {
    return ensureAppState(getActiveInstance());
  }

  function loadFromSessionStorageFor(instanceId) {
    const inst = getInstance(instanceId);
    try {
      const stored = sessionStorage.getItem(appStateKey(inst.id));
      if (stored) {
        inst.appState = normalizeAppStateShape(JSON.parse(stored));
        return inst.appState;
      }
    } catch (error) {
      console.warn("[AppState] Blad ladowania z sessionStorage:", error);
    }
    return null;
  }

  function loadFromSessionStorage() {
    return loadFromSessionStorageFor(activeInstanceId);
  }

  function saveToSessionStorageFor(instanceId, state) {
    try {
      const prepared = prepareStateForStorage(state);
      sessionStorage.setItem(appStateKey(instanceId), JSON.stringify(prepared));
      return true;
    } catch (error) {
      console.warn("[AppState] Blad zapisu do sessionStorage:", error);
      return false;
    }
  }

  function saveToSessionStorage(state) {
    return saveToSessionStorageFor(activeInstanceId, state);
  }

  function updateAppStateFor(instanceId, updates) {
    const inst = getInstance(instanceId);
    const state = ensureAppState(inst);
    const nextUpdates = updates && typeof updates === "object" ? { ...updates } : {};

    if (!("canonicalOffer" in nextUpdates) && "offer" in nextUpdates) {
      nextUpdates.canonicalOffer = nextUpdates.offer || null;
    }
    if (!("offer" in nextUpdates) && "canonicalOffer" in nextUpdates) {
      nextUpdates.offer = nextUpdates.canonicalOffer || null;
    }

    if (nextUpdates.uiFlags && typeof nextUpdates.uiFlags === "object") {
      state.uiFlags = Object.assign({}, state.uiFlags || defaultUiFlags(), nextUpdates.uiFlags);
      if ("completionAnimationShown" in nextUpdates.uiFlags) {
        state.completionAnimationShown = !!nextUpdates.uiFlags.completionAnimationShown;
      }
    }

    const updatesWithoutUiFlags = Object.assign({}, nextUpdates);
    delete updatesWithoutUiFlags.uiFlags;
    Object.assign(state, updatesWithoutUiFlags);

    if ("completionAnimationShown" in updatesWithoutUiFlags) {
      state.uiFlags = Object.assign({}, state.uiFlags || defaultUiFlags(), {
        completionAnimationShown: !!state.completionAnimationShown,
      });
    }

    normalizeAppStateShape(state);
    state.timestamp = Date.now();

    if ("canonicalOffer" in updatesWithoutUiFlags) {
      emitStateEvent("canonical_offer_updated", {
        instanceId: String(instanceId || "default"),
        traceId: updatesWithoutUiFlags.canonicalOffer?.traceId || null,
        hasOffer: !!updatesWithoutUiFlags.canonicalOffer,
      });
    }

    if (inst.saveTimeout) {
      clearTimeout(inst.saveTimeout);
    }
    inst.saveTimeout = setTimeout(() => {
      saveToSessionStorageFor(instanceId, state);
      inst.saveTimeout = null;
    }, SAVE_DEBOUNCE_MS);

    return state;
  }

  function updateAppState(updates) {
    return updateAppStateFor(activeInstanceId, updates);
  }

  function setDraftRequestFor(instanceId, draftRequest) {
    return updateAppStateFor(instanceId, { draftRequest: draftRequest || null });
  }

  function setDraftRequest(draftRequest) {
    return setDraftRequestFor(activeInstanceId, draftRequest);
  }

  function setCanonicalOfferFor(instanceId, offer) {
    const updates = {
      canonicalOffer: offer || null,
      offer: offer || null,
    };

    return updateAppStateFor(instanceId, updates);
  }

  function setCanonicalOffer(offer) {
    return setCanonicalOfferFor(activeInstanceId, offer);
  }

  function setOfferFor(instanceId, offer) {
    return setCanonicalOfferFor(instanceId, offer);
  }

  function setOffer(offer) {
    return setOfferFor(activeInstanceId, offer);
  }

  function setUiFlagsFor(instanceId, uiFlags) {
    return updateAppStateFor(instanceId, { uiFlags: uiFlags || {} });
  }

  function setUiFlags(uiFlags) {
    return setUiFlagsFor(activeInstanceId, uiFlags);
  }

  function isStrictBackendMode() {
    const cfg = (typeof window !== "undefined" && window.HEATPUMP_CONFIG) || {};
    return cfg.useBackendCalc === true;
  }

  function resolveCanonicalOfferState(appState, options = {}) {
    const snapshot = appState && typeof appState === "object" ? appState : getAppState();
    const seam =
      options && typeof options === "object" && typeof options.seam === "string"
        ? options.seam
        : "getCanonicalOffer";

    const candidates = [
      { source: "canonicalOffer", value: snapshot?.canonicalOffer || null },
      { source: "offer", value: snapshot?.offer || null },
    ];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (candidate.value && typeof candidate.value === "object") {
        if (candidate.source !== "canonicalOffer") {
          emitStateEvent(
            "legacy_offer_state_adapter_used",
            {
              seam,
              source: candidate.source,
              traceId: candidate.value?.traceId || null,
            },
            {
              onceKey: `legacy_offer_state_adapter_used::${seam}::${candidate.source}`,
            }
          );
        }
        return {
          offer: candidate.value,
          source: candidate.source,
          usedLegacyAdapter: candidate.source !== "canonicalOffer",
        };
      }
    }

    emitStateEvent(
      "canonical_offer_missing",
      {
        seam,
        strictBackendMode: isStrictBackendMode(),
      },
      {
        onceKey: `canonical_offer_missing::${seam}`,
      }
    );

    return {
      offer: null,
      source: "missing",
      usedLegacyAdapter: false,
    };
  }

  // Canonical OfferDTO resolver used across UI modules.
  function getCanonicalOffer(appState, options = {}) {
    return resolveCanonicalOfferState(appState, options).offer;
  }

  function prepareStateForStorage(state) {
    const safe = normalizeAppStateShape(
      state && typeof state === "object" ? { ...state } : {}
    );
    delete safe.configuratorOffer;
    delete safe.lastCalculationResult;
    return safe;
  }

  function getAllValuesForInstance(instanceId) {
    const inst = getInstance(instanceId);
    if (inst.appState && inst.appState.formData && Object.keys(inst.appState.formData).length > 0) {
      return { ...inst.appState.formData, ...inst.values };
    }
    return { ...inst.values };
  }

  function syncFormDataToAppStateFor(instanceId) {
    const formData = getAllValuesForInstance(instanceId);
    updateAppStateFor(instanceId, { formData });
  }

  function syncFormDataToAppState() {
    syncFormDataToAppStateFor(activeInstanceId);
  }

  function syncAppStateToFormEngineFor(instanceId) {
    const inst = getInstance(instanceId);
    const state = ensureAppState(inst);
    if (state.formData && Object.keys(state.formData).length > 0) {
      const prev = activeInstanceId;
      formEngine.__setActiveInstance(instanceId);
      Object.entries(state.formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          setValue(key, value);
        }
      });
      formEngine.__setActiveInstance(prev);
    }
  }

  function syncAppStateToFormEngine() {
    syncAppStateToFormEngineFor(activeInstanceId);
  }

  function registerField(name, elements) {
    getActiveInstance().fieldElements[name] = elements;
  }

  function getFieldElements(name) {
    return getActiveInstance().fieldElements[name] || null;
  }

  function setValue(name, value) {
    const inst = getActiveInstance();
    const previous = inst.values[name];
    if (typeof value === "string") {
      inst.values[name] = value.trim();
    } else if (Array.isArray(value)) {
      inst.values[name] = value.slice();
    } else if (value === undefined || value === null) {
      delete inst.values[name];
    } else {
      inst.values[name] = value;
    }
    const changed = previous !== inst.values[name];

    if (changed && inst.appState) {
      syncFormDataToAppState();
    }

    return changed;
  }

  function getValue(name) {
    return getActiveInstance().values[name];
  }

  function getAllValues() {
    return getAllValuesForInstance(activeInstanceId);
  }

  function resetValues() {
    const inst = getActiveInstance();
    Object.keys(inst.values).forEach((key) => delete inst.values[key]);
  }

  formEngine.state = {
    registerField,
    getFieldElements,
    setValue,
    getValue,
    getAllValues,
    resetValues,
  };

  if (typeof window !== "undefined") {
    window.__initState = function initState(ctx = {}) {
      if (!window.formEngine) {
        window.formEngine = formEngine;
      }

      const instanceId =
        ctx?.state?.instanceId ||
        ctx?.root?.getAttribute?.("data-hp-instance") ||
        "default";
      formEngine.__setActiveInstance(instanceId);

      ctx.state = ctx.state || {};
      Object.assign(ctx.state, {
        instanceId,
        formEngine,
        getAppState: () => ensureAppState(getInstance(instanceId)),
        updateAppState: (updates) => updateAppStateFor(instanceId, updates),
        resolveCanonicalOfferState: (appState, options) =>
          resolveCanonicalOfferState(
            appState || ensureAppState(getInstance(instanceId)),
            options
          ),
        getCanonicalOffer: (appState, options) =>
          getCanonicalOffer(appState || ensureAppState(getInstance(instanceId)), options),
        setDraftRequest: (draftRequest) => setDraftRequestFor(instanceId, draftRequest),
        setCanonicalOffer: (offer, options) =>
          setCanonicalOfferFor(instanceId, offer, options),
        setOffer: (offer, options) => setOfferFor(instanceId, offer, options),
        setUiFlags: (uiFlags) => setUiFlagsFor(instanceId, uiFlags),
        syncFormDataToAppState: () => syncFormDataToAppStateFor(instanceId),
        syncAppStateToFormEngine: () => syncAppStateToFormEngineFor(instanceId),
        loadFromSessionStorage: () => loadFromSessionStorageFor(instanceId),
        saveToSessionStorage: (state) => saveToSessionStorageFor(instanceId, state),
      });

      window.loadAppStateFromSessionStorage = loadFromSessionStorage;
      window.saveAppStateToSessionStorage = saveToSessionStorage;
      window.getAppState = getAppState;
      window.updateAppState = updateAppState;
      window.resolveCanonicalOfferState = resolveCanonicalOfferState;
      window.getCanonicalOffer = getCanonicalOffer;
      window.setDraftRequest = setDraftRequest;
      window.setCanonicalOffer = setCanonicalOffer;
      window.setOffer = setOffer;
      window.setUiFlags = setUiFlags;
      window.syncFormDataToAppState = syncFormDataToAppState;
      window.syncAppStateToFormEngine = syncAppStateToFormEngine;

      return function disposeState() {
        const inst = getInstance(instanceId);
        if (inst.saveTimeout) {
          clearTimeout(inst.saveTimeout);
          inst.saveTimeout = null;
        }
        inst.appState = null;
      };
    };
    window.__HP_STATE_READY__ = true;
  }
})(window);
