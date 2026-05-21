(function (window) {
  "use strict";

  const LOG = (typeof window !== "undefined" && window.HP_LOG) || {
    info: function () { },
    warn: function () { },
    error: function () { },
    group: function () { },
    groupEnd: function () { },
  };

  LOG.info("module:resultsRenderer", "loaded");

  function init(ctx) {
    const { root, dom, state } = ctx;
    const disposers = [];
    const config = state?.config || {};
    const doc = root.ownerDocument;
    const view = doc.defaultView || window;

    function trackTimeout(handler, delay) {
      const id = view.setTimeout(handler, delay);
      disposers.push(() => view.clearTimeout(id));
      return id;
    }

    function trackInterval(handler, delay) {
      const id = view.setInterval(handler, delay);
      disposers.push(() => view.clearInterval(id));
      return id;
    }

    function trackObserver(observer) {
      if (observer && typeof observer.disconnect === "function") {
        disposers.push(() => observer.disconnect());
      }
      return observer;
    }

    function bind(element, event, handler, options) {
      if (!element || !event || typeof handler !== "function") {
        return () => { };
      }
      element.addEventListener(event, handler, options);
      return function off() {
        element.removeEventListener(event, handler, options);
      };
    }

    function trackEvent(element, event, handler, options) {
      disposers.push(bind(element, event, handler, options));
    }

    const setTimeout = trackTimeout;
    const setInterval = trackInterval;
    const clearTimeout = view.clearTimeout.bind(view);
    const clearInterval = view.clearInterval.bind(view);

    const MutationObserver = view.MutationObserver
      ? function MutationObserverProxy(callback) {
        const observer = new view.MutationObserver(callback);
        trackObserver(observer);
        return observer;
      }
      : null;

    let lastCalcResult = {};
    let resultsHeaderMissingOfferLogged = false;
    const formEngine = state?.formEngine || null;
    const workflowController = state?.workflowController || null;
    const analytics = state?.analytics || null;
    const motion = state?.motion || window.MotionSystem || null;
    const projectionApi = state?.offerProjection || null;

    /** Szacunkowe zużycie prądu z rocznego ciepła (HDD): średni COP ~4. */
    const HEAT_PUMP_ELECTRIC_COP = 4;

    function formatKwPolishOneDecimal(val) {
      const n = Number(val);
      if (!Number.isFinite(n)) {
        return "—";
      }
      const rounded = Math.round(n * 10) / 10;
      return `${String(rounded.toFixed(1)).replace(".", ",")} kW`;
    }

    function annualElectricKwhFromThermal(thermalKwh) {
      const t = Number(thermalKwh);
      if (!Number.isFinite(t) || t <= 0) {
        return 0;
      }
      return Math.round(t / HEAT_PUMP_ELECTRIC_COP);
    }

    function isReducedMotionPreferred() {
      if (motion && typeof motion.reduceMotion === "boolean") {
        return motion.reduceMotion;
      }
      if (typeof view.matchMedia === "function") {
        try {
          return view.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (_) { }
      }
      return false;
    }

    function getMotionDelay(duration) {
      return isReducedMotionPreferred() ? 0 : duration;
    }

    function setCtaState(button, stateName, options = {}) {
      if (!button) return;
      const labels = options.labels || {};
      button.dataset.motionCta = button.dataset.motionCta || "on";
      button.dataset.ctaLabelDefault =
        button.dataset.ctaLabelDefault || (button.textContent || "").trim();
      button.dataset.ctaLabelLoading =
        button.dataset.ctaLabelLoading || labels.loading || "Przechodze...";
      button.dataset.ctaLabelSuccess =
        button.dataset.ctaLabelSuccess || labels.success || "Gotowe";

      button.classList.remove("is-loading", "is-success");

      if (stateName === "loading") {
        button.classList.add("is-loading");
        button.textContent = button.dataset.ctaLabelLoading;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (motion && typeof motion.animateCtaState === "function") {
          motion.animateCtaState(button, "loading");
        }
        return;
      }

      button.removeAttribute("aria-busy");
      button.disabled = false;

      if (stateName === "success") {
        button.classList.add("is-success");
        button.textContent = button.dataset.ctaLabelSuccess;
        if (motion && typeof motion.animateCtaState === "function") {
          motion.animateCtaState(button, "success");
        }
        return;
      }

      button.textContent = button.dataset.ctaLabelDefault;
    }

    function toggleAccordionSection(section, items, willCollapse) {
      if (!section || section.dataset.motionBusy === "1") return;
      const detailItems = Array.isArray(items)
        ? items
          .map((item) => {
            if (!item) return null;
            if (item instanceof Element) {
              return { el: item, display: "", manageDisplay: false };
            }
            if (item.el instanceof Element) {
              return {
                el: item.el,
                display: typeof item.display === "string" ? item.display : "",
                manageDisplay: item.manageDisplay === true,
              };
            }
            return null;
          })
          .filter(Boolean)
        : [];

      const canAnimate =
        motion &&
        typeof motion.animateDetailsToggle === "function" &&
        !isReducedMotionPreferred();

      section.dataset.motionBusy = "1";
      const done = () => {
        delete section.dataset.motionBusy;
      };

      if (willCollapse) {
        const finalizeCollapse = () => {
          section.classList.add("collapsed");
          detailItems.forEach((item) => {
            if (item.manageDisplay) {
              item.el.style.display = "none";
            }
          });
          done();
        };

        if (canAnimate && detailItems.length) {
          motion
            .animateDetailsToggle(section, detailItems, false)
            .then(finalizeCollapse, finalizeCollapse);
        } else {
          finalizeCollapse();
        }
        return;
      }

      section.classList.remove("collapsed");
      detailItems.forEach((item) => {
        if (item.manageDisplay) {
          item.el.style.display = item.display;
        }
      });

      if (canAnimate && detailItems.length) {
        motion.animateDetailsToggle(section, detailItems, true).then(done, done);
      } else {
        done();
      }
    }

    function isBackendCalcEnabled() {
      return !!(
        config?.useBackendCalc === true ||
        (window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.useBackendCalc === true)
      );
    }

    function isStrictBackendMode() {
      return isBackendCalcEnabled();
    }

    function toFiniteNumber(value, fallback = null) {
      const numberValue = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numberValue) ? numberValue : fallback;
    }

    function emitAnalytics(eventName, payload) {
      if (!eventName || !analytics || typeof analytics.emit !== "function") {
        return;
      }
      try {
        analytics.emit(eventName, payload || {});
      } catch (_) { }
    }

    function trackSpec(eventName, payload) {
      try {
        if (typeof window.topinstalTrackEvent === "function") {
          window.topinstalTrackEvent(eventName, payload || {});
        }
      } catch (_) { }
    }

    function isUuid(value) {
      return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value
        )
      );
    }

    function createUuid() {
      try {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }
      } catch (_) { }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
      });
    }

    function getOrCreateLeadId(candidate) {
      const fromCandidate = typeof candidate === "string" ? candidate.trim() : "";
      if (isUuid(fromCandidate)) {
        return fromCandidate.toLowerCase();
      }

      const fromState =
        (typeof state?.offerIds?.lead_id === "string" && state.offerIds.lead_id.trim()) ||
        "";
      if (isUuid(fromState)) {
        return fromState.toLowerCase();
      }

      const generated = createUuid().toLowerCase();
      state.offerIds = state.offerIds || {};
      state.offerIds.lead_id = generated;
      return generated;
    }

    function formatCurrencyPln(value) {
      const numeric = toFiniteNumber(value, null);
      if (numeric === null) {
        return null;
      }
      try {
        return new Intl.NumberFormat("pl-PL", {
          style: "currency",
          currency: "PLN",
          maximumFractionDigits: 0,
        }).format(numeric);
      } catch (_) {
        return `${Math.round(numeric)} PLN`;
      }
    }

    function formatDemandKw(value) {
      const numeric = toFiniteNumber(value, null);
      if (numeric === null) {
        return null;
      }
      const rounded = Math.round(numeric * 10) / 10;
      return rounded.toFixed(rounded % 1 === 0 ? 0 : 1);
    }

    function getCanonicalOfferDto(result) {
      let appState = null;
      try {
        appState =
          (typeof getAppState === "function" && getAppState()) ||
          (state && typeof state.getAppState === "function" ? state.getAppState() : null);
      } catch (_) { }

      let canonicalFromState = null;
      try {
        if (state && typeof state.getCanonicalOffer === "function") {
          canonicalFromState = state.getCanonicalOffer(appState);
        } else if (typeof window.getCanonicalOffer === "function") {
          canonicalFromState = window.getCanonicalOffer(appState);
        }
      } catch (_) { }

      return (
        canonicalFromState ||
        result?.offer_dto ||
        null
      );
    }

    function getRecommendedModelLabel(result) {
      const offer = getCanonicalOfferDto(result);
      const directModel =
        offer?.engineering?.selection?.pumpSelection?.hp?.model ||
        offer?.engineering?.selection?.pumpSelection?.aio?.model ||
        offer?.engineering?.selection?.pumpModel ||
        result?.selected_pump ||
        null;
      if (directModel) {
        return String(directModel);
      }

      const recommendedModels = Array.isArray(result?.recommended_models)
        ? result.recommended_models
        : [];
      if (recommendedModels.length > 0) {
        const first = recommendedModels[0];
        if (typeof first === "string") {
          return first;
        }
        if (first && typeof first === "object" && first.name) {
          return String(first.name);
        }
      }

      return "W trakcie doboru";
    }

    function getResultsHeaderPriceLabel(result) {
      const offer = getCanonicalOfferDto(result);
      if (!offer) {
        if (!resultsHeaderMissingOfferLogged) {
          resultsHeaderMissingOfferLogged = true;
          trackSpec("offer_projection_missing_offer_dto", {
            source: "calc",
            tab: 5,
            stepKey: "projection",
            meta: {
              target: "results_header",
              channel: "ui",
            },
          });
        }
        return "Do wyceny po konfiguracji";
      }

      resultsHeaderMissingOfferLogged = false;

      const totalGross = toFiniteNumber(
        offer?.pricing?.totals?.gross,
        toFiniteNumber(offer?.pricing?.total_gross_pln, null)
      );

      if (totalGross === null) {
        return "Do wyceny po konfiguracji";
      }

      const exactLabel = formatCurrencyPln(Math.round(totalGross));
      if (!exactLabel) {
        return "Do wyceny po konfiguracji";
      }
      return exactLabel;
    }

    function resolveResultsSummarySource(result) {
      if (result && typeof result === "object") {
        return result;
      }

      const appState =
        (typeof getAppState === "function" && getAppState()) ||
        (state && typeof state.getAppState === "function" ? state.getAppState() : null) ||
        null;

      return (
        appState?.config_data ||
        null
      );
    }

    function getResultsSummaryViewModel(result) {
      if (
        projectionApi &&
        typeof projectionApi.resolveInputFromRuntime === "function" &&
        typeof projectionApi.buildResultsHeaderViewModel === "function"
      ) {
        const source = resolveResultsSummarySource(result);
        const runtimeInput = projectionApi.resolveInputFromRuntime({
          target: "results_header",
          channel: "ui",
        });
        return projectionApi.buildResultsHeaderViewModel({
          offerDto:
            runtimeInput?.offerDto ||
            (source?.offer_dto && typeof source.offer_dto === "object"
              ? source.offer_dto
              : null),
          leadData: runtimeInput?.leadData || null,
          configuratorSelection: runtimeInput?.configuratorSelection || null,
          uiContext: {
            ...(runtimeInput?.uiContext || {}),
            target: "results_header",
            channel: "ui",
          },
        });
      }

      const source = resolveResultsSummarySource(result);
      return {
        demandKw:
          formatDemandKw(
            source?.max_heating_power ?? source?.recommended_power_kw
          ) || "—",
        recommendedModel: getRecommendedModelLabel(source),
        priceLabel: getResultsHeaderPriceLabel(source),
      };
    }

    function animateResultsSummaryHeader(headerEl) {
      if (!headerEl) return;
      if (motion && typeof motion.animateResultsHeader === "function") {
        motion.animateResultsHeader(headerEl);
      } else {
        headerEl.classList.add("motion-results-pulse");
        setTimeout(() => {
          headerEl.classList.remove("motion-results-pulse");
        }, getMotionDelay(220));
      }
    }

    function renderResultsSummaryHeader(result) {
      const headerEls = dom.qsa('[data-role="results-summary-header"]');
      if (!headerEls.length) {
        return;
      }

      const viewModel = getResultsSummaryViewModel(result);

      headerEls.forEach((headerEl) => {
        if (!headerEl || !headerEl.querySelector) {
          return;
        }

        const demandEl = headerEl.querySelector('[data-role="results-demand-kw"]');
        const modelEl = headerEl.querySelector(
          '[data-role="results-recommendation-model"]'
        );
        const priceEl = headerEl.querySelector('[data-role="results-price-range"]');

        if (demandEl) {
          demandEl.textContent = viewModel.demandKw;
        }
        if (modelEl) {
          modelEl.textContent = viewModel.recommendedModel;
        }
        if (priceEl) {
          priceEl.textContent = viewModel.priceLabel;
        }

        animateResultsSummaryHeader(headerEl);
      });
    }

    trackEvent(root, "heatpump:refreshResultsSummaryHeaders", (event) => {
      renderResultsSummaryHeader(event?.detail?.result || null);
    });

    function normalizeSelectionPumpEntry(entry, fallbackType = null) {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const model = typeof entry.model === "string" ? entry.model : null;
      if (!model) {
        return null;
      }

      const phase = toFiniteNumber(entry.phase, null);
      const pumpType =
        typeof entry.type === "string" && entry.type
          ? entry.type
          : fallbackType || null;

      return {
        model: model,
        power: toFiniteNumber(entry.power ?? entry.power_kw ?? entry.capacity_kW, null),
        series: entry.series || null,
        type: pumpType,
        phase: phase,
        requires3F: phase === 3,
      };
    }

    function buildPumpSelectionResultFromOffer(offerDto, result) {
      const selection = offerDto?.engineering?.selection;
      if (!selection || typeof selection !== "object") {
        return null;
      }

      let hpPump = normalizeSelectionPumpEntry(
        selection?.pumpSelection?.hp,
        selection?.type || "split"
      );
      const aioPump = normalizeSelectionPumpEntry(
        selection?.pumpSelection?.aio,
        "all-in-one"
      );

      if (!hpPump && typeof selection.pumpModel === "string" && selection.pumpModel) {
        hpPump = {
          model: selection.pumpModel,
          power: toFiniteNumber(selection.capacity_kW, null),
          series: null,
          type: selection.type || "split",
          phase: toFiniteNumber(selection.phase, null),
          requires3F: toFiniteNumber(selection.phase, null) === 3,
        };
      }

      const recommendedPowerKw = toFiniteNumber(
        selection.capacity_kW,
        toFiniteNumber(
          result?.recommended_power_kw,
          toFiniteNumber(result?.max_heating_power, null)
        )
      );

      const totalPowerKw =
        toFiniteNumber(result?.max_heating_power, 0) +
        toFiniteNumber(result?.hot_water_power, 0);

      let recommendedModels = [];
      if (Array.isArray(selection.recommendedModels)) {
        recommendedModels = selection.recommendedModels
          .map((modelEntry) => {
            if (typeof modelEntry === "string") {
              return {
                name: modelEntry,
                type: null,
                power_kw: null,
              };
            }
            if (modelEntry && typeof modelEntry === "object") {
              const name = modelEntry.name || modelEntry.model || null;
              if (!name) return null;
              return {
                name: name,
                type: modelEntry.type || null,
                power_kw: toFiniteNumber(
                  modelEntry.power_kw ?? modelEntry.power ?? modelEntry.capacity_kW,
                  null
                ),
              };
            }
            return null;
          })
          .filter(Boolean);
      }

      if (recommendedModels.length === 0) {
        if (hpPump?.model) {
          recommendedModels.push({
            name: hpPump.model,
            type: hpPump.type || "split",
            power_kw: hpPump.power,
          });
        }
        if (aioPump?.model) {
          recommendedModels.push({
            name: aioPump.model,
            type: aioPump.type || "all-in-one",
            power_kw: aioPump.power,
          });
        }
      }

      return {
        recommended_power_kw: recommendedPowerKw,
        pump_selection: {
          hp: hpPump,
          aio: aioPump,
          minPower: recommendedPowerKw,
          totalPower: totalPowerKw,
          all_options: Array.isArray(selection?.pumpSelection?.all_options)
            ? selection.pumpSelection.all_options
            : [],
        },
        recommended_models: recommendedModels,
      };
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // P1.2: KONSOLIDACJA ZAPISU config_data (jedno miejsce)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    /**
     * Zapisuje config_data do sessionStorage (SSoT dla configuratora)
     * @param {Object} options - Opcje zapisu
     * @param {Object} options.configuratorInput - Dane wejściowe konfiguratora
     * @param {Object} options.result - Wynik obliczeń
     * @param {string|null} options.selectedPumpModel - Wybrany model pompy (opcjonalnie)
     * @param {Object} options.pumpSelectionResult - Wynik doboru pomp (opcjonalnie)
     * @param {Object} options.overrideData - Nadpisanie danych (dla wyboru pompy z karty)
     */
    function saveConfigData(options = {}) {
      const {
        configuratorInput = {},
        result = {},
        selectedPumpModel = null,
        pumpSelectionResult = null,
        overrideData = {},
      } = options;

      try {
        // Zbuduj configData z danych wejściowych lub override
        const storage =
          view.sessionStorage ||
          (typeof sessionStorage !== "undefined" ? sessionStorage : null);
        const persistedInstanceId =
          state?.instanceId ||
          root?.getAttribute?.("data-hp-instance") ||
          "default";
        const persistedConfigDataKey = `config_data::${String(
          persistedInstanceId
        )}`;
        const readExistingConfigData = () => {
          const appStateSnapshot =
            typeof getAppState === "function" ? getAppState() : null;
          if (
            appStateSnapshot?.config_data &&
            typeof appStateSnapshot.config_data === "object"
          ) {
            return appStateSnapshot.config_data;
          }

          if (!storage) {
            return null;
          }

          for (const storageKey of [persistedConfigDataKey, "config_data"]) {
            try {
              const raw = storage.getItem(storageKey);
              if (!raw) {
                continue;
              }
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                return parsed;
              }
            } catch (_) { }
          }

          return null;
        };
        const existingConfigSnapshot = readExistingConfigData() || {};
        const canonicalOfferDtoForConfig =
          (overrideData?.offer_dto && typeof overrideData.offer_dto === "object"
            ? overrideData.offer_dto
            : null) ||
          (configuratorInput?.offer_dto &&
            typeof configuratorInput.offer_dto === "object"
            ? configuratorInput.offer_dto
            : null) ||
          (result?.offer_dto && typeof result.offer_dto === "object"
            ? result.offer_dto
            : null) ||
          (existingConfigSnapshot?.offer_dto &&
            typeof existingConfigSnapshot.offer_dto === "object"
            ? existingConfigSnapshot.offer_dto
            : null) ||
          null;
        const derivedPumpSelectionFromOffer = canonicalOfferDtoForConfig
          ? buildPumpSelectionResultFromOffer(canonicalOfferDtoForConfig, result)
          : null;
        const existingHydraulicsInputs =
          existingConfigSnapshot?.hydraulics_inputs &&
            typeof existingConfigSnapshot.hydraulics_inputs === "object"
            ? existingConfigSnapshot.hydraulics_inputs
            : {};
        const configData = {
          ...(existingConfigSnapshot && typeof existingConfigSnapshot === "object"
            ? existingConfigSnapshot
            : {}),
          ...(result && typeof result === "object" ? result : {}),
          ...(configuratorInput && typeof configuratorInput === "object"
            ? configuratorInput
            : {}),
          ...(overrideData && typeof overrideData === "object" ? overrideData : {}),
          from_calculator: true,
          id: overrideData.id || configuratorInput?.id || result?.id || null,
          heated_area:
            overrideData.heated_area ??
            configuratorInput?.heated_area ??
            result?.heated_area ??
            existingConfigSnapshot?.heated_area ??
            null,
          max_heating_power:
            overrideData.max_heating_power ??
            configuratorInput?.max_heating_power ??
            result?.max_heating_power ??
            existingConfigSnapshot?.max_heating_power ??
            null,
          recommended_power_kw:
            overrideData.recommended_power_kw ??
            configuratorInput?.recommended_power_kw ??
            pumpSelectionResult?.recommended_power_kw ??
            derivedPumpSelectionFromOffer?.recommended_power_kw ??
            result?.recommended_power_kw ??
            result?.max_heating_power ??
            existingConfigSnapshot?.recommended_power_kw ??
            null,
          bivalent_power:
            overrideData.bivalent_power ??
            configuratorInput?.bivalent_point_heating_power ??
            configuratorInput?.bivalent_power ??
            result?.bivalent_point_heating_power ??
            existingConfigSnapshot?.bivalent_power ??
            null,
          hot_water_power:
            overrideData.hot_water_power ??
            configuratorInput?.hot_water_power ??
            result?.hot_water_power ??
            existingConfigSnapshot?.hot_water_power ??
            0,
          include_hot_water:
            overrideData.include_hot_water !== undefined
              ? overrideData.include_hot_water
              : configuratorInput?.include_hot_water !== undefined
                ? configuratorInput.include_hot_water
                : result?.include_hot_water !== undefined
                  ? result.include_hot_water
                  : !!existingConfigSnapshot?.include_hot_water,
          hot_water_persons:
            overrideData.hot_water_persons ??
            configuratorInput?.hot_water_persons ??
            result?.hot_water_persons ??
            existingConfigSnapshot?.hot_water_persons ??
            null,
          hot_water_usage:
            overrideData.hot_water_usage ??
            configuratorInput?.hot_water_usage ??
            result?.hot_water_usage ??
            existingConfigSnapshot?.hot_water_usage ??
            null,
          heating_type:
            overrideData.heating_type ??
            configuratorInput?.heating_type ??
            result?.heating_type ??
            existingConfigSnapshot?.heating_type ??
            null,
          pump_selection:
            overrideData.pump_selection ??
            configuratorInput?.pump_selection ??
            pumpSelectionResult?.pump_selection ??
            derivedPumpSelectionFromOffer?.pump_selection ??
            existingConfigSnapshot?.pump_selection ??
            null,
          selected_pump:
            overrideData.selected_pump ??
            selectedPumpModel ??
            pumpSelectionResult?.pump_selection?.hp?.model ??
            pumpSelectionResult?.pump_selection?.aio?.model ??
            derivedPumpSelectionFromOffer?.pump_selection?.hp?.model ??
            derivedPumpSelectionFromOffer?.pump_selection?.aio?.model ??
            canonicalOfferDtoForConfig?.engineering?.selection?.pumpModel ??
            existingConfigSnapshot?.selected_pump ??
            null,
          annual_energy_consumption:
            overrideData.annual_energy_consumption ??
            result?.annual_energy_consumption ??
            existingConfigSnapshot?.annual_energy_consumption ??
            null,
          design_outdoor_temperature:
            overrideData.design_outdoor_temperature ??
            result?.design_outdoor_temperature ??
            existingConfigSnapshot?.design_outdoor_temperature ??
            null,
          offer_dto: canonicalOfferDtoForConfig,

          // Ensure shape expected by configurator-unified.js
          hydraulics_inputs: {
            has_underfloor_actuators:
              existingHydraulicsInputs.has_underfloor_actuators === true,
            radiators_is_ht: existingHydraulicsInputs.radiators_is_ht === true,
            bivalent_enabled: existingHydraulicsInputs.bivalent_enabled === true,
            bivalent_source_type:
              existingHydraulicsInputs.bivalent_source_type ?? null,
            bivalent_source_power_kw:
              existingHydraulicsInputs.bivalent_source_power_kw ?? null,
          },
          recommendations:
            existingConfigSnapshot?.recommendations &&
              typeof existingConfigSnapshot.recommendations === "object"
              ? existingConfigSnapshot.recommendations
              : {},
        };

        // ⚠️ FIX: Sprawdź czy view.sessionStorage istnieje (view = doc.defaultView || window)
        if (!storage) {
          if (typeof updateAppState === "function") {
            updateAppState({ config_data: configData });
          }
          if (window.__HP_DEBUG__) {
            LOG.warn("flow", "[FLOW-17A] sessionStorage not available");
          }
          return;
        }

        // Multi-root: klucz per instancja (config_data::instanceId)
        const instanceId =
          state?.instanceId ||
          root?.getAttribute?.("data-hp-instance") ||
          "default";
        const configDataKey = `config_data::${String(instanceId)}`;
        const readPersistedConfigData = () => {
          const appStateSnapshot =
            typeof getAppState === "function" ? getAppState() : null;
          if (
            appStateSnapshot?.config_data &&
            typeof appStateSnapshot.config_data === "object"
          ) {
            return appStateSnapshot.config_data;
          }

          if (!storage) {
            return null;
          }

          for (const storageKey of [configDataKey, "config_data"]) {
            try {
              const raw = storage.getItem(storageKey);
              if (!raw) {
                continue;
              }
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                return parsed;
              }
            } catch (_) { }
          }

          return null;
        };
        const existingConfigData = readPersistedConfigData() || {};
        const canonicalOfferDto =
          (overrideData?.offer_dto && typeof overrideData.offer_dto === "object"
            ? overrideData.offer_dto
            : null) ||
          (configuratorInput?.offer_dto &&
            typeof configuratorInput.offer_dto === "object"
            ? configuratorInput.offer_dto
            : null) ||
          (result?.offer_dto && typeof result.offer_dto === "object"
            ? result.offer_dto
            : null) ||
          (existingConfigData?.offer_dto &&
            typeof existingConfigData.offer_dto === "object"
            ? existingConfigData.offer_dto
            : null) ||
          null;
        const derivedPumpSelectionResult = canonicalOfferDto
          ? buildPumpSelectionResultFromOffer(canonicalOfferDto, result)
          : null;
        const existingHydraulics =
          existingConfigData?.hydraulics_inputs &&
            typeof existingConfigData.hydraulics_inputs === "object"
            ? existingConfigData.hydraulics_inputs
            : {};

        // ⚠️ FIX: sessionStorage.setItem() może rzucać QuotaExceededError lub SecurityError
        // w trybach prywatnych / restrykcyjnych przeglądarkach
        try {
          storage.setItem(configDataKey, JSON.stringify(configData));
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-17A] config_data saved to sessionStorage", {
              keys: Object.keys(configData),
              selected_pump: configData.selected_pump,
              source: overrideData.selected_pump
                ? "pump_card_click"
                : "calculation_result",
            });
          }
        } catch (storageError) {
          // Obsługa specyficznych błędów sessionStorage
          if (storageError.name === "QuotaExceededError") {
            if (window.__HP_DEBUG__) {
              LOG.warn(
                "flow",
                "[FLOW-17A] sessionStorage quota exceeded - config_data not saved"
              );
            }
            // ⚠️ FIX P0.2: Fallback do appState jeśli sessionStorage zablokowany
            if (typeof updateAppState === "function") {
              try {
                updateAppState({ config_data: configData });
                if (window.__HP_DEBUG__) {
                  LOG.info(
                    "flow",
                    "[FLOW-17A] config_data saved to appState (sessionStorage quota exceeded)"
                  );
                }
              } catch (e) {
                if (window.__HP_DEBUG__) {
                  LOG.warn(
                    "flow",
                    "[FLOW-17A] Failed to save config_data to appState:",
                    e
                  );
                }
              }
            }
          } else if (storageError.name === "SecurityError") {
            if (window.__HP_DEBUG__) {
              LOG.warn(
                "flow",
                "[FLOW-17A] sessionStorage security error (private mode?) - config_data not saved"
              );
            }
            // ⚠️ FIX P0.2: Fallback do appState jeśli sessionStorage zablokowany
            if (typeof updateAppState === "function") {
              try {
                updateAppState({ config_data: configData });
                if (window.__HP_DEBUG__) {
                  LOG.info(
                    "flow",
                    "[FLOW-17A] config_data saved to appState (sessionStorage blocked)"
                  );
                }
              } catch (e) {
                if (window.__HP_DEBUG__) {
                  LOG.warn(
                    "flow",
                    "[FLOW-17A] Failed to save config_data to appState:",
                    e
                  );
                }
              }
            }
          } else {
            if (window.__HP_DEBUG__) {
              LOG.warn(
                "flow",
                "[FLOW-17A] sessionStorage.setItem() failed",
                storageError
              );
            }
          }
          // Nie rzucamy dalej - aplikacja może działać bez zapisu config_data
        }
        if (typeof updateAppState === "function") {
          updateAppState({ config_data: configData });
        }
      } catch (e) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-17A] Failed to save config_data to sessionStorage",
            e
          );
        }
      }
    }

    LOG.info("module:resultsRenderer", "init called", {
      hasFormEngine: !!formEngine,
    });
    const updateAppState = state?.updateAppState;
    const setOffer = state?.setOffer;
    const getAppState = state?.getAppState;
    const showTab = state?.showTab;

    // ⚠️ FIX P1.1: Użyj konsolidowanej tabeli (Single Source of Truth)
    // Fallback do lokalnej tabeli dla kompatybilności wstecznej
    const pumpMatchingTable = window.PUMP_MATCHING_TABLE || {
      // HIGH PERFORMANCE - SPLIT - 1~ (230V) - Seria K
      "KIT-WC03K3E5": {
        min: { surface: 3.0, mixed: 3.0, radiators: 2.5 },
        max: { surface: 4.2, mixed: 4.2, radiators: 3.5 },
        power: 3,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      "KIT-WC05K3E5": {
        min: { surface: 4.3, mixed: 4.3, radiators: 3.5 },
        max: { surface: 6.5, mixed: 6.4, radiators: 6.0 },
        power: 5,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      "KIT-WC07K3E5": {
        min: { surface: 5.5, mixed: 5.0, radiators: 4.5 },
        max: { surface: 7.0, mixed: 6.5, radiators: 6.5 },
        power: 7,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      "KIT-WC09K3E5": {
        min: { surface: 6.7, mixed: 6.5, radiators: 5.5 },
        max: { surface: 8.0, mixed: 8.0, radiators: 7.5 },
        power: 9,
        series: "K",
        type: "split",
        requires3F: false,
        phase: 1,
      },
      // HIGH PERFORMANCE - SPLIT - 3~ (400V) - Seria K
      "KIT-WC09K3E8": {
        min: { surface: 8.0, mixed: 8.1, radiators: 7.5 },
        max: { surface: 11.0, mixed: 10.5, radiators: 10.0 },
        power: 9,
        series: "K",
        type: "split",
        requires3F: true,
        phase: 3,
      },
      "KIT-WC12K9E8": {
        min: { surface: 10.5, mixed: 9.5, radiators: 8.5 },
        max: { surface: 14.5, mixed: 13.5, radiators: 13.0 },
        power: 12,
        series: "K",
        type: "split",
        requires3F: true,
        phase: 3,
      },
      "KIT-WC16K9E8": {
        min: { surface: 12.5, mixed: 11.0, radiators: 10.0 },
        max: { surface: 17.5, mixed: 16.0, radiators: 14.5 },
        power: 16,
        series: "K",
        type: "split",
        requires3F: true,
        phase: 3,
      },
      // HIGH PERFORMANCE - ALL IN ONE 185L - 1~ (230V) - Seria K
      "KIT-ADC03K3E5": {
        min: { surface: 3.0, mixed: 3.0, radiators: 2.5 },
        max: { surface: 4.2, mixed: 4.2, radiators: 3.5 },
        power: 3,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      "KIT-ADC05K3E5": {
        min: { surface: 4.3, mixed: 4.3, radiators: 3.5 },
        max: { surface: 6.5, mixed: 6.4, radiators: 6.0 },
        power: 5,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      "KIT-ADC07K3E5": {
        min: { surface: 5.5, mixed: 5.0, radiators: 4.5 },
        max: { surface: 7.0, mixed: 6.5, radiators: 6.5 },
        power: 7,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      "KIT-ADC09K3E5": {
        min: { surface: 6.7, mixed: 6.5, radiators: 5.5 },
        max: { surface: 8.0, mixed: 8.0, radiators: 7.5 },
        power: 9,
        series: "K",
        type: "all-in-one",
        requires3F: false,
        phase: 1,
        cwu_tank: 185,
      },
      // HIGH PERFORMANCE - ALL IN ONE 185L - 3~ (400V) - Seria K
      "KIT-ADC09K9E8": {
        min: { surface: 8.0, mixed: 8.1, radiators: 7.5 },
        max: { surface: 11.0, mixed: 10.5, radiators: 10.0 },
        power: 9,
        series: "K",
        type: "all-in-one",
        requires3F: true,
        phase: 3,
        cwu_tank: 185,
      },
      "KIT-ADC12K9E8": {
        min: { surface: 10.5, mixed: 9.5, radiators: 8.5 },
        max: { surface: 14.5, mixed: 13.5, radiators: 13.0 },
        power: 12,
        series: "K",
        type: "all-in-one",
        requires3F: true,
        phase: 3,
        cwu_tank: 185,
      },
      "KIT-ADC16K9E8": {
        min: { surface: 12.5, mixed: 11.0, radiators: 10.0 },
        max: { surface: 17.5, mixed: 16.0, radiators: 14.5 },
        power: 16,
        series: "K",
        type: "all-in-one",
        requires3F: true,
        phase: 3,
        cwu_tank: 185,
      },
    };

    // Baza danych pomp ciepła - generowana z pumpMatchingTable (ceny szacunkowe)
    const pumpCardsData = Object.keys(pumpMatchingTable).map((model) => {
      const data = pumpMatchingTable[model];
      // Użyj dynamicznego URL z konfiguracji WordPress
      const imgUrl = config?.imgUrl || "../img";
      const image =
        data.type === "split"
          ? `${imgUrl}/split-k.png`
          : `${imgUrl}/allinone.png`;
      // Szacunkowe ceny na podstawie mocy i typu (można później uzupełnić z bazy cen)
      const basePrice = data.type === "split" ? 15000 : 17000;
      const powerMultiplier = data.power * 1000;
      const phaseMultiplier = data.phase === 3 ? 1.1 : 1.0;
      const price = Math.round(basePrice + powerMultiplier * phaseMultiplier);
      return {
        model: model,
        power: data.power,
        series: data.series,
        type: data.type,
        image: image,
        price: price,
        phase: data.phase,
        requires3F: data.requires3F,
      };
    });

    /**
     * Waliduje i normalizuje dane wyników z API
     */
    function validateAndNormalizeResult(result) {
      if (!result || typeof result !== "object") {
        throw new Error("Brak danych wyników lub nieprawidłowy format");
      }

      // Mapowanie pól z API na wymagane pola
      const normalized = {
        total_area: parseFloat(
          result.total_area || result.totalArea || result.floor_area || 0
        ),
        heated_area: parseFloat(
          result.heated_area || result.heatedArea || result.floor_area || 0
        ),
        design_outdoor_temperature: parseFloat(
          result.design_outdoor_temperature ||
          result.designOutdoorTemperature ||
          -20
        ),
        max_heating_power: parseFloat(
          result.max_heating_power ||
          result.maxHeatingPower ||
          result.heating_power ||
          0
        ),
        hot_water_power: parseFloat(
          result.hot_water_power ||
          result.hotWaterPower ||
          result.cwu_power ||
          0
        ),
        bivalent_point_heating_power: parseFloat(
          result.bivalent_point_heating_power ||
          result.bivalentPointHeatingPower ||
          result.bi_power ||
          0
        ),
        avg_heating_power: parseFloat(
          result.avg_heating_power ||
          result.avgHeatingPower ||
          result.average_power ||
          0
        ),
        avg_outdoor_temperature: parseFloat(
          result.avg_outdoor_temperature || result.avgOutdoorTemperature || 8
        ),
        annual_energy_consumption: parseFloat(
          result.annual_energy_consumption ||
          result.annualEnergyConsumption ||
          result.energy_consumption ||
          0
        ),
        annual_energy_consumption_factor: parseFloat(
          result.annual_energy_consumption_factor ||
          result.annualEnergyConsumptionFactor ||
          result.energy_factor ||
          0
        ),
        heating_power_factor: parseFloat(
          result.heating_power_factor ||
          result.heatingPowerFactor ||
          result.power_factor ||
          0
        ),
        cop: parseFloat(result.cop || result.COP || 4.0),
        scop: parseFloat(result.scop || result.SCOP || 4.0),
      };

      // Sprawdź czy mamy podstawowe dane
      if (normalized.max_heating_power <= 0) {
        throw new Error("Brak wymaganej mocy grzewczej w wynikach API");
      }

      if (normalized.heated_area <= 0) {
        throw new Error("Brak powierzchni ogrzewanej w wynikach API");
      }

      // Logowanie usunięte dla produkcji
      return normalized;
    }

    /**
     * Dobiera pompy ciepła na podstawie wyników
     */
    function selectHeatPumps(result, heatingType = "radiators") {
      const powerDemand =
        result.max_heating_power + (result.hot_water_power || 0);
      // Logowanie usunięte dla produkcji

      const matchingPumps = Object.entries(pumpMatchingTable)
        .filter(([model, data]) => {
          const min = data.min[heatingType];
          const max = data.max[heatingType];
          return powerDemand >= min && powerDemand <= max;
        })
        .map(([model, data]) => {
          const pumpData = pumpCardsData.find((p) => p.model === model);
          // Użyj dynamicznego URL z konfiguracji WordPress
          const imgUrl = config?.imgUrl || "../img";
          return {
            model: model,
            power: data.power,
            series: data.series,
            type: data.type,
            image: pumpData?.image || `${imgUrl}/default-pump.png`,
            price: pumpData?.price || 0,
          };
        });

      // Logowanie usunięte dla produkcji
      return matchingPumps;
    }
    function displayResultsInternal(result) {
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-9] displayResultsInternal() STARTED");
        LOG.info("flow", "[FLOW-9] Result received:", result);
      }

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // WORKFLOW COMPLETION (SCREEN 0) — UX: user sees completion + CTA,
      // while results/configurator load in background.
      // We trigger this here (resultsRenderer) to avoid relying on apiCaller versions/caching.
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      let completionRequested = false;
      try {
        const alreadyShown =
          typeof getAppState === "function"
            ? !!(
              getAppState()?.uiFlags?.completionAnimationShown ||
              getAppState()?.completionAnimationShown
            )
            : false;
        completionRequested = !alreadyShown;

        if (!alreadyShown) {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-9A] Dispatching workflow completion event (screen 0)..."
            );
          }
          root.dispatchEvent(
            new CustomEvent("heatpump:showWorkflowCompletion", {
              detail: { result },
              bubbles: true,
            })
          );
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-9A] Workflow completion event dispatched");
          }
        } else {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-9A] Workflow completion already shown - skipping"
            );
          }
        }
      } catch (e) {
        LOG.warn(
          "flow",
          "[FLOW-9A] Failed to dispatch workflow completion event",
          e
        );
        // On error, default to requesting completion to ensure UX flow continues
        completionRequested = true;
      }

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // UKRYJ FORMULARZ I POKAŻ WYNIKI
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-10] Hiding form sections...");
      }
      // Ukryj wszystkie sekcje formularza (data-tab="0" do "5")
      const formSections = dom.qsa(".section[data-tab]");
      formSections.forEach((section) => {
        section.classList.remove("active");
        section.style.display = "none";
      });
      if (window.__HP_DEBUG__) {
        LOG.info(
          "flow",
          `[FLOW-10] Hidden ${formSections.length} form sections`
        );
      }

      // Ukryj progress bar
      // UWAGA: jeśli pokazujemy workflow completion (screen 0), progress bar ma zostać widoczny i ustawiony na 100%.
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-11] Progress bar handling...");
      }
      const progressBarContainer = dom.byId("progress-bar-container");
      if (progressBarContainer) {
        if (completionRequested) {
          if (window.__HP_DEBUG__) {
            LOG.info(
              "flow",
              "[FLOW-11] Keeping progress bar visible for workflow completion"
            );
          }
        } else {
          progressBarContainer.style.display = "none";
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-11] Progress bar hidden");
          }
        }
      } else {
        if (window.__HP_DEBUG__) {
          LOG.warn("flow", "[FLOW-11] Progress bar container not found");
        }
      }

      // ✅ UKRYJ sekcję wyników - workflow completion będzie widoczny zamiast tego
      // hp-results pozostaje w tle (hidden) - dane są obliczone i dostępne dla konfiguratora
      console.log(
        "🔄 [FLOW-12] Keeping results container hidden (background data)..."
      );
      const resultsContainer = dom.qs(".hp-results");
      if (resultsContainer) {
        resultsContainer.classList.add("hidden"); // UKRYJ (nie pokazuj!)
        resultsContainer.style.display = "none"; // UKRYJ (nie pokazuj!)
        console.log(
          "✅ [FLOW-12] Results container kept hidden (workflow completion will be shown instead)"
        );
      } else {
        console.error(
          "❌ [FLOW-12] Results container (.hp-results) not found!"
        );
      }

      // Results wrapper section removed (no longer exists in HTML - was legacy code)

      // Pokaż actions (buttons PDF, email, itp.)
      const actionsContainers = dom.qsa(".results-actions");
      actionsContainers.forEach((el) => el.classList.remove("hidden"));

      const setText = (id, val, unit = "") => {
        const el = dom.byId(id);
        if (el && val !== undefined && val !== null)
          el.textContent = `${val}${unit}`;
      };

      // Podstawowe wyniki
      setText("r-total-area", result.total_area, " m²");
      setText("r-heated-area", result.heated_area, " m²");
      setText("r-max-power", result.max_heating_power, " kW");
      setText("r-cwu", result.hot_water_power || 0, " kW");
      const thermalAnnual = Number(result.annual_energy_consumption);
      const electricAnnual = annualElectricKwhFromThermal(thermalAnnual);
      setText("r-energy", electricAnnual, " kWh");
      setText("r-temp", result.design_outdoor_temperature, "°C");
      setText("r-bi-power", formatKwPolishOneDecimal(result.bivalent_point_heating_power), "");
      setText("r-avg-power", formatKwPolishOneDecimal(result.avg_heating_power), "");
      setText("r-temp-avg", result.avg_outdoor_temperature, "°C");
      const heatedForFactor = Number(result.heated_area);
      const factorElectric =
        heatedForFactor > 0 && Number.isFinite(electricAnnual)
          ? Math.round((electricAnnual / heatedForFactor) * 100) / 100
          : result.annual_energy_consumption_factor;
      setText("r-factor", factorElectric, " kWh/m²");
      setText("r-power-factor", result.heating_power_factor, " W/m²");
      renderResultsSummaryHeader(result);
      const inlineKw = dom.qs('[data-role="result-kw-inline"]');
      if (inlineKw) {
        inlineKw.textContent = formatDemandKw(
          result?.max_heating_power ?? result?.recommended_power_kw
        ) || "—";
      }
      trackSpec("calc_result_view", {
        source: "calc",
        tab: 5,
        stepKey: "results",
        traceId:
          result?.trace_id ||
          result?.traceId ||
          result?.offer_dto?.traceId ||
          null,
        meta: {
          view: "results",
        },
      });

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // SPECJALNE KOMUNIKATY W PROFILU ENERGETYCZNYM
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

      // Komunikat dla budynków >25kW
      const systemComment = dom.byId("system-comment-text");
      if (
        systemComment &&
        (result.max_heating_power >= 25 || result.recommended_power_kw >= 25)
      ) {
        systemComment.textContent =
          "Obsługa budynków o mocy w temp. projektowej większej niż 25kW niedostępna. Zalecamy termomodernizację budynku przed doborem pompy ciepła.";
        // UJEDNOLICONE: Kolor zgodny z CSS (--color-gold-dark: #8b6914) - OK
        systemComment.style.color = "#8b6914";
        systemComment.style.fontWeight = "600"; // Ujednolicone: 600 zamiast bold
        // UJEDNOLICONE: Font-family z CSS
        systemComment.style.fontFamily =
          "'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      }

      // Komunikat dla budynków 16-25kW
      if (
        systemComment &&
        result.max_heating_power >= 16 &&
        result.max_heating_power < 25
      ) {
        systemComment.textContent =
          "System wykrył prądożerne połączenie. Budynek najprawdopodobniej wymaga termomodernizacji. Rekomendujemy ocieplenie budynku lub wymianę stolarki przed doborem pompy ciepła.";
        // UJEDNOLICONE: Kolor zgodny z CSS (--color-accent-dark: #b8976a) - OK
        systemComment.style.color = "#b8976a";
        systemComment.style.fontWeight = "600"; // Ujednolicone: 600 zamiast bold
        // UJEDNOLICONE: Font-family z CSS
        systemComment.style.fontFamily =
          "'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      }

      // === DANE ROZSZERZONE ===
      if (result.extended) {
        // Logowanie usunięte dla produkcji

        // Pokaż sekcje rozszerzone
        const extendedSections = dom.byId("extended-results-sections");
        if (extendedSections) {
          extendedSections.style.display = "block";
        }

        // 1. Straty ciepła (Energy Losses)
        if (
          result.extended.energy_losses &&
          result.extended.energy_losses.length > 0
        ) {
          displayEnergyLosses(result.extended.energy_losses);
        }

        // 2. Propozycje modernizacji (Improvements)
        if (
          result.extended.improvements &&
          result.extended.improvements.length > 0
        ) {
          displayImprovements(result.extended.improvements);
        }

        // 3. Koszty ogrzewania (Heating Costs)
        if (
          result.extended.heating_costs &&
          result.extended.heating_costs.length > 0
        ) {
          displayHeatingCosts(
            result.extended.heating_costs,
            result.extended.heating_costs_assumptions || null
          );
        }

        // 4. Punkty biwalentne (Bivalent Points)
        if (result.extended.bivalent_points) {
          displayBivalentPoints(result.extended.bivalent_points);
        }
      }

      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // INICJALIZACJA AKORDEONÓW PO WYŚWIETLENIU WYNIKÓW
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // Upewnij się, że akordeony są zainicjalizowane po wyświetleniu wyników
      setTimeout(() => {
        // Sprawdź czy calculatorUI jest dostępny i ma funkcję initAccordions
        if (window.__HP_MODULES__?.calculatorUI?.initAccordions) {
          window.__HP_MODULES__.calculatorUI.initAccordions();
        } else if (typeof window.initAccordions === 'function') {
          window.initAccordions();
        } else {
          // Fallback: inicjalizuj akordeony bezpośrednio
          initAccordionsDirectly();
        }
      }, 100);

      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-14] Basic results displayed");
      }

      // === INTEGRACJA Z KONFIGURATOREM MASZYNOWNI ===
      if (window.__HP_DEBUG__) {
        LOG.info("flow", "[FLOW-15] Starting configurator integration...");
      }

      // Zbierz podstawowe dane z formularza PRZED blokiem try (używane też poza try)
      let formSnapshot = {};
      if (formEngine && typeof formEngine.getState === "function") {
        formSnapshot = formEngine.getState() || {};
        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-15] Form snapshot collected:", formSnapshot);
        }
      } else {
        if (window.__HP_DEBUG__) {
          LOG.warn("flow", "[FLOW-15] formEngine.getState not available");
        }
      }

      try {
        let pumpSelectionResult = null;
        pumpSelectionResult = buildPumpSelectionResultFromOffer(
          result?.offer_dto || null,
          result
        );

        if (pumpSelectionResult && window.__HP_DEBUG__) {
          LOG.info(
            "flow",
            "[FLOW-16] Pump selection sourced from backend OfferDTO",
            pumpSelectionResult
          );
        }

        const canUseLegacySelectionFallback = !isStrictBackendMode();
        if (!pumpSelectionResult && canUseLegacySelectionFallback) {
          // Legacy fallback: local pump matching table.
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-16] Calling DobierzPompe() fallback...");
          }
          try {
            // Dobór pompy musi uwzględniać dane z formularza (OZC result nie niesie heating_type)
            const pumpSelectionContext = Object.assign({}, result, {
              heating_type:
                result.heating_type !== undefined
                  ? result.heating_type
                  : formSnapshot.heating_type,
            });

            const pumpGroups = DobierzPompe(pumpSelectionContext);
            if (window.__HP_DEBUG__) {
              LOG.info("flow", "[FLOW-16] DobierzPompe() result:", pumpGroups);
            }
            const recommendedGroup = pumpGroups && pumpGroups[0];
            if (recommendedGroup) {
              const hpPump = recommendedGroup.wc || recommendedGroup.sdc || null;
              const aioPump = recommendedGroup.adc || null;

              pumpSelectionResult = {
                recommended_power_kw: recommendedGroup.power,
                pump_selection: {
                  hp: hpPump
                    ? {
                      model: hpPump.model,
                      power: hpPump.power,
                      series: hpPump.series,
                      type: "split",
                      phase: hpPump.phase,
                      requires3F: hpPump.requires3F,
                    }
                    : null,
                  aio: aioPump
                    ? {
                      model: aioPump.model,
                      power: aioPump.power,
                      series: aioPump.series,
                      type: "all-in-one",
                      phase: aioPump.phase,
                      requires3F: aioPump.requires3F,
                    }
                    : null,
                  minPower: recommendedGroup.power,
                  totalPower:
                    parseFloat(result.max_heating_power || 0) +
                    parseFloat(result.hot_water_power || 0),
                },
                recommended_models: [
                  ...(hpPump
                    ? [
                      {
                        name: hpPump.model,
                        type: hpPump.type,
                        power_kw: hpPump.power,
                      },
                    ]
                    : []),
                  ...(aioPump
                    ? [
                      {
                        name: aioPump.model,
                        type: aioPump.type,
                        power_kw: aioPump.power,
                      },
                    ]
                    : []),
                ],
              };

              if (window.__HP_DEBUG__) {
                LOG.info(
                  "flow",
                  "[FLOW-16] Pump selection result:",
                  pumpSelectionResult
                );
              }
            } else if (window.__HP_DEBUG__) {
              LOG.warn("flow", "[FLOW-16] No recommended pump group found");
            }
          } catch (e) {
            LOG.error("flow", "[FLOW-16] Error in DobierzPompe():", e);
          }
        } else if (!pumpSelectionResult) {
          LOG.warn(
            "flow",
            "[FLOW-16] Strict backend mode: OfferDTO selection missing, local fallback disabled"
          );
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // 📊 LOGOWANIE WYNIKÓW Z SILNIKÓW (przed przekazaniem do konfiguratora)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

        // 1. Zapotrzebowanie budynku (OZC)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // P1 FIX: Utwardzenie - rozróżnia null/undefined od NaN, akceptuje stringi liczbowe
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        function safeNumber(value) {
          if (value == null) return null;
          const n = typeof value === 'number' ? value : Number(value);
          return Number.isFinite(n) ? n : null;
        }

        const maxPower = safeNumber(result.max_heating_power);
        const designHeatLoss_kW = safeNumber(result.designHeatLoss_kW);
        const designHeatLoss = maxPower || designHeatLoss_kW;

        if (designHeatLoss != null && Number.isFinite(designHeatLoss)) {
          // OK - mamy poprawną wartość liczbową
        } else {
          // Sprawdź czy to NaN (błąd pipeline) czy brak wartości
          const rawMaxPower = result.max_heating_power;
          const rawDesignHeatLoss = result.designHeatLoss_kW;
          if (rawMaxPower === NaN || rawDesignHeatLoss === NaN ||
            (typeof rawMaxPower === 'number' && !Number.isFinite(rawMaxPower)) ||
            (typeof rawDesignHeatLoss === 'number' && !Number.isFinite(rawDesignHeatLoss))) {
            console.error(
              "BŁĄD PIPELINE: max_heating_power lub designHeatLoss_kW jest NaN"
            );
            console.error("   To wskazuje na błąd w pipeline konwersji wyników");
            console.error("   Raw values:", { max_heating_power: rawMaxPower, designHeatLoss_kW: rawDesignHeatLoss });
          } else {
            console.warn(
              "⚠️ BRAK WYNIKU: Zapotrzebowanie budynku nie zostało obliczone"
            );
            console.warn(
              "   Przyczyna: max_heating_power i designHeatLoss_kW są null/undefined"
            );
          }
        }

        // 2. Zarekomendowana pompa
        if (pumpSelectionResult && pumpSelectionResult.pump_selection) {
          const ps = pumpSelectionResult.pump_selection;
        } else {
          console.warn("⚠️ BRAK WYNIKU: Nie udało się dobrać pompy");
          console.warn(
            "   Przyczyna: pumpSelectionResult jest null lub pump_selection jest puste"
          );
          if (pumpSelectionResult) {
            console.warn(
              "   Szczegóły pumpSelectionResult:",
              pumpSelectionResult
            );
          }
        }

        // 3. CWU (będzie obliczone w konfiguratorze, ale logujemy dane wejściowe)
        // Sprawdź zarówno formSnapshot jak i result (result może mieć zaktualizowaną wartość z API)
        const cwuFromForm =
          formSnapshot.include_hot_water === true ||
          formSnapshot.include_hot_water === "yes";
        const cwuFromResult =
          result.include_hot_water === true ||
          result.include_hot_water === "yes";
        const cwuEnabled = cwuFromForm || cwuFromResult;
        const cwuPower = result.hot_water_power || null;
        if (!cwuEnabled) {
        } else if (!cwuPower && !formSnapshot.hot_water_persons) {
          console.warn(
            "⚠️ CWU włączone, ale brak danych do doboru (hot_water_power i hot_water_persons są puste)"
          );
        }

        // 4. Bufor (będzie obliczony w konfiguratorze, ale logujemy dane wejściowe)
        if (!designHeatLoss || !Number.isFinite(designHeatLoss)) {
          const msg = designHeatLoss === null || designHeatLoss === undefined
            ? "⚠️ BRAK WYNIKU: max_heating_power jest wymagane do doboru bufora"
            : "BŁĄD PIPELINE: max_heating_power jest NaN - błąd w konwersji wyników";
          console.warn(msg);
        }

        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-17] Building configuratorInput...");
        }

        // 3) Zbuduj obiekt danych wejściowych dla konfiguratora – na bazie wyników + doboru pomp
        // Uwaga: result może nie zawierać include_hot_water (to jest pole z formularza, nie z API)
        // Więc używamy formSnapshot, ale sprawdzamy też czy w result jest (dla pewności)
        const includeHotWaterValue =
          result.include_hot_water !== undefined
            ? result.include_hot_water
            : formSnapshot.include_hot_water;
        const includeHotWaterBool =
          includeHotWaterValue === true ||
          includeHotWaterValue === "yes" ||
          includeHotWaterValue === 1 ||
          includeHotWaterValue === "1";

        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-17] CWU enabled:", includeHotWaterBool);
        }

        const configuratorInput = {
          ...result,
          climate_zone:
            formSnapshot.location_id || formSnapshot.climate_zone || null,
          construction_year: formSnapshot.construction_year || null,
          insulation: formSnapshot.wall_size || null,
          heating_type: formSnapshot.heating_type || null,
          installation_type: formSnapshot.heating_type || null,
          source_type: formSnapshot.source_type || null,
          hot_water_persons: formSnapshot.hot_water_persons || null,
          hot_water_usage: formSnapshot.hot_water_usage || null,
          include_hot_water: includeHotWaterBool,
          building_type: formSnapshot.building_type || null,
          // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          // OZC SINGLE SOURCE OF TRUTH — DO NOT DERIVE POWER ELSEWHERE
          // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          // ARCHITECTURAL: recommended_power_kw MUST equal max_heating_power from OZC
          // max_heating_power comes from OZCEngine.designHeatLoss_kW (canonical)
          // Fallback chain is for backward compatibility only
          // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          recommended_power_kw:
            result.max_heating_power || // PRIMARY: OZC canonical output
            pumpSelectionResult?.recommended_power_kw || // FALLBACK: pump selection
            null,
          recommended_models:
            pumpSelectionResult?.recommended_models || [],
          // NOWY FORMAT: przekaż wyniki doboru pomp do konfiguratora
          pump_selection: pumpSelectionResult?.pump_selection || null,
        };

        if (window.__HP_DEBUG__) {
          LOG.info(
            "flow",
            "[FLOW-17] configuratorInput built:",
            configuratorInput
          );
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // P1.2: KONSOLIDACJA ZAPISU config_data (jedno miejsce)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // SSoT: sessionStorage.config_data — required by configurator-unified.js (hydraulics inputs & persistence)
        // Previously this was only set after clicking "WYBIERZ I KONFIGURUJ" on pump cards,
        // but in the desired UX we don't expose hp-results at all on this screen.
        // So we persist config_data immediately after calculations.
        const selectedPumpModel =
          pumpSelectionResult?.pump_selection?.hp?.model ||
          pumpSelectionResult?.pump_selection?.aio?.model ||
          null;

        saveConfigData({
          configuratorInput,
          result,
          selectedPumpModel,
          pumpSelectionResult,
        });

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // APP STATE PERSISTENCE — zapisz wynik obliczeń
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        if (window.__HP_DEBUG__) {
          LOG.info("flow", "[FLOW-18] Saving to app state...");
        }
        if (typeof setOffer === "function") {
          setOffer(configuratorInput?.offer_dto || null);
        }
        if (typeof updateAppState === "function") {
          if (window.__HP_DEBUG__) {
            LOG.info("flow", "[FLOW-18] Saved canonical offer and config_data");
          }
        } else {
          if (window.__HP_DEBUG__) {
            LOG.warn("flow", "[FLOW-18] updateAppState not available");
          }
        }
      } catch (e) {
        console.error(
          "BŁĄD: Nie udało się przekazać danych do konfiguratora maszynowni"
        );
        console.error("   Błąd:", e);
        console.error("   Stack:", e.stack);
      }

      // === ONBOARDING MODAL DLA KONFIGURATORA ===
      // Modal konfiguratora wyłączony - zastąpiony animacją typewriter w WorkflowController
      // WorkflowController obsługuje finalizację i pokazanie konfiguratora

      // === AKTUALIZACJA KOMENTARZA SYSTEMOWEGO ===
      // Pobierz dane z formularza, jeśli dostępne
      let formDataForComment = formSnapshot;
      if (
        !formDataForComment &&
        formEngine &&
        typeof formEngine.getState === "function"
      ) {
        formDataForComment = formEngine.getState() || {};
      }
      updateSystemComment(result, formDataForComment);
    }

    /**
     * Aktualizuje komentarz systemowy na podstawie wyników obliczeń
     * @param {Object} result - Wyniki obliczeń z API
     * @param {Object} formSnapshot - Dane z formularza (opcjonalne)
     */
    function updateSystemComment(result, formSnapshot = {}) {
      const commentElement = dom.byId("system-comment-text");
      if (!commentElement) return;

      // Pobierz dane z formularza, jeśli dostępne
      let formData = formSnapshot;
      if (
        !formData &&
        formEngine &&
        typeof formEngine.getState === "function"
      ) {
        formData = formEngine.getState() || {};
      }

      // Wykryj scenariusz na podstawie danych
      const constructionYear = formData.construction_year || null;
      const hasExternalIsolation =
        formData.has_external_isolation === "yes" ||
        formData.has_external_isolation === true;
      const hasTopIsolation =
        formData.top_isolation === "yes" || formData.top_isolation === true;
      const hasBottomIsolation =
        formData.bottom_isolation === "yes" ||
        formData.bottom_isolation === true;
      const buildingType = formData.building_type || null;

      // Sprawdź czy są podstawowe dane
      const hasBasicData = result.max_heating_power && result.total_area;

      // Sprawdź czy są niespójności (stary budynek bez izolacji)
      const isOldBuilding =
        constructionYear && parseInt(constructionYear) < 2015;
      const hasPoorIsolation =
        !hasExternalIsolation && !hasTopIsolation && !hasBottomIsolation;
      const isHighRisk = isOldBuilding && hasPoorIsolation;

      // SCENARIUSZ C - niespójność danych / ryzyko
      if (
        !hasBasicData ||
        isHighRisk ||
        (isOldBuilding && !hasExternalIsolation)
      ) {
        commentElement.textContent =
          "Konfiguracja została dobrana na podstawie wprowadzonych danych. Parametry systemu są gotowe do montażu.";
        return;
      }

      // SCENARIUSZ B - podwyższone zapotrzebowanie / niepewność
      if (isOldBuilding || hasPoorIsolation || !hasExternalIsolation) {
        commentElement.textContent =
          "Parametry budynku wskazują na podwyższone zapotrzebowanie na ciepło. Zaproponowana konfiguracja uwzględnia ten fakt, aby zapewnić stabilną pracę systemu.";
        return;
      }

      // SCENARIUSZ A - wszystko spójne (domyślny)
      commentElement.textContent =
        "Parametry budynku są spójne i pozwalają na bezpieczną pracę pompy ciepła w oparciu o wprowadzone dane. " +
        "System nie wykrył ryzyk przewymiarowania ani niedoboru mocy.";
    }

    function resetResultsSectionInternal() {
      const loadingElements = dom.qsa('[id^="r-"]');
      loadingElements.forEach((el) => {
        if (el) el.textContent = "...";
      });

      // Logowanie usunięte dla produkcji
    }

    // resetResultsSection jest eksportowane na końcu modułu (w sekcji eksportów)

    function displayRecommendedPumps(pumps, result) {
      const zone = dom.byId("pump-recommendation-zone");
      if (!zone || !Array.isArray(pumps)) return;

      // Funkcja tworząca pojedynczą kartę pompy
      function createPumpCard(pump, badgeClass) {
        const typeLabel =
          pump.type === "split"
            ? "SPLIT (zewn. + wewn.)"
            : "ALL-IN-ONE (1 jednostka)";
        const typeClass = pump.type === "split" ? "split" : "all-in-one";

        // Obrazy: preferuj dynamiczne URL z WordPress (HEATPUMP_CONFIG), unikaj hardcoded domeny produkcyjnej
        // uploadsUrl może być np. ".../wp-content/uploads/2024/" (z trailing slash) – normalizujemy poniżej.
        const uploadsBase =
          config && config.uploadsUrl ? String(config.uploadsUrl) : "";
        const uploadsUrl = uploadsBase ? uploadsBase.replace(/\/?$/, "/") : "";
        const imgBase =
          config && config.imgUrl ? String(config.imgUrl) : "../img";
        const imgUrl = imgBase.replace(/\/?$/, "/");

        // Preferuj uploads (WordPress media), fallback: zasoby wtyczki (`main/img/`)
        const imagePath =
          pump.type === "split"
            ? uploadsUrl
              ? `${uploadsUrl}split-k.png`
              : `${imgUrl}splitK1f.png`
            : uploadsUrl
              ? `${uploadsUrl}aio-k.png`
              : `${imgUrl}allinoneK1f.png`;

        const card = doc.createElement("div");
        card.className = `pump-recommendation-card recommended-${badgeClass} animate-fade-in animate-hover-lift`;
        card.setAttribute("data-pump", pump.model);

        card.innerHTML = `
                <div class="pump-image-container">
                    <img src="${imagePath}" alt="Pompa ciepła ${pump.type
          }" class="pump-image"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="pump-image-fallback" style="display:none; align-items:center; justify-content:center; height:100%; color:#4b5563; font-family:'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:clamp(12px, 2.5vw, 14px); font-weight:500;">
                        📷 Zdjęcie pompy ${pump.type.toUpperCase()}
                    </div>
                    <div class="pump-image-overlay">${pump.type === "split" ? "SPLIT" : "ALL-IN-ONE"
          }</div>
                </div>
                <div class="card-badge ${badgeClass}">${pump.type === "split" ? "REKOMENDOWANA" : "ALTERNATYWA"
          }</div>
                <div class="card-series">PANASONIC SERIA K</div>
                <div class="card-type-badge ${typeClass}">${typeLabel}</div>
                <div class="card-model">${pump.model}</div>
                <div class="card-power">${pump.power} kW</div>
                <div class="card-price">${new Intl.NumberFormat("pl-PL").format(
            pump.price
          )} zł</div>
                <div class="card-features">
                    <div class="feature">Moc grzewcza: ${pump.power} kW</div>
                    <div class="feature">COP: 4.2 (wysoka efektywność)</div>
                    <div class="feature">Klasa energetyczna: A+++</div>
                    <div class="feature">Temperatura pracy: -25°C do +35°C</div>
                    <div class="feature">Cicha praca: < 35 dB(A)</div>
                </div>
                <button class="select-pump-btn configure-btn" data-pump="${pump.model
          }">WYBIERZ I KONFIGURUJ</button>
            `;

        const button = card.querySelector(".configure-btn");
        trackEvent(button, "click", function () {
          const selectedPump = this.getAttribute("data-pump");
          // P1.2: Użyj skonsolidowanej funkcji saveConfigData
          saveConfigData({
            configuratorInput: {},
            result: result,
            selectedPumpModel: selectedPump,
            overrideData: {
              selected_pump: selectedPump,
              heated_area: result.heated_area,
              max_heating_power: result.max_heating_power,
              bivalent_power: result.bivalent_point_heating_power,
              hot_water_power: result.hot_water_power || 0,
              annual_energy_consumption: result.annual_energy_consumption,
              design_outdoor_temperature: result.design_outdoor_temperature,
            },
          });
          ErrorHandler.showToast(`Wybrano pompę: ${selectedPump}`, "success");
        });

        return card;
      }

      // Funkcja renderowania kart pomp w sliderze
      function renderPumpCards(pumps, containerId, sliderTitle) {
        const container = dom.byId(containerId);
        if (!container) return;

        // Sprawdź czy są pompy do wyświetlenia
        if (!pumps || pumps.length === 0) {
          container.style.display = "none";
          return;
        }

        container.style.display = "block";

        // Znajdź slider header i ustaw tytuł
        const sliderHeader = container.querySelector(".slider-header h3");
        if (sliderHeader) {
          sliderHeader.textContent = sliderTitle;
        }

        // Znajdź kontener na karty
        const cardsContainer = container.querySelector(".pump-cards-slider");
        if (!cardsContainer) return;

        // Wyczyść istniejące karty
        cardsContainer.innerHTML = "";

        // Utwórz slider track
        const sliderTrack = doc.createElement("div");
        sliderTrack.className = "slider-track";

        // Renderuj karty pomp
        pumps.forEach((pump, index) => {
          const pumpCard = createPumpCard(
            pump,
            index === 0 ? "recommended" : "alternative"
          );
          sliderTrack.appendChild(pumpCard);
        });

        cardsContainer.appendChild(sliderTrack);

        // Dodaj nawigację slidera jeśli jest więcej niż jedna karta
        if (pumps.length > 1) {
          addSliderNavigation(cardsContainer, pumps.length);
        }

        // Inicjalizuj slider
        initializeSlider(cardsContainer, pumps.length);
      }

      // Funkcja dodawania nawigacji slidera
      function addSliderNavigation(container, totalSlides) {
        const navigation = doc.createElement("div");
        navigation.className = "slider-navigation";

        // Przycisk poprzedni
        const prevBtn = doc.createElement("button");
        prevBtn.className = "slider-btn slider-prev";
        prevBtn.innerHTML = "‹";
        prevBtn.setAttribute("aria-label", "Poprzednia pompa");

        // Dots (kropki nawigacyjne)
        const dotsContainer = doc.createElement("div");
        dotsContainer.className = "slider-dots";

        for (let i = 0; i < totalSlides; i++) {
          const dot = doc.createElement("button");
          dot.className = `slider-dot ${i === 0 ? "active" : ""}`;
          dot.setAttribute("data-slide", i);
          dot.setAttribute("aria-label", `Przejdź do pompy ${i + 1}`);
          dotsContainer.appendChild(dot);
        }

        // Przycisk następny
        const nextBtn = doc.createElement("button");
        nextBtn.className = "slider-btn slider-next";
        nextBtn.innerHTML = "›";
        nextBtn.setAttribute("aria-label", "Następna pompa");

        navigation.appendChild(prevBtn);
        navigation.appendChild(dotsContainer);
        navigation.appendChild(nextBtn);

        container.appendChild(navigation);
      }

      // Funkcja inicjalizacji slidera
      function initializeSlider(container, totalSlides) {
        if (totalSlides <= 1) return;

        const track = container.querySelector(".slider-track");
        const prevBtn = container.querySelector(".slider-prev");
        const nextBtn = container.querySelector(".slider-next");
        const dots = container.querySelectorAll(".slider-dot");

        let currentSlide = 0;

        // Funkcja aktualizacji slidera
        function updateSlider(slideIndex) {
          currentSlide = slideIndex;

          // Animacja przesunięcia
          track.style.transform = `translateX(-${currentSlide * 100}%)`;

          // Aktualizacja dots
          dots.forEach((dot, index) => {
            dot.classList.toggle("active", index === currentSlide);
          });

          // Aktualizacja przycisków
          prevBtn.disabled = currentSlide === 0;
          nextBtn.disabled = currentSlide === totalSlides - 1;

          // Aktualizacja aria-labels
          prevBtn.style.opacity = currentSlide === 0 ? "0.5" : "1";
          nextBtn.style.opacity =
            currentSlide === totalSlides - 1 ? "0.5" : "1";
        }

        // Event listenery dla przycisków
        trackEvent(prevBtn, "click", () => {
          if (currentSlide > 0) {
            updateSlider(currentSlide - 1);
          }
        });

        trackEvent(nextBtn, "click", () => {
          if (currentSlide < totalSlides - 1) {
            updateSlider(currentSlide + 1);
          }
        });

        // Event listenery dla dots
        dots.forEach((dot, index) => {
          trackEvent(dot, "click", () => {
            updateSlider(index);
          });
        });

        // Obsługa klawiatury
        trackEvent(container, "keydown", (e) => {
          if (e.key === "ArrowLeft" && currentSlide > 0) {
            updateSlider(currentSlide - 1);
          } else if (e.key === "ArrowRight" && currentSlide < totalSlides - 1) {
            updateSlider(currentSlide + 1);
          }
        });

        // Inicjalna aktualizacja
        updateSlider(0);

        // Auto-play (opcjonalnie)
        if (totalSlides > 1) {
          let autoplayInterval = setInterval(() => {
            const nextSlide = (currentSlide + 1) % totalSlides;
            updateSlider(nextSlide);
          }, 5000); // 5 sekund

          // Zatrzymaj autoplay przy hover
          trackEvent(container, "mouseenter", () => {
            clearInterval(autoplayInterval);
          });

          trackEvent(container, "mouseleave", () => {
            autoplayInterval = setInterval(() => {
              const nextSlide = (currentSlide + 1) % totalSlides;
              updateSlider(nextSlide);
            }, 5000);
          });
        }
      }

      // TYLKO SLIDERY - bez dodatkowych kart lub elementów
      zone.innerHTML = `
            <div class="pump-slider-wrapper">
              <div class="slider-header">
                <h3>💎 Rekomendowane pompy ciepła PANASONIC</h3>
                <p>Zapotrzebowanie całkowite: <strong>${(
          parseFloat(result.max_heating_power) +
          parseFloat(result.hot_water_power || 0)
        ).toFixed(1)} kW</strong></p>
              </div>
              <div class="pump-cards-slider">

              </div>
            </div>
        `;

      const totalPowerDemand = (
        parseFloat(result.max_heating_power) +
        parseFloat(result.hot_water_power || 0)
      ).toFixed(1);
      renderPumpCards(
        pumps,
        "pump-recommendation-zone",
        `💎 Rekomendowane pompy ciepła PANASONIC (zapotrzebowanie: ${totalPowerDemand} kW)`
      );

      const cards = zone.querySelectorAll(".pump-recommendation-card");
      cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.15}s`;
      });
    }

    function DobierzPompe(result) {
      // ARCHITECTURAL: Pompy są dobierane na podstawie mocy CO (max_heating_power), nie totalPower (CO + CWU)
      // This ensures consistency with configurator which uses only max_heating_power for pump selection
      const heatingPower = parseFloat(result.max_heating_power || 0);

      // ⚠️ FIX P0.1: Walidacja zakresu max_heating_power przed doborem pompy
      if (isNaN(heatingPower) || heatingPower <= 0) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Invalid max_heating_power:",
            heatingPower
          );
        }
        return [];
      }

      // ⚠️ FIX P0.1: Sanity check - bardzo mała moc (< 2.5kW) lub bardzo duża (> 17.5kW)
      if (heatingPower < 2.5) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Very low power detected:",
            heatingPower,
            "- using smallest pump as fallback"
          );
        }
        // Kontynuuj - użyj najmniejszej pompy jako fallback (już zaimplementowane w linii 1600-1635)
      } else if (heatingPower > 17.5 && heatingPower < 25) {
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Very high power detected:",
            heatingPower,
            "- using largest pump"
          );
        }
        // Kontynuuj - użyj największej pompy (już zaimplementowane w linii 1600-1635)
      } else if (heatingPower >= 25) {
        // ⚠️ FIX P0.1: Spójność z konfiguratorem - >=25kW → zwróć [] (konfigurator się nie pokaże)
        if (window.__HP_DEBUG__) {
          LOG.warn(
            "flow",
            "[FLOW-16] Power >= 25kW - returning empty array (configurator will be hidden)"
          );
        }
        return []; // Spójne z configurator-unified.js:399 (selectHeatPumps zwraca [] dla >=25kW)
      }

      // Logowanie usunięte dla produkcji

      // Użyj pumpMatchingTable do doboru pomp na podstawie zakresów min/max
      const heatingType = result.heating_type || "mixed";
      const normalizedType =
        heatingType === "radiators"
          ? "radiators"
          : heatingType === "underfloor" || heatingType === "surface"
            ? "surface"
            : "mixed";

      // Logowanie usunięte dla produkcji

      // Filtruj pompy TYLKO na podstawie mocy - bez sprawdzania fazy
      const matching = Object.entries(pumpMatchingTable)
        .filter(([model, data]) => {
          // Sprawdź zakres mocy dla danego typu instalacji
          const min = data.min[normalizedType] || data.min.mixed;
          const max = data.max[normalizedType] || data.max.mixed;
          const powerMatch = heatingPower >= min && heatingPower <= max;

          return powerMatch;
        })
        .map(([model, data]) => {
          // Użyj dynamicznego URL z konfiguracji WordPress
          const imgUrl = config?.imgUrl || "../img";
          const image =
            data.type === "split"
              ? `${imgUrl}/split-k.png`
              : `${imgUrl}/allinone.png`;
          return {
            model: model,
            power: data.power,
            series: data.series,
            type: data.type,
            image: image,
            phase: data.phase,
            requires3F: data.requires3F,
          };
        })
        // WAŻNE: Sortuj po mocy ROSNĄCO, aby wybrać najmniejszą pasującą pompę
        .sort((a, b) => a.power - b.power);

      // Logowanie usunięte dla produkcji

      // Jeśli nie znaleziono, wybierz najmniejszą pompę która ma max >= heatingPower
      if (matching.length === 0) {
        // Brak dopasowanych pomp w zakresie, szukam najmniejszej pompy z max >= heatingPower
        const allPumpsFlat = Object.keys(pumpMatchingTable)
          .map((model) => {
            const data = pumpMatchingTable[model];
            const min = data.min[normalizedType] || data.min.mixed;
            const max = data.max[normalizedType] || data.max.mixed;

            // Wybierz pompy które mogą pokryć zapotrzebowanie (max >= heatingPower)
            if (max >= heatingPower) {
              // Użyj dynamicznego URL z konfiguracji WordPress
              const imgUrl = config?.imgUrl || "../img";
              return {
                model: model,
                power: data.power,
                series: data.series,
                type: data.type,
                image:
                  data.type === "split"
                    ? `${imgUrl}/split-k.png`
                    : `${imgUrl}/allinone.png`,
                phase: data.phase,
                requires3F: data.requires3F,
                max: max,
              };
            }
            return null;
          })
          .filter((p) => p !== null)
          .sort((a, b) => a.power - b.power); // Sortuj po mocy rosnąco

        if (allPumpsFlat.length > 0) {
          const smallest = allPumpsFlat[0];
          // Wybrano najmniejszą pompę pokrywającą zapotrzebowanie
          matching.push(smallest);
        } else {
          // Fallback 2: dobierz najmniejszą pompę (jeśli tylko ona pokrywa zapotrzebowanie)
          const anyPumps = Object.keys(pumpMatchingTable)
            .map((model) => {
              const data = pumpMatchingTable[model];
              const max = data.max[normalizedType] || data.max.mixed;
              if (max < heatingPower) return null;

              const imgUrl = config?.imgUrl || "../img";
              return {
                model: model,
                power: data.power,
                series: data.series,
                type: data.type,
                image:
                  data.type === "split"
                    ? `${imgUrl}/split-k.png`
                    : `${imgUrl}/allinone.png`,
                phase: data.phase,
                requires3F: data.requires3F,
                max: max,
              };
            })
            .filter((p) => p !== null)
            .sort((a, b) => a.power - b.power);

          if (anyPumps.length > 0) {
            matching.push(anyPumps[0]);
          }
        }
      }

      // Grupuj pompy po mocy i typie (split/all-in-one)
      // Wszystkie pompy mają series: 'K', więc rozróżniamy po typie
      const grouped = {};
      matching.forEach((pump) => {
        if (!grouped[pump.power]) grouped[pump.power] = {};
        // Rozróżnij po typie: split (WC) vs all-in-one (ADC)
        if (pump.type === "split") {
          grouped[pump.power]["wc"] = pump;
          grouped[pump.power]["sdc"] = pump; // Kompatybilność wsteczna
        } else if (pump.type === "all-in-one") {
          grouped[pump.power]["adc"] = pump;
        }
      });

      const pumpGroups = Object.entries(grouped)
        .map(([power, typeMap]) => ({
          power: Number(power),
          sdc: typeMap.sdc || typeMap.wc || null, // Kompatybilność wsteczna
          adc: typeMap.adc || null,
          wc: typeMap.wc || null, // HP Split
        }))
        .sort((a, b) => a.power - b.power);

      // Logowanie usunięte dla produkcji
      return pumpGroups;
    }

    function renderHaierStyleSliders(pumpGroups, container) {
      if (!container) {
        // Kontener pump-recommendation-zone nie istnieje - cichy fallback
        return;
      }

      if (!Array.isArray(pumpGroups)) {
        // pumpGroups nie jest tablicą - cichy fallback
        return;
      }

      if (pumpGroups.length === 0) {
        // Brak grup pomp do wyświetlenia - cichy fallback
        container.innerHTML =
          "<p class=\"micro-note\" style=\"text-align: center; color: #4b5563; font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\">Nie znaleziono dopasowanych pomp. Skontaktuj się z nami w celu indywidualnego doboru.</p>";
        return;
      }

      // Funkcja pomocnicza do aktualizacji tytułu na podstawie faktycznie wyświetlanych pomp
      function updatePowerTitleFromRenderedPumps(
        container,
        titleId,
        titlePrefix
      ) {
        const titleElement = dom.byId(titleId);
        if (!titleElement || !container) return;

        // Znajdź wszystkie karty pomp w kontenerze
        const pumpCards = container.querySelectorAll(
          ".heat-pump-card[data-power]"
        );
        if (pumpCards.length === 0) return;

        // Wyciągnij moc z pierwszej pompy (wszystkie pompy w grupie mają tę samą moc)
        const firstCard = pumpCards[0];
        const power = firstCard.getAttribute("data-power");

        if (power) {
          titleElement.textContent = `${titlePrefix}: ${power} kW`;
        }
      }

      // Wyczyść kontener główny
      container.innerHTML = "";

      // Weź pierwszą grupę (rekomendowaną moc)
      const recommendedGroup = pumpGroups[0];
      if (!recommendedGroup) {
        // Brak rekomendowanej grupy pomp - cichy fallback
        container.innerHTML =
          "<p class=\"micro-note\" style=\"text-align: center; color: #4b5563; font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\">Nie znaleziono rekomendowanej pompy. Skontaktuj się z nami w celu indywidualnego doboru.</p>";
        return;
      }

      // Zapisz rekomendacje do globalnych wyników, aby PDF mógł je odczytać
      try {
        const recModels = [];
        if (recommendedGroup.sdc) {
          recModels.push({
            name: recommendedGroup.sdc.model,
            type: recommendedGroup.sdc.type,
            power_kw: recommendedGroup.sdc.power,
          });
        }
        if (recommendedGroup.adc) {
          recModels.push({
            name: recommendedGroup.adc.model,
            type: recommendedGroup.adc.type,
            power_kw: recommendedGroup.adc.power,
          });
        }
        if (recModels.length > 0) {
          renderResultsSummaryHeader({
            ...result,
            recommended_power_kw: recommendedGroup.power,
            recommended_models: recModels,
          });
        }
      } catch (e) {
        // Nie udało się zapisać rekomendowanych modeli do PDF - cichy fallback
      }

      // Generuj karty pomp dla rekomendowanej mocy
      if (recommendedGroup.sdc) {
        const sdcCard = createMinimalCard(recommendedGroup.sdc);
        container.appendChild(sdcCard);
      }
      if (recommendedGroup.adc) {
        const adcCard = createMinimalCard(recommendedGroup.adc);
        container.appendChild(adcCard);
      }

      // Aktualizuj tytuł mocy na podstawie faktycznie wyświetlanych pomp
      updatePowerTitleFromRenderedPumps(
        container,
        "pump-power-title",
        "Rekomendowana moc"
      );

      // Sprawdź czy istnieje alternatywna moc
      const alternativeGroup = pumpGroups[1];
      const alternativeSection = dom.byId("alternative-power-section");
      const alternativeContainer = dom.byId("alternative-pump-zone");
      const alternativeTitle = dom.byId("alternative-power-title");

      if (alternativeGroup && alternativeSection && alternativeContainer) {
        // Pokaż sekcję alternatywną
        alternativeSection.style.display = "block";

        // Wyczyść kontener
        alternativeContainer.innerHTML = "";

        // Generuj karty pomp dla alternatywnej mocy
        if (alternativeGroup.sdc) {
          const sdcCard = createMinimalCard(alternativeGroup.sdc);
          alternativeContainer.appendChild(sdcCard);
        }
        if (alternativeGroup.adc) {
          const adcCard = createMinimalCard(alternativeGroup.adc);
          alternativeContainer.appendChild(adcCard);
        }

        // Aktualizuj tytuł alternatywnej mocy na podstawie faktycznie wyświetlanych pomp
        updatePowerTitleFromRenderedPumps(
          alternativeContainer,
          "alternative-power-title",
          "Alternatywna moc"
        );
      } else if (alternativeSection) {
        // Ukryj sekcję jeśli nie ma alternatywnej mocy
        alternativeSection.style.display = "none";
      }

      function createMinimalCard(pump) {
        const label = pump.type === "split" ? "Split" : "All-in-One";
        // Użyj dynamicznego URL z konfiguracji WordPress
        const imgUrl = config?.imgUrl || "../img";
        const imgPath =
          pump.type === "split" ? `${imgUrl}/sdc-k.png` : `${imgUrl}/adc-k.png`;
        const seriesName = "Panasonic Seria K";
        const typeDesc =
          pump.type === "split"
            ? "Split (jednostka zewnętrzna + wewnętrzna)"
            : "All-in-One (kompaktowa)";

        const card = doc.createElement("div");
        card.className = "heat-pump-card haier-style";
        card.setAttribute("data-pump", pump.model);
        card.setAttribute("data-power", pump.power);

        card.innerHTML = `
                <img src="${imgPath}" alt="Pompa ${label}" class="clean-pump-image">
                <div class="pump-model-name">${seriesName} ${pump.power} kW</div>
                <div class="pump-specs">
                    Model: ${pump.model}<br>
                    Typ: ${typeDesc}<br>
                    Moc: ${pump.power} kW
                </div>
            `;

        return card;
      }
    }

    // Funkcje obsługi przycisków
    let customerDataCollected = false;

    function showPDFContactForm() {
      const pdfFormContainer = dom.byId("pdf-contact-form");
      if (pdfFormContainer) {
        // Prefer class-based visibility (works in summary step and legacy containers)
        pdfFormContainer.classList.remove("hidden");
        pdfFormContainer.style.display = "block";
        pdfFormContainer.scrollIntoView({ behavior: "smooth" });
        const intent = pdfFormContainer.getAttribute("data-intent") || "email_pdf";
        trackSpec("lead_open", {
          source: "calc",
          tab: 5,
          stepKey: "lead_form",
          meta: {
            kind: intent === "order_contact" ? "contact_confirm" : "email_pdf",
          },
        });
      }
    }

    function hidePDFContactForm() {
      const pdfFormContainer = dom.byId("pdf-contact-form");
      if (pdfFormContainer) {
        pdfFormContainer.classList.add("hidden");
        pdfFormContainer.style.display = "none";
      }
    }

    function getLeadForm() {
      return dom.byId("pdf-contact-form");
    }

    function setInlineError(formEl, key, message) {
      if (!formEl) return;
      const err = formEl.querySelector(`[data-error-for="${key}"]`);
      if (!err) return;
      if (!message) {
        err.innerHTML = "";
        err.style.display = "none";
        return;
      }
      err.classList.add("field-error");
      err.innerHTML = `<i class="ph ph-warning-circle"></i><span>${message}</span>`;
      err.style.display = "flex";
    }

    function clearInlineErrors(formEl) {
      if (!formEl) return;
      formEl.querySelectorAll("[data-error-for]").forEach((el) => {
        el.innerHTML = "";
        el.style.display = "none";
      });
      ["customer-email", "customer-phone", "customer-city", "customer-name"].forEach((id) => {
        const input = dom.byId(id);
        if (input) input.classList.remove("field-invalid");
      });
    }

    function readLeadFormValues() {
      const formEl = getLeadForm();
      const name = (dom.byId("customer-name")?.value || "").trim();
      const email = (dom.byId("customer-email")?.value || "").trim();
      const phone = (dom.byId("customer-phone")?.value || "").trim();
      const city = (dom.byId("customer-city")?.value || "").trim();
      const preferred = (dom.byId("preferred-contact-time")?.value || "").trim();
      const terms = !!dom.byId("consent-terms-accept")?.checked;
      const rodo = !!dom.byId("consent-rodo-contact")?.checked;
      const marketing = !!dom.byId("consent-marketing-opt-in")?.checked;
      const photoConfirm = !!dom.byId("consent-photo-confirm")?.checked;
      const intent = formEl ? (formEl.getAttribute("data-intent") || "") : "";

      return {
        intent,
        name,
        email,
        phone,
        city,
        postal_code: city,
        preferred_contact_time: preferred || null,
        consents: {
          terms_accept: terms,
          rodo_contact: rodo,
          marketing_opt_in: marketing,
          photo_confirm: photoConfirm,
        },
      };
    }

    function validateLeadForm(values) {
      const formEl = getLeadForm();
      clearInlineErrors(formEl);

      const analytics = state?.analytics || null;

      const errors = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const isContact = values.intent === "order_contact";

      if (!isContact && !values.email) {
        errors.push({ key: "customer-email", message: "Email jest wymagany." });
      } else if (!isContact && !emailRegex.test(values.email)) {
        errors.push({ key: "customer-email", message: "Nieprawidłowy format adresu email." });
      }

      // Phone required only for contact intent
      if (isContact && !values.phone) {
        errors.push({ key: "customer-phone", message: "Telefon jest wymagany, aby zamówić kontakt." });
      }

      if (!values.consents.terms_accept) {
        errors.push({ key: "consent-terms-accept", message: "Zaznacz wymagane potwierdzenie danych." });
      }
      if (!values.consents.rodo_contact) {
        errors.push({ key: "consent-rodo-contact", message: "Zaznacz zgodę na kontakt w sprawie oferty." });
      }

      errors.forEach((e) => {
        setInlineError(formEl, e.key, e.message);
        const field = dom.byId(e.key);
        if (field && field.classList) field.classList.add("field-invalid");
        try {
          analytics && analytics.emit && analytics.emit("validation_error", { field_name: e.key, reason: e.message, step_key: "summary" });
        } catch (_) { }
      });

      return errors.length === 0;
    }

    async function postLeadUpsert(values) {
      const offerApi = state?.offerPayload || null;
      if (!offerApi || typeof offerApi.buildOfferPayload !== "function") {
        throw new Error("Brak buildera oferty (offerPayload.js).");
      }

      const leadInput = {
        name: values.name || null,
        email: values.email || null,
        phone: values.phone || null,
        city: values.city || null,
        postal_code: values.postal_code || null,
        preferred_contact_time: values.preferred_contact_time || null,
        consents: values.consents,
      };
      const payload = offerApi.buildOfferPayload({ includePii: true, leadInput });
      const kind = values.intent === "order_contact" ? "contact_confirm" : "email_pdf";
      const leadId = getOrCreateLeadId(
        payload?.leadId || payload?.lead?.lead_id || state?.offerIds?.lead_id || null
      );

      payload.kind = kind;
      payload.source = payload.source || "calc";
      payload.sessionId = state?.sessionId || payload?.lead?.session_id || null;
      payload.traceId =
        payload.traceId ||
        payload?.offer_dto?.traceId ||
        payload?.offer?.traceId ||
        null;
      payload.name = values.name || null;
      payload.city = values.city || null;
      payload.leadId = leadId;
      payload.lead = payload.lead || {};
      payload.lead.lead_id = leadId;
      payload.lead.session_id = payload.sessionId || payload.lead.session_id || null;
      payload.lead.trace_id = payload.traceId || payload.lead.trace_id || null;
      payload.lead.kind = kind;

      const ajaxUrl = state?.config?.ajaxUrl || window.HEATPUMP_CONFIG?.ajaxUrl || null;
      const nonce = state?.config?.nonce || window.HEATPUMP_CONFIG?.nonce || null;
      if (!ajaxUrl) throw new Error("Brak HEATPUMP_CONFIG.ajaxUrl (admin-ajax.php).");

      const fd = new FormData();
      fd.append("action", "heatpump_lead_upsert");
      if (nonce) fd.append("nonce", String(nonce));
      fd.append("payload", JSON.stringify(payload));

      const res = await fetch(String(ajaxUrl), {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`Błąd serwera CRM: ${res.status} ${res.statusText}`);
      }

      const json = await res.json().catch(() => null);
      if (!json || json.success !== true) {
        throw new Error((json && json.data && json.data.message) || "Nie udało się zapisać leada.");
      }

      const resolvedLeadId =
        (json?.data?.lead_id && String(json.data.lead_id)) ||
        (json?.lead_id && String(json.lead_id)) ||
        leadId;
      if (resolvedLeadId) {
        state.offerIds = state.offerIds || {};
        state.offerIds.lead_id = String(resolvedLeadId).toLowerCase();
      }

      const result = {
        json,
        leadId: state?.offerIds?.lead_id || leadId,
        kind,
      };

      if (
        window.__topinstalPdfLeadGate &&
        typeof window.__topinstalPdfLeadGate.maybeAutoDownloadPdfAfterLead === "function"
      ) {
        await window.__topinstalPdfLeadGate.maybeAutoDownloadPdfAfterLead({
          root,
          dom,
          state,
        });
      }

      return result;
    }

    async function sendOfferEmail(values) {
      const analytics = state?.analytics || null;
      const leadId = getOrCreateLeadId(state?.offerIds?.lead_id || null);
      try {
        analytics && analytics.emit && analytics.emit("email_submit_clicked", { intent: values.intent || "email_pdf", step_key: "summary" });
      } catch (_) { }
      trackSpec("lead_submit", {
        source: "calc",
        tab: 5,
        stepKey: "lead_form",
        leadId,
        meta: {
          kind: "email_pdf",
          hasEmail: !!values.email,
          hasPhone: !!values.phone,
        },
      });

      const offerApi = state?.offerPayload || null;
      const leadInput = {
        name: values.name || null,
        email: values.email,
        phone: values.phone || null,
        city: values.city || null,
        postal_code: values.postal_code || null,
        preferred_contact_time: values.preferred_contact_time || null,
        consents: values.consents,
      };

      if (
        !projectionApi ||
        typeof projectionApi.resolveInputFromRuntime !== "function" ||
        typeof projectionApi.buildDocumentPayload !== "function" ||
        typeof projectionApi.buildEmailPayload !== "function"
      ) {
        throw new Error("Brak offerProjection runtime adapter dla email.");
      }

      const runtimeInput = projectionApi.resolveInputFromRuntime({
        target: "email",
        channel: "email",
        leadInput,
        leadData: leadInput,
        documentMode: "offer",
      });
      const emailProjectionInput = {
        offerDto: runtimeInput?.offerDto || null,
        leadData: leadInput,
        configuratorSelection: runtimeInput?.configuratorSelection || null,
        uiContext: {
          ...(runtimeInput?.uiContext || {}),
          target: "email",
          channel: "email",
          documentMode: "offer",
        },
      };
      const documentProjectionInput = {
        ...emailProjectionInput,
        uiContext: {
          ...emailProjectionInput.uiContext,
          target: "document",
        },
      };
      const documentPayload = projectionApi.buildDocumentPayload(documentProjectionInput);
      const emailPayload = projectionApi.buildEmailPayload(emailProjectionInput);

      // Prefer the existing emailSender.js implementation (WP proxy)
      if (typeof window.sendOfferByEmail !== "function") {
        throw new Error("Brak funkcji sendOfferByEmail (emailSender.js).");
      }

      await window.sendOfferByEmail(
        {
          emailPayload,
          documentPayload,
        },
        values.email
      );
      const persisted = await postLeadUpsert(values);

      customerDataCollected = true;
      if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
        ErrorHandler.showToast("Wysłane. Sprawdź maila — a tu możesz pobrać PDF.", "success", 3500);
      }
      try {
        analytics && analytics.emit && analytics.emit("email_sent_success", { step_key: "summary" });
      } catch (_) { }
      trackSpec("lead_success", {
        source: "calc",
        tab: 5,
        stepKey: "lead_form",
        leadId: persisted?.leadId || leadId,
        meta: { kind: persisted?.kind || "email_pdf" },
      });
      hidePDFContactForm();
    }

    async function upsertLeadToCrm(values) {
      const analytics = state?.analytics || null;
      const leadId = getOrCreateLeadId(state?.offerIds?.lead_id || null);
      try {
        analytics && analytics.emit && analytics.emit("contact_submit_clicked", { step_key: "summary" });
      } catch (_) { }
      trackSpec("lead_submit", {
        source: "calc",
        tab: 5,
        stepKey: "lead_form",
        leadId,
        meta: {
          kind: "contact_confirm",
          hasEmail: !!values.email,
          hasPhone: !!values.phone,
        },
      });
      const persisted = await postLeadUpsert(values);

      if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
        ErrorHandler.showToast("Dziękujemy. Skontaktujemy się w sprawie terminu.", "success", 3500);
      }
      try {
        analytics && analytics.emit && analytics.emit("crm_lead_upsert_success", { step_key: "summary" });
      } catch (_) { }
      trackSpec("lead_success", {
        source: "calc",
        tab: 5,
        stepKey: "lead_form",
        leadId: persisted?.leadId || leadId,
        meta: { kind: persisted?.kind || "contact_confirm" },
      });

      hidePDFContactForm();
    }

    async function collectCustomerData() {
      const values = readLeadFormValues();
      // Default intent for legacy flow: email_pdf
      if (!values.intent) {
        const formEl = getLeadForm();
        if (formEl) formEl.setAttribute("data-intent", "email_pdf");
        values.intent = "email_pdf";
      }
      if (!validateLeadForm(values)) return false;
      await sendOfferEmail(values);
      return true;
    }

    function showSuccessMessage(email) {
      const successDiv = doc.createElement("div");
      successDiv.className = "pdf-success-message";
      successDiv.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <h4>Raport został wysłany!</h4>
                <p>Pełny raport energetyczny został wysłany na adres:<br><strong>${email}</strong></p>
                <p>Sprawdź swoją skrzynkę odbiorczą (również folder spam).</p>
            </div>
        `;

      const actionsContainer = dom.qs(".results-actions");
      if (actionsContainer) {
        actionsContainer.appendChild(successDiv);
        successDiv.scrollIntoView({ behavior: "smooth" });

        // Ukryj formularz kontaktowy
        hidePDFContactForm();

        // Usuń komunikat po 10 sekundach
        setTimeout(() => {
          if (successDiv.parentNode) {
            successDiv.remove();
          }
        }, 10000);
      }
    }


    function initActionButtons() {
      const leadSubtitle = dom.qs('[data-role="lead-form-subtitle"]');
      if (leadSubtitle) {
        leadSubtitle.textContent = "Wyślemy podsumowanie w PDF. Bez spamu.";
      }
      const phoneHelper = dom.qs('[data-role="phone-helper"]');
      if (phoneHelper) {
        phoneHelper.textContent = "Potwierdzimy dobór po krótkiej rozmowie i/lub zdjęciach kotłowni.";
      }
      const emailInput = dom.byId("customer-email");
      if (emailInput) {
        emailInput.placeholder = "Twój e-mail";
      }
      const emailTile = dom.qs('[data-intent="email_pdf"]');
      if (emailTile) {
        const title = emailTile.querySelector(".offer-intent__title");
        const desc = emailTile.querySelector(".offer-intent__desc");
        if (title) title.textContent = "Wyślij PDF na e-mail";
        if (desc) desc.textContent = "Wyślemy podsumowanie w PDF. Bez spamu.";
      }
      const contactTile = dom.qs('[data-intent="order_contact"]');
      if (contactTile) {
        const title = contactTile.querySelector(".offer-intent__title");
        const desc = contactTile.querySelector(".offer-intent__desc");
        if (title) title.textContent = "Poproś o kontakt i potwierdzenie doboru";
        if (desc) desc.textContent = "Potwierdzimy dobór po krótkiej rozmowie i/lub zdjęciach kotłowni.";
      }
      const submitEmailBtn = dom.qs('[data-action="submit-email-pdf"]');
      if (submitEmailBtn) {
        submitEmailBtn.textContent = "Wyślij PDF na e-mail";
      }
      const submitContactBtn = dom.qs('[data-action="submit-order-contact"]');
      if (submitContactBtn) {
        submitContactBtn.textContent = "Poproś o kontakt i potwierdzenie doboru";
      }

      const bindAction = (selector, fn) => {
        dom.qsa(selector).forEach((btn) => {
          trackEvent(btn, "click", (e) => {
            e.preventDefault();
            ensureActiveRoot();
            fn(e, btn);
          });
        });
      };

      bindAction('[data-action="open-lead-form"]', (_event, btn) => {
        const formEl = getLeadForm();
        const rawIntent = btn?.getAttribute?.("data-intent") || "email_pdf";
        const intent = rawIntent === "order_contact" ? "contact_confirm" : "email_pdf";
        if (formEl) {
          formEl.setAttribute("data-intent", intent === "contact_confirm" ? "order_contact" : "email_pdf");
          const submitEmailBtn = formEl.querySelector('[data-action="submit-email-pdf"]');
          const submitContactBtn = formEl.querySelector('[data-action="submit-order-contact"]');
          if (submitEmailBtn) submitEmailBtn.hidden = intent !== "email_pdf";
          if (submitContactBtn) submitContactBtn.hidden = intent !== "contact_confirm";
        }
        showPDFContactForm();
      });

      bindAction('[data-action="send-email"]', showPDFContactForm);
      bindAction('[data-action="collect-customer-data"]', () => {
        collectCustomerData().catch((e) => {
          if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
            ErrorHandler.showToast("Coś poszło nie tak. Spróbuj ponownie lub pobierz PDF.", "error", 4000);
          }
          const analytics = state?.analytics || null;
          try {
            analytics && analytics.emit && analytics.emit("email_sent_error", { reason: String(e && e.message ? e.message : "error"), step_key: "summary" });
          } catch (_) { }
          trackSpec("lead_error", {
            source: "calc",
            tab: 5,
            stepKey: "lead_form",
            leadId: state?.offerIds?.lead_id || null,
            meta: {
              kind: "email_pdf",
              reason: String(e && e.message ? e.message : "error"),
            },
          });
        });
      });
      bindAction('[data-action="submit-email-pdf"]', () => {
        const values = readLeadFormValues();
        if (!values.intent) values.intent = "email_pdf";
        if (!validateLeadForm(values)) return;
        sendOfferEmail(values).catch((e) => {
          if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
            ErrorHandler.showToast("Coś poszło nie tak. Spróbuj ponownie lub pobierz PDF.", "error", 4000);
          }
          const analytics = state?.analytics || null;
          try {
            analytics && analytics.emit && analytics.emit("email_sent_error", { reason: String(e && e.message ? e.message : "error"), step_key: "summary" });
          } catch (_) { }
          trackSpec("lead_error", {
            source: "calc",
            tab: 5,
            stepKey: "lead_form",
            leadId: state?.offerIds?.lead_id || null,
            meta: {
              kind: "email_pdf",
              reason: String(e && e.message ? e.message : "error"),
            },
          });
        });
      });
      bindAction('[data-action="submit-order-contact"]', () => {
        const values = readLeadFormValues();
        if (!values.intent) values.intent = "order_contact";
        if (!validateLeadForm(values)) return;
        upsertLeadToCrm(values).catch((e) => {
          if (typeof ErrorHandler !== "undefined" && ErrorHandler.showToast) {
            ErrorHandler.showToast("Nie udało się wysłać zgłoszenia. Spróbuj ponownie.", "error", 4000);
          }
          const analytics = state?.analytics || null;
          try {
            analytics && analytics.emit && analytics.emit("crm_lead_upsert_error", { reason: String(e && e.message ? e.message : "error"), step_key: "summary" });
          } catch (_) { }
          trackSpec("lead_error", {
            source: "calc",
            tab: 5,
            stepKey: "lead_form",
            leadId: state?.offerIds?.lead_id || null,
            meta: {
              kind: "contact_confirm",
              reason: String(e && e.message ? e.message : "error"),
            },
          });
        });
      });
      bindAction('[data-action="hide-pdf-form"]', hidePDFContactForm);
      bindAction('[data-action="go-back"]', goBackToForm);
      bindAction('[data-action="start-new"]', startNewCalculation);

      // Print (otwiera okno drukowania przeglądarki)
      bindAction('[data-action="print"]', () => {
        window.print();
      });

      // Back to config (przełącza na widok konfiguratora)
      bindAction('[data-action="back-to-config"]', () => {
        const switchBtn = dom.qs('[data-target="configurator-view"]');
        if (switchBtn) {
          switchBtn.click();
        }
      });
    }

    if (state) {
      state.results = {
        showPDFContactForm,
        hidePDFContactForm,
        collectCustomerData,
        goBackToForm,
        startNewCalculation,
      };
    }

    initActionButtons();

    trackEvent(root, "hp:showPdfForm", () => {
      ensureActiveRoot();
      showPDFContactForm();
    });
    trackEvent(root, "hp:hidePdfForm", () => {
      ensureActiveRoot();
      hidePDFContactForm();
    });
    trackEvent(root, "hp:collectCustomerData", () => {
      ensureActiveRoot();
      collectCustomerData();
    });
    trackEvent(root, "hp:goBackToForm", () => {
      ensureActiveRoot();
      goBackToForm();
    });
    trackEvent(root, "hp:startNewCalculation", () => {
      ensureActiveRoot();
      startNewCalculation();
    });
    trackEvent(root, "hp:downloadPdf", () => {
      ensureActiveRoot();
      if (state && typeof state.downloadPDF === "function") {
        state.downloadPDF({ root, dom, state });
        return;
      }
      console.error("[PDF] downloadPDF not available");
    });

    // === FUNKCJE POMOCNICZE DLA DANYCH ROZSZERZONYCH ===

    function displayEnergyLosses(losses) {
      const container = dom.byId("energy-losses-container");
      if (!container) return;

      const sortedLosses = [...losses].sort((a, b) => b.percent - a.percent);

      let html = '<table class="results-table results-table--compact">';
      html += `
            <thead>
                <tr>
                    <th>Przegroda</th>
                    <th>Udział strat</th>
                </tr>
            </thead>
            <tbody>
        `;

      sortedLosses.forEach((loss) => {
        html += `
                <tr>
                    <td class="results-table__label">${loss.label}</td>
                    <td>${loss.percent.toFixed(1)}%</td>
                </tr>
            `;
      });

      html += "</tbody></table>";
      container.innerHTML = html;
    }

    function displayImprovements(improvements) {
      const container = dom.byId("improvements-container");
      if (!container) return;

      const sortedImprovements = [...improvements].sort(
        (a, b) => b.energy_saved - a.energy_saved
      );

      // Responsive width dla kolumny Nr na mobile
      const isMobile = view.matchMedia("(max-width: 480px)").matches;
      const nrWidth = isMobile ? "50px" : "40px";

      let html = '<table class="results-table results-table--compact">';
      html += `
            <thead>
                <tr>
                    <th style="width:${nrWidth}; text-align:right;">Nr</th>
                    <th>Modernizacja</th>
                    <th>Oszczędność</th>
                </tr>
            </thead>
            <tbody>
        `;

      sortedImprovements.forEach((improvement, index) => {
        html += `
                <tr>
                    <td class="results-table__num">${index + 1}</td>
                    <td class="results-table__label">${improvement.label}</td>
                    <td>${improvement.energy_saved.toFixed(1)}%</td>
                </tr>
            `;
      });

      html += "</tbody></table>";
      container.innerHTML = html;
    }

    function displayHeatingCosts(costs, assumptions = null) {
      const container = dom.byId("heating-costs-container");
      if (!container) return;

      // 1) Znormalizuj rekordy (akceptujemy różne nazwy pól)
      const normalized = (Array.isArray(costs) ? costs : [])
        .map((c) => ({
          label: c.label || c.variant || c.name || "Wariant",
          detail: c.detail || "",
          efficiencyFactor:
            c.efficiency_factor != null
              ? Number(c.efficiency_factor)
              : c.cop != null
                ? Number(c.cop)
                : c.efficiency != null
                  ? Number(c.efficiency) / 100
                  : null,
          efficiencyDisplay:
            c.efficiency_display ||
            (c.efficiency != null
              ? `${c.efficiency}%`
              : c.cop != null
                ? `SCOP ${c.cop}`
                : ""),
          annualCostCo:
            c.annual_cost_co_pln != null ? Number(c.annual_cost_co_pln) : null,
          annualCostCwu:
            c.annual_cost_cwu_pln != null ? Number(c.annual_cost_cwu_pln) : null,
          annualCostTotal:
            c.annual_cost_total_pln != null
              ? Number(c.annual_cost_total_pln)
              : c.cost != null
                ? Number(c.cost)
                : c.annual_cost_pln != null
                  ? Number(c.annual_cost_pln)
                  : null,
        }))
        .filter((c) => c.annualCostTotal != null);

      // 2) Usuń pompę gruntową (case-insensitive)
      const withoutGround = normalized.filter((c) => !/grunt/i.test(c.label));

      // 3) Znajdź powietrzną – zawsze na pierwszej pozycji i z wyróżnieniem
      const airIndex = withoutGround.findIndex((c) =>
        /powietrzn/i.test(c.label)
      );
      let ordered = [...withoutGround].sort(
        (a, b) => a.annualCostTotal - b.annualCostTotal
      );
      if (airIndex >= 0) {
        const air = withoutGround[airIndex];
        ordered = [air, ...ordered.filter((i) => i !== air)];
      }

      // 4) Ogranicz do maks. 5 pozycji, ale z zachowaniem powietrznej na 1. miejscu
      const top = ordered.slice(0, 5);

      // 5) Render – prosta tabela inżynierska
      const hasBreakdown = top.some(
        (item) => item.annualCostCo != null || item.annualCostCwu != null
      );

      const assumptionsLine =
        assumptions?.displayLine ||
        (assumptions
          ? `Założenia: prąd ${assumptions.electricityPLNperKWh} PLN/kWh, gaz ${assumptions.gasPLNperKWh} PLN/kWh, pellet ${assumptions.pelletPLNperKWh} PLN/kWh, drewno ${assumptions.woodPLNperKWh} PLN/kWh, SCOP ${assumptions.scopUsed}, data ${assumptions.dateStamp}.`
          : "");

      let html = '<table class="results-table">';
      html += `
            <thead>
                <tr>
                    <th>Wariant ogrzewania</th>
                    <th>Sprawność / SCOP</th>
                    ${hasBreakdown
          ? "<th>Koszt CO</th><th>Koszt CWU</th><th>Koszt łączny</th>"
          : "<th>Roczny koszt</th>"
        }
                </tr>
            </thead>
            <tbody>
        `;

      top.forEach((item, index) => {
        const isAir = /powietrzn/i.test(item.label);
        const rowClass = isAir ? "results-table__highlight" : "";
        const detail = item.detail
          ? `<span class="results-table__secondary">${item.detail}</span>`
          : "";
        const badge = isAir
          ? '<span class="results-table__secondary">Najbardziej opłacalne</span>'
          : "";

        html += `
                <tr class="${rowClass}">
                    <td>
                        <span class="results-table__label">${item.label}</span>
                        ${detail}
                        ${badge}
                    </td>
                    <td>${item.efficiencyDisplay || "—"}</td>
                    ${hasBreakdown
            ? `<td>${item.annualCostCo != null ? formatCurrency(item.annualCostCo) : "—"}</td>
                           <td>${item.annualCostCwu != null ? formatCurrency(item.annualCostCwu) : "—"}</td>
                           <td>${formatCurrency(item.annualCostTotal)}</td>`
            : `<td>${formatCurrency(item.annualCostTotal)}</td>`
          }
                </tr>
            `;
      });

      html += "</tbody></table>";
      if (assumptionsLine) {
        html += `<p data-role="heating-costs-assumptions" class="results-table__secondary" style="margin-top:8px;">${assumptionsLine}</p>`;
      }
      container.innerHTML = html;
    }

    function displayBivalentPoints(bivalentPoints) {
      const container = dom.byId("bivalent-points-container");
      if (!container) return;

      // Wybierz tylko temperatury -5, -7, -9, -11
      const keyPoints = bivalentPoints.parallel
        ? bivalentPoints.parallel.filter((p) =>
          [-5, -7, -9, -11].includes(p.temperature)
        )
        : bivalentPoints
          ? bivalentPoints.filter((p) =>
            [-5, -7, -9, -11].includes(p.temperature)
          )
          : [];

      if (keyPoints.length === 0) return;

      let html = '<table class="results-table results-table--compact">';
      html += `
            <thead>
                <tr>
                    <th>Temperatura zewnętrzna</th>
                    <th>Potrzebna moc</th>
                </tr>
            </thead>
            <tbody>
        `;

      keyPoints.forEach((point) => {
        html += `
                <tr>
                    <td>${point.temperature}°C</td>
                    <td>${(point.power / 1000).toFixed(1)} kW</td>
                </tr>
            `;
      });

      html += "</tbody></table>";
      container.innerHTML = html;
    }

    // Funkcje pomocnicze
    function getColorForLoss(percent) {
      if (percent > 40) return "#c23e32";
      if (percent > 20) return "#b78a2f";
      if (percent > 10) return "#d9b84c";
      return "#d4a574";
    }

    function formatCurrency(amount) {
      return new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }

    const ensureActiveRoot = () => {
      if (typeof window.__HP_SET_ACTIVE_ROOT__ === "function") {
        window.__HP_SET_ACTIVE_ROOT__(root);
      }
    };

    function goBackToForm() {
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // POWRÓT DO FORMULARZA — przejdź do pierwszej zakładki (nie ostatniej!)
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      ensureActiveRoot();
      try {
        root.removeAttribute("data-view");
      } catch (_) { }

      if (typeof showTab === "function") {
        // Przejdź do pierwszej zakładki (0), nie ostatniej (5)
        showTab(0);

        // Scroll do góry formularza
        setTimeout(() => {
          const firstSection = dom.qs(
            '#top-instal-calc .section[data-tab="0"]'
          );
          if (firstSection) {
            firstSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else {
        // Fallback - przewiń do góry strony
        const currentScrollTop =
          view.pageYOffset || doc.documentElement.scrollTop;
        const targetScrollTop = Math.max(0, currentScrollTop / 2);

        view.scrollTo({
          top: targetScrollTop,
          behavior: "smooth",
        });
      }
    }

    function startNewCalculation() {
      ensureActiveRoot();
      try {
        root.removeAttribute("data-view");
      } catch (_) { }
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // NOWE OBLICZENIE — resetuj stan i przejdź do pierwszej zakładki
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // Resetuj flagę animacji completion (użytkownik zaczyna od nowa)
      if (typeof updateAppState === "function") {
        updateAppState({
          completionAnimationShown: false,
          uiFlags: {
            completionAnimationShown: false,
          },
          formData: {},
          currentTab: 0,
          draftRequest: null,
          offer: null,
        });
      }

      // Resetuj flagę w WorkflowController
      if (
        workflowController &&
        typeof workflowController.reset === "function"
      ) {
        workflowController.reset();
      }

      // Pełniejszy reset: wyczyść config_data i stan konfiguratora z sessionStorage
      try {
        const instanceId =
          state?.instanceId || root?.getAttribute?.("data-hp-instance") || "default";
        const storage =
          view.sessionStorage ||
          (typeof sessionStorage !== "undefined" ? sessionStorage : null);
        if (storage) {
          storage.removeItem(`config_data::${String(instanceId)}`);
          storage.removeItem("config_data");
          storage.removeItem(`wycena2025_configuratorState::${String(instanceId)}`);
          if (typeof updateAppState === "function") {
            updateAppState({ config_data: null });
          }
        }
      } catch (_) { }

      // Powiadom konfigurator o resecie (event na root)
      try {
        root.dispatchEvent(new CustomEvent("heatpump:resetConfigurator", { bubbles: true }));
      } catch (_) { }

      if (typeof showTab === "function") {
        showTab(0);
      } else {
        // Fallback - przeładuj stronę
        view.location.reload();
      }
    }

    // Nie nadpisujemy window.downloadPDF - funkcja z downloadPDF.js powinna być używana

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // INICJALIZACJA AKORDEONÓW (fallback jeśli calculatorUI nie jest dostępny)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initAccordionsDirectly() {
      // Akordeon dla profilu energetycznego
      const energyProfileSections = dom.qsa(".energy-profile-section");
      energyProfileSections.forEach((section) => {
        const title = section.querySelector(".result-title");
        if (title && !title.dataset.accordionBound) {
          title.dataset.accordionBound = "1";
          trackEvent(title, "click", function () {
            const content = section.querySelector(".result-grid");
            const subtitle = section.querySelector(".result-subtitle");
            const dataComment = section.nextElementSibling;
            const isDataComment =
              dataComment && dataComment.classList.contains("data-comment");
            const willCollapse = !section.classList.contains("collapsed");
            toggleAccordionSection(
              section,
              [
                content
                  ? { el: content, display: "table", manageDisplay: true }
                  : null,
                subtitle
                  ? { el: subtitle, display: "block", manageDisplay: true }
                  : null,
                isDataComment
                  ? { el: dataComment, display: "block", manageDisplay: true }
                  : null,
              ],
              willCollapse
            );
            if (!willCollapse) {
              trackSpec("result_section_expand", {
                source: "calc",
                tab: 5,
                stepKey: "results",
                meta: { sectionKey: "energy_profile" },
              });
            }
          });
        }
      });

      // Akordeon dla extended-section
      const extendedSections = dom.qsa(".extended-section.accordion-section");
      extendedSections.forEach((section) => {
        const title = section.querySelector(".section-title");
        if (title && !title.dataset.accordionBound) {
          title.dataset.accordionBound = "1";
          trackEvent(title, "click", function () {
            const willCollapse = !section.classList.contains("collapsed");
            const accordionContent = section.querySelector(".accordion-content");
            toggleAccordionSection(
              section,
              accordionContent ? [accordionContent] : [],
              willCollapse
            );
            if (!willCollapse) {
              const sectionKey =
                section.getAttribute("data-section-key") ||
                title.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
              trackSpec("result_section_expand", {
                source: "calc",
                tab: 5,
                stepKey: "results",
                meta: { sectionKey },
              });
            }
          });
        }
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // RESULTS SWITCHER LOGIC (scoped)
    function initResultsSwitcher() {
      const switcher = dom.qs('[data-role="results-switcher"]');
      if (!switcher) return;

      const buttons = Array.from(
        switcher.querySelectorAll(".results-switch-btn")
      );
      const views = Array.from(dom.qsa(".results-view"));
      if (!buttons.length || !views.length) return;

      const getAppState = state?.getAppState;
      const updateAppState = state?.updateAppState;

      function focusTabByIndex(index) {
        const normalized =
          ((index % buttons.length) + buttons.length) % buttons.length;
        const targetButton = buttons[normalized];
        if (targetButton && typeof targetButton.focus === "function") {
          targetButton.focus();
        }
        return targetButton;
      }

      function setActive(targetId, source = "ui") {
        views.forEach((viewEl) => {
          const isTarget =
            viewEl.id === targetId || viewEl.dataset.view === targetId;
          if (isTarget) {
            viewEl.classList.remove("hidden");
            viewEl.classList.add("visible");
            viewEl.setAttribute("aria-hidden", "false");
          } else {
            viewEl.classList.add("hidden");
            viewEl.classList.remove("visible");
            viewEl.setAttribute("aria-hidden", "true");
          }
        });

        buttons.forEach((btn) => {
          const isActive = btn.dataset.target === targetId;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-selected", isActive ? "true" : "false");
          btn.setAttribute("tabindex", isActive ? "0" : "-1");
        });

        if (typeof updateAppState === "function") {
          updateAppState({ activeView: targetId });
        }

        if (targetId === "energy-profile-view") {
          emitAnalytics("results_view_profil", { source });
        } else if (targetId === "configurator-view") {
          emitAnalytics("results_view_maszynownia", { source });
        }

        // INICJALIZACJA AKORDEONÓW PO PRZEŁĄCZENIU NA WIDOK PROFILU ENERGETYCZNEGO
        if (targetId === "energy-profile-view") {
          setTimeout(() => {
            if (window.__HP_MODULES__?.calculatorUI?.initAccordions) {
              window.__HP_MODULES__.calculatorUI.initAccordions();
            } else {
              initAccordionsDirectly();
            }
          }, 50);
        }
      }

      buttons.forEach((btn) => {
        trackEvent(btn, "click", (event) => {
          event.preventDefault();
          const target = btn.dataset.target;
          if (target) {
            setActive(target, "tab_click");
          }
        });

        trackEvent(btn, "keydown", (event) => {
          const currentIndex = buttons.indexOf(btn);
          if (currentIndex < 0) return;

          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            const nextIndex =
              event.key === "ArrowRight" ? currentIndex + 1 : currentIndex - 1;
            const focused = focusTabByIndex(nextIndex);
            const target = focused && focused.dataset ? focused.dataset.target : null;
            if (target) {
              setActive(target, "tab_keyboard");
            }
            return;
          }

          if (event.key === "Home") {
            event.preventDefault();
            const focused = focusTabByIndex(0);
            const target = focused && focused.dataset ? focused.dataset.target : null;
            if (target) {
              setActive(target, "tab_keyboard");
            }
            return;
          }

          if (event.key === "End") {
            event.preventDefault();
            const focused = focusTabByIndex(buttons.length - 1);
            const target = focused && focused.dataset ? focused.dataset.target : null;
            if (target) {
              setActive(target, "tab_keyboard");
            }
          }
        });
      });

      const goConfigBtn = dom.qs('[data-action="results-go-config"]');
      if (goConfigBtn) {
        trackEvent(goConfigBtn, "click", (event) => {
          event.preventDefault();
          if (goConfigBtn.dataset.ctaBusy === "1") return;

          goConfigBtn.dataset.ctaBusy = "1";
          setCtaState(goConfigBtn, "loading", {
            labels: {
              loading: "Otwieram konfigurator...",
              success: "Konfigurator gotowy",
            },
          });

          view.setTimeout(() => {
            setCtaState(goConfigBtn, "success");
            try {
              root.setAttribute("data-view", "configurator");
            } catch (_) { }
            setActive("configurator-view", "summary_cta");
            emitAnalytics("results_cta_config", { source: "summary_header" });
            const configuratorView = dom.byId("configurator-view");
            if (configuratorView && typeof configuratorView.scrollIntoView === "function") {
              configuratorView.scrollIntoView({ behavior: "smooth", block: "start" });
            }

            view.setTimeout(() => {
              setCtaState(goConfigBtn, "idle");
              goConfigBtn.dataset.ctaBusy = "0";
            }, getMotionDelay(1000));
          }, getMotionDelay(140));
        });
      }

      const initial =
        (typeof getAppState === "function" && getAppState()?.activeView) ||
        buttons.find((btn) => btn.classList.contains("active"))?.dataset
          .target ||
        buttons[0]?.dataset.target;

      if (initial) {
        setActive(initial, "init");
      }
    }

    initResultsSwitcher();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // EKSPORT FUNKCJI DO WINDOW (kompatybilność wsteczna)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Eksportuj displayResults - używa dom z closure, ale jeśli wywołane z zewnątrz,
    // znajdzie aktywny root i stworzy dom
    if (typeof window !== "undefined") {
      // Zapisz referencję do funkcji wewnętrznej
      const internalDisplayResults = displayResultsInternal;

      window.displayResults = function displayResults(result) {
        LOG.info("flow", "displayResults called");
        // Jeśli wywołane z kontekstu modułu (dom istnieje), użyj go
        if (dom && dom.byId) {
          return internalDisplayResults(result);
        }

        // Multi-root: preferuj aktywny root
        const activeRoot =
          window.__HP_ACTIVE_ROOT__ ||
          document.querySelector(".heatpump-calculator") ||
          document;
        const activeDom = window.createScopedDom
          ? window.createScopedDom(activeRoot)
          : {
            byId: (id) => document.getElementById(id),
            qs: (sel) => activeRoot.querySelector(sel),
            qsa: (sel) => Array.from(activeRoot.querySelectorAll(sel)),
          };

        // Wywołaj z aktywnym dom (musimy użyć tymczasowego dom)
        const originalDom = dom;
        // Nie możemy zmienić dom, więc użyjmy bezpośrednio activeDom
        const setText = (id, val, unit = "") => {
          const el = activeDom.byId(id);
          if (el && val !== undefined && val !== null)
            el.textContent = `${val}${unit}`;
        };

        // Podstawowe wyniki (uproszczona wersja)
        setText("r-total-area", result.total_area, " m²");
        setText("r-heated-area", result.heated_area, " m²");
        setText("r-max-power", result.max_heating_power, " kW");
        setText("r-cwu", result.hot_water_power || 0, " kW");
        const thermalAnnual2 = Number(result.annual_energy_consumption);
        const electricAnnual2 = annualElectricKwhFromThermal(thermalAnnual2);
        setText("r-energy", electricAnnual2, " kWh");
        setText("r-temp", result.design_outdoor_temperature, "°C");
        setText("r-bi-power", formatKwPolishOneDecimal(result.bivalent_point_heating_power), "");
        setText("r-avg-power", formatKwPolishOneDecimal(result.avg_heating_power), "");
        setText("r-temp-avg", result.avg_outdoor_temperature, "°C");
        const heatedForFactor2 = Number(result.heated_area);
        const factorElectric2 =
          heatedForFactor2 > 0 && Number.isFinite(electricAnnual2)
            ? Math.round((electricAnnual2 / heatedForFactor2) * 100) / 100
            : result.annual_energy_consumption_factor;
        setText("r-factor", factorElectric2, " kWh/m²");
        setText("r-power-factor", result.heating_power_factor, " W/m²");

        console.warn(
          "[ResultsRenderer] displayResults wywołane bez kontekstu modułu - użyto uproszczonego wyświetlania"
        );
      };

      // Eksportuj resetResultsSection (tylko jeśli nie istnieje)
      if (!window.resetResultsSection) {
        window.resetResultsSection = function resetResultsSection() {
          const defaultRoot =
            window.__HP_ACTIVE_ROOT__ ||
            document.querySelector(".heatpump-calculator") ||
            document;
          const defaultDom = window.createScopedDom
            ? window.createScopedDom(defaultRoot)
            : {
              qsa: (sel) => Array.from(defaultRoot.querySelectorAll(sel)),
            };

          const loadingElements = defaultDom.qsa('[id^="r-"]');
          loadingElements.forEach((el) => {
            if (el) el.textContent = "...";
          });
        };
      }
    }

    return function disposer() {
      disposers.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      });
    };
  }

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.resultsRenderer = { init };
})(window);
