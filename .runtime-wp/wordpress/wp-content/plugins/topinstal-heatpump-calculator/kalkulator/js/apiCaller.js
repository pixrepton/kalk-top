// === FILE: apiCaller.js ===
// Backend-first calculation caller for canonical calculate-offer flow.

(function (window) {
  "use strict";

  const LOG = (typeof window !== "undefined" && window.HP_LOG) || {
    info: function () { },
    warn: function () { },
    error: function () { },
    group: function () { },
    groupEnd: function () { },
  };

  LOG.info("module:apiCaller", "loaded");

  let isAPICallInProgress = false;

  function isBackendCalcEnabled() {
    return !!(window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.useBackendCalc === true);
  }

  function isDualRunEnabled() {
    return !!(window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.dualRunDev === true);
  }

  function toFiniteNumber(value, fallback) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function trackCalcEvent(eventName, payload = {}) {
    try {
      if (typeof window.topinstalTrackEvent === "function") {
        window.topinstalTrackEvent(eventName, {
          source: "calc",
          tab: 5,
          stepKey: "calculate",
          ...(payload || {}),
        });
      }
    } catch (_) { }
  }

  function persistConfiguratorBridgeConfig(offer, result) {
    if (!offer || typeof offer !== "object") {
      return;
    }
    try {
      const storage =
        typeof sessionStorage !== "undefined" ? sessionStorage : null;
      const root =
        document.querySelector("#configurator-app, #configurator-view") ||
        document.querySelector("[data-hp-instance]") ||
        document.body;
      const instanceId =
        root?.getAttribute?.("data-hp-instance") ||
        (typeof window.getAppState === "function"
          ? window.getAppState()?.instanceId
          : null) ||
        "default";
      const configDataKey = `config_data::${String(instanceId)}`;
      let existing = {};
      if (storage) {
        for (const key of [configDataKey, "config_data"]) {
          try {
            const raw = storage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              existing = parsed;
              break;
            }
          } catch (_) {
            // ignore malformed persisted payloads
          }
        }
      }
      const configData = Object.assign({}, existing, result || {}, {
        from_calculator: true,
        offer_dto: offer,
      });
      if (storage) {
        storage.setItem(configDataKey, JSON.stringify(configData));
      }
      if (typeof window.updateAppState === "function") {
        window.updateAppState({ config_data: configData, canonicalOffer: offer });
      }
    } catch (error) {
      LOG.warn("flow", "persistConfiguratorBridgeConfig failed", error);
    }
  }

  function ensureWorkflowCompletionShown(result) {
    const view = window;
    if (typeof view.setTimeout !== "function") {
      return;
    }
    view.setTimeout(() => {
      try {
        const activeRoot =
          window.__HP_ACTIVE_ROOT__ ||
          document.querySelector(".heatpump-calculator");
        const completionContainer = activeRoot?.querySelector?.(
          ".workflow-completion"
        );
        const visible =
          !!completionContainer &&
          completionContainer.style.display !== "none" &&
          completionContainer.getClientRects?.().length > 0;
        if (!visible && typeof window.showWorkflowCompletion === "function") {
          LOG.warn("flow", "Workflow completion fallback triggered");
          window.showWorkflowCompletion(result);
        }
      } catch (fallbackError) {
        LOG.warn("flow", "Workflow completion fallback failed", fallbackError);
      }
    }, 120);
  }

  function trackBackendFallbackTelemetry(offer, traceId) {
    if (!offer || typeof offer !== "object") {
      return;
    }

    if (offer?.engineMeta?.fallbackUsed === true) {
      trackCalcEvent("backend_fallback_used", {
        traceId: traceId || offer?.traceId || null,
        meta: {
          traceId: traceId || offer?.traceId || null,
          reasons: Array.isArray(offer?.engineMeta?.fallbackReasons)
            ? offer.engineMeta.fallbackReasons
            : [],
        },
      });
    }
  }

  function toYesNo(value) {
    const normalized = String(value == null ? "" : value).toLowerCase();
    if (value === true || normalized === "yes" || normalized === "true" || normalized === "1") return "yes";
    return "no";
  }

  function updateCanonicalState(partial) {
    if (!partial || typeof partial !== "object") return;
    const updates = { ...partial };

    try {
      if ("draftRequest" in updates && typeof window.setDraftRequest === "function") {
        window.setDraftRequest(updates.draftRequest || null);
        delete updates.draftRequest;
      }

      if ("canonicalOffer" in updates && typeof window.setCanonicalOffer === "function") {
        window.setCanonicalOffer(updates.canonicalOffer || null);
        delete updates.canonicalOffer;
      }

      if ("offer" in updates && typeof window.setCanonicalOffer === "function") {
        window.setCanonicalOffer(updates.offer || null);
        delete updates.offer;
      } else if ("offer" in updates && typeof window.setOffer === "function") {
        window.setOffer(updates.offer || null);
        delete updates.offer;
      }

      if (typeof window.updateAppState === "function" && Object.keys(updates).length > 0) {
        window.updateAppState(updates);
      }
    } catch (error) {
      LOG.warn("flow", "Failed to update appState from apiCaller", error);
    }
  }

  async function parseJsonResponse(response) {
    const text = await response.text().catch(function () {
      return "";
    });
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

  async function sendDualRunDebugReport(report, context) {
    if (!report || typeof report !== "object") return;

    const cfg = window.HEATPUMP_CONFIG || {};
    if (cfg.dualRunDebugEnabled !== true) return;

    const endpoint = cfg.dualRunDebugEndpoint || cfg.ajaxUrl;
    if (!endpoint || typeof endpoint !== "string") return;

    const action =
      typeof cfg.dualRunDebugAction === "string" && cfg.dualRunDebugAction
        ? cfg.dualRunDebugAction
        : "heatpump_dual_run_log";

    const payload = {
      traceId: context?.traceId || context?.backendTraceId || null,
      passed: !(report?.mismatch?.designHeatLossKw || report?.mismatch?.totalGrossPln),
      deltaKw: report?.diff?.designHeatLossKw ?? null,
      deltaGross: report?.diff?.totalGrossPln ?? null,
      report: report,
      context: context || {},
    };

    const body = new FormData();
    body.append("action", action);
    if (cfg.nonce) {
      body.append("nonce", String(cfg.nonce));
    }
    body.append("payload", JSON.stringify(payload));

    try {
      const response = await fetch(String(endpoint), {
        method: "POST",
        credentials: "same-origin",
        body: body,
      });
      if (!response.ok) {
        LOG.warn("dual-run", "Dual-run debug report rejected", {
          status: response.status,
          statusText: response.statusText,
        });
        return;
      }

      const json = await parseJsonResponse(response);
      if (!json || json.success !== true) {
        LOG.warn("dual-run", "Dual-run debug report failed", json);
      }
    } catch (error) {
      LOG.warn("dual-run", "Dual-run debug report transport failed", error);
    }
  }

  function mapOfferToLegacyResult(offer, dto, payload) {
    const ozc = offer?.engineering?.ozc || {};
    const cwu = offer?.engineering?.cwu || {};
    const selection = offer?.engineering?.selection || {};
    const buffer = offer?.engineering?.buffer || {};
    const totals = offer?.pricing?.totals || {};
    const building = (dto && dto.building) || payload || {};

    const metrics = ozc.metrics && typeof ozc.metrics === "object" ? ozc.metrics : {};
    const heatedArea = toFiniteNumber(
      ozc.heatedArea_m2 ?? building.heated_area ?? building.floor_area ?? building.total_area,
      0
    );
    // Powierzchnia „całkowita” w profilu: ta sama baza co ogrzewana (OZC / kondygnacje), nie L×W z formularza.
    const totalArea = heatedArea;
    const maxHeatingPower = toFiniteNumber(ozc.designHeatLoss_kW ?? ozc.recommendedPower_kW, 0);
    const recommendedPower = toFiniteNumber(ozc.recommendedPower_kW ?? maxHeatingPower, maxHeatingPower);
    const hotWaterPower = toFiniteNumber(
      ozc.hotWaterPower_kW ?? cwu.hotWaterPower_kW,
      0
    );
    const annualEnergy = toFiniteNumber(
      ozc.annualEnergyConsumption_kWh ?? metrics.annual_energy_consumption,
      maxHeatingPower > 0 ? maxHeatingPower * 1800 : 0
    );
    const annualFactor =
      heatedArea > 0 ? Math.round((annualEnergy / heatedArea) * 100) / 100 : 0;
    const heatingFactor =
      heatedArea > 0 ? Math.round((maxHeatingPower * 1000 / heatedArea) * 100) / 100 : 0;

    const pumpSelection =
      selection?.pumpSelection ||
      (selection?.pumpModel
        ? {
          hp: {
            model: selection.pumpModel,
            power: toFiniteNumber(selection.capacity_kW, null),
            phase: selection.phase || null,
            type: selection.type || null,
          },
          aio: null,
          all_options: [],
        }
        : null);

    return {
      id: offer?.traceId || dto?.traceId || null,
      trace_id: offer?.traceId || dto?.traceId || null,
      total_area: totalArea,
      heated_area: heatedArea,
      max_heating_power: maxHeatingPower,
      recommended_power_kw: recommendedPower,
      hot_water_power: hotWaterPower,
      bivalent_point_heating_power: toFiniteNumber(
        ozc.bivalentPointHeatingPower_kW ?? metrics.bivalent_point_heating_power,
        Math.max(0, maxHeatingPower * 0.55)
      ),
      avg_heating_power: toFiniteNumber(
        ozc.avgHeatingPower_kW ?? metrics.avg_heating_power,
        Math.max(0, maxHeatingPower * 0.62)
      ),
      design_outdoor_temperature: toFiniteNumber(
        building.design_outdoor_temperature ?? building.design_temp,
        -20
      ),
      avg_outdoor_temperature: toFiniteNumber(building.avg_outdoor_temperature, 8),
      annual_energy_consumption: annualEnergy,
      annual_energy_consumption_factor: annualFactor,
      heating_power_factor: heatingFactor,
      include_hot_water: toYesNo(dto?.preferences?.dhw?.enabled ?? building.include_hot_water),
      hot_water_persons: dto?.preferences?.dhw?.persons ?? building.hot_water_persons ?? null,
      hot_water_usage:
        dto?.preferences?.dhw?.usageProfile ?? building.hot_water_usage ?? null,
      heating_type:
        dto?.preferences?.heating?.emitterType ??
        building.heating_type ??
        building.installation_type ??
        null,
      source_type:
        dto?.preferences?.heating?.sourceType ?? building.source_type ?? null,
      climate_zone: building.location_id ?? building.climate_zone ?? null,
      location_id: building.location_id ?? building.climate_zone ?? null,
      construction_year: building.construction_year ?? building.building_year ?? null,
      building_type: building.building_type ?? null,
      recommended_models: selection?.recommendedModels || [],
      pump_selection: pumpSelection,
      buffer_recommendation: {
        liters: buffer?.liters ?? null,
        setup_type: buffer?.setupType ?? "NONE",
        reason_codes: buffer?.reasonCodes || [],
      },
      offer_pricing: {
        currency: offer?.pricing?.currency || "PLN",
        total_net: toFiniteNumber(totals.net, 0),
        total_vat: toFiniteNumber(totals.vat, 0),
        total_gross: toFiniteNumber(totals.gross, 0),
        items: offer?.pricing?.items || [],
      },
      offer_dto: offer,
    };
  }

  async function runDualRunValidation(payload, backendOutput) {
    if (!isDualRunEnabled()) return;

    try {
      if (typeof window.__ensureOzcEngineManager === "function") {
        window.__ensureOzcEngineManager();
      }

      if (
        !window.ozcEngineManager ||
        typeof window.ozcEngineManager.calculate !== "function"
      ) {
        LOG.warn("dual-run", "Skipping: ozcEngineManager is not available");
        return;
      }

      const payloadForLocalEngine = { ...(payload || {}) };
      if (!payloadForLocalEngine.location_id) {
        try {
          const fe = window.formEngine;
          const getVal = fe?.state?.getValue?.bind(fe.state);
          const locationId =
            (getVal && (getVal("location_id") || getVal("climate_zone"))) || null;
          if (locationId) {
            payloadForLocalEngine.location_id = locationId;
          }
        } catch (_) { }
      }

      const localRaw = await window.ozcEngineManager.calculate(payloadForLocalEngine);
      if (localRaw && localRaw.errors && Object.keys(localRaw.errors).length > 0) {
        LOG.warn("dual-run", "Skipping: local engine returned validation errors", localRaw.errors);
        return;
      }

      function isCieploLike(result) {
        if (!result || typeof result !== "object") return false;
        return (
          Number.isFinite(Number(result.max_heating_power)) ||
          Number.isFinite(Number(result.recommended_power_kw))
        );
      }

      let localResult = localRaw;
      if (
        !isCieploLike(localResult) &&
        window.ozcEngineManager &&
        typeof window.ozcEngineManager.convertToCieploAppFormat === "function"
      ) {
        localResult = window.ozcEngineManager.convertToCieploAppFormat(
          localRaw,
          payloadForLocalEngine
        );
      }

      const backendDesignKw = toFiniteNumber(
        backendOutput?.result?.max_heating_power ??
        backendOutput?.offer?.engineering?.ozc?.designHeatLoss_kW,
        NaN
      );
      const localDesignKw = toFiniteNumber(
        localResult?.max_heating_power ?? localResult?.recommended_power_kw,
        NaN
      );

      const backendGross = toFiniteNumber(
        backendOutput?.offer?.pricing?.totals?.gross ??
        backendOutput?.result?.offer_pricing?.total_gross,
        NaN
      );
      const localGross = toFiniteNumber(localResult?.offer_pricing?.total_gross, NaN);

      const toleranceKw = toFiniteNumber(
        window.HEATPUMP_CONFIG?.dualRunToleranceKw,
        0.2
      );
      const toleranceGross = toFiniteNumber(
        window.HEATPUMP_CONFIG?.dualRunToleranceGross,
        100
      );

      const kwDiff =
        Number.isFinite(backendDesignKw) && Number.isFinite(localDesignKw)
          ? Math.abs(backendDesignKw - localDesignKw)
          : null;
      const grossDiff =
        Number.isFinite(backendGross) && Number.isFinite(localGross)
          ? Math.abs(backendGross - localGross)
          : null;

      const hasKwMismatch = kwDiff !== null && kwDiff > toleranceKw;
      const hasGrossMismatch = grossDiff !== null && grossDiff > toleranceGross;

      const diffReport = {
        timestamp: new Date().toISOString(),
        tolerance: {
          designHeatLossKw: toleranceKw,
          totalGrossPln: toleranceGross,
        },
        backend: {
          designHeatLossKw: Number.isFinite(backendDesignKw) ? backendDesignKw : null,
          totalGrossPln: Number.isFinite(backendGross) ? backendGross : null,
        },
        local: {
          designHeatLossKw: Number.isFinite(localDesignKw) ? localDesignKw : null,
          totalGrossPln: Number.isFinite(localGross) ? localGross : null,
        },
        diff: {
          designHeatLossKw: kwDiff,
          totalGrossPln: grossDiff,
        },
        mismatch: {
          designHeatLossKw: hasKwMismatch,
          totalGrossPln: hasGrossMismatch,
        },
      };

      window.__HP_DUAL_RUN_LAST_DIFF__ = diffReport;
      updateCanonicalState({ dualRun: diffReport });
      sendDualRunDebugReport(diffReport, {
        backendTraceId:
          backendOutput?.offer?.traceId ||
          backendOutput?.result?.trace_id ||
          backendOutput?.result?.traceId ||
          null,
        localTraceId: localResult?.trace_id || localResult?.traceId || null,
        source: "apiCaller",
      });

      if (hasKwMismatch || hasGrossMismatch) {
        LOG.warn("dual-run", "Mismatch detected between backend and local flow", diffReport);
      } else {
        LOG.info("dual-run", "Backend and local flow are within tolerance", diffReport);
      }
    } catch (error) {
      LOG.warn("dual-run", "Dual-run validation failed", error);
    }
  }

  async function callBackendCalculateOffer(payload) {
    if (typeof window.mapUiStateToCalcRequestDTO !== "function") {
      throw new Error("mapUiStateToCalcRequestDTO is not available");
    }
    if (!window.topinstalApi || typeof window.topinstalApi.calculateOffer !== "function") {
      throw new Error("topinstalApi.calculateOffer is not available");
    }

    const appState = typeof window.getAppState === "function" ? window.getAppState() : {};
    const dto = window.mapUiStateToCalcRequestDTO({
      appState,
      sourcePayload: payload,
      traceId: window.ensureTraceId ? window.ensureTraceId(null) : null,
      source: "configurator",
    });

    let formStateSnapshot = null;
    try {
      if (window.formEngine?.state && typeof window.formEngine.state.getAllValues === "function") {
        formStateSnapshot = window.formEngine.state.getAllValues();
      }
    } catch (_) {
      formStateSnapshot = null;
    }

    let sessionId = null;
    try {
      sessionId =
        appState?.sessionId ||
        (typeof window.localStorage !== "undefined"
          ? window.localStorage.getItem("ti_calc_session_id")
          : null);
    } catch (_) {
      sessionId = null;
    }
    if (sessionId) {
      dto.sessionId = sessionId;
    }
    if (formStateSnapshot && typeof formStateSnapshot === "object") {
      dto.formStateSnapshot = formStateSnapshot;
    }

    updateCanonicalState({ draftRequest: dto });

    const offer = await window.topinstalApi.calculateOffer(dto, {
      timeoutMs: window.HEATPUMP_CONFIG?.calculateOfferTimeoutMs || 15000,
      retryCount: 1,
    });
    updateCanonicalState({ offer: offer, draftRequest: dto });

    return {
      dto,
      offer,
      result: mapOfferToLegacyResult(offer, dto, payload),
    };
  }

  /**
   * Calls the canonical backend calculate-offer endpoint.
   *
   * @param {Object} payload - Calculation payload
   * @returns {Promise<Object>} - Calculation result
   */
  async function callCieplo(payload) {
    console.log("[FLOW-1] callCieplo() STARTED");
    console.log("[FLOW-1] Payload:", payload);
    const startedAt =
      Number.isFinite(Number(window.__TOPINSTAL_CALC_STARTED_AT))
        ? Number(window.__TOPINSTAL_CALC_STARTED_AT)
        : Date.now();

    if (isAPICallInProgress) {
      console.warn("[FLOW-1] API call already in progress - skipping");
      LOG.warn("flow", "API call skipped - already in progress");
      return { success: false, error: "Call already in progress" };
    }

    isAPICallInProgress = true;

    try {
      console.log("[FLOW-2] API calculation started");
      LOG.info("flow", "API calculation started");

      if (!isBackendCalcEnabled()) {
        const configMessage =
          "Kalkulator wymaga aktywnego backendowego endpointu calculate-offer.";
        LOG.error("flow", configMessage, {
          guard: "BACKEND_CALC_REQUIRED",
        });
        trackCalcEvent("calc_error", {
          meta: {
            httpStatus: 0,
            reasonCode: "backend_disabled",
            durationMs: Math.max(0, Date.now() - startedAt),
          },
        });
        isAPICallInProgress = false;
        return {
          success: false,
          source: "backend-required",
          error: configMessage,
        };
      }

      LOG.info("flow", "Using backend calculate-offer endpoint");
      const backendOutput = await callBackendCalculateOffer(payload || {});
      const finalResult = backendOutput.result;

      const maxPower = toFiniteNumber(finalResult.max_heating_power, NaN);
      const recommendedPower = toFiniteNumber(finalResult.recommended_power_kw, NaN);
      if (!Number.isFinite(maxPower) || !Number.isFinite(recommendedPower)) {
        throw new Error("Invalid backend result: missing max_heating_power/recommended_power_kw");
      }

      if (typeof window.showTab === "function") {
        window.showTab(5);
      }

      updateCanonicalState({
        draftRequest: backendOutput.dto,
        offer: backendOutput.offer || null,
      });

      persistConfiguratorBridgeConfig(backendOutput.offer, finalResult);

      // Fresh calculation: allow workflow completion to run again after config_data save.
      if (typeof window.updateAppState === "function") {
        window.updateAppState({
          completionAnimationShown: false,
          uiFlags: {
            completionAnimationShown: false,
          },
        });
      }

      // Workflow completion (Gratulacje) is owned by displayResults; fallback if UI did not open.
      try {
        if (typeof window.displayResults === "function") {
          window.displayResults(finalResult);
        } else {
          LOG.warn("flow", "displayResults is not available");
          if (typeof window.showWorkflowCompletion === "function") {
            window.showWorkflowCompletion(finalResult);
          }
        }
      } catch (displayError) {
        LOG.error("flow", "displayResults failed", displayError);
        if (typeof window.showWorkflowCompletion === "function") {
          window.showWorkflowCompletion(finalResult);
        }
      }
      ensureWorkflowCompletionShown(finalResult);

      if (isDualRunEnabled()) {
        runDualRunValidation(payload || {}, backendOutput);
      }

      const backendTraceId =
        backendOutput?.offer?.traceId ||
        finalResult?.trace_id ||
        finalResult?.traceId ||
        null;
      const ozc = backendOutput?.offer?.engineering?.ozc || {};
      trackCalcEvent("calc_result_view", {
        traceId: backendTraceId,
        stepKey: "results",
        meta: {
          traceId: backendTraceId,
          durationMs: Math.max(0, Date.now() - startedAt),
          mode: "backend",
          designHeatLoss_kW: ozc.designHeatLoss_kW ?? null,
          recommendedPower_kW: ozc.recommendedPower_kW ?? null,
          heatedArea_m2: ozc.heatedArea_m2 ?? null,
        },
      });
      trackBackendFallbackTelemetry(backendOutput?.offer, backendTraceId);

      isAPICallInProgress = false;
      return {
        success: true,
        source: "backend-rest",
        result: finalResult,
        offer: backendOutput.offer,
      };
    } catch (error) {
      LOG.error("flow", "API call failed", error);

      const rawMessage = String(error?.message || "");
      const isFetchHeaderBug =
        rawMessage.includes("Cannot convert value in record branch") ||
        rawMessage.includes("greater than 255");
      const backendMessage =
        error && error.data && error.data.message
          ? error.data.message
          : isFetchHeaderBug
            ? "Błąd konfiguracji żądania (nieprawidłowy nagłówek). Odśwież stronę (Ctrl+F5) i spróbuj ponownie."
            : rawMessage &&
              (rawMessage.includes("Failed to fetch") ||
                rawMessage.includes("NetworkError"))
              ? "Serwer chwilowo nie odpowiada. Spróbuj ponownie."
              : rawMessage || "Nie udało się pobrać wyniku. Spróbuj ponownie za chwilę.";

      if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
        ErrorHandler.showToast(backendMessage, "error");
      } else {
        alert(backendMessage);
      }

      trackCalcEvent("calc_error", {
        meta: {
          httpStatus: Number(error?.status || error?.data?.status || 0) || 0,
          reasonCode: "backend_error",
          durationMs: Math.max(0, Date.now() - startedAt),
        },
      });
      isAPICallInProgress = false;
      return {
        success: false,
        status: Number(error?.status || error?.data?.status || 0) || 0,
        error: backendMessage,
        networkError: !Number(error?.status || error?.data?.status || 0),
        source: "backend-rest",
        offer: null,
      };
    }
  }

  // Eksportuj funkcję
  window.callCieplo = callCieplo;
})(window);
