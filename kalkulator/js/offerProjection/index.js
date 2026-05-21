(function (global) {
  "use strict";

  const namespace =
    global.__HP_OFFER_PROJECTION__ || (global.__HP_OFFER_PROJECTION__ = {});
  const core =
    namespace.core ||
    (typeof require === "function" ? require("./core.js") : null);
  const summary =
    namespace.summary ||
    (typeof require === "function" ? require("./summary.js") : null);
  const resultsHeader =
    namespace.resultsHeader ||
    (typeof require === "function" ? require("./resultsHeader.js") : null);
  const documentProjection =
    namespace.document ||
    (typeof require === "function" ? require("./document.js") : null);
  const emailProjection =
    namespace.email ||
    (typeof require === "function" ? require("./email.js") : null);

  function resolveConfiguratorSelection(ctx, appState) {
    const state = ctx?.state || {};
    const configuratorApi =
      state?.configuratorApi || appState?.configuratorApi || null;
    const configData =
      appState?.config_data && typeof appState.config_data === "object"
        ? appState.config_data
        : null;

    return (
      (configuratorApi && typeof configuratorApi.getSelection === "function"
        ? configuratorApi.getSelection()
        : null) ||
      appState?.configuratorSelection ||
      appState?.configuratorSelectionPayload ||
      configData?.configuratorSelection ||
      configData?.configurator_selection ||
      global.configuratorSelection ||
      null
    );
  }

  function resolveCanonicalOfferWithTelemetry(ctx, appState, options = {}) {
    const state = ctx?.state || {};
    const seam = options?.target || "projection";

    if (state && typeof state.resolveCanonicalOfferState === "function") {
      return state.resolveCanonicalOfferState(appState, {
        seam,
      });
    }

    const offer =
      (state && typeof state.getCanonicalOffer === "function"
        ? state.getCanonicalOffer(appState, {
            seam,
          })
        : null) ||
      null;

    return {
      offer,
      source: offer ? "unknown" : "missing",
      usedLegacyAdapter: false,
    };
  }

  function resolveInputFromRuntime(ctx, options = {}) {
    const state = ctx?.state || {};
    const appState =
      (typeof state.getAppState === "function" && state.getAppState()) ||
      (typeof global.getAppState === "function" ? global.getAppState() : null) ||
      {};

    const explicitOfferDto =
      options?.offerDto && typeof options.offerDto === "object" ? options.offerDto : null;
    const configuratorSelection =
      options?.configuratorSelection && typeof options.configuratorSelection === "object"
        ? options.configuratorSelection
        : resolveConfiguratorSelection(ctx, appState);
    const resolvedOffer = explicitOfferDto
      ? {
          offer: explicitOfferDto,
          source: "explicitOfferDto",
          usedLegacyAdapter: false,
        }
      : resolveCanonicalOfferWithTelemetry(ctx, appState, {
          target: options?.target || "projection",
        });

    if (!resolvedOffer?.offer) {
      core.emitProjectionEvent(
        core.buildOfferProjectionContext({
          offerDto: null,
          leadData: options?.leadData || options?.leadInput || null,
          configuratorSelection,
          uiContext: {
            target: options?.target || "projection",
            channel: options?.channel || "ui",
          },
        }),
        "canonical_offer_missing",
        {
          target: options?.target || "projection",
          source: resolvedOffer?.source || "missing",
        },
        {
          onceKey: `canonical_offer_missing::${String(
            options?.target || "projection"
          )}`,
        }
      );
    }

    return {
      offerDto: resolvedOffer?.offer || null,
      leadData: options?.leadData || options?.leadInput || null,
      configuratorSelection,
      uiContext: {
        ...(options?.uiContext && typeof options.uiContext === "object"
          ? options.uiContext
          : {}),
        locale:
          options?.uiContext?.locale || options?.locale || "pl-PL",
        target:
          options?.uiContext?.target || options?.target || "projection",
        channel:
          options?.uiContext?.channel || options?.channel || "ui",
        documentMode:
          options?.uiContext?.documentMode ||
          options?.mode ||
          options?.documentMode ||
          "offer",
        requestBuildingSnapshot:
          appState?.draftRequest?.building &&
          typeof appState.draftRequest.building === "object"
            ? appState.draftRequest.building
            : {},
        formData:
          appState?.formData && typeof appState.formData === "object"
            ? appState.formData
            : {},
        runtimeMeta: {
          traceId:
            appState?.draftRequest?.traceId ||
            appState?.canonicalOffer?.traceId ||
            appState?.offer?.traceId ||
            null,
          configuratorPricingState:
            appState?.configuratorPricingState &&
            typeof appState.configuratorPricingState === "object"
              ? appState.configuratorPricingState
              : null,
        },
      },
    };
  }

  function init(ctx) {
    const state = ctx?.state || (ctx.state = {});
    state.offerProjection = {
      resolveInputFromRuntime: (options) => resolveInputFromRuntime(ctx, options),
      buildSummaryViewModel: (input) => summary.buildSummaryViewModel(input),
      buildResultsHeaderViewModel: (input) =>
        resultsHeader.buildResultsHeaderViewModel(input),
      buildDocumentPayload: (input) => documentProjection.buildDocumentPayload(input),
      buildEmailPayload: (input) => emailProjection.buildEmailPayload(input),
    };

    return function disposeOfferProjection() {
      try {
        if (state.offerProjection) delete state.offerProjection;
      } catch (_) {}
    };
  }

  const api = {
    init,
    resolveInputFromRuntime,
    buildSummaryViewModel: (input) => summary.buildSummaryViewModel(input),
    buildResultsHeaderViewModel: (input) =>
      resultsHeader.buildResultsHeaderViewModel(input),
    buildDocumentPayload: (input) => documentProjection.buildDocumentPayload(input),
    buildEmailPayload: (input) => emailProjection.buildEmailPayload(input),
  };

  namespace.index = api;
  global.__HP_MODULES__ = global.__HP_MODULES__ || {};
  global.__HP_MODULES__.offerProjection = { init };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
