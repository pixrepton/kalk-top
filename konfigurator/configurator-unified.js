// configurator-unified.js
// Kompleksowy, zunifikowany konfigurator maszynowni TOP-INSTAL
// Łączy najlepsze cechy configurator-new.js i configurator.js
// Gotowy do produkcji — pełna funkcjonalność: pricing, rules engine, export, advanced summary

(function (window) {
  "use strict";

  const PRICING_SOURCE_REASON_MASTER_UNAVAILABLE =
    "MASTER_PRICING_UNAVAILABLE";

  function isPricingObject(value) {
    return !!value && typeof value === "object";
  }

  function isMasterPricingDataReady(pricingData) {
    if (!isPricingObject(pricingData)) return false;
    const byPower = pricingData?.pump?.by_power_kw;
    const cwu = pricingData?.cwu;
    const buffer = pricingData?.buffer;
    const options = pricingData?.options;

    if (!isPricingObject(byPower) || Object.keys(byPower).length === 0) return false;
    if (!isPricingObject(cwu) || Object.keys(cwu).length === 0) return false;
    if (!isPricingObject(buffer) || Object.keys(buffer).length === 0) return false;
    if (!isPricingObject(options) || Object.keys(options).length === 0) return false;

    return true;
  }

  function resolvePricingSource(pricingData) {
    if (isMasterPricingDataReady(pricingData)) {
      return { mode: "master", warnings: [] };
    }
    return {
      mode: "unavailable",
      reasonCode: PRICING_SOURCE_REASON_MASTER_UNAVAILABLE,
      warnings: [
        {
          code: PRICING_SOURCE_REASON_MASTER_UNAVAILABLE,
          message:
            "Pricing master-data unavailable or incomplete. Runtime pricing must wait for backend OfferDTO.",
        },
      ],
    };
  }

  function init(ctx) {
    if (!ctx || !ctx.root || !ctx.dom) {
      console.error(
        "[KONFIG:INIT] Invalid context: root and dom are required",
        { hasCtx: !!ctx, hasRoot: !!ctx?.root, hasDom: !!ctx?.dom }
      );
      return function noop() { };
    }

    const root = ctx.root;
    const dom = ctx.dom;
    const runtimeAppState = ctx?.state || null;
    const disposers = [];
    const doc = root.ownerDocument;
    const view = doc.defaultView || window;
    /** Verbose logs only when localStorage hp_konfig_debug === "1" */
    function konfigDebug() {
      try {
        return view.localStorage.getItem("hp_konfig_debug") === "1";
      } catch (_) {
        return false;
      }
    }
    const config = runtimeAppState?.config || window.HEATPUMP_CONFIG || {};
    const motion = runtimeAppState?.motion || null;
    const getAppState = runtimeAppState?.getAppState;
    const updateAppState = runtimeAppState?.updateAppState;
    const setDraftRequest = runtimeAppState?.setDraftRequest;
    const setOffer = runtimeAppState?.setOffer;
    const debug = runtimeAppState?.debug || view;

    if (konfigDebug()) {
      console.log("[KONFIG:INIT] motion:", !!motion, "bufferRules:", !!getBufferRulesSource());
    }

    /**
     * Gdy UTF-8 został zinterpretowany jako Latin-1 (każdy bajt = jeden znak U+00xx),
     * odtwarzamy oryginalny UTF-8 (np. Ä + U+0085 → ą). Nie rusza poprawnego tekstu z znakiem > U+00FF.
     */
    function maybeRepairUtf8Misread(str) {
      if (typeof str !== "string" || str.length < 2) {
        return str;
      }
      const cp1252ByteMap = {
        0x20ac: 0x80,
        0x201a: 0x82,
        0x0192: 0x83,
        0x201e: 0x84,
        0x2026: 0x85,
        0x2020: 0x86,
        0x2021: 0x87,
        0x02c6: 0x88,
        0x2030: 0x89,
        0x0160: 0x8a,
        0x2039: 0x8b,
        0x0152: 0x8c,
        0x017d: 0x8e,
        0x2018: 0x91,
        0x2019: 0x92,
        0x201c: 0x93,
        0x201d: 0x94,
        0x2022: 0x95,
        0x2013: 0x96,
        0x2014: 0x97,
        0x02dc: 0x98,
        0x2122: 0x99,
        0x0161: 0x9a,
        0x203a: 0x9b,
        0x0153: 0x9c,
        0x017e: 0x9e,
        0x0178: 0x9f,
      };
      let hasHighLatin = false;
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i += 1) {
        const c = str.charCodeAt(i);
        if (c <= 255) {
          bytes[i] = c & 0xff;
          if (c >= 128) {
            hasHighLatin = true;
          }
          continue;
        }
        const mappedByte = cp1252ByteMap[c];
        if (typeof mappedByte !== "number") {
          return str;
        }
        bytes[i] = mappedByte;
        hasHighLatin = true;
      }
      if (!hasHighLatin) {
        return str;
      }
      try {
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (decoded === str) {
          return str;
        }
        if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(decoded)) {
          return decoded;
        }
      } catch (_e) {
        return str;
      }
      return str;
    }

    function sanitizeConfiguratorTextEncoding(input) {
      if (typeof input !== "string" || input.length === 0) {
        return input;
      }

      let inputFixed = maybeRepairUtf8Misread(input);

      const replacements = [
        [/\u0139\u201A/g, "\u0142"],
        [/\u0139\u0081/g, "\u0141"],
        [/\u0139\u013D/g, "\u017C"],
        [/\u0139\u017B/g, "\u017B"],
        [/\u0139\u017A/g, "\u017A"],
        [/\u0139\u0179/g, "\u0179"],
        [/\u00C4\u201A/g, "\u0105"],
        [/\u00C4\u0085/g, "\u0105"],
        [/\u00C4\u2026/g, "\u0105"],
        [/\u00C4\u0084/g, "\u0104"],
        [/\u00C4\u2122/g, "\u0119"],
        [/\u00C4\u0098/g, "\u0118"],
        [/\u00C4\u2020/g, "\u0106"],
        [/\u00C4\u2021/g, "\u0107"],
        [/\u0139\u0161/g, "\u015A"],
        [/\u0139\u203A/g, "\u015B"],
        [/\u0103\u201A/g, "\u00F3"],
        [/\u0102\u0142/g, "\u00F3"],
        [/\u0102\u201C/g, "\u00D3"],
        [/\u00C5\u201E/g, "\u0144"],
        [/\u00C5\u0083/g, "\u0143"],
        [/\u00C2\u00B0/g, "\u00B0"],
        [/\u00C2\u02DB/g, "\u00B2"],
        [/\u0102\u2014/g, "\u00D7"],
        [/\u00E2\u20AC\u201D/g, "—"],
        [/\u00E2\u20AC\u201C/g, "–"],
        [/\u00E2\u20AC\u00A2/g, "\u2022"],
        [/\u00E2\u2020\u2019/g, "\u2192"],
        [/Pompa ciep(?:Ă„Ä…Ă˘â‚¬Ĺˇa|Äąâ€ša)/g, "Pompa ciepła"],
        [/pompy ciep(?:Äąâ€ša|la)/g, "pompy ciepła"],
        [/pomp(?:e|ę) ciepla/g, "pompę ciepła"],
        [/Poziom ha(?:Äąâ€šasu|Ă„Ä…Ă˘â‚¬Ĺˇasu)/g, "Poziom hałasu"],
        [/Rekomendowana pojemno(?:ść|ść)/g, "Rekomendowana pojemność"],
        [/uÄąÄ˝ytkowania/g, "użytkowania"],
        [/domownikÄ‚Ĺ‚w/g, "domowników"],
        [/ciepłej wody/g, "ciepłej wody"],
      ];

      let output = inputFixed;
      for (let pass = 0; pass < 2; pass += 1) {
        const next = replacements.reduce(
          (acc, [pattern, value]) => acc.replace(pattern, value),
          output
        );
        if (next === output) {
          break;
        }
        output = next;
      }

      return output;
    }

    function sanitizeConfiguratorDom(scope = root) {
      if (!scope || !doc?.createTreeWalker || !view?.NodeFilter) {
        return;
      }

      const walker = doc.createTreeWalker(scope, view.NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }
      textNodes.forEach((node) => {
        const sanitized = sanitizeConfiguratorTextEncoding(node.nodeValue);
        if (sanitized !== node.nodeValue) {
          node.nodeValue = sanitized;
        }
      });

      const attrSelectors = "[title],[aria-label],[alt],[placeholder]";
      if (scope.matches && scope.matches(attrSelectors)) {
        ["title", "aria-label", "alt", "placeholder"].forEach((attrName) => {
          const value = scope.getAttribute(attrName);
          if (typeof value !== "string" || value.length === 0) return;
          const sanitized = sanitizeConfiguratorTextEncoding(value);
          if (sanitized !== value) {
            scope.setAttribute(attrName, sanitized);
          }
        });
      }

      scope.querySelectorAll(attrSelectors).forEach((element) => {
        ["title", "aria-label", "alt", "placeholder"].forEach((attrName) => {
          const value = element.getAttribute(attrName);
          if (typeof value !== "string" || value.length === 0) return;
          const sanitized = sanitizeConfiguratorTextEncoding(value);
          if (sanitized !== value) {
            element.setAttribute(attrName, sanitized);
          }
        });
      });
    }

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

    let configuratorInitDone = false;
    let pricesData = null; // Cache dla equipment-catalog.json -> pricebook view
    /** Ostatni poprawnie sparsowany equipment-catalog (SSoT dla tabel pompowych po loadzie). */
    let equipmentCatalogSnapshot = null;
    let pricesSource = "uninitialized"; // uninitialized | remote | fallback
    let pricesLoadPromise = null;
    let pricesFailures = 0;
    let pricesNextRetryAt = 0;
    const PRICES_RETRY_BASE_MS = 15000;
    const PRICES_RETRY_MAX_MS = 180000;

    function resolveConfiguratorBaseUrl() {
      const fromAppState = config?.konfiguratorUrl;
      if (typeof fromAppState === "string" && fromAppState.trim() !== "") {
        return fromAppState.replace(/\/+$/, "");
      }

      const fromGlobal = window.HEATPUMP_CONFIG?.konfiguratorUrl;
      if (typeof fromGlobal === "string" && fromGlobal.trim() !== "") {
        return fromGlobal.replace(/\/+$/, "");
      }

      try {
        const scripts = document.getElementsByTagName("script");
        for (let i = scripts.length - 1; i >= 0; i -= 1) {
          const src =
            scripts[i] && typeof scripts[i].src === "string"
              ? scripts[i].src
              : "";
          if (!src) continue;
          if (
            src.indexOf("/konfigurator/configurator-unified.js") === -1 &&
            !/\/configurator-unified\.js(?:\?|$)/.test(src)
          ) {
            continue;
          }
          return src.split("?")[0].replace(/\/configurator-unified\.js$/, "");
        }
      } catch (e) {
        // no-op
      }

      return "../konfigurator";
    }

    /* ==========================================================================
     PRICES LOADER Ă˘â‚¬â€ť ÄąÂadowanie cen z master-data/equipment-catalog.json
     ========================================================================== */
    function mapEquipmentCatalogToPriceBook(catalog) {
      if (!catalog || typeof catalog !== "object") return {};
      const pumps = Array.isArray(catalog.pumps) ? catalog.pumps : [];
      const byPower = {};
      pumps.forEach((pump) => {
        if (!pump || typeof pump !== "object") return;
        const power = Number(pump.power_kw);
        const pricing = pump.pricing && typeof pump.pricing === "object" ? pump.pricing : null;
        if (!Number.isFinite(power) || power <= 0 || !pricing) return;
        const key = String(Math.round(power));
        byPower[key] = { ...(byPower[key] || {}), ...pricing };
      });
      const sections =
        catalog.pricing_sections && typeof catalog.pricing_sections === "object"
          ? catalog.pricing_sections
          : {};
      return {
        schema_version: catalog.schema_version || "equipment_catalog_v1",
        pricing_version: catalog.data_version || "master-data",
        currency: catalog.currency || "PLN",
        vat_rate: Number.isFinite(Number(catalog.vat_rate))
          ? Number(catalog.vat_rate)
          : 0.08,
        pump: { by_power_kw: byPower },
        cwu: sections.cwu || {},
        buffer: sections.buffer || {},
        foundation: sections.foundation || {},
        drainage: sections.drainage || {},
        water: sections.water || {},
        options: sections.options || {},
        hydraulic_components_aio: Number(sections.hydraulic_components_aio) || 0,
        hydraulic_components_split: Number(sections.hydraulic_components_split) || 0,
        installation_net: Number(sections.installation_net) || 0,
        pricing_policy: catalog.pricing_policy || {},
      };
    }

    /**
     * Odpowiednik TopInstal_PricingEngine::find_closest_numeric_key — najbliższy klucz liczbowy w mapie.
     * @param {Record<string, unknown>} map
     * @param {number} target
     * @returns {string|null}
     */
    function findClosestNumericKey(map, target) {
      if (!map || typeof map !== "object") return null;
      const t = Number(target);
      if (!Number.isFinite(t)) return null;
      let bestKey = null;
      let bestDistance = null;
      Object.keys(map).forEach((key) => {
        if (!isFinite(Number(key))) return;
        const distance = Math.abs(t - Number(key));
        if (bestDistance === null || distance < bestDistance) {
          bestDistance = distance;
          bestKey = key;
        }
      });
      return bestKey;
    }

    /**
     * Jak SelectionRulesRepository_Wp::build_rules_from_catalog — pumpMatchingTable z katalogu.
     * @param {Record<string, unknown>} catalog
     * @returns {Record<string, object>}
     */
    function buildPumpMatchingTableFromCatalog(catalog) {
      const pumps = Array.isArray(catalog?.pumps) ? catalog.pumps : [];
      const table = {};
      pumps.forEach((pump) => {
        if (!pump || typeof pump !== "object") return;
        const model =
          typeof pump.model === "string" ? pump.model.trim() : "";
        if (!model) return;
        const range =
          pump.selection_range_kw && typeof pump.selection_range_kw === "object"
            ? pump.selection_range_kw
            : {};
        const surf = range.surface || {};
        const mix = range.mixed || {};
        const rad = range.radiators || {};
        const typeRaw = (
          pump.type != null ? String(pump.type) : "split"
        ).toLowerCase();
        const type =
          typeRaw === "all-in-one" || typeRaw === "all_in_one"
            ? "all-in-one"
            : "split";
        const phase = Number(pump.phase) || 1;
        const row = {
          min: {
            surface: Number(surf.min) || 0,
            mixed: Number(mix.min) || 0,
            radiators: Number(rad.min) || 0,
          },
          max: {
            surface: Number(surf.max) || 0,
            mixed: Number(mix.max) || 0,
            radiators: Number(rad.max) || 0,
          },
          power: Number(pump.power_kw) || 0,
          series: pump.series || "K",
          type,
          requires3F: phase === 3,
          phase,
        };
        if (type === "all-in-one") {
          row.cwu_tank = Number(pump.cwu_tank) || 185;
        }
        table[model] = row;
      });
      return table;
    }

    /**
     * Jak SelectionRulesRepository_Wp — mapa split → AIO z pair.aio_model.
     * @param {Record<string, unknown>} catalog
     * @returns {Record<string, string>}
     */
    function buildAioMapFromCatalog(catalog) {
      const pumps = Array.isArray(catalog?.pumps) ? catalog.pumps : [];
      const map = {};
      pumps.forEach((pump) => {
        if (!pump || typeof pump !== "object") return;
        const model =
          typeof pump.model === "string" ? pump.model.trim() : "";
        const aio = pump.pair?.aio_model;
        const aioStr =
          aio != null && typeof aio === "string" ? aio.trim() : "";
        if (model && aioStr) {
          map[model] = aioStr;
        }
      });
      return map;
    }

    function buildAioLargeCwuMapFromCatalog(catalog) {
      const pumps = Array.isArray(catalog?.pumps) ? catalog.pumps : [];
      const map = {};
      pumps.forEach((pump) => {
        if (!pump || typeof pump !== "object") return;
        const model =
          typeof pump.model === "string" ? pump.model.trim() : "";
        const aio = pump.pair?.aio_model_large_cwu;
        const aioStr =
          aio != null && typeof aio === "string" ? aio.trim() : "";
        if (model && aioStr) {
          map[model] = aioStr;
        }
      });
      return map;
    }

    function resolveMasterDataBaseUrl() {
      const fromGlobalBase = window.HEATPUMP_CONFIG?.baseUrl;
      if (typeof fromGlobalBase === "string" && fromGlobalBase.trim() !== "") {
        return fromGlobalBase.replace(/\/+$/, "");
      }
      const configUrl = resolveConfiguratorBaseUrl();
      return configUrl.replace(/\/konfigurator$/, "");
    }

    async function loadPricesData() {
      const now = Date.now();
      if (pricesSource === "remote" && pricesData) return pricesData;
      if (
        pricesSource === "fallback" &&
        pricesData &&
        now < pricesNextRetryAt
      ) {
        return pricesData;
      }
      if (pricesLoadPromise) return pricesLoadPromise;

      const baseUrl = resolveMasterDataBaseUrl();
      const pricesUrl = `${baseUrl}/core/infrastructure/master-data/equipment-catalog.json`;

      pricesLoadPromise = (async () => {
        const scheduleRetry = () => {
          pricesFailures += 1;
          const backoffMs = Math.min(
            PRICES_RETRY_MAX_MS,
            PRICES_RETRY_BASE_MS * Math.pow(2, Math.max(0, pricesFailures - 1))
          );
          pricesNextRetryAt = Date.now() + backoffMs;
          return backoffMs;
        };

        const emptyFallback = {};

        try {
          const response = await fetch(pricesUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const parsed = await response.json();
          pricesData = mapEquipmentCatalogToPriceBook(parsed);
          applyEquipmentCatalogRuntime(parsed);
          pricesSource = "remote";
          pricesFailures = 0;
          pricesNextRetryAt = 0;
          if (konfigDebug()) {
            console.log("[KONFIG:PRICES] Loaded equipment-catalog from", pricesUrl);
          }
          return pricesData;
        } catch (error) {
          const backoffMs = scheduleRetry();
          pricesData =
            pricesData && typeof pricesData === "object"
              ? pricesData
              : emptyFallback;
          pricesSource = "fallback";
          console.warn(
            `[KONFIG:PRICES] Failed to load equipment-catalog (${pricesUrl}); runtime pricing remains backend-only. Retry in ${Math.round(
              backoffMs / 1000
            )}s`,
            error
          );
          return pricesData;
        } finally {
          pricesLoadPromise = null;
        }
      })();

      return pricesLoadPromise;
    }

    function maybeRefreshPricesData() {
      if (
        pricesSource === "fallback" &&
        !pricesLoadPromise &&
        Date.now() >= pricesNextRetryAt
      ) {
        loadPricesData().catch(() => { });
      }
    }

    let presentationData = null;
    let presentationSource = "uninitialized";
    let presentationLoadPromise = null;
    let presentationFailures = 0;
    let presentationNextRetryAt = 0;
    const PRESENTATION_RETRY_BASE_MS = 15000;
    const PRESENTATION_RETRY_MAX_MS = 180000;

    async function loadPresentationData() {
      const now = Date.now();
      if (presentationSource === "remote" && presentationData) {
        return presentationData;
      }
      if (
        presentationSource === "fallback" &&
        presentationData &&
        now < presentationNextRetryAt
      ) {
        return presentationData;
      }
      if (presentationLoadPromise) return presentationLoadPromise;

      const configUrl = resolveConfiguratorBaseUrl();
      const presentationUrl = `${configUrl}/configurator-presentation.json`;

      presentationLoadPromise = (async () => {
        const scheduleRetry = () => {
          presentationFailures += 1;
          const backoffMs = Math.min(
            PRESENTATION_RETRY_MAX_MS,
            PRESENTATION_RETRY_BASE_MS *
            Math.pow(2, Math.max(0, presentationFailures - 1))
          );
          presentationNextRetryAt = Date.now() + backoffMs;
          return backoffMs;
        };

        try {
          const response = await fetch(presentationUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const parsed = await response.json();
          presentationData =
            parsed && typeof parsed === "object" ? parsed : null;
          presentationSource = "remote";
          presentationFailures = 0;
          presentationNextRetryAt = 0;
          if (konfigDebug()) {
            console.log("[KONFIG:PRESENTATION] Loaded", presentationUrl);
          }
          setTimeout(() => {
            try {
              const app = dom.byId("configurator-app");
              if (
                app &&
                app.dataset.initialized === "true" &&
                typeof requestRecompute === "function"
              ) {
                requestRecompute();
              }
            } catch (e) {
              // no-op
            }
          }, 0);
          return presentationData;
        } catch (error) {
          const backoffMs = scheduleRetry();
          presentationData =
            presentationData && typeof presentationData === "object"
              ? presentationData
              : null;
          presentationSource = "fallback";
          console.warn(
            `[KONFIG:PRESENTATION] Failed to load (${presentationUrl}); using inline fallback. Retry in ${Math.round(
              backoffMs / 1000
            )}s`,
            error
          );
          return presentationData;
        } finally {
          presentationLoadPromise = null;
        }
      })();

      return presentationLoadPromise;
    }

    function maybeRefreshPresentationData() {
      if (
        presentationSource === "fallback" &&
        !presentationLoadPromise &&
        Date.now() >= presentationNextRetryAt
      ) {
        loadPresentationData().catch(() => { });
      }
    }

    function mergeBufferCatalogFromPresentation(fallbackByCapacity) {
      const imgUrl = config?.imgUrl || "../img";
      const byCap = presentationData?.buffer_cards?.by_capacity_liters;
      if (!byCap || typeof byCap !== "object") {
        return fallbackByCapacity;
      }
      const out = {};
      Object.keys(fallbackByCapacity).forEach((k) => {
        const base = fallbackByCapacity[k];
        const row = byCap[k];
        if (row && typeof row === "object") {
          out[k] = {
            ...base,
            title: row.title || base.title,
            description: row.description || base.description,
            dimensions: row.dimensions || base.dimensions,
            image: row.image_file
              ? `${imgUrl}/${row.image_file}`
              : base.image,
          };
        } else {
          out[k] = { ...base };
        }
      });
      return out;
    }

    const DEFAULT_BUFFER_RULES = {
      capacityPerKw: {
        underfloor: 10,
        radiators_lt: 20,
        radiators_ht: 25,
        radiators: 20,
        mixed: 15,
      },
      availableCapacities: {
        buffer: [50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000],
      },
      separatorSizeClasses: { thresholds: { small: 7, medium: 15 } },
      cwuRules: {
        baseCapacity: { 1: 150, 2: 150, 3: 200, 4: 200, "5+": 300 },
        usageAdjustments: { shower: 0, shower_bath: 50, bath: 100 },
        safetyRule: { usage: "bath", persons_min: 2, minimumCapacity: 200 },
        availableCapacities: [150, 200, 250, 300, 400, 500],
      },
    };

    function getBufferRulesSource() {
      const fromRuntime =
        (config && config.bufferRules) ||
        (typeof window !== "undefined" &&
          window.HEATPUMP_CONFIG &&
          window.HEATPUMP_CONFIG.bufferRules) ||
        null;
      return fromRuntime && typeof fromRuntime === "object" ? fromRuntime : null;
    }

    /**
     * Engineering policy snapshot from PHP (BufferRulesRepository), with safe defaults.
     */
    function getBufferRules() {
      return getBufferRulesSource() || DEFAULT_BUFFER_RULES;
    }

    async function loadBufferRules() {
      return getBufferRules();
    }

    /* ==========================================================================
     PUMP MATCHING & SELECTION (z configurator.js)
     ========================================================================== */

    // Tabela doboru pomp ciepła - tylko modele ze starego kodu (SDCĂ˘â€ â€™WC, ADC) - Seria K
    // Tabela doboru pomp ciepła - tylko modele ze starego kodu (SDCĂ˘â€ â€™WC, ADC)
    // Zakresy min/max to zakresy mocy przy -20Ă‚Â°C (dane doborowe Panasonic), NIE zakresy modulacji
    // Ă˘ĹˇÂ ÄŹÂ¸Ĺą FIX P1.1: UÄąÄ˝yj konsolidowanej tabeli (Single Source of Truth)
    // Fallback do lokalnej tabeli dla kompatybilnoÄąâ€şci wstecznej (po loadzie katalogu nadpisywane z equipment-catalog)
    const PUMP_MATCHING_TABLE_FALLBACK = {
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

    function clonePumpTableFallback() {
      return JSON.parse(JSON.stringify(PUMP_MATCHING_TABLE_FALLBACK));
    }
    let pumpMatchingTable =
      window.PUMP_MATCHING_TABLE || clonePumpTableFallback();

    // Mapa odpowiednikÄ‚Ĺ‚w AIO dla modeli Split - tylko modele ze starego kodu
    const AIO_MAP_FALLBACK = {
      "KIT-WC03K3E5": "KIT-ADC03K3E5",
      "KIT-WC05K3E5": "KIT-ADC05K3E5",
      "KIT-WC07K3E5": "KIT-ADC07K3E5",
      "KIT-WC09K3E5": "KIT-ADC09K3E5",
      "KIT-WC09K3E8": "KIT-ADC09K9E8",
      "KIT-WC12K9E8": "KIT-ADC12K9E8",
      "KIT-WC16K9E8": "KIT-ADC16K9E8",
    };
    const AIO_LARGE_CWU_MAP_FALLBACK = {
      "KIT-WC09K3E8": "KIT-ADC09K9E83",
      "KIT-WC12K9E8": "KIT-ADC12K9E83",
      "KIT-WC16K9E8": "KIT-ADC16K9E83",
    };

    let aioMap = { ...AIO_MAP_FALLBACK };
    let aioLargeCwuMap = { ...AIO_LARGE_CWU_MAP_FALLBACK };

    /**
     * Po załadowaniu equipment-catalog: pumpMatchingTable + aioMap jak backend (SelectionRulesRepository_Wp).
     */
    function applyEquipmentCatalogRuntime(parsed) {
      if (!parsed || typeof parsed !== "object") return;
      equipmentCatalogSnapshot = parsed;
      const builtPump = buildPumpMatchingTableFromCatalog(parsed);
      if (Object.keys(builtPump).length > 0) {
        pumpMatchingTable = builtPump;
      }
      const builtAio = buildAioMapFromCatalog(parsed);
      if (Object.keys(builtAio).length > 0) {
        aioMap = { ...AIO_MAP_FALLBACK, ...builtAio };
      }
      const builtAioLarge = buildAioLargeCwuMapFromCatalog(parsed);
      if (Object.keys(builtAioLarge).length > 0) {
        aioLargeCwuMap = { ...AIO_LARGE_CWU_MAP_FALLBACK, ...builtAioLarge };
      }
      setTimeout(() => {
        try {
          const app = dom.byId("configurator-app");
          if (
            app &&
            app.dataset.initialized === "true" &&
            typeof requestRecompute === "function"
          ) {
            requestRecompute();
          }
        } catch (e) {
          // no-op
        }
      }, 0);
    }

    function findEquivalentAIO(splitModel, recommendedCwuCapacity = null) {
      if (!splitModel) return null;
      const cwuCapacity = Number(recommendedCwuCapacity);
      if (Number.isFinite(cwuCapacity) && cwuCapacity >= 400) {
        return null;
      }
      if (Number.isFinite(cwuCapacity) && cwuCapacity > 200) {
        return aioLargeCwuMap[splitModel] || null;
      }
      return aioMap[splitModel] || null;
    }

    function resolveRecommendedCwuCapacityForPumpSelection(calcInput) {
      const meta =
        calcInput && typeof calcInput === "object" ? calcInput : {};
      const includeHot = !!meta.include_hot_water;
      const persons = Number(meta.hot_water_persons || meta.cwu_people || 0);
      if (!includeHot || !Number.isFinite(persons) || persons <= 0) {
        return null;
      }

      const profile = meta.hot_water_usage || meta.cwu_profile || null;
      const validPersons =
        Number.isFinite(persons) && persons > 0 && persons < 20
          ? Math.round(persons)
          : 0;
      const validProfile = profile || "shower_bath";
      const rules = getBufferRules();
      const cwuRules = rules?.cwuRules || {
        baseCapacity: { 1: 150, 2: 150, 3: 200, 4: 200, "5+": 300 },
        usageAdjustments: { shower: 0, shower_bath: 50, bath: 100 },
        safetyRule: { usage: "bath", persons_min: 2, minimumCapacity: 200 },
        availableCapacities: [150, 200, 250, 300, 400, 500],
      };

      let recommendedCapacity = null;
      if (validPersons > 0) {
        const baseCapacityMap = cwuRules.baseCapacity || {};
        if (validPersons <= 2) recommendedCapacity = baseCapacityMap["2"] || 150;
        else if (validPersons <= 4) recommendedCapacity = baseCapacityMap["4"] || 200;
        else if (validPersons <= 6) recommendedCapacity = baseCapacityMap["5+"] || 250;
        else recommendedCapacity = baseCapacityMap["5+"] || 300;
      } else {
        recommendedCapacity = 200;
      }

      const usageAdjustments = cwuRules.usageAdjustments || {
        shower: 0,
        shower_bath: 50,
        bath: 100,
      };
      let extra = 0;
      if (validProfile === "shower_bath") {
        extra = usageAdjustments.shower_bath || 50;
      } else if (validProfile === "bath" || validProfile === "comfort") {
        extra = usageAdjustments.bath || 100;
      }

      if (recommendedCapacity) {
        recommendedCapacity += extra;
        const allowed = cwuRules.availableCapacities || [
          150, 200, 250, 300, 400, 500,
        ];
        recommendedCapacity = allowed.reduce((best, candidate) => {
          if (best === null) return candidate;
          return Math.abs(candidate - recommendedCapacity) <
            Math.abs(best - recommendedCapacity)
            ? candidate
            : best;
        }, null);
      }

      if (!recommendedCapacity) {
        recommendedCapacity = 200;
      }

      const safetyRule = cwuRules.safetyRule || {
        usage: "bath",
        persons_min: 2,
        minimumCapacity: 200,
      };
      if (
        validProfile === safetyRule.usage &&
        validPersons >= safetyRule.persons_min &&
        recommendedCapacity < safetyRule.minimumCapacity
      ) {
        recommendedCapacity = safetyRule.minimumCapacity;
      }

      return recommendedCapacity;
    }

    // Funkcja przypisujĂ„â€¦ca obrazy do pomp Ă˘â‚¬â€ś dostosowana do aktualnych plikÄ‚Ĺ‚w PNG w katalogu img
    function getPumpImage(type, phase, series, power, model = null) {
      // UÄąÄ˝yj dynamicznego URL z konfiguracji WordPress
      const imgUrl = config?.imgUrl || "../img";
      const basePath = imgUrl.endsWith("/") ? imgUrl : imgUrl + "/";

      // SPLIT Ă˘â‚¬â€ś osobna jednostka zewnętrzna - Seria K
      if (type === "split") {
        // Standardowe split-y - Seria K (wspólny asset 1f/3f do czasu osobnego pliku splitK3f w pakiecie)
        if (phase === 3) {
          return basePath + "splitK1f.png";
        }
        return basePath + "splitK1f.png";
      }

      // ALLĂ˘â‚¬â€INĂ˘â‚¬â€ONE Ă˘â‚¬â€ś jednostka wewnętrzna z wbudowanym zasobnikiem - Seria K
      if (type === "all-in-one") {
        if (phase === 3) {
          return basePath + "allinoneK3f.png";
        }
        return basePath + "allinoneK1f.png";
      }

      // Fallback Ă˘â‚¬â€ś klasyczna jednostka zewnętrzna
      return basePath + "splitK1f.png";
    }

    // Dobiera pompy ciepła na podstawie wynikÄ‚Ĺ‚w kalkulatora
    // ARCHITECTURAL: Uses OZC canonical max_heating_power (heating only, no CWU)
    // Pump selection is based on heating demand, CWU is handled separately by buffer
    function selectHeatPumps(result, heatingType = "radiators") {
      // P1 FIX: Utwardzenie wejÄąâ€şciowe - rozrÄ‚Ĺ‚ÄąÄ˝nia null/undefined od NaN, akceptuje stringi
      function safeNumber(value) {
        if (value == null) return null;
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n : null;
      }

      // OZC SINGLE SOURCE OF TRUTH: recommended_power_kw should equal max_heating_power
      const recommendedPower = safeNumber(result.recommended_power_kw);
      const maxPower = safeNumber(result.max_heating_power);
      const powerDemand = recommendedPower ?? maxPower ?? 0;

      // Fail-fast: jeÄąâ€şli obie wartoÄąâ€şci sĂ„â€¦ null/NaN, loguj ostrzeÄąÄ˝enie
      if (powerDemand === 0 && recommendedPower === null && maxPower === null) {
        if (konfigDebug()) {
          console.warn("[selectHeatPumps] No power values; using 0 kW fallback", {
            recommended_power_kw: result.recommended_power_kw,
            max_heating_power: result.max_heating_power,
          });
        }
      } else if (!Number.isFinite(powerDemand) || powerDemand <= 0) {
        console.error("[selectHeatPumps] Invalid power demand", powerDemand, {
          recommended_power_kw: result.recommended_power_kw,
          max_heating_power: result.max_heating_power,
        });
      }

      // SPECJALNE PRZYPADKI

      // D5: Walidacja zakresu heated_area (sanity check)
      const heatedArea = result.heated_area || result.total_area || 0;
      if (heatedArea <= 0 || heatedArea > 10000) {
        if (konfigDebug()) {
          console.warn(`[selectHeatPumps] Invalid heated_area (${heatedArea} m²), using fallback`);
        }
      }

      // 1. Zbyt niska moc (< 1.8kW) + canadian + <80mĂ‚Ë› + temp<21Ă‚Â°C Ă˘â€ â€™ pompa 3kW
      const constructionType =
        result.construction_type || result.building_construction_type;
      const totalArea = result.total_area || heatedArea || 0;
      const indoorTemp = result.indoor_temperature || 21;
      const isVeryLowPowerSpecialCase =
        powerDemand < 1.8 &&
        constructionType === "canadian" &&
        totalArea < 80 &&
        indoorTemp < 21;

      if (isVeryLowPowerSpecialCase) {
        const pump3kW = pumpMatchingTable["KIT-WC03K3E5"];
        if (pump3kW) {
          return [
            {
              model: "KIT-WC03K3E5",
              power: pump3kW.power,
              series: pump3kW.series,
              type: pump3kW.type,
              image: getPumpImage(
                pump3kW.type,
                pump3kW.phase,
                pump3kW.series,
                pump3kW.power,
                "KIT-WC03K3E5"
              ),
              phase: pump3kW.phase,
              requires3F: pump3kW.requires3F,
              cwu_tank: pump3kW.cwu_tank || null,
              specialCase: "very_low_power",
              adjustedPowerDisplay: `${powerDemand.toFixed(2)} ± 2 kW`, // Wyświetl z tolerancją dla bardzo niskich mocy
            },
          ];
        }
      }

      // 2. Zbyt wysoka moc (16-25kW) Ă˘â€ â€™ pompa 16kW 3-fazowa + komunikat
      if (powerDemand >= 16 && powerDemand < 25) {
        const pump16kW3F = pumpMatchingTable["KIT-WC16K9E8"];
        if (pump16kW3F) {
          return [
            {
              model: "KIT-WC16K9E8",
              power: pump16kW3F.power,
              series: pump16kW3F.series,
              type: pump16kW3F.type,
              image: getPumpImage(
                pump16kW3F.type,
                pump16kW3F.phase,
                pump16kW3F.series,
                pump16kW3F.power,
                "KIT-WC16K9E8"
              ),
              phase: pump16kW3F.phase,
              requires3F: pump16kW3F.requires3F,
              cwu_tank: pump16kW3F.cwu_tank || null,
              specialCase: "high_power_termomodernization",
              warningMessage:
                "System wykrył bardzo wysokie zapotrzebowanie cieplne. Budynek najprawdopodobniej wymaga termomodernizacji.",
            },
          ];
        }
      }

      // 3. Zbyt wysoka moc (> 25kW) Ă˘â€ â€™ nie wyÄąâ€şwietlaj konfiguratora
      if (powerDemand >= 25) {
        return []; // Pusty array - konfigurator nie będzie wyÄąâ€şwietlony
      }

      const normalizedType =
        heatingType === "underfloor" ? "surface" : heatingType;

      // Dobór pomp tylko po mocy (bez fazy)
      let matchingPumps = Object.entries(pumpMatchingTable)
        .filter(([, data]) => {
          const min = data.min[normalizedType] || data.min.mixed;
          const max = data.max[normalizedType] || data.max.mixed;
          return powerDemand >= min && powerDemand <= max;
        })
        .map(([model, data]) => {
          return {
            model: model,
            power: data.power,
            series: data.series,
            type: data.type,
            image: getPumpImage(
              data.type,
              data.phase,
              data.series,
              data.power,
              model
            ),
            phase: data.phase,
            requires3F: data.requires3F,
            cwu_tank: data.cwu_tank || null,
          };
        });


      matchingPumps.sort((a, b) => a.power - b.power);
      if (matchingPumps.length === 0) {
        console.warn(
          `[selectHeatPumps] No matching pumps for ${powerDemand} kW (heating type: ${normalizedType})`
        );
      }
      return matchingPumps;
    }

    // Przygotowuje profile pomp (Split + AIO) dla konfiguratora
    function preparePumpProfiles(calcInput) {
      if (isBackendCalcEnabled()) {
        const backendRecommendation = resolveCanonicalPumpRecommendationSnapshot(
          calcInput,
          null
        );
        const backendProfiles =
          buildPumpProfilesFromCanonicalRecommendation(backendRecommendation);
        if (backendProfiles.length > 0) {
          return backendProfiles;
        }
        return [];
      }

      const heatingType =
        calcInput.heating_type || calcInput.installation_type || "radiators";

      const matched = selectHeatPumps(calcInput, heatingType);

      if (!matched || matched.length === 0) {
        console.warn("[Configurator] No matching heat pumps for calculator input", {
          powerDemand: calcInput.recommended_power_kw || calcInput.max_heating_power,
          heatingType,
        });
        return [];
      }

      if (konfigDebug()) {
        console.log(
          "[preparePumpProfiles] Matched",
          matched.length,
          "pump(s):",
          matched.map((p) => `${p.model} (${p.power}kW)`).join(", ")
        );
      }

      const recommended = matched[0]; // Pierwsza pompa to rekomendowany Split

      // JeÄąâ€şli to specjalny przypadek (very_low_power lub high_power_termomodernization), nie szukaj AIO
      if (recommended.specialCase) {
        return [
          {
            id: "hp",
            optionId: "hp",
            label: "Split",
            variant: "Rekomendowana — split",
            type: "split",
            isRecommended: true,
            model: recommended.model,
            power_kw: recommended.power,
            series: recommended.series,
            image: recommended.image,
            minPhase: recommended.phase || 1,
            requires3F: recommended.requires3F || false,
            specialCase: recommended.specialCase,
            adjustedPowerDisplay: recommended.adjustedPowerDisplay,
            warningMessage: recommended.warningMessage,
          },
        ];
      }

      const recommendedCwuCapacity =
        resolveRecommendedCwuCapacityForPumpSelection(calcInput);
      const aioModel = findEquivalentAIO(
        recommended.model,
        recommendedCwuCapacity
      );
      const aioData = aioModel ? pumpMatchingTable[aioModel] : null;

      return [
        {
          id: "hp",
          optionId: "hp",
          label: "Split",
          variant: "Rekomendowana — split",
          type: "split",
          isRecommended: true,
          model: recommended.model,
          power_kw: recommended.power,
          series: recommended.series,
          image: recommended.image,
          minPhase: recommended.phase || 1,
          requires3F: recommended.requires3F || false,
          warningMessage: recommended.warningMessage || null,
        },
        {
          id: "aio",
          optionId:
            Number(aioData?.cwu_tank) >= 250 ? "aio_premium400" : "aio",
          label: "All-in-One",
          variant: "All-in-One",
          type: "all-in-one",
          isRecommended: false,
          model: aioModel,
          power_kw: recommended.power,
          series: aioData?.series || "ADC",
          image: aioData
            ? getPumpImage(
              "all-in-one",
              aioData.phase || recommended.phase || 1,
              aioData.series,
              aioData.power,
              aioModel
            )
            : (config?.imgUrl || "../img") + "/aioK.png",
          minPhase: aioData?.phase || recommended.phase || 1,
          requires3F: aioData?.requires3F || recommended.requires3F || false,
          disabled: !aioModel,
          cwu_tank: aioData?.cwu_tank || null,
        },
      ];
    }

    // Loader panasonic.json
    let panasonicDB = null;
    let panasonicDBPromise = null;

    async function loadPanasonicDB() {
      if (panasonicDBPromise) return panasonicDBPromise;

      panasonicDBPromise = (async () => {
        try {
          // Użyj odpornego resolvera URL (działa nawet przy opóźnionym HEATPUMP_CONFIG)
          const configUrl = resolveConfiguratorBaseUrl();
          const jsonUrl = `${configUrl}/panasonic.json`;
          const response = await fetch(jsonUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();

          // panasonic.json to array, więc zwracamy bezpośrednio
          panasonicDB = Array.isArray(data) ? data : [];
          return panasonicDB;
        } catch (e) {
          console.warn("[Configurator] Failed to load panasonic.json", e);
          // Elegancki, informacyjny komunikat dla użytkownika
          if (
            typeof window.ErrorHandler !== "undefined" &&
            window.ErrorHandler.showToast
          ) {
            window.ErrorHandler.showToast(
              "Część rekomendacji w trybie uproszczonym",
              "info",
              4000
            );
          }
          return [];
        }
      })();

      return panasonicDBPromise;
    }

    // Mapuje model pompy do danych z panasonic.json
    function getPumpDataFromDB(model) {
      if (!panasonicDB || !model) return null;
      return panasonicDB.find((p) => p.kit === model) || null;
    }

    /**
     * Jednolity label CWU dla pomp all-in-one (wbudowany zasobnik).
     * @param {object|null} selectedPump
     * @param {Record<string, object>|null} pumpTable
     * @returns {string|null} null gdy nie AIO
     */
    function resolveIntegratedCwuLabel(selectedPump, pumpTable) {
      if (!selectedPump || typeof selectedPump !== "object") return null;
      const oid = selectedPump.optionId || "";
      const isAIO =
        selectedPump.type === "aio" ||
        selectedPump.type === "all-in-one" ||
        (typeof oid === "string" && oid.indexOf("aio") !== -1);
      if (!isAIO) return null;
      const model = selectedPump.model || null;
      let tankLiters = null;
      if (model && pumpTable && pumpTable[model] && pumpTable[model].cwu_tank != null) {
        tankLiters = pumpTable[model].cwu_tank;
      }
      if (tankLiters == null && selectedPump.cwu_tank != null) {
        tankLiters = selectedPump.cwu_tank;
      }
      const dbRow = model ? getPumpDataFromDB(model) : null;
      if (tankLiters == null && dbRow && dbRow.cwu_tank != null) {
        tankLiters = dbRow.cwu_tank;
      }
      const n = Number(tankLiters);
      if (Number.isFinite(n) && n > 0) {
        return `Zintegrowany ${Math.round(n)} l`;
      }
      return "Zintegrowany zbiornik CWU (w zestawie)";
    }

    /** Seria pompy (K/A/…) — używana m.in. do Service Cloud; bez domyślnego K w meta. */
    function resolveServiceCloudGeneration(state) {
      const pump = state?.selectedPump;
      const fromPump =
        pump && typeof pump.series === "string" && pump.series.trim() !== ""
          ? pump.series.trim()
          : "";
      const fromMeta =
        typeof state?.meta?.generation === "string" && state.meta.generation.trim() !== ""
          ? state.meta.generation.trim()
          : "";
      return fromPump || fromMeta || "";
    }

    /* ==========================================================================
     STATE MANAGEMENT
     ========================================================================== */

    let steps = [];
    let navPrev = null;
    let navNext = null;
    let currentStepNumberEl = null;
    let totalStepsNumberEl = null;
    let summaryBody = null;
    let totalSteps = 0;
    let currentStepIndex = 0;

    // Stan konfiguratora - rozszerzony o pricing i products
    const state = {
      selections: {},
      meta: null, // Dane z kalkulatora
      baseDraftRequest: null,
      selectedPump: null,
      selectedCwuProduct: null,
      selectedBufferProduct: null,
      backendOffer: null,
      recommendations: {
        hydraulics: null, // Single Source of Truth: hydraulicsRecommendation
        cwu: null,
      },
      configuratorUi: {
        serviceStickyRevealed: false,
      },
      pricing: {
        total_netto_pln: 0,
        total_brutto_pln: 0,
        items: [],
      },
    };
    let lastSelectionPayload = null;
    let backendRefreshTimer = null;
    let backendRefreshSeq = 0;
    let lastBackendRequestSignature = null;
    let lastBackendHydraulicsSignature = null;

    // CONFIGURATOR STATE PERSISTENCE Ă˘â‚¬â€ť zapis/odczyt stanu przy przeÄąâ€šĂ„â€¦czaniu widokÄ‚Ĺ‚w
    const CONFIGURATOR_STATE_KEY_BASE = "wycena2025_configuratorState";
    const SUPPORTED_SELECTION_KEYS = Object.freeze([
      "pompa",
      "cwu",
      "bufor",
      "cyrkulacja",
      "service",
      "posadowienie",
      "reduktor",
      "woda",
    ]);

    function getConfiguratorStateKey() {
      const instanceId =
        runtimeAppState?.instanceId ||
        root?.getAttribute?.("data-hp-instance") ||
        "default";
      return `${CONFIGURATOR_STATE_KEY_BASE}::${String(instanceId)}`;
    }

    function sanitizeSelectionsForSupportedProductSurface(inputSelections) {
      const rawSelections =
        inputSelections && typeof inputSelections === "object"
          ? inputSelections
          : {};
      const sanitized = {};

      SUPPORTED_SELECTION_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(rawSelections, key)) {
          sanitized[key] = rawSelections[key];
        }
      });

      if (
        !sanitized.service &&
        Object.prototype.hasOwnProperty.call(rawSelections, "service_cloud")
      ) {
        sanitized.service = rawSelections.service_cloud;
      }

      return sanitized;
    }

    /**
     * Zapisuje stan konfiguratora do sessionStorage
     */
    function saveConfiguratorState() {
      try {
        const stateToSave = {
          selections: sanitizeSelectionsForSupportedProductSurface(
            state.selections
          ),
          selectedPump: state.selectedPump,
          meta: state.meta,
          backendOffer: state.backendOffer,
          recommendations: state.recommendations,
          pricing: state.pricing,
          currentStepIndex: currentStepIndex,
          configuratorUi: state.configuratorUi ? { ...state.configuratorUi } : { serviceStickyRevealed: false },
          timestamp: Date.now(),
        };
        view.sessionStorage.setItem(
          getConfiguratorStateKey(),
          JSON.stringify(stateToSave)
        );
        return true;
      } catch (error) {
        console.warn(
          "[Configurator] Failed to save configurator state to sessionStorage",
          error
        );
        return false;
      }
    }

    /**
     * ÄąÂaduje stan konfiguratora z sessionStorage
     */
    function loadConfiguratorState() {
      try {
        const stored = view.sessionStorage.getItem(getConfiguratorStateKey());
        if (stored) {
          const savedState = JSON.parse(stored);
          return savedState;
        }
      } catch (error) {
        console.warn(
          "[Configurator] Failed to load configurator state from sessionStorage",
          error
        );
      }
      return null;
    }

    /**
     * Przywraca stan konfiguratora (selekcje, wybory użytkownika)
     */
    function restoreConfiguratorState(savedState) {
      if (!savedState) return false;

      try {
        // PrzywrÄ‚Ĺ‚Ă„â€ˇ selekcje
        if (
          savedState.selections &&
          Object.keys(savedState.selections).length > 0
        ) {
          state.selections = sanitizeSelectionsForSupportedProductSurface(
            savedState.selections
          );
        }

        // PrzywrÄ‚Ĺ‚Ă„â€ˇ selectedPump
        if (savedState.selectedPump) {
          state.selectedPump = savedState.selectedPump;
        }

        // PrzywrÄ‚Ĺ‚Ă„â€ˇ currentStepIndex
        if (savedState.currentStepIndex !== undefined) {
          currentStepIndex = savedState.currentStepIndex;
        }

        // PrzywrÄ‚Ĺ‚Ă„â€ˇ pricing (jeÄąâ€şli istnieje)
        if (savedState.pricing) {
          state.pricing = { ...savedState.pricing };
        }

        if (savedState.backendOffer) {
          state.backendOffer = savedState.backendOffer;
        }

        // PrzywrÄ‚Ĺ‚Ă„â€ˇ recommendations (jeÄąâ€şli istnieje)
        if (savedState.recommendations) {
          state.recommendations = { ...savedState.recommendations };
        }

        if (savedState.configuratorUi && typeof savedState.configuratorUi === "object") {
          state.configuratorUi = {
            ...state.configuratorUi,
            ...savedState.configuratorUi,
          };
        }
        if (state.selections?.service?.optionId) {
          state.configuratorUi.serviceStickyRevealed = true;
        }

        // Zaktualizuj UI na podstawie przywrÄ‚Ĺ‚conego stanu
        restoreSelectionsToUI();

        // Przelicz po przywróceniu stanu (backend-first; legacy local fallback wyłączony w HEATPUMP_CONFIG)
        recompute();

        return true;
      } catch (error) {
        console.warn("[Configurator] Failed to restore configurator state", error);
        return false;
      }
    }

    /**
     * Przywraca selekcje do UI (zaznacza karty, aktualizuje sticky bar)
     */
    function restoreSelectionsToUI() {
      Object.keys(selectionBarTypeMapping).forEach((stepKey) => {
        syncSelectionForStep(stepKey);
      });

      if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
        showStep(currentStepIndex, true); // noScroll = true
      }
      return;
    }

    // Handlery eventÄ‚Ĺ‚w
    let cardClickHandler = null;
    let navClickHandler = null;
    let summaryClickHandler = null;
    let selectionsBarClickHandler = null;
    let tooltipHandler = null;
    const selectionBarTypeMapping = {
      pompa: "pompa",
      cwu: "cwu",
      bufor: "bufor",
      cyrkulacja: "cyrkulacja",
      service: "service",
      posadowienie: "posadowienie",
      reduktor: "reduktor",
      woda: "uzdatnianie",
    };
    const notApplicableLabels = {
      cwu: "Nie dotyczy",
      cyrkulacja: "Nie dotyczy",
      service: "Niedostępne dla tej konfiguracji",
      default: "Nie dotyczy",
    };

    // Konfiguracja krokÄ‚Ĺ‚w z ikonami
    const summaryConfig = [
      { stepKey: "pompa", label: "Pompa ciepła", icon: "ri-settings-5-fill" },
      { stepKey: "cwu", label: "Zasobnik CWU", icon: "ri-showers-fill" },
      {
        stepKey: "hydraulics_inputs",
        label: "Parametry hydrauliczne",
        icon: "ri-flow-chart-fill",
      },
      { stepKey: "bufor", label: "Bufor CO", icon: "ri-drop-fill" },
      {
        stepKey: "cyrkulacja",
        label: "Cyrkulacja CWU",
        icon: "ri-refresh-fill",
      },
      { stepKey: "service", label: "Service Cloud", icon: "ri-cloud-fill" },
      {
        stepKey: "posadowienie",
        label: "Posadowienie jednostki zewnętrznej",
        icon: "ri-building-fill",
      },
      {
        stepKey: "reduktor",
        label: "Reduktor ciśnienia",
        icon: "ri-scale-fill",
      },
      {
        stepKey: "woda",
        label: "Stacja uzdatniania wody",
        icon: "ri-drop-fill",
      },
    ];

    // Eksport stanu na zewnĂ„â€¦trz
    if (runtimeAppState) {
      runtimeAppState.configuratorSelections =
        sanitizeSelectionsForSupportedProductSurface(state.selections);
      runtimeAppState.configuratorState = state;
    }

    /* ==========================================================================
     config_data (sessionStorage) — calculator integration + SSoT
     ========================================================================== */

    // Multi-root: klucz per instancja (config_data::instanceId)
    function getConfigDataStorageKey() {
      const instanceId =
        runtimeAppState?.instanceId ||
        root?.getAttribute?.("data-hp-instance") ||
        "default";
      return `config_data::${String(instanceId)}`;
    }

    function readConfigDataFromSessionStorage() {
      const key = getConfigDataStorageKey();
      try {
        let raw = view.sessionStorage.getItem(key);
        if (!raw) {
          raw = view.sessionStorage.getItem("config_data");
        }
        if (!raw) {
          if (konfigDebug()) {
            console.warn("[KONFIG:SSoT] No config_data in sessionStorage", { key });
          }
          return null;
        }
        const parsed = JSON.parse(raw);
        const valid = parsed && typeof parsed === "object" ? parsed : null;
        if (!valid) {
          console.error("[KONFIG:SSoT] Invalid config_data JSON shape");
        } else if (konfigDebug()) {
          console.log("[KONFIG:SSoT] Loaded config_data", {
            key,
            keys: Object.keys(valid),
          });
        }
        return valid;
      } catch (e) {
        console.error("[KONFIG:SSoT] Failed to read config_data from sessionStorage", e);
        return null;
      }
    }

    function writeConfigDataToSessionStorage(configData) {
      const key = getConfigDataStorageKey();
      try {
        view.sessionStorage.setItem(key, JSON.stringify(configData));
        if (konfigDebug()) {
          console.log("[KONFIG:SSoT] Saved config_data", {
            key,
            keys: Object.keys(configData || {}),
          });
        }
        return true;
      } catch (e) {
        console.error("[KONFIG:SSoT] Failed to write config_data to sessionStorage", e);
        return false;
      }
    }

    function ensureConfigDataShape(configData) {
      const hadData = !!(configData && typeof configData === "object");
      const next =
        configData && typeof configData === "object" ? { ...configData } : {};

      const hadHydraulics = !!(
        next.hydraulics_inputs && typeof next.hydraulics_inputs === "object"
      );

      if (
        !next.hydraulics_inputs ||
        typeof next.hydraulics_inputs !== "object"
      ) {
        next.hydraulics_inputs = {
          has_underfloor_actuators: false,
          radiators_is_ht: false,
          bivalent_enabled: false,
          bivalent_source_type: null,
          bivalent_source_power_kw: null,
        };
      } else {
        next.hydraulics_inputs = {
          has_underfloor_actuators:
            !!next.hydraulics_inputs.has_underfloor_actuators,
          radiators_is_ht: !!next.hydraulics_inputs.radiators_is_ht,
          bivalent_enabled: !!next.hydraulics_inputs.bivalent_enabled,
          bivalent_source_type:
            next.hydraulics_inputs.bivalent_source_type === "gas" ||
              next.hydraulics_inputs.bivalent_source_type === "solid_fuel" ||
              next.hydraulics_inputs.bivalent_source_type ===
              "fireplace_water_jacket"
              ? next.hydraulics_inputs.bivalent_source_type
              : null,
          bivalent_source_power_kw:
            next.hydraulics_inputs.bivalent_source_power_kw != null
              ? Number(next.hydraulics_inputs.bivalent_source_power_kw) || null
              : null,
        };
      }

      if (!next.recommendations || typeof next.recommendations !== "object") {
        next.recommendations = {};
      }

      if (konfigDebug()) {
        console.log("[KONFIG:SSoT] Normalized config_data", {
          hadData,
          hadHydraulics,
          has_recommendations: !!next.recommendations,
        });
      }

      return next;
    }

    function getHydraulicsInputs() {
      const configData = ensureConfigDataShape(
        readConfigDataFromSessionStorage()
      );
      return configData.hydraulics_inputs;
    }

    function formatHydraulicsSourceTypeLabel(type) {
      if (type === "gas") return "biwalencja: gaz";
      if (type === "solid_fuel") return "biwalencja: kocioł stałopalny";
      if (type === "fireplace_water_jacket") return "biwalencja: kominek z płaszczem wodnym";
      return "biwalencja: nie";
    }

    function getHydraulicsInputsCompletionState() {
      const heatingType = normalizeHeatingType(
        state?.meta?.heating_type ||
        state?.meta?.installation_type ||
        "radiators"
      );
      const inputs = getHydraulicsInputs();
      const showUnderfloorActuators =
        heatingType === "underfloor" || heatingType === "mixed";
      const showRadiatorsHT =
        heatingType === "radiators" || heatingType === "mixed";
      const missingFields = [];
      const summaryParts = [];

      if (showUnderfloorActuators) {
        summaryParts.push(
          inputs.has_underfloor_actuators
            ? "strefowanie pętli: tak"
            : "strefowanie pętli: nie"
        );
      }
      if (showRadiatorsHT) {
        summaryParts.push(
          inputs.radiators_is_ht
            ? "grzejniki HT: tak"
            : "grzejniki HT: nie"
        );
      }

      if (inputs.bivalent_enabled) {
        if (!inputs.bivalent_source_type) {
          missingFields.push("bivalent_source_type");
          summaryParts.push("biwalencja: brak typu");
        } else {
          summaryParts.push(
            formatHydraulicsSourceTypeLabel(inputs.bivalent_source_type)
          );
        }
      } else {
        summaryParts.push("biwalencja: nie");
      }

      const shouldBlockRecommendation = missingFields.length > 0;
      const message = shouldBlockRecommendation
        ? "Włączona biwalencja wymaga wskazania typu drugiego źródła. Dopiero wtedy pokazemy kanoniczny dobor bufora i sposób wpięcia."
        : "Odpowiedzi z tego kroku bezpośrednio zmieniają pojemność bufora, potrzebę sprzęgła hydraulicznego i sposób wpięcia instalacji.";

      return {
        heatingType,
        inputs,
        showUnderfloorActuators,
        showRadiatorsHT,
        missingFields,
        isComplete: !shouldBlockRecommendation,
        shouldBlockRecommendation,
        summaryLabel: summaryParts.join(" | "),
        message,
      };
    }

    function buildHydraulicsPendingRecommendation(overrides = {}) {
      const completionState = getHydraulicsInputsCompletionState();
      const reasonCode =
        overrides.reasonCode ||
        (completionState.shouldBlockRecommendation
          ? "HYDRAULICS_INPUTS_INCOMPLETE"
          : "BACKEND_OFFER_PENDING");
      const short =
        overrides.short ||
        (completionState.shouldBlockRecommendation
          ? "Uzupełnij dane hydrauliki, aby policzyć bufor."
          : "Oczekiwanie na backendową rekomendację hydrauliki.");
      const long =
        overrides.long ||
        (completionState.shouldBlockRecommendation
          ? completionState.message
          : "Konfigurator czeka na odświeżenie kanonicznego OfferDTO z backendu.");

      return {
        axes: {
          flow_protection: null,
          hydraulic_separation: null,
          energy_storage: null,
        },
        recommendation: null,
        buffer_liters: null,
        severity: "INFO",
        reason_codes: [reasonCode],
        explanation: {
          short,
          long,
        },
        inputs_used: {
          heating_type: completionState.heatingType,
          designHeatLoss_kW: state?.meta?.max_heating_power || 0,
          heating_power: state?.meta?.recommended_power_kw || 0,
        },
        type: completionState.shouldBlockRecommendation ? "input_required" : "pending",
        setupType: completionState.shouldBlockRecommendation ? "INPUT_REQUIRED" : "PENDING",
        hydraulicSeparationRequired: null,
        dominantReason: short,
        estimatedSystemVolume: null,
        requiredSystemVolume: null,
        systemVolumeSufficient: null,
        pending: true,
        formCompletion: {
          isComplete: completionState.isComplete,
          missingFields: completionState.missingFields.slice(),
          summaryLabel: completionState.summaryLabel,
        },
      };
    }

    function invalidateHydraulicsDependentState() {
      if (state?.recommendations && typeof state.recommendations === "object") {
        state.recommendations.hydraulics = null;
      }
      state.selectedBufferProduct = null;
      clearSelectionState("bufor");
    }

    function setHydraulicsInputs(partial) {
      const current = ensureConfigDataShape(readConfigDataFromSessionStorage());
      const next = ensureConfigDataShape({
        ...current,
        hydraulics_inputs: {
          ...current.hydraulics_inputs,
          ...partial,
        },
      });
      const changed =
        JSON.stringify(current.hydraulics_inputs || {}) !==
        JSON.stringify(next.hydraulics_inputs || {});
      if (konfigDebug()) {
        console.log("[KONFIG:SSoT] hydraulics_inputs update", partial, "→", next.hydraulics_inputs);
      }
      writeConfigDataToSessionStorage(next);
      if (changed) {
        invalidateHydraulicsDependentState();
      }
      return next.hydraulics_inputs;
    }

    function persistHydraulicsRecommendationToConfigData(
      hydraulicsRecommendation
    ) {
      const current = ensureConfigDataShape(readConfigDataFromSessionStorage());
      const next = ensureConfigDataShape({
        ...current,
        recommendations: {
          ...current.recommendations,
          hydraulics: hydraulicsRecommendation,
        },
      });
      if (konfigDebug()) {
        console.log("[KONFIG:DECYZJE] persist hydraulics recommendation", hydraulicsRecommendation);
      }
      writeConfigDataToSessionStorage(next);
    }

    /* ==========================================================================
     PRICING — UI estimates (authority: konfigurator/AGENTS.md § Pricing authority)
     - Canonical money: backend calculate-offer → PricingEngine + equipment-catalog.json
     - runtime visible money always comes from backend OfferDTO
     - master: pricesData from equipment-catalog fetch (developer parity only)
     - unavailable: no local commercial fallback; wait for backend OfferDTO
     ========================================================================== */

    function getPricingSourceSnapshot() {
      return resolvePricingSource(pricesData);
    }

    function pickPumpPriceFromMasterRow(pumpPrices, optionId, phaseHint) {
      const normalizedOptionId = String(optionId || "").toLowerCase();
      if (!pumpPrices || typeof pumpPrices !== "object") return 0;

      if (normalizedOptionId.includes("aio_premium400")) {
        return (
          Number(pumpPrices.aio_premium400_net) ||
          Number(pumpPrices.aio_premium_net) ||
          0
        );
      }
      if (normalizedOptionId.includes("split400")) {
        return (
          Number(pumpPrices.split400_net) || Number(pumpPrices.split_net) || 0
        );
      }
      if (
        normalizedOptionId.includes("aio") ||
        normalizedOptionId.includes("premium")
      ) {
        return (
          Number(pumpPrices.aio_premium_net) || Number(pumpPrices.split_net) || 0
        );
      }

      // Master catalog: align with backend TopInstal_PricingEngine + pricing_policy
      // default_candidates (split_3ph prefers split400_net; split_1ph prefers split_net).
      const phase = phaseHint == null ? null : Number(phaseHint);
      if (phase === 3) {
        return (
          Number(pumpPrices.split400_net) ||
          Number(pumpPrices.split_net) ||
          0
        );
      }
      return Number(pumpPrices.split_net) || Number(pumpPrices.split400_net) || 0;
    }

    function calculatePumpPrice(pumpData, powerKw, pricingSource = null) {
      if (!pumpData || !powerKw) return 0;
      if (isBackendCalcEnabled()) return 0;
      const source = pricingSource || getPricingSourceSnapshot();
      const optionId = pumpData.optionId || "";

      if (source.mode !== "master") return 0;

      const powerKey = String(Math.round(Number(powerKw)));
      const pumpPrices = pricesData?.pump?.by_power_kw?.[powerKey];
      const phaseHint =
        pumpData.phase != null
          ? pumpData.phase
          : pumpData.minPhase != null
            ? pumpData.minPhase
            : null;
      return pickPumpPriceFromMasterRow(pumpPrices, optionId, phaseHint);
    }

    function calculateCwuPrice(optionId, capacity, pricingSource = null) {
      if (!optionId || !capacity) return 0;
      if (isBackendCalcEnabled()) return 0;
      const source = pricingSource || getPricingSourceSnapshot();
      const capacityMatch = optionId.match(/(\d+)/);
      const actualCapacity = capacityMatch ? Number(capacityMatch[1]) : capacity;
      const material = optionId.includes("inox") ? "inox" : "emalia";

      if (source.mode !== "master") return 0;

      const cwuRoot = pricesData?.cwu;
      if (!cwuRoot || typeof cwuRoot !== "object") return 0;
      let catalog = cwuRoot[material];
      if (!catalog || typeof catalog !== "object") {
        catalog = cwuRoot.emalia;
      }
      if (!catalog || typeof catalog !== "object") return 0;
      const capKey = String(actualCapacity);
      if (
        catalog[capKey] !== undefined &&
        catalog[capKey] !== null &&
        catalog[capKey] !== ""
      ) {
        return Number(catalog[capKey]) || 0;
      }
      const closest = findClosestNumericKey(catalog, actualCapacity);
      if (closest != null && catalog[closest] !== undefined) {
        return Number(catalog[closest]) || 0;
      }
      return 0;
    }

    function calculateBufferPrice(optionId, pricingSource = null) {
      if (!optionId) return 0;
      if (isBackendCalcEnabled()) return 0;
      const source = pricingSource || getPricingSourceSnapshot();
      const capacityMatch = optionId.match(/(\d+)/);
      if (!capacityMatch) return 0;
      const capacity = Number(capacityMatch[1]);

      const hr = state.recommendations?.hydraulics || null;
      const isParallel = hr?.recommendation === "BUFOR_RÓWNOLEGLE";
      const mountType = isParallel ? "sprzeglo" : "na_powrocie";

      if (source.mode !== "master") return 0;

      const buffer = pricesData?.buffer;
      if (!buffer || typeof buffer !== "object") return 0;
      const capKey = String(capacity);
      const row = buffer[capKey];
      if (row && typeof row === "object") {
        const direct = Number(row[mountType]);
        if (Number.isFinite(direct)) return direct;
      }
      const closestKey = findClosestNumericKey(buffer, capacity);
      if (closestKey != null) {
        const fb = buffer[closestKey];
        if (fb && typeof fb === "object") {
          return Number(fb[mountType]) || 0;
        }
      }
      return 0;
    }

    function calculateAccessoryPrice(optionId, pricingSource = null) {
      if (!optionId) return 0;
      if (isBackendCalcEnabled()) return 0;
      const source = pricingSource || getPricingSourceSnapshot();

      if (source.mode !== "master") return 0;

      if (
        optionId === "cyrkulacja-tak" &&
        pricesData?.options?.["cyrkulacja-tak"] !== undefined
      ) {
        return Number(pricesData.options["cyrkulacja-tak"]) || 0;
      }
      if (
        optionId === "reduktor-tak" &&
        pricesData?.water?.pressure?.["z-reduktorem-cisnienia"] !== undefined
      ) {
        return Number(pricesData.water.pressure["z-reduktorem-cisnienia"]) || 0;
      }
      if (
        optionId === "woda-tak" &&
        pricesData?.water?.filters?.["filtry-zmiekczacz"] !== undefined
      ) {
        return Number(pricesData.water.filters["filtry-zmiekczacz"]) || 0;
      }
      if (
        optionId === "posadowienie-grunt" &&
        pricesData?.foundation?.["fundament-klienta"] !== undefined
      ) {
        return Number(pricesData.foundation["fundament-klienta"]) || 0;
      }
      if (
        optionId === "posadowienie-sciana" &&
        pricesData?.foundation?.["fundament-nasz"] !== undefined
      ) {
        return Number(pricesData.foundation["fundament-nasz"]) || 0;
      }
      if (
        optionId === "posadowienie-eko" &&
        pricesData?.foundation?.["stojak"] !== undefined
      ) {
        return Number(pricesData.foundation["stojak"]) || 0;
      }
      return 0;
    }

    function isBackendCalcEnabled() {
      return !!(config && config.useBackendCalc === true);
    }

    function trackConfiguratorMilestone(eventName, partial) {
      try {
        if (typeof window.topinstalTrackEvent !== "function") {
          return null;
        }
        const offer =
          (partial && partial.offer) ||
          (runtimeAppState && runtimeAppState.canonicalOffer) ||
          null;
        const traceId =
          (partial && partial.traceId) ||
          (offer && offer.traceId) ||
          (typeof window.ensureTraceId === "function"
            ? window.ensureTraceId(null)
            : null);
        const ozc =
          offer && offer.engineering && offer.engineering.ozc
            ? offer.engineering.ozc
            : {};
        const selection =
          offer && offer.engineering && offer.engineering.selection
            ? offer.engineering.selection
            : {};
        return window.topinstalTrackEvent(eventName, {
          source: "configurator",
          traceId: traceId,
          stepKey: (partial && partial.stepKey) || "configurator",
          meta: {
            ...((partial && partial.meta) || {}),
            traceId: traceId,
            designHeatLoss_kW: ozc.designHeatLoss_kW ?? null,
            recommendedPower_kW: ozc.recommendedPower_kW ?? null,
            pumpModel: selection.pumpModel ?? null,
          },
        });
      } catch (_) {
        return null;
      }
    }

    function syncCanonicalOfferState(offer) {
      const canonicalOffer = offer && typeof offer === "object" ? offer : null;

      if (typeof setCanonicalOffer === "function") {
        setCanonicalOffer(canonicalOffer);
      } else if (typeof setOffer === "function") {
        setOffer(canonicalOffer);
      } else if (typeof updateAppState === "function") {
        updateAppState({ canonicalOffer: canonicalOffer, offer: canonicalOffer });
      }

      if (typeof updateAppState === "function") {
        updateAppState({
          canonicalOffer: canonicalOffer,
        });
      }
    }

    function persistCanonicalOfferToConfigData(offer, hydraulicsRecommendation = null) {
      const canonicalOffer = offer && typeof offer === "object" ? offer : null;
      if (!canonicalOffer) {
        return null;
      }

      const current = ensureConfigDataShape(readConfigDataFromSessionStorage());
      const selectionPayload = buildSelectionPayload();
      const selection = canonicalOffer?.engineering?.selection || {};
      const ozc = canonicalOffer?.engineering?.ozc || {};
      const pumpSelection =
        selection?.pumpSelection && typeof selection.pumpSelection === "object"
          ? selection.pumpSelection
          : current?.pump_selection && typeof current.pump_selection === "object"
            ? current.pump_selection
            : null;
      const nextRecommendations =
        current?.recommendations && typeof current.recommendations === "object"
          ? { ...current.recommendations }
          : {};

      if (hydraulicsRecommendation && typeof hydraulicsRecommendation === "object") {
        nextRecommendations.hydraulics = hydraulicsRecommendation;
      }
      const backendCwuRecommendation = normalizeCwuRecommendationFromOffer(
        canonicalOffer?.engineering?.cwu || {}
      );
      if (backendCwuRecommendation) {
        nextRecommendations.cwu = backendCwuRecommendation;
      }

      const next = ensureConfigDataShape({
        ...current,
        offer_dto: canonicalOffer,
        pump_selection: pumpSelection,
        selected_pump:
          selection?.pumpModel ||
          pumpSelection?.hp?.model ||
          pumpSelection?.aio?.model ||
          current?.selected_pump ||
          null,
        max_heating_power: Number.isFinite(Number(ozc?.designHeatLoss_kW))
          ? Number(ozc.designHeatLoss_kW)
          : current?.max_heating_power ?? null,
        recommended_power_kw: Number.isFinite(Number(selection?.capacity_kW))
          ? Number(selection.capacity_kW)
          : current?.recommended_power_kw ?? null,
        hot_water_power: Number.isFinite(Number(ozc?.hotWaterPower_kW))
          ? Number(ozc.hotWaterPower_kW)
          : current?.hot_water_power ?? 0,
        annual_energy_consumption: Number.isFinite(Number(ozc?.annualEnergy_kWh))
          ? Number(ozc.annualEnergy_kWh)
          : current?.annual_energy_consumption ?? null,
        design_outdoor_temperature: Number.isFinite(
          Number(ozc?.designOutdoorTemperatureC)
        )
          ? Number(ozc.designOutdoorTemperatureC)
          : current?.design_outdoor_temperature ?? null,
        recommendations: nextRecommendations,
        configuratorSelection:
          selectionPayload && typeof selectionPayload === "object"
            ? selectionPayload
            : current?.configuratorSelection ?? null,
      });

      writeConfigDataToSessionStorage(next);

      if (runtimeAppState) {
        runtimeAppState.config_data = next;
      }
      if (typeof updateAppState === "function") {
        updateAppState({ config_data: next });
      }

      trackConfiguratorMilestone("configurator_offer_ready", {
        offer: canonicalOffer,
        stepKey: "offer_persisted",
      });

      return next;
    }

    function toFiniteNumber(value, fallback = 0) {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    function toBool(value, fallback = false) {
      if (value === null || typeof value === "undefined") return fallback;
      if (value === true || value === false) return value;
      const normalized = String(value).trim().toLowerCase();
      if (normalized === "1" || normalized === "true" || normalized === "yes")
        return true;
      if (normalized === "0" || normalized === "false" || normalized === "no")
        return false;
      return fallback;
    }

    function ensureCalcTraceId(value) {
      if (typeof value === "string" && value.trim() !== "") return value.trim();
      if (typeof window.ensureTraceId === "function") {
        return window.ensureTraceId(value || null);
      }
      if (typeof window.createTraceId === "function") {
        return window.createTraceId();
      }
      return "cfg-" + Date.now().toString(16);
    }

    function resolveConfiguratorHasBuffer() {
      const optionId = state?.selections?.bufor?.optionId || "";
      if (optionId === "buffer-0" || optionId === "bufor-nie") {
        return false;
      }
      if (optionId) {
        return true;
      }
      return true;
    }

    function resolveConfiguratorDhwEnabled() {
      const cwuOptionId = state?.selections?.cwu?.optionId || "";
      if (cwuOptionId === "cwu-none") {
        return false;
      }
      return toBool(state?.meta?.include_hot_water, false);
    }

    function readSelectionOptionId(selection) {
      if (!selection) return null;
      if (typeof selection === "string") {
        const normalized = selection.trim();
        return normalized !== "" ? normalized : null;
      }
      if (typeof selection === "object") {
        const optionId = typeof selection.optionId === "string" ? selection.optionId.trim() : "";
        if (optionId !== "") return optionId;
        const id = typeof selection.id === "string" ? selection.id.trim() : "";
        if (id !== "") return id;
      }
      return null;
    }

    function buildConfiguratorPreferenceOptions() {
      const selections = sanitizeSelectionsForSupportedProductSurface(
        state?.selections || {}
      );
      const mapped = {
        pumpOptionId: readSelectionOptionId(selections.pompa),
        dhwOptionId: readSelectionOptionId(selections.cwu),
        bufferOptionId: readSelectionOptionId(selections.bufor),
        circulationOptionId: readSelectionOptionId(selections.cyrkulacja),
        pressureReducerOptionId: readSelectionOptionId(selections.reduktor),
        waterTreatmentOptionId: readSelectionOptionId(selections.woda),
        foundationOptionId: readSelectionOptionId(selections.posadowienie),
        serviceOptionId: readSelectionOptionId(selections.service),
      };

      const compact = {};
      Object.keys(mapped).forEach((key) => {
        if (mapped[key]) {
          compact[key] = mapped[key];
        }
      });
      return compact;
    }

    function resolveSelectedPumpParitySnapshot() {
      const selectedPump = state?.selectedPump || null;
      if (!selectedPump || typeof selectedPump !== "object") {
        return null;
      }

      const model =
        typeof selectedPump.model === "string" && selectedPump.model.trim() !== ""
          ? selectedPump.model.trim()
          : null;
      const profile = model ? pumpMatchingTable?.[model] || null : null;
      const powerKw =
        toFiniteNumber(selectedPump.power_kw, null) ??
        toFiniteNumber(profile?.power, null);
      const phase =
        toFiniteNumber(selectedPump.phase, null) ??
        toFiniteNumber(profile?.phase, null);
      const series =
        (typeof selectedPump.series === "string" && selectedPump.series.trim() !== ""
          ? selectedPump.series.trim()
          : null) ||
        (typeof profile?.series === "string" && profile.series.trim() !== ""
          ? profile.series.trim()
          : null) ||
        (typeof state?.meta?.generation === "string" && state.meta.generation.trim() !== ""
          ? state.meta.generation.trim()
          : null);

      const snapshot = {
        optionId:
          typeof selectedPump.optionId === "string" && selectedPump.optionId.trim() !== ""
            ? selectedPump.optionId.trim()
            : null,
        model: model,
        type:
          typeof selectedPump.type === "string" && selectedPump.type.trim() !== ""
            ? selectedPump.type.trim()
            : null,
        power_kw: powerKw,
        phase: phase,
        series: series,
      };

      Object.keys(snapshot).forEach((key) => {
        if (snapshot[key] == null || snapshot[key] === "") {
          delete snapshot[key];
        }
      });

      return Object.keys(snapshot).length > 0 ? snapshot : null;
    }

    function buildConfiguratorParityContext() {
      const hydraulicsInputs =
        typeof getHydraulicsInputs === "function" ? getHydraulicsInputs() : null;
      const selectedPump = resolveSelectedPumpParitySnapshot();
      const meta = state?.meta || {};

      const context = {
        selectedPump: selectedPump,
        hydraulics_inputs:
          hydraulicsInputs && typeof hydraulicsInputs === "object"
            ? { ...hydraulicsInputs }
            : null,
        meta: {
          generation:
            typeof meta.generation === "string" && meta.generation.trim() !== ""
              ? meta.generation.trim()
              : null,
          recommended_power_kw: toFiniteNumber(meta.recommended_power_kw, null),
          max_heating_power: toFiniteNumber(meta.max_heating_power, null),
          heated_area: toFiniteNumber(meta.heated_area, null),
          total_area: toFiniteNumber(meta.total_area, null),
          heating_type: meta.heating_type || null,
          installation_type: meta.installation_type || null,
        },
      };

      if (!context.hydraulics_inputs) {
        delete context.hydraulics_inputs;
      }
      if (!context.selectedPump) {
        delete context.selectedPump;
      }
      Object.keys(context.meta).forEach((key) => {
        if (context.meta[key] == null || context.meta[key] === "") {
          delete context.meta[key];
        }
      });
      if (Object.keys(context.meta).length === 0) {
        delete context.meta;
      }

      return Object.keys(context).length > 0 ? context : null;
    }

    function buildConfiguratorSourcePayload() {
      const meta = state?.meta || {};
      const payload = {
        heated_area: toFiniteNumber(meta.heated_area, null),
        total_area: toFiniteNumber(meta.total_area, null),
        construction_year:
          meta.construction_year != null
            ? Number(meta.construction_year)
            : meta.building_year != null
              ? Number(meta.building_year)
              : null,
        building_type: meta.building_type || null,
        heating_type: meta.heating_type || meta.installation_type || null,
        installation_type: meta.installation_type || meta.heating_type || null,
        include_hot_water: resolveConfiguratorDhwEnabled(),
        hot_water_persons:
          meta.hot_water_persons != null ? Number(meta.hot_water_persons) : null,
        hot_water_usage: meta.hot_water_usage || null,
        source_type: meta.heat_source_prev || "air_to_water_hp",
        location_id: meta.location_id || null,
        design_temp:
          meta.design_outdoor_temperature != null
            ? Number(meta.design_outdoor_temperature)
            : null,
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === null || Number.isNaN(payload[key])) {
          delete payload[key];
        }
      });

      return payload;
    }

    function buildConfiguratorCalcRequestDTO() {
      const appSnapshot =
        typeof getAppState === "function" ? getAppState() : runtimeAppState || {};
      const baseDraftRequest =
        (state?.baseDraftRequest && typeof state.baseDraftRequest === "object"
          ? state.baseDraftRequest
          : null) ||
        (appSnapshot?.draftRequest && typeof appSnapshot.draftRequest === "object"
          ? appSnapshot.draftRequest
          : null);
      const sourcePayload = buildConfiguratorSourcePayload();
      const traceId = ensureCalcTraceId(
        baseDraftRequest?.traceId ||
        appSnapshot?.draftRequest?.traceId ||
        appSnapshot?.offer?.traceId ||
        state?.backendOffer?.traceId ||
        null
      );

      let dto = null;
      if (typeof window.mapUiStateToCalcRequestDTO === "function") {
        dto = window.mapUiStateToCalcRequestDTO({
          appState: Object.assign({}, appSnapshot, {
            draftRequest: baseDraftRequest || appSnapshot?.draftRequest || null,
          }),
          sourcePayload: sourcePayload,
          traceId: traceId,
          source: "configurator",
          preserveExistingDraftRequest: true,
          hasBuffer: resolveConfiguratorHasBuffer(),
          configuratorSelections: sanitizeSelectionsForSupportedProductSurface(
            state?.selections || {}
          ),
        });
      }

      if (!dto || typeof dto !== "object") {
        const baseLead =
          baseDraftRequest?.lead && typeof baseDraftRequest.lead === "object"
            ? baseDraftRequest.lead
            : {};
        const baseBuilding =
          baseDraftRequest?.building && typeof baseDraftRequest.building === "object"
            ? baseDraftRequest.building
            : {};
        const basePreferences =
          baseDraftRequest?.preferences &&
            typeof baseDraftRequest.preferences === "object"
            ? baseDraftRequest.preferences
            : {};
        const baseHeating =
          basePreferences.heating && typeof basePreferences.heating === "object"
            ? basePreferences.heating
            : {};
        const baseDhw =
          basePreferences.dhw && typeof basePreferences.dhw === "object"
            ? basePreferences.dhw
            : {};
        const baseContext =
          baseDraftRequest?.context && typeof baseDraftRequest.context === "object"
            ? baseDraftRequest.context
            : {};
        dto = {
          schemaVersion: "1.0",
          traceId: traceId,
          lead: Object.assign({}, baseLead),
          building: Object.assign({}, baseBuilding, sourcePayload),
          preferences: {
            heating: {
              emitterType:
                sourcePayload.heating_type ||
                sourcePayload.installation_type ||
                baseHeating.emitterType ||
                null,
              sourceType:
                sourcePayload.source_type ||
                baseHeating.sourceType ||
                "air_to_water_hp",
            },
            dhw: {
              enabled:
                sourcePayload.include_hot_water != null
                  ? sourcePayload.include_hot_water === true
                  : baseDhw.enabled === true,
              persons:
                sourcePayload.hot_water_persons != null
                  ? sourcePayload.hot_water_persons
                  : baseDhw.persons || null,
              usageProfile:
                sourcePayload.hot_water_usage || baseDhw.usageProfile || null,
            },
            hasBuffer:
              resolveConfiguratorHasBuffer() ?? basePreferences.hasBuffer ?? true,
          },
          context: {
            source: "configurator",
            pluginVersion:
              config?.pluginVersion || baseContext.pluginVersion || null,
            uiVersion: config?.uiVersion || baseContext.uiVersion || null,
          },
        };
      }

      dto.traceId = traceId;
      dto.building = Object.assign({}, dto.building || {}, sourcePayload);
      dto.preferences = dto.preferences || {};
      dto.preferences.hasBuffer = resolveConfiguratorHasBuffer();
      dto.preferences.heating = dto.preferences.heating || {};
      dto.preferences.heating.emitterType =
        dto.preferences.heating.emitterType ||
        sourcePayload.heating_type ||
        sourcePayload.installation_type ||
        null;
      dto.preferences.heating.sourceType =
        dto.preferences.heating.sourceType ||
        sourcePayload.source_type ||
        "air_to_water_hp";
      dto.preferences.dhw = dto.preferences.dhw || {};
      dto.preferences.dhw.enabled = resolveConfiguratorDhwEnabled();
      dto.preferences.dhw.persons =
        dto.preferences.dhw.enabled && sourcePayload.hot_water_persons
          ? Number(sourcePayload.hot_water_persons)
          : null;
      dto.preferences.dhw.usageProfile = dto.preferences.dhw.enabled
        ? sourcePayload.hot_water_usage || null
        : null;
      dto.preferences.options = Object.assign(
        {},
        dto.preferences.options || {},
        buildConfiguratorPreferenceOptions()
      );
      dto.context = dto.context || {};
      dto.context.source = "configurator";
      dto.context.pluginVersion =
        config?.pluginVersion || dto.context.pluginVersion || null;
      dto.context.uiVersion = config?.uiVersion || dto.context.uiVersion || null;
      const parityContext = buildConfiguratorParityContext();
      if (parityContext) {
        dto.context.configurator = Object.assign(
          {},
          dto.context.configurator || {},
          parityContext
        );
      }

      return dto;
    }

    function mapOfferPricingItemsToLegacy(items) {
      if (!Array.isArray(items)) return [];
      return items.map((item) => {
        const qty = toFiniteNumber(item?.qty, 1);
        const unitNet = toFiniteNumber(item?.unitPriceNet, 0);
        const totalNet = toFiniteNumber(item?.totalNet, qty * unitNet);
        return {
          name: item?.name || item?.sku || "Pozycja",
          qty: qty,
          quantity: qty,
          unit_price: unitNet,
          unit_price_pln: unitNet,
          total: totalNet,
          total_pln: totalNet,
          vat_rate: toFiniteNumber(item?.vatRate, 0.08),
          total_brutto_pln: toFiniteNumber(item?.totalGross, totalNet),
        };
      });
    }

    function normalizeHydraulicsRecommendationFromOffer(bufferResult) {
      const rawSetup = String(bufferResult?.setupType || "")
        .trim()
        .toUpperCase();
      const litersRaw = toFiniteNumber(bufferResult?.liters, 0);
      const liters = litersRaw > 0 ? litersRaw : null;

      let recommendation = "NONE";
      let setupType = "NONE";

      if (rawSetup.indexOf("SZEREG") !== -1 || rawSetup === "SERIES_BYPASS") {
        recommendation = "BUFOR_SZEREGOWO";
        setupType = "SERIES_BYPASS";
      } else if (
        rawSetup.indexOf("ROWNO") !== -1 ||
        rawSetup.indexOf("RÄ‚â€śWNO") !== -1 ||
        rawSetup === "PARALLEL_CLUTCH"
      ) {
        recommendation = "BUFOR_RÓWNOLEGLE";
        setupType = "PARALLEL_CLUTCH";
      } else if (liters && liters > 0) {
        recommendation = "BUFOR_SZEREGOWO";
        setupType = "SERIES_BYPASS";
      }

      if (!liters || liters <= 0) {
        recommendation = "NONE";
        setupType = "NONE";
      }

      const reasonCodes = Array.isArray(bufferResult?.reasonCodes)
        ? bufferResult.reasonCodes
        : [];
      const dominantReason = reasonCodes.length > 0 ? String(reasonCodes[0]) : null;

      return {
        recommendation: recommendation,
        buffer_liters: liters,
        setupType: setupType,
        reason_codes: reasonCodes,
        severity: recommendation === "NONE" ? "INFO" : "MANDATORY",
        type:
          recommendation === "NONE"
            ? "none"
            : recommendation === "BUFOR_SZEREGOWO"
              ? "storage"
              : "both",
        dominantReason: dominantReason,
        explanation: {
          short: dominantReason || "Backend recommendation",
          long: dominantReason || "Backend recommendation",
        },
      };
    }

    function normalizeHydraulicsRecommendationFromOffer(bufferResult) {
      const recommendationPayload =
        bufferResult?.recommendation && typeof bufferResult.recommendation === "object"
          ? bufferResult.recommendation
          : {};
      const sizingPayload =
        bufferResult?.sizing && typeof bufferResult.sizing === "object"
          ? bufferResult.sizing
          : {};
      const rawSetup = String(
        recommendationPayload?.setupType || bufferResult?.setupType || ""
      )
        .trim()
        .toUpperCase();
      const rawRecommendation = String(
        recommendationPayload?.recommendation || ""
      )
        .trim()
        .toUpperCase();
      const litersRaw = toFiniteNumber(
        recommendationPayload?.buffer_liters,
        toFiniteNumber(bufferResult?.liters, 0)
      );
      const liters = litersRaw > 0 ? litersRaw : null;

      let recommendation = "NONE";
      let setupType = "NONE";

      if (
        rawRecommendation.indexOf("SZEREG") !== -1 ||
        rawSetup.indexOf("SZEREG") !== -1 ||
        rawSetup === "SERIES_BYPASS"
      ) {
        recommendation = "BUFOR_SZEREGOWO";
        setupType = "SERIES_BYPASS";
      } else if (
        rawRecommendation.indexOf("ROWNO") !== -1 ||
        rawRecommendation.indexOf("RÓWNO") !== -1 ||
        rawSetup.indexOf("ROWNO") !== -1 ||
        rawSetup.indexOf("RĂ“WNO") !== -1 ||
        rawSetup === "PARALLEL_CLUTCH"
      ) {
        recommendation = "BUFOR_RÓWNOLEGLE";
        setupType = "PARALLEL_CLUTCH";
      } else if (liters && liters > 0) {
        recommendation = "BUFOR_SZEREGOWO";
        setupType = "SERIES_BYPASS";
      }

      if (!liters || liters <= 0) {
        recommendation = "NONE";
        setupType = "NONE";
      }

      const reasonCodes = Array.isArray(recommendationPayload?.reason_codes)
        ? recommendationPayload.reason_codes.map((code) => String(code))
        : Array.isArray(bufferResult?.reasonCodes)
          ? bufferResult.reasonCodes.map((code) => String(code))
          : [];
      const axes =
        recommendationPayload?.axes && typeof recommendationPayload.axes === "object"
          ? {
            flow_protection:
              recommendationPayload.axes.flow_protection || null,
            hydraulic_separation:
              recommendationPayload.axes.hydraulic_separation || null,
            energy_storage:
              recommendationPayload.axes.energy_storage || null,
          }
          : {
            flow_protection: null,
            hydraulic_separation: null,
            energy_storage: null,
          };
      const dominant =
        typeof recommendationPayload?.dominant === "string" &&
          recommendationPayload.dominant.trim() !== ""
          ? recommendationPayload.dominant.trim()
          : null;
      const sizingComponents =
        sizingPayload &&
          (sizingPayload.antiCycling || sizingPayload.bivalent || sizingPayload.hydraulic)
          ? {
            antiCycling: sizingPayload.antiCycling || null,
            bivalent: sizingPayload.bivalent || null,
            hydraulic: sizingPayload.hydraulic || null,
            systemVolume: sizingPayload.systemVolume || null,
          }
          : undefined;
      const requiredSystemVolume = toFiniteNumber(
        sizingPayload?.systemVolume?.required_liters,
        null
      );
      const estimatedSystemVolume = toFiniteNumber(
        sizingPayload?.systemVolume?.estimated_liters,
        null
      );
      const systemVolumeSufficient =
        typeof sizingPayload?.systemVolume?.sufficient === "boolean"
          ? sizingPayload.systemVolume.sufficient
          : null;
      const dominantReason =
        reasonCodes.length > 0
          ? String(reasonCodes[0])
          : recommendation === "NONE"
            ? "BUFFER_NOT_REQUIRED"
            : "BUFFER_BACKEND_RECOMMENDED";
      const severity =
        recommendation === "NONE"
          ? "INFO"
          : axes.energy_storage === "OPTIONAL"
            ? "RECOMMENDED"
            : "MANDATORY";

      return {
        recommendation: recommendation,
        buffer_liters: liters,
        setupType: setupType,
        reason_codes: reasonCodes,
        severity: severity,
        type:
          recommendationPayload?.type ||
          (recommendation === "NONE"
            ? "none"
            : recommendation === "BUFOR_SZEREGOWO"
              ? "storage"
              : "both"),
        axes,
        dominant: dominant,
        dominantReason: dominantReason,
        sizingComponents: sizingComponents,
        computedLiters: toFiniteNumber(
          sizingPayload?.calculatedCapacity_liters,
          null
        ),
        roundedTo: liters,
        requiredSystemVolume: requiredSystemVolume,
        estimatedSystemVolume: estimatedSystemVolume,
        systemVolumeSufficient: systemVolumeSufficient,
        warnings: Array.isArray(bufferResult?.warnings)
          ? bufferResult.warnings
          : [],
        assumptions: Array.isArray(bufferResult?.assumptions)
          ? bufferResult.assumptions
          : [],
        explanation: {
          short: dominantReason || "Backend recommendation",
          long: dominantReason || "Backend recommendation",
        },
      };
    }

    function normalizeCwuRecommendationFromOffer(cwuResult) {
      if (!cwuResult || typeof cwuResult !== "object") {
        return null;
      }

      const enabled = cwuResult?.enabled === true;
      const required = cwuResult?.required === true;
      const skip = cwuResult?.skip === true;
      const recommendedCapacityRaw = toFiniteNumber(
        cwuResult?.recommendedCapacityL,
        toFiniteNumber(
          cwuResult?.resolvedCapacityL,
          toFiniteNumber(cwuResult?.pricingHint?.capacityL, null)
        )
      );
      const recommendedCapacity =
        recommendedCapacityRaw && recommendedCapacityRaw > 0
          ? recommendedCapacityRaw
          : null;
      const personsRaw = toFiniteNumber(
        cwuResult?.persons,
        toFiniteNumber(cwuResult?.personsRaw, null)
      );
      const persons =
        personsRaw && personsRaw > 0 ? Math.round(personsRaw) : null;
      const usageProfile =
        typeof cwuResult?.usageProfile === "string" &&
          cwuResult.usageProfile.trim() !== ""
          ? cwuResult.usageProfile.trim()
          : null;
      const explanationPayload =
        cwuResult?.explanation && typeof cwuResult.explanation === "object"
          ? cwuResult.explanation
          : {};
      const skipReason =
        typeof cwuResult?.skipReason === "string" &&
          cwuResult.skipReason.trim() !== ""
          ? cwuResult.skipReason.trim()
          : skip
            ? "Nie dotyczy"
            : null;

      return {
        source: "backend",
        demandEnabled: cwuResult?.demandEnabled === true,
        enabled,
        required,
        skip,
        skipReason,
        recommendedCapacity,
        persons,
        usageProfile,
        isAio: cwuResult?.isAio === true,
        hotWaterPower_kW: toFiniteNumber(cwuResult?.hotWaterPower_kW, null),
        annualCwuEnergy_kWh: toFiniteNumber(
          cwuResult?.annualCwuEnergy_kWh,
          null
        ),
        resolvedOptionId:
          typeof cwuResult?.resolvedOptionId === "string" &&
            cwuResult.resolvedOptionId.trim() !== ""
            ? cwuResult.resolvedOptionId.trim()
            : null,
        resolvedCapacityL: toFiniteNumber(cwuResult?.resolvedCapacityL, null),
        resolvedMaterial:
          typeof cwuResult?.resolvedMaterial === "string" &&
            cwuResult.resolvedMaterial.trim() !== ""
            ? cwuResult.resolvedMaterial.trim()
            : null,
        pricingHint:
          cwuResult?.pricingHint && typeof cwuResult.pricingHint === "object"
            ? { ...cwuResult.pricingHint }
            : null,
        reasonCodes: Array.isArray(cwuResult?.reasonCodes)
          ? cwuResult.reasonCodes.map((code) => String(code))
          : [],
        warnings: Array.isArray(cwuResult?.warnings)
          ? cwuResult.warnings
          : [],
        assumptions: Array.isArray(cwuResult?.assumptions)
          ? cwuResult.assumptions
          : [],
        explanation: {
          short:
            typeof explanationPayload.short === "string" &&
              explanationPayload.short.trim() !== ""
              ? explanationPayload.short.trim()
              : null,
          long:
            typeof explanationPayload.long === "string" &&
              explanationPayload.long.trim() !== ""
              ? explanationPayload.long.trim()
              : null,
        },
      };
    }

    function buildCurrentBackendRequestSignature() {
      const dto = buildConfiguratorCalcRequestDTO();
      return JSON.stringify({
        building: dto?.building || {},
        preferences: dto?.preferences || {},
        contextConfigurator: dto?.context?.configurator || {},
        selections: state?.selections || {},
        selectedPump: resolveSelectedPumpParitySnapshot(),
      });
    }

    function buildHydraulicsBackendRequestSignature() {
      const dto = buildConfiguratorCalcRequestDTO();
      return JSON.stringify({
        building: dto?.building || {},
        hasBuffer: dto?.preferences?.hasBuffer ?? null,
        heating: dto?.preferences?.heating || {},
        hydraulicsInputs: dto?.context?.configurator?.hydraulics_inputs || {},
        selectedPump: resolveSelectedPumpParitySnapshot(),
      });
    }

    function hasFreshBackendOffer() {
      if (!isBackendCalcEnabled()) {
        return false;
      }
      if (!state?.backendOffer || typeof state.backendOffer !== "object") {
        return false;
      }
      if (!lastBackendRequestSignature) {
        return false;
      }
      return buildCurrentBackendRequestSignature() === lastBackendRequestSignature;
    }

    function hasFreshBackendHydraulicsOffer() {
      if (!isBackendCalcEnabled()) {
        return false;
      }
      if (!state?.backendOffer || typeof state.backendOffer !== "object") {
        return false;
      }
      if (!lastBackendHydraulicsSignature) {
        return false;
      }
      return (
        buildHydraulicsBackendRequestSignature() ===
        lastBackendHydraulicsSignature
      );
    }

    function getFreshCanonicalOffer() {
      return hasFreshBackendOffer() ? state.backendOffer : null;
    }

    function getFreshCanonicalHydraulicsOffer() {
      return hasFreshBackendHydraulicsOffer() ? state.backendOffer : null;
    }

    function buildConfiguratorPricingState() {
      const backendEnabled = isBackendCalcEnabled();
      const offerFresh = hasFreshBackendOffer();
      const hydraulicsFresh = hasFreshBackendHydraulicsOffer();

      return {
        mode: backendEnabled ? "backend" : "backend_required",
        hasOffer: !!(state?.backendOffer && typeof state.backendOffer === "object"),
        offerFresh,
        hydraulicsFresh,
        needsReprice: backendEnabled && !offerFresh,
      };
    }

    function dispatchSummaryDataChanged(reason = null) {
      const pricingState = buildConfiguratorPricingState();
      state.configuratorPricingState = pricingState;

      try {
        root.dispatchEvent(
          new CustomEvent("hp:summaryDataChanged", {
            detail: {
              reason,
              pricingState,
              traceId: state?.backendOffer?.traceId || null,
            },
            bubbles: true,
          })
        );
      } catch (_) { }

      return pricingState;
    }

    function getCanonicalPricingSnapshot() {
      const freshOffer = getFreshCanonicalOffer();
      const totals = freshOffer?.pricing?.totals || null;
      const source =
        freshOffer && totals
          ? "backend"
          : isBackendCalcEnabled()
            ? "pending"
            : "backend_required";

      return {
        source,
        total_netto_pln: toFiniteNumber(totals?.net, 0),
        total_brutto_pln: toFiniteNumber(totals?.gross, 0),
        items:
          freshOffer && Array.isArray(state?.pricing?.items) ? state.pricing.items : [],
      };
    }

    function buildCanonicalRecommendationsSnapshot() {
      const freshOffer = getFreshCanonicalOffer();
      const freshHydraulicsOffer = getFreshCanonicalHydraulicsOffer();
      const hydraulicsOffer =
        freshHydraulicsOffer?.engineering?.buffer &&
          typeof freshHydraulicsOffer.engineering.buffer === "object"
          ? freshHydraulicsOffer
          : freshOffer;

      if (
        (freshOffer?.engineering && typeof freshOffer.engineering === "object") ||
        (hydraulicsOffer?.engineering &&
          typeof hydraulicsOffer.engineering === "object")
      ) {
        return {
          source: "backend",
          selection: freshOffer?.engineering?.selection || null,
          cwu: normalizeCwuRecommendationFromOffer(
            freshOffer?.engineering?.cwu || {}
          ),
          buffer: hydraulicsOffer?.engineering?.buffer || null,
          ozc: freshOffer?.engineering?.ozc || null,
          hydraulics: normalizeHydraulicsRecommendationFromOffer(
            hydraulicsOffer?.engineering?.buffer || {}
          ),
        };
      }

      if (isBackendCalcEnabled()) {
        return {
          source: "pending",
          selection: null,
          cwu: null,
          buffer: null,
          ozc: null,
          hydraulics: null,
        };
      }

      return {
        source: "legacy",
        selection: null,
        cwu:
          state?.recommendations?.cwu && typeof state.recommendations.cwu === "object"
            ? state.recommendations.cwu
            : null,
        buffer: null,
        ozc: null,
        hydraulics: state?.recommendations?.hydraulics || null,
      };
    }

    function getCanonicalCwuRules() {
      const freshOffer = getFreshCanonicalOffer();
      if (
        freshOffer?.engineering?.cwu &&
        typeof freshOffer.engineering.cwu === "object"
      ) {
        const backendCwu = normalizeCwuRecommendationFromOffer(
          freshOffer.engineering.cwu
        );
        if (backendCwu) {
          return backendCwu;
        }
      }

      const legacyCwu = rulesEngine.cwu(state);
      return {
        ...legacyCwu,
        source: "legacy",
        reasonCodes: [],
        warnings: [],
        assumptions: [],
        explanation: {
          short: null,
          long: null,
        },
      };
    }

    function getCanonicalHydraulicsRenderSnapshot(evaluated) {
      const completionState = getHydraulicsInputsCompletionState();
      if (completionState.shouldBlockRecommendation) {
        return {
          source: "input_required",
          recommendation: null,
          hydraulicsCompletion: completionState,
        };
      }

      const freshOffer = getFreshCanonicalHydraulicsOffer();
      if (freshOffer?.engineering?.buffer && typeof freshOffer.engineering.buffer === "object") {
        const recommendation = normalizeHydraulicsRecommendationFromOffer(
          freshOffer.engineering.buffer
        );
        return {
          source: "backend",
          recommendation,
          hydraulicsCompletion: completionState,
        };
      }

      const persistedRecommendation =
        state?.recommendations?.hydraulics &&
          typeof state.recommendations.hydraulics === "object"
          ? state.recommendations.hydraulics
          : null;
      if (persistedRecommendation) {
        return {
          source: "backend_persisted",
          recommendation: persistedRecommendation,
          hydraulicsCompletion: completionState,
        };
      }

      if (isBackendCalcEnabled()) {
        return {
          source: "pending",
          recommendation: null,
          hydraulicsCompletion: completionState,
        };
      }

      const recommendation =
        evaluated?.hydraulicsRecommendation ||
        evaluated?.bufferRules?.hydraulicsRecommendation ||
        state?.recommendations?.hydraulics ||
        null;
      return {
        source: recommendation ? "legacy" : "none",
        recommendation: recommendation || null,
        hydraulicsCompletion: completionState,
      };
    }

    function applyOfferToConfiguratorState(offer) {
      if (!offer || typeof offer !== "object") return;

      const totals = offer?.pricing?.totals || {};
      state.backendOffer = offer;
      state.pricing.total_netto_pln = toFiniteNumber(totals?.net, 0);
      state.pricing.total_brutto_pln = toFiniteNumber(totals?.gross, 0);
      state.pricing.items = mapOfferPricingItemsToLegacy(offer?.pricing?.items);
      state.pricing.source_mode = "backend";
      state.pricing.fallback_reason_code = null;
      state.pricing.warnings = [];

      const backendHydraulics = normalizeHydraulicsRecommendationFromOffer(
        offer?.engineering?.buffer || {}
      );
      const backendCwu = normalizeCwuRecommendationFromOffer(
        offer?.engineering?.cwu || {}
      );
      state.recommendations.hydraulics = backendHydraulics;
      state.recommendations.cwu = backendCwu;
      renderCanonicalHydraulicsUi();
      renderCanonicalPumpUi().catch((error) => {
        console.warn("[Configurator] canonical pump UI refresh failed:", error);
      });

      if (runtimeAppState) {
        runtimeAppState.canonicalOffer = offer;
      }
      syncCanonicalOfferState(offer);
      persistCanonicalOfferToConfigData(offer, backendHydraulics);
    }

    async function refreshOfferData(options = {}) {
      if (!state?.meta) {
        return null;
      }

      if (!isBackendCalcEnabled()) {
        throw new Error("Backend calculate-offer must be enabled for configurator offer refresh.");
      }

      if (
        !window.topinstalApi ||
        typeof window.topinstalApi.calculateOffer !== "function"
      ) {
        if (state.backendOffer) {
          updateSummary();
          exposeSelectionOnWindow();
          dispatchSummaryDataChanged("backend_offer_reused_no_api");
          return state.backendOffer;
        }
        throw new Error("topinstalApi.calculateOffer is not available");
      }

      const dto = buildConfiguratorCalcRequestDTO();
      if (typeof setDraftRequest === "function") {
        setDraftRequest(dto);
      } else if (typeof updateAppState === "function") {
        updateAppState({ draftRequest: dto });
      }

      const completionState = getHydraulicsInputsCompletionState();
      if (completionState.shouldBlockRecommendation) {
        updateNavButtons();
        updateSummary();
        exposeSelectionOnWindow();
        saveConfiguratorState();
        dispatchSummaryDataChanged("hydraulics_input_required");
        return null;
      }

      const requestSignature = buildCurrentBackendRequestSignature();
      const hydraulicsRequestSignature = buildHydraulicsBackendRequestSignature();

      if (
        options.force !== true &&
        state.backendOffer &&
        requestSignature === lastBackendRequestSignature
      ) {
        if (!lastBackendHydraulicsSignature) {
          lastBackendHydraulicsSignature = hydraulicsRequestSignature;
        }
        return state.backendOffer;
      }

      const seq = ++backendRefreshSeq;

      try {
        const offer = await window.topinstalApi.calculateOffer(dto, {
          timeoutMs: config?.calculateOfferTimeoutMs || 15000,
          retryCount: 1,
        });

        if (seq !== backendRefreshSeq) {
          return null;
        }

        lastBackendRequestSignature = requestSignature;
        lastBackendHydraulicsSignature = hydraulicsRequestSignature;
        applyOfferToConfiguratorState(offer);
        updateSummary();
        exposeSelectionOnWindow();
        saveConfiguratorState();
        dispatchSummaryDataChanged("backend_offer_applied");
        return offer;
      } catch (error) {
        if (seq !== backendRefreshSeq) {
          return null;
        }

        console.warn("[Configurator] Backend offer refresh failed:", error);

        if (state.backendOffer) {
          updateSummary();
          exposeSelectionOnWindow();
          saveConfiguratorState();
          dispatchSummaryDataChanged("backend_offer_reused_after_error");
          return state.backendOffer;
        }

        if (window.ErrorHandler && typeof window.ErrorHandler.showToast === "function") {
          const backendMessage =
            error?.data?.message ||
            error?.message ||
            "Nie udało się odświeżyć oferty z backendu.";
          window.ErrorHandler.showToast(`⚠ ${backendMessage}`, "warning", 3500);
        }

        throw error;
      }
    }

    function scheduleOfferRefresh(options = {}) {
      if (!isBackendCalcEnabled()) {
        return;
      }

      const delayMs = Number(options?.delayMs);
      const effectiveDelay =
        Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 250;

      if (backendRefreshTimer) {
        clearTimeout(backendRefreshTimer);
      }

      backendRefreshTimer = setTimeout(() => {
        backendRefreshTimer = null;
        refreshOfferData(options).catch((error) => {
          console.warn("[Configurator] scheduled backend refresh failed:", error);
        });
      }, effectiveDelay);
    }

    function extractCapacityFromOptionId(optionId) {
      const match = optionId.match(/(\d+)/);
      return match ? Number(match[1]) : 0;
    }

    /* ==========================================================================
     RULES ENGINE (z configurator.js - peÄąâ€šna wersja)
     ========================================================================== */

    /* ==========================================================================
     HYDRAULICS RECOMMENDATION ENGINE (FLOW / SEPARATOR / STORAGE) Ă˘â‚¬â€ť CANONICAL
     ========================================================================== */

    /**
     * Silnik hydrauliki CO Ă˘â‚¬â€ť SINGLE SOURCE OF TRUTH dla UI/PDF/Email
     *
     * Hydraulics recommendation from backend OfferDTO (PHP BufferEngine).
     * Zachowuje kompatybilność z istniejĂ„â€¦cym kodem (przyjmuje state)
     *
     * Zwraca obiekt zgodny z kontraktem:
     * `config_data.recommendations.hydraulics = hydraulicsRecommendation`
     */
    function computeHydraulicsRecommendation(state) {
      if (isBackendCalcEnabled()) {
        const completionState = getHydraulicsInputsCompletionState();
        if (completionState.shouldBlockRecommendation) {
          const incompleteRecommendation = buildHydraulicsPendingRecommendation({
            reasonCode: "HYDRAULICS_INPUTS_INCOMPLETE",
            short: "Uzupelnij typ drugiego źródła, aby policzyc hydraulike.",
            long: completionState.message,
          });
          if (state) {
            if (!state.recommendations) state.recommendations = {};
            state.recommendations.hydraulics = incompleteRecommendation;
          }
          persistHydraulicsRecommendationToConfigData(incompleteRecommendation);
          return incompleteRecommendation;
        }

        if (
          state?.backendOffer?.engineering?.buffer &&
          typeof state.backendOffer.engineering.buffer === "object" &&
          hasFreshBackendHydraulicsOffer()
        ) {
          const backendRecommendation = normalizeHydraulicsRecommendationFromOffer(
            state.backendOffer.engineering.buffer
          );
          if (state) {
            if (!state.recommendations) state.recommendations = {};
            state.recommendations.hydraulics = backendRecommendation;
          }
          persistHydraulicsRecommendationToConfigData(backendRecommendation);
          return backendRecommendation;
        }

        const pendingRecommendation = buildHydraulicsPendingRecommendation();
        if (state) {
          if (!state.recommendations) state.recommendations = {};
          state.recommendations.hydraulics = pendingRecommendation;
        }
        return pendingRecommendation;
      }

      const backendRequired = buildHydraulicsPendingRecommendation({
        reasonCode: "BACKEND_CALC_REQUIRED",
        short: "Hydraulika wymaga backendowego calculate-offer.",
        long: "Lokalny silnik bufora w przeglądarce został wyłączony. Włącz useBackendCalc i odśwież ofertę z PHP BufferEngine.",
      });
      if (state) {
        if (!state.recommendations) state.recommendations = {};
        state.recommendations.hydraulics = backendRequired;
      }
      persistHydraulicsRecommendationToConfigData(backendRequired);
      return backendRequired;
    }

    function normalizeHeatingType(raw) {
      if (!raw) return "radiators";
      if (raw === "surface") return "underfloor";
      return raw;
    }

    const HYDRAULICS_REASON_CODES = {
      FLOW_RISK_UNDERFLOOR_ACTUATORS: "FLOW_RISK_UNDERFLOOR_ACTUATORS",
      MIXED_CIRCUITS_SEPARATION: "MIXED_CIRCUITS_SEPARATION",
      LOW_LOAD_HT_RADIATORS_KILLER: "LOW_LOAD_HT_RADIATORS_KILLER",
      BIVALENT_SOLID_FUEL: "BIVALENT_SOLID_FUEL",
      BIVALENT_FIREPLACE_WATER_JACKET: "BIVALENT_FIREPLACE_WATER_JACKET",
      ANTI_CYCLING_STORAGE_REQUIRED: "ANTI_CYCLING_STORAGE_REQUIRED",
      MANUFACTURER_3PH_K_200L: "MANUFACTURER_3PH_K_200L",
    };

    const rulesEngine = {
      // CWU Ă˘â‚¬â€ś decyzja o wÄąâ€šĂ„â€¦czeniu + zalecana pojemność
      cwu(state) {
        const includeHot = !!state.meta?.include_hot_water;
        const persons = Number(
          state.meta?.hot_water_persons || state.meta?.cwu_people || 0
        );
        const profile =
          state.meta?.hot_water_usage || state.meta?.cwu_profile || null;
        const isAIO =
          state.selectedPump?.type === "aio" ||
          state.selectedPump?.type === "all-in-one" ||
          state.selectedPump?.optionId?.includes("aio");

        // Ă˘Ĺ›â€¦ NOWA LOGIKA: skip jeÄąâ€şli nie chce CWU lub AIO
        const skip = !includeHot || persons === 0 || isAIO;
        const enabled = includeHot && !isAIO && persons > 0;
        const required = includeHot && !isAIO && persons > 0;

        // OkreÄąâ€şl powÄ‚Ĺ‚d pominięcia (dla sticky bar i wynikÄ‚Ĺ‚w)
        let skipReason = null;
        if (skip) {
          if (!includeHot || persons === 0) {
            skipReason = "Nie dotyczy";
          } else if (isAIO) {
            skipReason =
              resolveIntegratedCwuLabel(state.selectedPump, pumpMatchingTable) ||
              "Zintegrowany zbiornik CWU (w zestawie)";
          }
        }

        let recommendedCapacity = null;

        if (enabled) {
          // Ă˘ĹˇÂ ÄŹÂ¸Ĺą FIX P1.3: Sanity check dla persons (walidacja zakresu)
          const validPersons =
            Number.isFinite(persons) && persons > 0 && persons < 20
              ? Math.round(persons)
              : 0;
          // Ă˘Ĺ›â€¦ FIX: Walidacja profile - użyj domyÄąâ€şlnego jeÄąâ€şli null
          const validProfile = profile || "shower_bath";

          // PHASE 3C Ă˘â‚¬â€ť Load from rules JSON (Data-Driven Configuration)
          const rules = getBufferRules();
          const cwuRules = rules?.cwuRules || {
            baseCapacity: { 1: 150, 2: 150, 3: 200, 4: 200, "5+": 300 },
            usageAdjustments: { shower: 0, shower_bath: 50, bath: 100 },
            materialAdjustments: { inox: 50, emalia: 100 },
            safetyRule: { usage: "bath", persons_min: 2, minimumCapacity: 200 },
            availableCapacities: [150, 200, 250, 300, 400, 500],
          };

          if (validPersons > 0) {
            const baseCapacityMap = cwuRules.baseCapacity || {};
            if (validPersons <= 2)
              recommendedCapacity = baseCapacityMap["2"] || 150;
            else if (validPersons <= 4)
              recommendedCapacity = baseCapacityMap["4"] || 200;
            else if (validPersons <= 6)
              recommendedCapacity = baseCapacityMap["5+"] || 250;
            else recommendedCapacity = baseCapacityMap["5+"] || 300;
          } else {
            // Ă˘Ĺ›â€¦ FIX: Fallback jeÄąâ€şli persons jest niepoprawne
            recommendedCapacity = 200; // DomyÄąâ€şlna wartość
          }

          const usageAdjustments = cwuRules.usageAdjustments || {
            shower: 0,
            shower_bath: 50,
            bath: 100,
          };
          let extra = 0;
          if (validProfile === "shower_bath") {
            extra = usageAdjustments.shower_bath || 50;
          } else if (validProfile === "bath") {
            extra = usageAdjustments.bath || 100;
          }

          if (recommendedCapacity) {
            recommendedCapacity += extra;
            const allowed = cwuRules.availableCapacities || [
              150, 200, 250, 300, 400, 500,
            ];
            recommendedCapacity = allowed.reduce((best, candidate) => {
              if (best === null) return candidate;
              return Math.abs(candidate - recommendedCapacity) <
                Math.abs(best - recommendedCapacity)
                ? candidate
                : best;
            }, null);
          }

          // Ă˘Ĺ›â€¦ FIX: Upewnij się ÄąÄ˝e recommendedCapacity nie jest null po wszystkich obliczeniach
          if (!recommendedCapacity) {
            recommendedCapacity = 200; // Fallback bezpieczeÄąâ€žstwa
          }

          // Safety rule: bath + persons >= 2 Ă˘â€ â€™ minimum 200 L
          const safetyRule = cwuRules.safetyRule || {
            usage: "bath",
            persons_min: 2,
            minimumCapacity: 200,
          };
          if (
            validProfile === safetyRule.usage &&
            validPersons >= safetyRule.persons_min
          ) {
            if (
              !recommendedCapacity ||
              recommendedCapacity < safetyRule.minimumCapacity
            ) {
              recommendedCapacity = safetyRule.minimumCapacity;
            }
          }
        }

        return {
          enabled,
          required,
          recommendedCapacity,
          skip, // Ă˘Ĺ›â€¦ NOWA FLAGA
          skipReason, // Ă˘Ĺ›â€¦ NOWA FLAGA
        };
      },

      // BUFOR CO Ă˘â‚¬â€ś wymagany / zakres (rozszerzona logika)
      buffer(state) {
        // Ă˘Ĺ›â€¦ SINGLE SOURCE OF TRUTH (Wycena2025):
        // Zamiast liczyĂ„â€ˇ "bufor" heurystykami w UI, wyliczamy kanoniczny obiekt hydrauliki
        // i mapujemy go do legacy API tego kroku.
        const hr = computeHydraulicsRecommendation(state);

        const pumpOptionIdLegacy = state?.selectedPump?.optionId || null;
        const pumpDataLegacy = pumpOptionIdLegacy
          ? pumpMatchingTable[pumpOptionIdLegacy]
          : null;
        const pumpPowerLegacy = Number(
          pumpDataLegacy?.power || state?.selectedPump?.power_kw || 0
        );
        // PHASE 3C Ă˘â‚¬â€ť Load from rules JSON
        const rules = getBufferRules();
        const separatorThresholds = rules?.separatorSizeClasses?.thresholds || {
          small: 7,
          medium: 15,
        };
        const separatorSizeClass =
          pumpPowerLegacy < separatorThresholds.small
            ? "small"
            : pumpPowerLegacy < separatorThresholds.medium
              ? "medium"
              : "large";

        // NOWY: Mapowanie do 3 typÄ‚Ĺ‚w (NONE, BUFOR_SZEREGOWO, BUFOR_RÓWNOLEGLE)
        let type = "none";
        let liters = null;
        let hydraulicSeparationRequired = false;

        if (hr.recommendation === "BUFOR_SZEREGOWO") {
          type = "storage"; // Bufor szeregowo z by-passem
          liters = hr.buffer_liters;
          hydraulicSeparationRequired = false;
        } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
          type = "both"; // Bufor rÄ‚Ĺ‚wnolegle jako sprzęgło hydrauliczne
          liters = hr.buffer_liters;
          hydraulicSeparationRequired = true; // SprzęgÄąâ€šo = separacja hydrauliczna
        } else {
          // NONE
          type = "none";
          liters = null;
          hydraulicSeparationRequired = false;
        }

        return {
          type,
          required: hr.severity === "MANDATORY",
          allowZeroBuffer: hr.recommendation === "NONE",
          liters,
          recommendedCapacity: hr.buffer_liters || 0, // legacy convenience
          separatorSize:
            hr.recommendation === "BUFOR_RÓWNOLEGLE"
              ? separatorSizeClass
              : null,
          hydraulicSeparationRequired,
          dominantReason: hr.explanation?.short || "",
          reasons: hr.reason_codes || [],
          constraints: [],
          hydraulicsRecommendation: hr, // passthrough
        };
      },

      // CYRKULACJA CWU
      circulation(state) {
        const includeHot = !!state.meta?.include_hot_water;
        const persons = Number(
          state.meta?.hot_water_persons || state.meta?.cwu_people || 0
        );
        const hotWaterUsage =
          state.meta?.hot_water_usage || state.meta?.cwu_profile || null;
        return {
          enabled: includeHot,
          recommended: persons >= 4 || hotWaterUsage === "comfort",
        };
      },

      // SERVICE CLOUD — dostępny dla konfiguracji z wybraną pompą (bez blokady serii).
      serviceCloud(state) {
        return {
          enabled: true,
          aiDiagnosticsEnabled: true,
        };
      },

      // FILTRY / ZABEZPIECZENIA HYDRAULICZNE
      hydraulics(state) {
        const year = Number(
          state.meta?.building_year || state.meta?.construction_year || 2020
        );
        const modernized = !!state.meta?.heat_source_prev;
        const autoSelectMagnet = modernized || year < 1990;
        const requireFlush = modernized || year < 2005;
        const recommendFlush = !requireFlush && year >= 2005 && year < 2015;
        return {
          autoSelectMagnet,
          requireFlush,
          recommendFlush,
        };
      },

      // POSADOWIENIE JEDNOSTKI ZEWNĂ„ÂTRZNEJ
      mounting(selectedPump, state) {
        const buildingType = state.meta?.building_type || "single_house";
        const weight = Number(selectedPump?.weight || 70);
        const allowedWall = true;
        const warnWall = buildingType === "apartment" || weight > 65;
        return {
          allowedWall,
          warnWall,
        };
      },

      // UZDATNIANIE WODY
      water(state) {
        return { recommendSoftener: true };
      },

      // PODSUMOWANIE KOMPLETNOÄąĹˇCI MASZYNOWNI
      summary(state, derived) {
        const missing = [];
        if (!state.selections.pompa) missing.push("Pompa");
        if (derived.cwuRules.required && !state.selections.cwu) {
          missing.push("Zasobnik CWU");
        }
        if (derived.bufferRules.required && !state.selections.bufor) {
          missing.push("Bufor CO");
        }
        return {
          complete: missing.length === 0,
          missing,
        };
      },
    };

    // UICallbacks - operacje na DOM
    const UICallbacks = {
      setSectionEnabled(sectionKey, isEnabled) {
        const step = dom.qs(`[data-step-key="${sectionKey}"]`);
        if (!step) return;
        step.classList.toggle("section-disabled", !isEnabled);
        step.querySelectorAll(".option-card, .product-card").forEach((card) => {
          card.classList.toggle("disabled", !isEnabled);
          card.setAttribute("aria-disabled", !isEnabled ? "true" : "false");
          if (isEnabled) {
            card.removeAttribute("data-disabled-reason");
            card.title = "";
          }
        });
        if (!isEnabled) {
          markStepAsNotApplicable(sectionKey);
        } else if (state.selections[sectionKey]?.system) {
          clearSelectionState(sectionKey);
        }
      },

      setSectionRequired(sectionKey, isRequired) {
        const step = dom.qs(`[data-step-key="${sectionKey}"]`);
        if (!step) return;
        step.classList.toggle("section-required", !!isRequired);
      },

      markRecommended(sectionKey, recommendedValue) {
        if (!recommendedValue) return;
        const step = dom.qs(`[data-step-key="${sectionKey}"]`);
        if (!step) return;
        step.querySelectorAll(".option-card").forEach((card) => {
          const optionId = card.getAttribute("data-option-id") || "";
          const capacity = extractCapacityFromOptionId(optionId);
          card.classList.toggle(
            "recommended",
            capacity === Number(recommendedValue)
          );
        });
      },

      autoSelect(optionKey) {
        const card = dom.qs(`[data-option-id="${optionKey}"]`);
        if (!card || card.classList.contains("disabled")) return;
        const stepSection = card.closest(".config-step");
        const stepKey = stepSection?.dataset?.stepKey || null;
        const currentOptionId = stepKey
          ? state.selections?.[stepKey]?.optionId || null
          : null;
        if (card.classList.contains("selected") && currentOptionId === optionKey) {
          return;
        }
        captureSelectionForCard(card);
      },

      forceSelect(optionKey) {
        const card = dom.qs(`[data-option-id="${optionKey}"]`);
        if (!card) return;
        card.classList.add("selected", "forced");
        captureSelectionForCard(card);
      },

      warnOnOption(optionKey, condition) {
        const card = dom.qs(`[data-option-id="${optionKey}"]`);
        if (!card) return;
        card.classList.toggle("warn", !!condition);
      },

      setOptionDisabled(optionKey, isDisabled, reason = "") {
        const card = dom.qs(`[data-option-id="${optionKey}"]`);
        if (!card) return;

        card.classList.toggle("disabled", !!isDisabled);
        card.setAttribute("aria-disabled", isDisabled ? "true" : "false");
        card.title = isDisabled && reason ? String(reason) : "";
        card.setAttribute(
          "data-disabled-reason",
          isDisabled && reason ? String(reason) : ""
        );

        if (!isDisabled) {
          return;
        }

        const stepSection = card.closest(".config-step");
        const stepKey = stepSection?.dataset?.stepKey || null;
        if (!stepKey) {
          return;
        }

        if (state.selections?.[stepKey]?.optionId === optionKey) {
          clearSelectionState(stepKey);
          updateNavButtons();
        }
      },
    };

    function evaluateRules() {
      if (!state.meta) return null;

      const cwuRules = getCanonicalCwuRules();
      const bufferRules = rulesEngine.buffer(state);
      // Ă˘Ĺ›â€¦ FIX: UÄąÄ˝yj tylko Äąâ€şwieÄąÄ˝o obliczonego hydraulicsRecommendation z bufferRules
      // Usunięto fallback do state.recommendations?.hydraulics (moÄąÄ˝e byĂ„â€ˇ stary cache)
      const hydraulicsRecommendation =
        bufferRules?.hydraulicsRecommendation || null;

      // Ă˘Ĺ›â€¦ Dodaj separatorSize do hydraulicsRecommendation jeÄąâ€şli jest dostępne
      // separatorSize powinno byĂ„â€ˇ juÄąÄ˝ w hydraulicsRecommendation z BufferEngine,
      // ale na wszelki wypadek sprawdÄąĹźmy bufferRules jako fallback
      if (
        hydraulicsRecommendation &&
        !hydraulicsRecommendation.separatorSize &&
        bufferRules?.separatorSize
      ) {
        hydraulicsRecommendation.separatorSize = bufferRules.separatorSize;
      }
      const circulationRules = rulesEngine.circulation(state);
      const scRules = rulesEngine.serviceCloud(state);
      const hydraulicsRules = rulesEngine.hydraulics(state);
      const mountingRules = rulesEngine.mounting(state.selectedPump, state);
      const waterRules = rulesEngine.water(state);
      const summary = rulesEngine.summary(state, {
        cwuRules,
        bufferRules,
        hydraulicsRules,
      });

      return {
        cwuRules,
        bufferRules,
        hydraulicsRecommendation,
        circulationRules,
        scRules,
        hydraulicsRules,
        mountingRules,
        waterRules,
        summary,
      };
    }

    function applyRulesToUI(evaluated) {
      if (!evaluated) return;

      // CWU
      if (evaluated.cwuRules.skip) {
        hideStepAsNotApplicable(
          "cwu",
          evaluated.cwuRules.skipReason || getNotApplicableLabel("cwu")
        );
      } else {
        restoreStepFromNotApplicable("cwu");
        UICallbacks.setSectionEnabled("cwu", evaluated.cwuRules.enabled);
        if (evaluated.cwuRules.recommendedCapacity) {
          UICallbacks.markRecommended(
            "cwu",
            evaluated.cwuRules.recommendedCapacity
          );
        }
      }

      // Bufor
      UICallbacks.setSectionRequired("bufor", evaluated.bufferRules.required);

      // Cyrkulacja
      if (!evaluated.circulationRules.enabled) {
        hideStepAsNotApplicable("cyrkulacja", getNotApplicableLabel("cyrkulacja"));
      } else {
        restoreStepFromNotApplicable("cyrkulacja");
        UICallbacks.setSectionEnabled("cyrkulacja", true);
      }

      // Service Cloud
      if (!evaluated.scRules.enabled) {
        hideStepAsNotApplicable("service", getNotApplicableLabel("service"));
      } else {
        restoreStepFromNotApplicable("service");
        UICallbacks.setSectionEnabled("service", true);
      }

      // Filtr magnetyczny pozostaje rodziną backend-only / poza retail UI.

      // Posadowienie - warning dla Äąâ€şciany
      UICallbacks.setSectionEnabled("posadowienie", true);
      UICallbacks.warnOnOption(
        "posadowienie-sciana",
        evaluated.mountingRules.warnWall
      );
      UICallbacks.setOptionDisabled(
        "posadowienie-sciana",
        false,
        "Montaż ścienny niedostępny dla tej masy lub typu budynku."
      );

      // Uzdatnianie - rekomenduj (TYLKO jeÄąâ€şli uÄąÄ˝ytkownik jeszcze nie wybraÄąâ€š)
      if (evaluated.waterRules.recommendSoftener) {
        const existingWaterSelection = state.selections.woda;
        if (!existingWaterSelection || !existingWaterSelection.optionId) {
          UICallbacks.autoSelect("woda-tak");
        }
      }

      ensureCurrentStepIsActive();
    }

    // Funkcja recompute do przeliczania reguł (z configurator.js)
    // Ă˘ĹˇÂ ÄŹÂ¸Ĺą FIX P1.2: recompute() musi byĂ„â€ˇ natychmiastowe (deterministyczne) dla PDF/getSelection
    function recompute() {
      maybeRefreshPricesData();
      maybeRefreshPresentationData();
      state.selections = sanitizeSelectionsForSupportedProductSurface(
        state.selections
      );
      if (runtimeAppState) {
        runtimeAppState.configuratorState = state;
        runtimeAppState.configuratorSelections =
          sanitizeSelectionsForSupportedProductSurface(state.selections);
      }
      const evaluated = evaluateRules();
      applyRulesToUI(evaluated);
      const backendCalcEnabled = isBackendCalcEnabled();
      renderCanonicalHydraulicsUi(evaluated);

      updateNavButtons();
      updateSummary();
      exposeSelectionOnWindow();
      dispatchSummaryDataChanged("configurator_recompute");
      sanitizeConfiguratorDom(root);
      scheduleOfferRefresh({ delayMs: 250 });
    }

    let hydraulicsPreviewDebounceId = null;

    // Ă˘ĹˇÂ ÄŹÂ¸Ĺą FIX P1.2: Debounce wrapper dla eventÄ‚Ĺ‚w UI (aby uniknĂ„â€¦Ă„â€ˇ wielokrotnych obliczeÄąâ€ž przy szybkich zmianach)
    let requestRecomputeTimeout = null;
    function requestRecompute() {
      if (requestRecomputeTimeout) {
        clearTimeout(requestRecomputeTimeout);
      }
      requestRecomputeTimeout = setTimeout(() => {
        recompute();
        requestRecomputeTimeout = null;
      }, 100); // 100ms debounce dla UI events
    }

    function buildSelectionPayload() {
      const selections = sanitizeSelectionsForSupportedProductSurface(
        state.selections
      );
      const products = {
        pump: state.selectedPump ? { ...state.selectedPump } : null,
        cwu: state.selectedCwuProduct
          ? { ...state.selectedCwuProduct }
          : selections.cwu
            ? { ...selections.cwu }
            : null,
        buffer: state.selectedBufferProduct
          ? { ...state.selectedBufferProduct }
          : selections.bufor
            ? { ...selections.bufor }
            : null,
      };
      const pricingSnapshot = getCanonicalPricingSnapshot();
      const recommendationsSnapshot = buildCanonicalRecommendationsSnapshot();

      return {
        meta: state.meta ? { ...state.meta } : null,
        selections,
        recommendations: recommendationsSnapshot,
        offer: state.backendOffer || null,
        products,
        pricing: {
          total_netto_pln: pricingSnapshot.total_netto_pln,
          total_brutto_pln: pricingSnapshot.total_brutto_pln,
          items: Array.isArray(pricingSnapshot.items)
            ? pricingSnapshot.items.map((item) => ({ ...item }))
            : [],
        },
      };
    }

    if (runtimeAppState) {
      runtimeAppState.configuratorRecompute = recompute;
      runtimeAppState.configuratorApi = {
        recompute,
        refreshOffer: () => refreshOfferData({ force: true }),
        evaluateRules,
        selectOption,
        selectOptionById,
        selectBufferCapacity,
        selectRecommended,
        loadFromCanonicalState: (input) =>
          runtimeAppState.configurator?.loadFromCanonicalState
            ? runtimeAppState.configurator.loadFromCanonicalState(input)
            : false,
        getState: () => state,
        getSelection: () =>
          lastSelectionPayload ||
          runtimeAppState.configuratorSelection ||
          buildSelectionPayload(),
      };
    }

    /* ==========================================================================
     DATA EXPORT (z configurator.js)
     ========================================================================== */

    function exposeSelectionOnWindow() {
      const payload = buildSelectionPayload();
      const pricingState = buildConfiguratorPricingState();

      lastSelectionPayload = payload;
      state.configuratorPricingState = pricingState;

      if (runtimeAppState) {
        runtimeAppState.canonicalOffer = state.backendOffer || null;
        runtimeAppState.configuratorSelection = payload;
        runtimeAppState.configuratorSelections = payload.selections;
        runtimeAppState.configuratorState = state;
        runtimeAppState.configuratorPricingState = pricingState;
      }

      if (
        typeof getAppState === "function" &&
        typeof updateAppState === "function"
      ) {
        const updates = {
          canonicalOffer: state.backendOffer || null,
          configuratorSelection: payload,
          configuratorSelections: payload.selections,
          configuratorState: state,
          configuratorPricingState: pricingState,
        };
        updateAppState(updates);
      }
    }

    /* ==========================================================================
     HELPER FUNCTIONS (z configurator.js)
     ========================================================================== */

    function getSummaryIcon(key) {
      const icons = {
        meta: "ri-bar-chart-fill",
        pump_variant: "ri-settings-5-fill",
        pompa: "ri-settings-5-fill",
        cwu: "ri-showers-fill",
        buffer: "ri-drop-fill",
        bufor: "ri-drop-fill",
        circulation: "ri-refresh-fill",
        cyrkulacja: "ri-refresh-fill",
        service_cloud: "ri-cloud-fill",
        service: "ri-cloud-fill",
        foundation: "ri-building-fill",
        posadowienie: "ri-building-fill",
        reducer: "ri-scale-fill",
        reduktor: "ri-scale-fill",
        softener: "ri-drop-fill",
        woda: "ri-drop-fill",
      };
      return icons[key] || "ri-check-fill";
    }

    function getSummaryKeyFromLabel(label) {
      const map = {
        Pompa: "pompa",
        "Zasobnik CWU": "cwu",
        "Bufor CO": "bufor",
        "Cyrkulacja CWU": "cyrkulacja",
        "Service Cloud": "service",
        "Posadowienie jednostki zewnętrznej": "posadowienie",
        "Reduktor ciśnienia": "reduktor",
        "Stacja uzdatniania wody": "woda",
      };
      return map[label] || "";
    }

    // Formatowanie mocy w kW
    function formatPower(v) {
      if (!v || v === 0) return "—";
      return `${v.toFixed(1)} kW`;
    }

    // RozwiĂ„â€¦zuje produkt CWU na podstawie typu i pojemnoÄąâ€şci (z configurator.js)
    function resolveCwuProduct(cwuData, typeId, capacity) {
      if (
        !cwuData ||
        !typeId ||
        capacity === null ||
        typeof capacity === "undefined"
      ) {
        return null;
      }
      // Nowa struktura: types[].products[]
      if (cwuData.types) {
        const type = cwuData.types.find((t) => t.id === typeId);
        if (type && type.products) {
          const product = type.products.find(
            (p) => p.capacity === Number(capacity)
          );
          if (product)
            return {
              ...product,
              typeId,
              capacity_l: product.capacity_l ?? Number(capacity),
            };
        }
      }
      // Stara struktura: catalog[typeId][capacity]
      if (cwuData.catalog) {
        const typeCatalog = cwuData.catalog[typeId];
        if (typeCatalog) {
          const key = String(capacity);
          const product = typeCatalog[key];
          if (product) {
            return {
              ...product,
              typeId,
              capacity_l: product.capacity_l ?? Number(capacity),
            };
          }
        }
      }
      return null;
    }

    // RozwiĂ„â€¦zuje produkt bufora na podstawie pojemnoÄąâ€şci (z configurator.js)
    function resolveBufferProduct(bufferData, capacity) {
      if (!bufferData || capacity === null || typeof capacity === "undefined") {
        return null;
      }
      // Nowa struktura: products[]
      if (bufferData.products) {
        const product = bufferData.products.find(
          (p) => p.capacity === Number(capacity)
        );
        if (product)
          return {
            ...product,
            capacity_l: product.capacity_l ?? Number(capacity),
          };
      }
      // Stara struktura: catalog[capacity]
      if (bufferData.catalog) {
        const key = String(capacity);
        const product = bufferData.catalog[key];
        if (product) {
          return {
            ...product,
            capacity_l: product.capacity_l ?? Number(capacity),
          };
        }
      }
      return null;
    }

    // PeÄąâ€šna funkcja budujĂ„â€¦ca wiersze podsumowania (z configurator.js)
    function buildSummaryRows(state) {
      const rows = [];
      if (!state || !state.selections || !state.data || !state.meta)
        return rows;

      const data = state.data;
      const meta = state.meta;
      const selections = sanitizeSelectionsForSupportedProductSurface(
        state.selections
      );

      // Pompa Ă˘â‚¬â€ś wariant
      if (selections.pompa && selections.pompa.label) {
        rows.push({
          key: "pump_variant",
          label: "Pompa ciepła",
          value: selections.pompa.label,
          badge: "",
        });
      } else if (state.selectedPump && state.selectedPump.label) {
        rows.push({
          key: "pump_variant",
          label: "Pompa ciepła",
          value: state.selectedPump.label,
          badge: "",
        });
      }

      // CWU - nowa struktura (typ + pojemność)
      let cwuValue = "Nie wybrano";
      // Ă˘Ĺ›â€¦ NOWA LOGIKA: SprawdÄąĹź czy CWU jest pominięte (skip)
      const evaluated = evaluateRules();
      if (evaluated?.cwuRules?.skip) {
        cwuValue =
          resolveIntegratedCwuLabel(state.selectedPump, pumpMatchingTable) ||
          evaluated.cwuRules.skipReason ||
          "Nie dotyczy";
      } else if (selections.cwu) {
        // Unified uÄąÄ˝ywa obiektu z optionId i label
        if (selections.cwu.label) {
          cwuValue = selections.cwu.label;
        } else if (typeof selections.cwu === "string") {
          // Fallback dla starej struktury stringowej
          const cwuData = data.cwuOptions;
          if (cwuData && !cwuData.disabled) {
            const parts = selections.cwu.split("-");
            if (parts.length >= 3) {
              const typeId = parts.slice(0, 2).join("-");
              const capacity = parts[2];
              const type = cwuData.types?.find((t) => t.id === typeId);
              const product = resolveCwuProduct(cwuData, typeId, capacity);
              if (product && product.label) {
                cwuValue = product.label;
              } else if (type) {
                cwuValue = `${type.title} ${capacity} l`;
              } else {
                cwuValue = `Zasobnik ${capacity} l`;
              }
            }
          } else if (cwuData && cwuData.disabled) {
            cwuValue = "Wyłączone (pompa AIO)";
          }
        }
      }
      rows.push({
        key: "cwu",
        label: "Zasobnik CWU",
        value: cwuValue,
        badge: "",
      });

      // Bufor
      let bufferValue = "Nie wybrano";
      if (selections.bufor) {
        if (selections.bufor.label) {
          bufferValue = selections.bufor.label;
        } else if (typeof selections.bufor === "string") {
          const capacityMatch = selections.bufor.match(/buffer-(\d+)/);
          const capacity = capacityMatch ? Number(capacityMatch[1]) : null;
          if (capacity && data.bufferConfig) {
            const product = resolveBufferProduct(data.bufferConfig, capacity);
            if (product?.label) {
              bufferValue = product.label;
            } else {
              bufferValue = `Bufor ${capacity} l`;
            }
          }
        }
      }
      rows.push({
        key: "buffer",
        label: "Bufor / sprzęgło",
        value: bufferValue,
        badge: "",
      });

      // Cyrkulacja
      const cyrOpt = data.circulationOptions?.find(
        (o) =>
          o.id === selections.cyrkulacja?.optionId ||
          selections.cyrkulacja === o.id
      );
      rows.push({
        key: "circulation",
        label: "Cyrkulacja CWU",
        value: cyrOpt
          ? cyrOpt.label
          : selections.cyrkulacja?.label || "Nie wybrano",
        badge: "",
      });

      // Service Cloud
      const serviceSelection = selections.service || selections.service_cloud || null;
      const serviceOptionId = readSelectionOptionId(serviceSelection);
      const svcOpt = data.serviceCloudOptions?.find(
        (o) =>
          o.id === serviceOptionId || serviceSelection === o.id
      );
      const serviceLabel =
        (svcOpt && typeof svcOpt.label === "string" && svcOpt.label.trim()) ||
        (serviceSelection &&
          typeof serviceSelection.label === "string" &&
          serviceSelection.label.trim()
          ? serviceSelection.label.trim()
          : null) ||
        (serviceOptionId === "service-cloud" || serviceSelection === "service-cloud"
          ? "Service Cloud"
          : "Nie wybrano");
      rows.push({
        key: "service_cloud",
        label: "Service Cloud",
        value: serviceLabel,
        badge: "",
      });

      // Posadowienie
      const fundOpt = data.foundationOptions?.find(
        (o) =>
          o.id === selections.posadowienie?.optionId ||
          selections.posadowienie === o.id
      );
      rows.push({
        key: "foundation",
        label: "Posadowienie jednostki zewnętrznej",
        value: fundOpt
          ? fundOpt.label
          : selections.posadowienie?.label || "Nie wybrano",
        badge: "",
      });

      // Reduktor ciśnienia
      const redOpt = data.reducerOptions?.find(
        (o) =>
          o.id === selections.reduktor?.optionId || selections.reduktor === o.id
      );
      rows.push({
        key: "reducer",
        label: "Reduktor ciśnienia",
        value: redOpt
          ? redOpt.label
          : selections.reduktor?.label || "Nie wybrano",
        badge: "",
      });

      // Stacja uzdatniania
      const softOpt = data.softenerOptions?.find(
        (o) => o.id === selections.woda?.optionId || selections.woda === o.id
      );
      rows.push({
        key: "softener",
        label: "Stacja uzdatniania wody",
        value: softOpt
          ? softOpt.label
          : selections.woda?.label || "Nie wybrano",
        badge: "",
      });

      // Dane meta Ă˘â‚¬â€ś powierzchnia / moc
      if (meta.heated_area || meta.power_total_kw) {
        rows.unshift({
          key: "meta",
          label: "Profil budynku",
          value: [
            meta.heated_area
              ? `${meta.heated_area.toFixed
                ? meta.heated_area.toFixed(0)
                : meta.heated_area
              } m²`
              : null,
            meta.power_total_kw
              ? `${meta.power_total_kw.toFixed
                ? meta.power_total_kw.toFixed(1)
                : meta.power_total_kw
              } kW`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
          badge: "",
        });
      }

      return rows.filter((row) => !!row && typeof row === "object");
    }

    // Auto-wybÄ‚Ĺ‚r poczĂ„â€¦tkowy (z configurator.js)
    function applyInitialAutoSelection(state, selectCardProgrammatically) {
      if (!state || !state.data || !state.meta) return;
      const { meta, data, selections } = state;
      const initialCwuRules = getCanonicalCwuRules();

      // Service Cloud: bez auto-wyboru przy starcie (użytkownik wybiera na kroku Service Cloud).

      // Zasobnik CWU - ustaw rekomendowana pojemnosc + typ domyslny
      if (
        initialCwuRules?.enabled &&
        !initialCwuRules?.skip &&
        (!selections.cwu || !selections.cwu.optionId)
      ) {
        const cwuData = data.cwuOptions;
        if (cwuData && !cwuData.disabled) {
          const defaultTypeId =
            cwuData.defaultTypeId || cwuData.types?.[0]?.id || "cwu-emalia";
          const defaultCapacity =
            cwuData.recommendedCapacity ||
            (Array.isArray(cwuData.capacities) ? cwuData.capacities[0] : null);
          if (
            defaultTypeId &&
            defaultCapacity &&
            typeof selectCardProgrammatically === "function"
          ) {
            selectCardProgrammatically(
              "cwu",
              `${defaultTypeId}-${defaultCapacity}`
            );
          }
        }
      }

      // Bufor CO Ă˘â‚¬â€ś prosty dobÄ‚Ĺ‚r wg typu instalacji
      if (!selections.bufor || !selections.bufor.optionId) {
        const bufferData = data.bufferConfig;
        if (bufferData && typeof selectCardProgrammatically === "function") {
          const initialCapacity =
            bufferData.recommendedCapacity || bufferData.capacities?.[0];
          if (initialCapacity) {
            selectCardProgrammatically("bufor", `buffer-${initialCapacity}`);
          }
        }
      }
    }

    /* ==========================================================================
     NAVIGATION & UI HELPERS (z configurator-new.js)
     ========================================================================== */

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    /* ==========================================================================
     STICKY SELECTIONS BAR - Aktualizacja wybranych komponentÄ‚Ĺ‚w
     ========================================================================== */

    function updateSelectionsBar(stepKey, displayLabel, options = {}) {
      const dataType = selectionBarTypeMapping[stepKey];
      if (!dataType) return;

      const selectionItem = root.querySelector(`.selection-item[data-type="${dataType}"]`);
      if (!selectionItem) return;

      if (dataType === "service" && !state.configuratorUi?.serviceStickyRevealed) {
        selectionItem.hidden = true;
        return;
      }
      if (dataType === "service") {
        selectionItem.hidden = false;
      }

      const valueEl = selectionItem.querySelector(".selection-value");
      if (!valueEl) return;
      const animate = options.animate !== false;
      const currentValue = valueEl.textContent.trim();
      const wasEmpty =
        valueEl.hasAttribute("data-empty") ||
        currentValue === "" ||
        currentValue === "—" ||
        currentValue === "-";

      // SkrÄ‚Ĺ‚Ă„â€ˇ zbyt dÄąâ€šugie nazwy (max 30 znakÄ‚Ĺ‚w)
      let shortLabel = displayLabel || "—";
      if (shortLabel.length > 30) {
        shortLabel = shortLabel.substring(0, 27) + "...";
      }

      valueEl.textContent = shortLabel;
      valueEl.removeAttribute("data-empty");

      if (animate && wasEmpty && motion && typeof motion.animateAttach === "function") {
        motion.animateAttach(selectionItem);
      }
    }

    function resetSelectionsBar(stepKey, placeholder = "-") {
      const dataType = selectionBarTypeMapping[stepKey];
      if (!dataType) return;

      const selectionItem = root.querySelector(`.selection-item[data-type="${dataType}"]`);
      if (!selectionItem) return;

      if (dataType === "service" && !state.configuratorUi?.serviceStickyRevealed) {
        selectionItem.hidden = true;
        return;
      }
      if (dataType === "service") {
        selectionItem.hidden = false;
      }

      const valueEl = selectionItem.querySelector(".selection-value");
      if (!valueEl) return;

      valueEl.textContent = placeholder;
      valueEl.setAttribute("data-empty", "true");
    }

    function clearStepCardSelection(stepKey) {
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      if (!step) return;
      step
        .querySelectorAll(
          ".option-card.selected, .product-card.selected, .option-card.forced, .product-card.forced"
        )
        .forEach((card) => {
          card.classList.remove("selected", "forced");
        });
    }

    function getNotApplicableLabel(stepKey) {
      return notApplicableLabels[stepKey] || notApplicableLabels.default;
    }

    function clearSelectionState(stepKey) {
      clearStepCardSelection(stepKey);
      delete state.selections[stepKey];

      if (stepKey === "pompa") {
        state.selectedPump = null;
      } else if (stepKey === "cwu") {
        state.selectedCwuProduct = null;
      } else if (stepKey === "bufor") {
        state.selectedBufferProduct = null;
      }

      resetSelectionsBar(stepKey);
    }

    function markStepAsNotApplicable(stepKey, label = getNotApplicableLabel(stepKey)) {
      clearStepCardSelection(stepKey);
      state.selections[stepKey] = {
        optionId: stepKey === "cwu" ? "cwu-none" : `${stepKey}-na`,
        label,
        system: true,
      };

      if (stepKey === "pompa") {
        state.selectedPump = null;
      } else if (stepKey === "cwu") {
        state.selectedCwuProduct = null;
      } else if (stepKey === "bufor") {
        state.selectedBufferProduct = null;
      }

      updateSelectionsBar(stepKey, label, { animate: false });
    }

    function hideStepAsNotApplicable(stepKey, label = getNotApplicableLabel(stepKey)) {
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      if (step) {
        step.style.display = "none";
        step.classList.add("section-skipped");
        step.classList.remove("section-disabled");
      }
      markStepAsNotApplicable(stepKey, label);
    }

    function restoreStepFromNotApplicable(stepKey) {
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      if (step) {
        step.style.display = "";
        step.classList.remove("section-skipped");
      }
      if (state.selections?.[stepKey]?.system) {
        clearSelectionState(stepKey);
      }
    }

    function syncSelectionForStep(stepKey) {
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      const selection = state.selections[stepKey];

      if (!selection) {
        clearStepCardSelection(stepKey);
        resetSelectionsBar(stepKey);
        return false;
      }

      const stepIsNotApplicable = getStepUiState(step || stepKey).status !== "completed";

      if (selection.system) {
        clearStepCardSelection(stepKey);
        if (stepIsNotApplicable && selection.label) {
          updateSelectionsBar(stepKey, selection.label, { animate: false });
          return false;
        }
        clearSelectionState(stepKey);
        return false;
      }

      if (!selection.optionId) {
        clearSelectionState(stepKey);
        return false;
      }

      const card = step
        ? step.querySelector(`[data-option-id="${selection.optionId}"]`)
        : dom.qs(`[data-option-id="${selection.optionId}"]`);

      if (!card) {
        clearSelectionState(stepKey);
        return false;
      }

      if (card.classList.contains("disabled")) {
        clearSelectionState(stepKey);
        return false;
      }

      clearStepCardSelection(stepKey);
      card.classList.add("selected");
      const titleEl =
        card.querySelector(".product-title") ||
        card.querySelector(".option-title");
      const resolvedLabel =
        (titleEl && titleEl.textContent.trim()) ||
        selection.label ||
        selection.optionId ||
        "";

      if (!selection.label || selection.label === selection.optionId) {
        state.selections[stepKey] = {
          ...selection,
          label: resolvedLabel,
        };
      }

      updateSelectionsBar(stepKey, resolvedLabel, { animate: false });
      return true;
    }

    function captureSelectionForCard(card) {
      const stepSection = card.closest(".config-step");
      if (!stepSection) return;

      const stepKey = stepSection.dataset.stepKey;
      if (!stepKey) return;

      const optionId = card.getAttribute("data-option-id") || null;
      // Dla product-card użyj product-title, dla option-card użyj option-title
      const titleEl =
        card.querySelector(".product-title") ||
        card.querySelector(".option-title");
      const label = titleEl ? titleEl.textContent.trim() : optionId || "";

      // UsuÄąâ€ž selekcję z innych kart w tym kroku (obsÄąâ€šuguj oba typy kart)
      stepSection
        .querySelectorAll(".option-card.selected, .product-card.selected")
        .forEach((c) => {
          if (c !== card) c.classList.remove("selected");
        });

      card.classList.add("selected");

      // Zapisz w state
      state.selections[stepKey] = {
        optionId,
        label,
      };

      // Aktualizuj sticky pasek z wybranymi komponentami
      updateSelectionsBar(stepKey, label);

      // Aktualizuj selectedPump jeÄąâ€şli to pompa
      if (stepKey === "pompa") {
        const selectedPower = toFiniteNumber(
          card.getAttribute("data-pump-power"),
          null
        );
        const selectedPhase = toFiniteNumber(
          card.getAttribute("data-pump-phase"),
          null
        );
        const selectedSeriesRaw = card.getAttribute("data-pump-series");
        const selectedSeries =
          typeof selectedSeriesRaw === "string" && selectedSeriesRaw.trim() !== ""
            ? selectedSeriesRaw.trim()
            : null;
        state.selectedPump = {
          optionId,
          label,
          model: card.getAttribute("data-pump-model") || null,
          type: optionId?.includes("aio") ? "all-in-one" : "split",
          power_kw: selectedPower ?? state.meta?.recommended_power_kw ?? null,
          phase: selectedPhase,
          series: selectedSeries,
        };
        if (selectedSeries && state.meta && typeof state.meta === "object") {
          state.meta.generation = selectedSeries;
        }
      } else if (stepKey === "cwu") {
        state.selectedCwuProduct = { optionId, label };
      } else if (stepKey === "bufor") {
        state.selectedBufferProduct = { optionId, label };
      }

      // Przelicz konfigurator (backend-first + fallback)
      recompute();

      // Ă˘Ĺ›â€¦ Zapisz stan do sessionStorage (dla przeÄąâ€šĂ„â€¦czania widokÄ‚Ĺ‚w)
      saveConfiguratorState();

      // Aktualizuj przycisk "Dalej" po wyborze opcji
      updateNavButtons();
    }

    function selectOption(stepKey, optionId) {
      if (!stepKey || !optionId) return false;
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      if (!step) return false;
      const card = step.querySelector(`[data-option-id="${optionId}"]`);
      if (!card) return false;
      captureSelectionForCard(card);
      return true;
    }

    function selectOptionById(optionId) {
      if (!optionId) return false;
      const card = dom.qs(`[data-option-id="${optionId}"]`);
      if (!card) return false;
      captureSelectionForCard(card);
      return true;
    }

    function selectRecommended(stepKey) {
      if (!stepKey) return false;
      const step = dom.qs(`[data-step-key="${stepKey}"]`);
      if (!step) return false;
      const badge = step.querySelector(".badge-recommended");
      const card = badge ? badge.closest(".product-card, .option-card") : null;
      if (card) {
        captureSelectionForCard(card);
        return true;
      }
      const fallbackCard = step.querySelector(".product-card, .option-card");
      if (fallbackCard) {
        captureSelectionForCard(fallbackCard);
        return true;
      }
      return false;
    }

    function selectBufferCapacity(capacity) {
      if (typeof capacity === "undefined" || capacity === null) return false;
      const optionId = `buffer-${capacity}`;
      return selectOption("bufor", optionId) || selectOptionById(optionId);
    }

    function showStepByKey(stepKey) {
      if (!stepKey) return;
      const step = steps.find((s) => s.dataset.stepKey === stepKey);
      if (!step) return;
      const idx = steps.indexOf(step);
      if (idx !== -1) showStep(idx);
    }

    function getStepUiState(stepOrKey, summaryEvaluation = null) {
      const step =
        typeof stepOrKey === "string"
          ? dom.qs(`[data-step-key="${stepOrKey}"]`)
          : stepOrKey || null;
      const stepKey =
        step?.dataset?.stepKey ||
        (typeof stepOrKey === "string" ? stepOrKey : null);
      const selection = stepKey ? state.selections[stepKey] || null : null;
      const cwuSkipped = stepKey === "cwu" && !!summaryEvaluation?.cwuRules?.skip;

      if (!step || !stepKey) {
        return {
          key: stepKey,
          status: "hidden",
          isInFlow: false,
          hasSelection: false,
        };
      }

      if (step.classList.contains("section-disabled")) {
        return {
          key: stepKey,
          status: "disabled",
          isInFlow: false,
          hasSelection: !!selection?.optionId,
        };
      }

      if (
        cwuSkipped ||
        step.classList.contains("section-skipped") ||
        !!selection?.system
      ) {
        return {
          key: stepKey,
          status: "not_applicable",
          isInFlow: false,
          hasSelection: !!selection?.optionId,
        };
      }

      if (stepKey === "hydraulics_inputs") {
        const completionState = getHydraulicsInputsCompletionState();
        return {
          key: stepKey,
          status: completionState.shouldBlockRecommendation
            ? "required"
            : "completed",
          isInFlow: true,
          hasSelection: completionState.isComplete,
        };
      }

      if (stepKey === "bufor") {
        const hydraulicsSnapshot = getCanonicalHydraulicsRenderSnapshot();
        const recommendationReady = !!hydraulicsSnapshot?.recommendation;
        const hasBufferSelection = !!selection?.optionId;
        return {
          key: stepKey,
          status: recommendationReady && hasBufferSelection ? "completed" : "required",
          isInFlow: true,
          hasSelection: recommendationReady && hasBufferSelection,
          pending: !recommendationReady,
          pendingSource: recommendationReady
            ? null
            : hydraulicsSnapshot?.source || "pending",
        };
      }

      if (selection?.optionId || stepKey === "summary") {
        return {
          key: stepKey,
          status: "completed",
          isInFlow: true,
          hasSelection: true,
        };
      }

      return {
        key: stepKey,
        status: "required",
        isInFlow: true,
        hasSelection: false,
      };
    }

    function getActiveSteps() {
      return steps.filter((step) => getStepUiState(step).isInFlow);
    }

    function resolveActiveStepIndex(index) {
      let targetIndex = clamp(index, 0, totalSteps - 1);

      if (steps.length === 0) {
        return 0;
      }

      const isStepSkipped = (step) => !getStepUiState(step).isInFlow;

      if (!isStepSkipped(steps[targetIndex])) {
        return targetIndex;
      }

      for (let i = targetIndex + 1; i < steps.length; i++) {
        if (!isStepSkipped(steps[i])) {
          return i;
        }
      }

      for (let i = targetIndex - 1; i >= 0; i--) {
        if (!isStepSkipped(steps[i])) {
          return i;
        }
      }

      return targetIndex;
    }

    function ensureCurrentStepIsActive() {
      if (steps.length === 0) return;
      const resolvedIndex = resolveActiveStepIndex(currentStepIndex);
      const currentStep = steps[currentStepIndex] || null;
      if (resolvedIndex !== currentStepIndex || !currentStep?.classList.contains("active")) {
        showStep(resolvedIndex, true);
      }
    }

    function showStep(index, noScroll = false) {
      let targetIndex = resolveActiveStepIndex(index);

      currentStepIndex = targetIndex;

      if (steps.length === 0) {
        console.error("[Configurator] No configurator steps in DOM");
        return;
      }

      steps.forEach((step, i) => {
        if (i === currentStepIndex) {
          step.classList.add("active");
          // Ă˘Ĺ›â€¦ NAPRAWA: WymuÄąâ€ş display: block przez inline style z !important (nadpisze CSS)
          step.style.setProperty("display", "block", "important");
          step.style.setProperty("opacity", "1", "important");
          step.style.setProperty("visibility", "visible", "important");
        } else {
          step.classList.remove("active");
          step.style.setProperty("display", "none", "important");
        }
      });

      // Przelicz aktywne kroki (bez skipped)
      const activeSteps = getActiveSteps();
      const activeStepIndex = activeSteps.indexOf(steps[currentStepIndex]);

      if (currentStepNumberEl) {
        currentStepNumberEl.textContent = String(activeStepIndex + 1);
      }
      if (totalStepsNumberEl) {
        totalStepsNumberEl.textContent = String(activeSteps.length);
      }

      updateNavButtons();

      // Emit lightweight lifecycle event for the last screen (scoped to this root).
      // Used by the FINAL SUMMARY controller to fire summary_viewed once.
      try {
        const activeStep = steps[currentStepIndex];
        const stepKey = activeStep?.dataset?.stepKey || null;
        if (stepKey === "hydraulics_inputs") {
          renderHydraulicsInputsStep();
        } else if (stepKey === "bufor") {
          renderCanonicalHydraulicsUi(evaluateRules());
        }
        // CSS hook: allow other UI parts to react without DOM queries.
        try {
          root.classList.toggle("hp-summary-active", stepKey === "summary");
        } catch (err) {
          // Ignore errors
        }
        if (stepKey === "summary") {
          // Cena końcowa: offerSummary.js (nasłuch hp:summaryStepShown)
          root.dispatchEvent(
            new CustomEvent("hp:summaryStepShown", {
              detail: { stepKey: "summary" },
              bubbles: true,
            })
          );
        }
      } catch (err) {
        // Ignore errors
      }

      // Scroll: początek aktywnego kroku, z offsetem pod sticky (pasek wyborów + nagłówek strony)
      if (!noScroll) {
        const activeStep = steps[currentStepIndex];
        if (activeStep) {
          setTimeout(() => {
            const view = root.ownerDocument?.defaultView || window;
            const stickyBar = root.querySelector("#configurator-selections-bar");
            const barH = stickyBar ? stickyBar.getBoundingClientRect().height : 0;
            const extra = barH + 12;
            const rect = activeStep.getBoundingClientRect();
            const top = rect.top + (view.scrollY || 0) - extra;
            view.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          }, 80);
        }
      }

      try {
        const sk = steps[currentStepIndex]?.dataset?.stepKey || null;
        if (sk === "service") {
          state.configuratorUi.serviceStickyRevealed = true;
          syncSelectionForStep("service");
        }
      } catch (_) { }
    }

    function updateNavButtons() {
      const activeSteps = getActiveSteps();
      const resolvedIndex = resolveActiveStepIndex(currentStepIndex);
      const currentStep = steps[resolvedIndex] || null;
      const activeStepIndex = activeSteps.indexOf(currentStep);

      if (navPrev) {
        navPrev.disabled = activeStepIndex === 0;
      }
      if (navNext) {
        const isLast = activeStepIndex === activeSteps.length - 1;
        const isPenultimate = activeStepIndex === activeSteps.length - 2;

        if (isLast) {
          navNext.textContent = "Dalej →";
          navNext.disabled = true;
          navNext.style.setProperty("display", "none", "important");
          return;
        }

        navNext.style.removeProperty("display");
        navNext.textContent = isPenultimate
          ? "Przejdź do podsumowania"
          : "Dalej →";

        if (currentStep) {
          const stepUiState = getStepUiState(currentStep);
          const optionsCount = currentStep.querySelectorAll(
            ".product-card, .option-card"
          ).length;
          const hasSelection = stepUiState.hasSelection;
          const isStepNotApplicable =
            stepUiState.status === "disabled" ||
            stepUiState.status === "not_applicable" ||
            stepUiState.status === "hidden";
          const requiresHydraulicsCompletion =
            currentStep.dataset.stepKey === "hydraulics_inputs";
          const requiresBufferRecommendation =
            currentStep.dataset.stepKey === "bufor";
          const stepPending = stepUiState.pending === true;

          if (
            stepUiState.status === "required" &&
            !hasSelection &&
            !isStepNotApplicable &&
            (
              optionsCount > 1 ||
              requiresHydraulicsCompletion ||
              requiresBufferRecommendation ||
              stepPending
            )
          ) {
            navNext.disabled = true;
          } else {
            navNext.disabled = false;
          }
        } else {
          navNext.disabled = false;
        }
      }
    }

    function updateSummary() {
      if (!summaryBody) return;

      summaryBody.innerHTML = "";
      const summaryEvaluation = evaluateRules();

      summaryConfig.forEach((rowCfg) => {
        const tr = doc.createElement("tr");

        const tdTitle = doc.createElement("td");
        tdTitle.className = "section-title";
        tdTitle.innerHTML = `<i class="${rowCfg.icon}" aria-hidden="true"></i> ${rowCfg.label}`;

        const tdValue = doc.createElement("td");
        tdValue.className = "section-value";

        const tdStatus = doc.createElement("td");
        tdStatus.className = "section-status";

        const selection = state.selections[rowCfg.stepKey];
        const step = dom.qs(`[data-step-key="${rowCfg.stepKey}"]`);
        const stepUiState = getStepUiState(step || rowCfg.stepKey, summaryEvaluation);

        if (rowCfg.stepKey === "hydraulics_inputs") {
          const completionState = getHydraulicsInputsCompletionState();
          if (stepUiState.status === "not_applicable") {
            tdValue.textContent = getNotApplicableLabel("hydraulics_inputs");
            tdStatus.textContent = "Nie dotyczy";
          } else if (stepUiState.status === "disabled") {
            tdValue.textContent = selection?.label || "Opcja chwilowo niedostępna";
            tdStatus.textContent = "Niedostępne";
          } else if (completionState.isComplete) {
            tdValue.textContent = completionState.summaryLabel;
            const statusBadge = doc.createElement("span");
            statusBadge.className = "status-selected";
            statusBadge.textContent = "Wybrano";
            tdStatus.appendChild(statusBadge);
            const editLink = doc.createElement("a");
            editLink.href = "#";
            editLink.className = "summary-edit-link";
            editLink.setAttribute("data-action", "edit-step");
            editLink.setAttribute("data-step-key", rowCfg.stepKey);
            editLink.textContent = "Edytuj";
            tdStatus.appendChild(doc.createTextNode(" "));
            tdStatus.appendChild(editLink);
          } else {
            tdValue.textContent = completionState.summaryLabel;
            tdStatus.textContent = "Wymagane";
          }
          tr.appendChild(tdTitle);
          tr.appendChild(tdValue);
          tr.appendChild(tdStatus);
          summaryBody.appendChild(tr);
          return;
        }

        if (stepUiState.status === "not_applicable") {
          tdValue.textContent =
            rowCfg.stepKey === "cwu" && summaryEvaluation?.cwuRules?.skipReason
              ? summaryEvaluation.cwuRules.skipReason
              : selection?.label || getNotApplicableLabel(rowCfg.stepKey);
          tdStatus.textContent = "Nie dotyczy";
        } else if (stepUiState.status === "disabled") {
          tdValue.textContent = selection?.label || "Opcja chwilowo niedostępna";
          tdStatus.textContent = "Niedostępne";
        } else if (selection?.label) {
          tdValue.textContent = selection.label;
          const statusBadge = doc.createElement("span");
          statusBadge.className = "status-selected";
          statusBadge.textContent = "Wybrano";
          tdStatus.appendChild(statusBadge);
          const editLink = doc.createElement("a");
          editLink.href = "#";
          editLink.className = "summary-edit-link";
          editLink.setAttribute("data-action", "edit-step");
          editLink.setAttribute("data-step-key", rowCfg.stepKey);
          editLink.textContent = "Edytuj";
          tdStatus.appendChild(doc.createTextNode(" "));
          tdStatus.appendChild(editLink);
        } else {
          tdValue.textContent = "Nie wybrano";
          tdStatus.textContent =
            stepUiState.status === "required" ? "Wymagane" : "—";
        }

        tr.appendChild(tdTitle);
        tr.appendChild(tdValue);
        tr.appendChild(tdStatus);
        summaryBody.appendChild(tr);
      });

      const summaryBanner = dom.qs("#config-summary-status");
      if (!summaryEvaluation?.summary) {
        if (summaryBanner) {
          summaryBanner.className = "summary-banner";
          summaryBanner.innerHTML = "";
        }
        return;
      }

      if (summaryBanner) {
        if (summaryEvaluation.summary.complete) {
          summaryBanner.className = "summary-banner summary-banner--complete";
          summaryBanner.innerHTML = `
            <div class="summary-banner-icon">✓</div>
            <div class="summary-banner-content">
              <strong>Konfiguracja kompletna</strong>
              <p>Wszystkie wymagane komponenty zostały dobrane. Możesz wygenerować ofertę PDF.</p>
            </div>
          `;
        } else {
          summaryBanner.className = "summary-banner summary-banner--incomplete";
          summaryBanner.innerHTML = `
            <div class="summary-banner-icon">⚠</div>
            <div class="summary-banner-content">
              <strong>Wymagane komponenty: brak wyboru</strong>
              <p>Uzupełnij konfigurację, aby spełnić wymagania serwisowe i gwarancyjne.</p>
            </div>
          `;
        }
      }
    }


    /* ==========================================================================
     EVENT BINDING (z configurator-new.js)
     ========================================================================== */

    function bindCardClicks() {
      const stepsContainer = dom.byId("configurator-steps");
      if (!stepsContainer) {
        console.warn("[Configurator] Missing #configurator-steps");
        return;
      }

      if (cardClickHandler) {
        stepsContainer.removeEventListener("click", cardClickHandler);
      }

      cardClickHandler = function (e) {
        // ObsÄąâ€šuguj zarÄ‚Ĺ‚wno option-card jak i product-card
        const card =
          e.target.closest(".option-card") || e.target.closest(".product-card");
        if (!card || card.classList.contains("disabled")) return;

        captureSelectionForCard(card);
      };

      trackEvent(stepsContainer, "click", cardClickHandler);
    }

    function bindNavigation() {
      const app = dom.byId("configurator-app");
      if (!app) {
        console.warn("[Configurator] Missing #configurator-app");
        return;
      }

      if (navClickHandler) {
        app.removeEventListener("click", navClickHandler);
      }

      navClickHandler = function (e) {
        // Zapobiegaj domyÄąâ€şlnemu zachowaniu (przeÄąâ€šadowanie strony)
        if (
          e.target.id === "nav-prev" ||
          e.target.closest("#nav-prev") ||
          e.target.id === "nav-next" ||
          e.target.closest("#nav-next")
        ) {
          e.preventDefault();
          e.stopPropagation();
        }

        if (e.target.id === "nav-prev" || e.target.closest("#nav-prev")) {
          // Ă˘Ĺ›â€¦ NOWA LOGIKA: ZnajdÄąĹź poprzedniĂ„â€¦ aktywnĂ„â€¦ sekcję (pomijajĂ„â€¦c skipped)
          const activeSteps = getActiveSteps();
          const currentActiveIndex = activeSteps.indexOf(
            steps[resolveActiveStepIndex(currentStepIndex)]
          );
          if (currentActiveIndex > 0) {
            const prevActiveStep = activeSteps[currentActiveIndex - 1];
            const prevIndex = steps.indexOf(prevActiveStep);
            showStep(prevIndex);
          }
        } else if (
          e.target.id === "nav-next" ||
          e.target.closest("#nav-next")
        ) {
          // Ă˘Ĺ›â€¦ NOWA LOGIKA: ZnajdÄąĹź następnĂ„â€¦ aktywnĂ„â€¦ sekcję (pomijajĂ„â€¦c skipped)
          const activeSteps = getActiveSteps();
          const currentActiveIndex = activeSteps.indexOf(
            steps[resolveActiveStepIndex(currentStepIndex)]
          );
          if (currentActiveIndex < activeSteps.length - 1) {
            const nextActiveStep = activeSteps[currentActiveIndex + 1];
            const nextIndex = steps.indexOf(nextActiveStep);
            showStep(nextIndex);
          }
        }
      };

      trackEvent(app, "click", navClickHandler);
    }

    function generateOfferData() {
      return {
        ...buildSelectionPayload(),
        ts: Date.now(),
        version: 1,
      };
    }

    function bindSummaryActions() {
      const app = root.querySelector("#configurator-app") || root;
      if (!app) return;

      const summaryContainer = root.querySelector(".summary-actions")?.closest(".config-step") || root;

      if (summaryClickHandler) {
        root.removeEventListener("click", summaryClickHandler);
      }

      summaryClickHandler = function (e) {
        if (!root.contains(e.target)) return;
        const actionEl = e.target.closest("[data-action]");
        const action = actionEl ? actionEl.getAttribute("data-action") : null;
        if (!action) return;

        if (action === "contact-form") {
          e.preventDefault();
          const configuratorData = generateOfferData();
          root.dispatchEvent(
            new CustomEvent("hp:goToContactForm", {
              detail: { configuratorData },
              bubbles: true,
            })
          );
        } else if (action === "edit-step") {
          e.preventDefault();
          const stepKey = actionEl.getAttribute("data-step-key");
          if (stepKey) showStepByKey(stepKey);
        } else if (action === "back-to-config") {
          const normalSteps = steps.filter(
            (step) => step.dataset.stepKey !== "summary"
          );
          const lastNormal = normalSteps[normalSteps.length - 1];
          const idx = steps.indexOf(lastNormal);
          if (idx !== -1) showStep(idx);
        } else if (action === "print") {
          view.print();
        } else if (action === "go-back") {
          root.dispatchEvent(
            new CustomEvent("hp:goBackToForm", { bubbles: true })
          );
        } else if (action === "start-new") {
          root.dispatchEvent(
            new CustomEvent("hp:startNewCalculation", { bubbles: true })
          );
        }
      };

      trackEvent(root, "click", summaryClickHandler);
    }

    function bindSelectionsBar() {
      const bar = root.querySelector('[data-role="selections-bar"]');
      if (!bar) return;
      if (selectionsBarClickHandler) {
        root.removeEventListener("click", selectionsBarClickHandler);
      }
      const typeToStepKey = {
        pompa: "pompa",
        cwu: "cwu",
        bufor: "bufor",
        cyrkulacja: "cyrkulacja",
        service: "service",
        posadowienie: "posadowienie",
        reduktor: "reduktor",
        uzdatnianie: "woda",
      };
      selectionsBarClickHandler = function (e) {
        if (!root.contains(e.target)) return;
        const item = e.target.closest(".selection-item");
        if (!item || !bar.contains(item)) return;
        const dataType = item.getAttribute("data-type");
        const stepKey = typeToStepKey[dataType] || dataType;
        if (stepKey) showStepByKey(stepKey);
      };
      trackEvent(root, "click", selectionsBarClickHandler);
    }

    // P2.3 Ă˘â‚¬â€ť Tooltipy techniczne (root-scoped, bez bibliotek)
    function bindTooltips() {
      const tooltipEl = root.querySelector('[data-role="configurator-tooltip"]');
      if (!tooltipEl) return;
      if (tooltipHandler) {
        root.removeEventListener("mouseenter", tooltipHandler, true);
        root.removeEventListener("mouseleave", tooltipHandler, true);
        root.removeEventListener("focus", tooltipHandler, true);
        root.removeEventListener("blur", tooltipHandler, true);
      }
      const tooltipTexts = {
        "anti-cycling": "Minimalna objętość bufora wymagana do zapobiegania zbyt częstemu włączaniu/wyłączaniu pompy (short-cycling).",
        "bivalent": "Objętość bufora wymagana do magazynowania energii z drugiego źródła ciepła (kocioł, kominek).",
        "hydraulic": "Deficyt objętości wody w instalacji — różnica między wymaganym a szacowanym obciążeniem systemu.",
        "computed-liters": "Obliczona pojemność bufora przed zaokrągleniem do dostępnych rozmiarów rynkowych.",
        "rounded-to": "Pojemność dobrana z dostępnych rozmiarów rynkowych, najbliższa obliczonej wartości.",
      };
      let hideTimeout = null;
      let currentTarget = null;
      function showTooltip(target) {
        if (hideTimeout) clearTimeout(hideTimeout);
        currentTarget = target;
        const tooltipId = target.getAttribute("data-tooltip");
        const text = tooltipTexts[tooltipId] || tooltipId;
        if (!text) return;
        tooltipEl.textContent = text;
        tooltipEl.style.display = "block";
        const rect = target.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        const isNarrow = rootRect.width < 560;
        const tooltipWidth = Math.min(280, rootRect.width - 32);
        let left;
        let top;
        if (isNarrow) {
          left = Math.max(16, (rootRect.width - tooltipWidth) / 2);
          top = rect.bottom - rootRect.top + 8;
          tooltipEl.style.transform = "none";
        } else {
          left = rect.right + 8 - rootRect.left;
          top = rect.top + rect.height / 2 - rootRect.top;
          if (left + tooltipWidth > rootRect.width) {
            left = rect.left - tooltipWidth - 8 - rootRect.left;
          }
          if (left < 8) left = 8;
          if (left + tooltipWidth > rootRect.width - 8) left = rootRect.width - tooltipWidth - 8;
          if (top < 8) top = 8;
          if (top > rootRect.height - 40) top = rootRect.height - 40;
          tooltipEl.style.transform = "translateY(-50%)";
        }
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
        tooltipEl.setAttribute("aria-hidden", "false");
      }
      function hideTooltip() {
        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
          tooltipEl.setAttribute("aria-hidden", "true");
          tooltipEl.style.display = "none";
          currentTarget = null;
        }, 100);
      }
      tooltipHandler = function (e) {
        if (!root.contains(e.target)) {
          if (currentTarget) hideTooltip();
          return;
        }
        const target = e.target.closest("[data-tooltip]");
        if (target && target === currentTarget) return;
        if (target) {
          showTooltip(target);
        } else if (currentTarget) {
          hideTooltip();
        }
      };
      trackEvent(root, "mouseenter", tooltipHandler, true);
      trackEvent(root, "mouseleave", tooltipHandler, true);
      trackEvent(root, "focusin", tooltipHandler, true);
      trackEvent(root, "focusout", tooltipHandler, true);
    }

    // PeÄąâ€šniejszy reset: nasÄąâ€šuchuj heatpump:resetConfigurator (z resultsRenderer.startNewCalculation)
    trackEvent(root, "heatpump:resetConfigurator", () => {
      state.selections = {};
      state.selectedPump = null;
      state.selectedCwuProduct = null;
      state.selectedBufferProduct = null;
      state.backendOffer = null;
      lastBackendRequestSignature = null;
      lastBackendHydraulicsSignature = null;
      state.recommendations = { hydraulics: null };
      state.pricing = { total_netto_pln: 0, total_brutto_pln: 0, items: [] };
      currentStepIndex = 0;
      lastSelectionPayload = null;

      steps.forEach((step) => {
        step.classList.remove("section-disabled", "section-skipped", "section-required");
        step.style.removeProperty("display");
        step.style.removeProperty("opacity");
        step.style.removeProperty("visibility");
        step
          .querySelectorAll(
            ".option-card.selected, .product-card.selected, .option-card.forced, .product-card.forced, .option-card.warn, .product-card.warn, .option-card.recommended, .product-card.recommended"
          )
          .forEach((card) => {
            card.classList.remove("selected", "forced", "warn", "recommended", "disabled");
            card.setAttribute("aria-disabled", "false");
            card.removeAttribute("data-disabled-reason");
            card.title = "";
          });
      });

      Object.keys(selectionBarTypeMapping).forEach((stepKey) => {
        resetSelectionsBar(stepKey);
      });

      updateSummary();
      exposeSelectionOnWindow();
      showStep(0, true);
    });

    /* ==========================================================================
     PUMP CARD RENDERING (nowa funkcjonalność)
     ========================================================================== */

    // Renderuje kartę pompy z peÄąâ€šnymi danymi z panasonic.json
    function normalizeConfiguratorPumpType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      if (
        normalized === "all-in-one" ||
        normalized === "all_in_one" ||
        normalized === "aio"
      ) {
        return "all-in-one";
      }
      if (normalized === "split" || normalized === "hp") {
        return "split";
      }
      return null;
    }

    function normalizeConfiguratorPumpSelectionEntry(entry, fallbackType) {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const model =
        typeof entry.model === "string" && entry.model.trim() !== ""
          ? entry.model.trim()
          : null;
      if (!model) {
        return null;
      }

      return {
        model,
        type: normalizeConfiguratorPumpType(entry.type || fallbackType),
        power_kw: toFiniteNumber(
          entry.power ?? entry.power_kw ?? entry.capacity_kW,
          null
        ),
        phase: toFiniteNumber(entry.phase ?? entry.minPhase, null),
        series:
          typeof entry.series === "string" && entry.series.trim() !== ""
            ? entry.series.trim()
            : null,
        cwu_tank: toFiniteNumber(entry.cwu_tank ?? entry.cwuTank, null),
        requires3F: toBool(entry.requires3F, false),
      };
    }

    function resolveCanonicalPumpRecommendationSnapshot(calcData, appSnapshot) {
      const appStateSnapshot =
        appSnapshot && typeof appSnapshot === "object"
          ? appSnapshot
          : typeof getAppState === "function"
            ? getAppState()
            : null;
      const strictBackendMode =
        isBackendCalcEnabled();
      const offerSelection =
        calcData?.offer_dto?.engineering?.selection ||
        appStateSnapshot?.canonicalOffer?.engineering?.selection ||
        state?.backendOffer?.engineering?.selection ||
        null;

      if (offerSelection && typeof offerSelection === "object") {
        const hp = normalizeConfiguratorPumpSelectionEntry(
          offerSelection?.pumpSelection?.hp,
          offerSelection?.type || "split"
        );
        const aio = normalizeConfiguratorPumpSelectionEntry(
          offerSelection?.pumpSelection?.aio,
          "all-in-one"
        );
        const preferredType =
          normalizeConfiguratorPumpType(offerSelection?.type) ||
          (aio && !hp ? "all-in-one" : null) ||
          (hp ? "split" : null);
        const preferredEntry =
          (preferredType === "all-in-one" ? aio : hp) || hp || aio || null;

        return {
          source: "offer_dto",
          preferredType: preferredType || preferredEntry?.type || null,
          preferredModel:
            preferredEntry?.model || offerSelection?.pumpModel || null,
          hp,
          aio,
        };
      }

      if (!strictBackendMode) {
        const legacySelection =
          calcData?.pump_selection && typeof calcData.pump_selection === "object"
            ? calcData.pump_selection
            : null;
        if (legacySelection) {
          const hp = normalizeConfiguratorPumpSelectionEntry(
            legacySelection?.hp,
            "split"
          );
          const aio = normalizeConfiguratorPumpSelectionEntry(
            legacySelection?.aio,
            "all-in-one"
          );
          const preferredEntry = hp || aio || null;

          return {
            source: "legacy_result",
            preferredType: preferredEntry?.type || null,
            preferredModel: preferredEntry?.model || null,
            hp,
            aio,
          };
        }
      }

      return {
        source: strictBackendMode ? "pending" : "none",
        preferredType: null,
        preferredModel: null,
        hp: null,
        aio: null,
      };
    }

    function resolveRecommendedPumpProfile(pumpProfiles, recommendation) {
      if (!Array.isArray(pumpProfiles) || pumpProfiles.length === 0) {
        return null;
      }

      const preferredModel =
        typeof recommendation?.preferredModel === "string"
          ? recommendation.preferredModel
          : null;
      if (preferredModel) {
        const byModel = pumpProfiles.find((profile) => profile?.model === preferredModel);
        if (byModel) {
          return byModel;
        }
      }

      const preferredType = normalizeConfiguratorPumpType(
        recommendation?.preferredType
      );
      if (preferredType) {
        const byType = pumpProfiles.find(
          (profile) => normalizeConfiguratorPumpType(profile?.type) === preferredType
        );
        if (byType) {
          return byType;
        }
      }

      return null;
    }

    function buildPumpProfilesFromCanonicalRecommendation(recommendation) {
      if (!recommendation || typeof recommendation !== "object") {
        return [];
      }

      function buildProfile(entry, id, label, variant, fallbackType) {
        const normalized = normalizeConfiguratorPumpSelectionEntry(
          entry,
          fallbackType
        );
        if (!normalized || !normalized.model) {
          return null;
        }

        const catalogEntry = pumpMatchingTable?.[normalized.model] || {};
        const type =
          normalizeConfiguratorPumpType(
            normalized.type || fallbackType || catalogEntry?.type
          ) || fallbackType;
        const powerKw =
          toFiniteNumber(normalized.power_kw, null) ??
          toFiniteNumber(catalogEntry?.power, null);
        const phase =
          toFiniteNumber(normalized.phase, null) ??
          toFiniteNumber(catalogEntry?.phase, null) ??
          1;
        const series =
          (typeof normalized.series === "string" && normalized.series.trim() !== ""
            ? normalized.series.trim()
            : null) ||
          (typeof catalogEntry?.series === "string" &&
            catalogEntry.series.trim() !== ""
            ? catalogEntry.series.trim()
            : null) ||
          (typeof state?.meta?.generation === "string" &&
            state.meta.generation.trim() !== ""
            ? state.meta.generation.trim()
            : null) ||
          "K";
        const requires3F =
          normalized.requires3F === true ||
          toBool(catalogEntry?.requires3F, false) ||
          phase === 3;
        const cwuTank =
          toFiniteNumber(normalized.cwu_tank, null) ??
          toFiniteNumber(catalogEntry?.cwu_tank, null);

        return {
          id,
          optionId:
            type === "all-in-one" && Number(cwuTank) >= 250
              ? "aio_premium400"
              : type === "all-in-one"
                ? "aio"
                : "hp",
          label,
          variant,
          type,
          isRecommended: false,
          model: normalized.model,
          power_kw: powerKw,
          series,
          image: getPumpImage(type, phase, series, powerKw, normalized.model),
          minPhase: phase,
          requires3F,
          cwu_tank: cwuTank,
        };
      }

      const splitProfile = buildProfile(
        recommendation?.hp,
        "hp",
        "Split",
        "Rekomendowana - split",
        "split"
      );
      const aioProfile = buildProfile(
        recommendation?.aio,
        "aio",
        "All-in-One",
        "All-in-One",
        "all-in-one"
      );

      const profiles = [splitProfile, aioProfile].filter(Boolean);
      if (profiles.length === 0) {
        return [];
      }

      const preferredType = normalizeConfiguratorPumpType(
        recommendation?.preferredType
      );
      const recommendedId =
        preferredType === "all-in-one" && aioProfile
          ? "aio"
          : splitProfile
            ? "hp"
            : aioProfile
              ? "aio"
              : null;

      return profiles.map((profile) => ({
        ...profile,
        isRecommended: profile.id === recommendedId,
      }));
    }

    function syncSelectedPumpFromProfiles(pumpProfiles) {
      if (!Array.isArray(pumpProfiles) || pumpProfiles.length === 0) {
        return null;
      }

      const selectedOptionId =
        state?.selections?.pompa?.optionId || state?.selectedPump?.optionId || null;
      let matchedProfile = null;

      if (selectedOptionId) {
        matchedProfile =
          pumpProfiles.find((profile) => profile?.id === selectedOptionId) || null;
      }
      if (!matchedProfile && state?.selectedPump?.model) {
        matchedProfile =
          pumpProfiles.find(
            (profile) => profile?.model === state.selectedPump.model
          ) || null;
      }

      if (matchedProfile) {
        state.selectedPump = {
          ...(state.selectedPump || {}),
          optionId: matchedProfile.id,
          label: matchedProfile.label,
          model: matchedProfile.model,
          type: matchedProfile.type,
          power_kw: matchedProfile.power_kw,
          phase: matchedProfile.minPhase || null,
          series: matchedProfile.series || null,
        };
      }

      return matchedProfile;
    }

    function renderPumpPendingState(rootElement = null) {
      const scope = rootElement || dom.qs("#configurator-app") || root;
      const pumpStep =
        scope?.querySelector?.('[data-step-key="pompa"]') ||
        dom.qs('[data-step-key="pompa"]');
      if (!pumpStep) {
        return;
      }

      const optionsGrid = pumpStep.querySelector(".options-grid");
      if (optionsGrid) {
        optionsGrid.innerHTML = `
          <div class="product-card" data-role="pump-pending">
            <div class="product-content">
              <span class="product-subtitle">Oczekiwanie na wynik backendu</span>
              <h4 class="product-title">Dobor pompy w przygotowaniu</h4>
              <p class="product-description">
                Konfigurator czeka na kanoniczny OfferDTO z backendu. Rekomendowane warianty pompy pojawia sie po odswiezeniu oferty.
              </p>
            </div>
          </div>
        `;
      }

      const sectionDescription = pumpStep.querySelector(".section-description");
      if (sectionDescription) {
        sectionDescription.textContent =
          "Dobor pompy zostanie pokazany po otrzymaniu backendowej rekomendacji.";
      }
    }

    async function renderCanonicalPumpUi(
      rootElement = null,
      recommendationInput = null
    ) {
      const scope = rootElement || dom.qs("#configurator-app") || root;
      const pumpStep =
        scope?.querySelector?.('[data-step-key="pompa"]') ||
        dom.qs('[data-step-key="pompa"]');
      if (!pumpStep) {
        return null;
      }

      const optionsGrid = pumpStep.querySelector(".options-grid");
      if (!optionsGrid) {
        return null;
      }

      const recommendation =
        recommendationInput || resolveCanonicalPumpRecommendationSnapshot(null, null);
      const directProfiles =
        buildPumpProfilesFromCanonicalRecommendation(recommendation);
      const pumpProfiles =
        directProfiles.length > 0
          ? directProfiles
          : preparePumpProfiles(state.meta || {});
      if (!Array.isArray(pumpProfiles) || pumpProfiles.length === 0) {
        renderPumpPendingState(scope);
        return null;
      }

      if (!panasonicDB) {
        await loadPanasonicDB();
      }

      const recommendedProfile = resolveRecommendedPumpProfile(
        pumpProfiles,
        recommendation
      );
      const splitProfile =
        pumpProfiles.find((profile) => profile?.id === "hp") || pumpProfiles[0];
      const aioProfile =
        pumpProfiles.find((profile) => profile?.id === "aio") || null;
      const splitData = splitProfile ? getPumpDataFromDB(splitProfile.model) : null;
      const aioData = aioProfile ? getPumpDataFromDB(aioProfile.model) : null;

      const splitCard = splitProfile
        ? renderPumpCard(
          splitProfile,
          splitData,
          recommendedProfile?.id === splitProfile.id
        )
        : "";
      const aioCard =
        aioProfile && !aioProfile.disabled
          ? renderPumpCard(
            aioProfile,
            aioData,
            recommendedProfile?.id === aioProfile.id
          )
          : "";

      optionsGrid.innerHTML = splitCard + aioCard;
      if (!state.selections?.pompa?.optionId) {
        const enabledCards = Array.from(
          optionsGrid.querySelectorAll(".product-card, .option-card")
        ).filter((card) => !card.classList.contains("disabled"));
        if (enabledCards.length === 1) {
          const recommendedOptionId =
            enabledCards[0]?.getAttribute("data-option-id") ||
            enabledCards[0]?.dataset?.optionId ||
            null;
          if (recommendedOptionId) {
            UICallbacks.autoSelect(recommendedOptionId);
          }
        }
      }
      syncSelectionForStep("pompa");

      const selectedProfile = syncSelectedPumpFromProfiles(pumpProfiles);
      if (selectedProfile?.model) {
        const selectedPumpData = getPumpDataFromDB(selectedProfile.model);
        if (selectedPumpData && state.selectedPump) {
          state.selectedPump.panasonicData = selectedPumpData;
        }
      }

      const heatDemand = state.meta?.max_heating_power || null;
      const recommendedPumpPower =
        recommendedProfile?.power_kw ??
        splitProfile?.power_kw ??
        aioProfile?.power_kw ??
        null;
      const sectionDescription = pumpStep.querySelector(".section-description");
      const existingNote = pumpStep.querySelector(".recommendation-note");
      if (existingNote) {
        existingNote.remove();
      }

      if (sectionDescription) {
        if (heatDemand && recommendedPumpPower) {
          sectionDescription.textContent = `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
            2
          )} kW. System rekomenduje pompę ciepła o mocy znamionowej ${recommendedPumpPower} kW jako optymalne rozwiązanie pod kątem komfortu, kosztów i żywotności urządzenia.`;
        } else if (heatDemand) {
          sectionDescription.textContent = `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
            2
          )} kW. Wybierz preferowany model pompy ciepła.`;
        } else {
          sectionDescription.textContent =
            "Na podstawie obliczeń rekomendujemy pompę o odpowiedniej mocy. Wybierz preferowany model.";
        }
      }

      return {
        recommendation,
        profiles: pumpProfiles,
        recommendedProfile,
      };
    }

    function renderPumpCard(pumpProfile, panasonicData, isRecommended = false) {
      if (!pumpProfile) return "";

      const dbData = panasonicData || {};
      const cop = dbData.heating?.A7W35_COP || null;
      const refrigerant = dbData.refrigerant || "R32";
      const soundDb = dbData.outdoor_unit?.sound_dB || null;
      const dimensions = dbData.outdoor_unit?.dimensions_mm;
      const cleanCopStr = cop ? `${cop.toFixed(1)} (A7/W35)` : "—";
      const cleanDimStr = dimensions
        ? `${dimensions.w}×${dimensions.d}×${dimensions.h}`
        : "—";

      // Dla AIO - pokaż pojemność CWU
      const cwuTank =
        pumpProfile.cwu_tank ||
        (pumpProfile.type === "all-in-one" ? 185 : null);

      // Użyj adjustedPowerDisplay dla specjalnych przypadków (np. "1.5 ± 2 kW")
      const powerDisplay = pumpProfile.adjustedPowerDisplay
        ? pumpProfile.adjustedPowerDisplay.replace(" kW", "kW")
        : `${pumpProfile.power_kw}kW`;
      const title =
        pumpProfile.type === "split"
          ? `Panasonic Aquarea ${powerDisplay}`
          : `Panasonic Aquarea All-in-One ${powerDisplay}`;
      const cleanTypeLabel =
        pumpProfile.type === "split"
          ? "Pompa ciepła typu Split"
          : "Pompa ciepła ze zintegrowanym zasobnikiem";

      const description =
        pumpProfile.type === "split"
          ? "System dzielony z jednostką wewnętrzną i zewnętrzną. Elastyczny montaż."
          : `Kompaktowe rozwiązanie z wbudowanym zasobnikiem CWU ${cwuTank || 185
          }L.`;

      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">Rekomendowane</span>'
        : "";
      const imgBase = ((config?.imgUrl || "../img").replace(/\/?$/, "") || "../img");
      const pumpImgSrc =
        pumpProfile.image || `${imgBase}/split-k.png`;
      const pumpImgFallback = `${imgBase}/dom.png`;

      return `
      <button type="button" class="product-card ui-option" data-option-id="${pumpProfile.optionId || pumpProfile.id
        }" data-pump-model="${pumpProfile.model || ""}" data-pump-power="${pumpProfile.power_kw || ""
        }" data-pump-phase="${pumpProfile.minPhase || ""}" data-pump-series="${pumpProfile.series || ""
        }">
        <div class="product-image">
          <img src="${pumpImgSrc}" alt="${title}" onerror="this.onerror=null;this.src='${pumpImgFallback}';" />
        </div>
        <div class="product-content">
          ${recommendedBadge}
          <div class="product-subtitle">${cleanTypeLabel}</div>
          <h4 class="product-title">${title}</h4>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Moc grzewcza</span>
              <span class="spec-value">${pumpProfile.adjustedPowerDisplay || `${pumpProfile.power_kw} kW`
        }</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">COP</span>
              <span class="spec-value">${cleanCopStr}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Czynnik</span>
              <span class="spec-value">${refrigerant}</span>
            </div>
            ${soundDb
          ? `
            <div class="spec-row">
              <span class="spec-label">Poziom hałasu</span>
              <span class="spec-value">${soundDb} dB</span>
            </div>
            `
          : ""
        }
            ${cwuTank
          ? `
            <div class="spec-row">
              <span class="spec-label">Zasobnik CWU</span>
              <span class="spec-value">${cwuTank} L</span>
            </div>
            `
          : ""
        }
            ${dimensions
          ? `
            <div class="spec-row">
              <span class="spec-label">Wymiary</span>
              <span class="spec-value">${cleanDimStr}</span>
            </div>
            `
          : ""
        }
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję pompy z 2 kartami (Split + AIO)
    async function renderPumpSection(pumpProfiles, recommendationInput = null) {
      if (!pumpProfiles || pumpProfiles.length === 0) {
        console.warn("[Configurator] No pump profiles to render");
        return "";
      }

      // ZaÄąâ€šaduj panasonic.json jeÄąâ€şli jeszcze nie zaÄąâ€šadowany
      if (!panasonicDB) {
        await loadPanasonicDB();
      }

      const splitProfile =
        pumpProfiles.find((p) => p.type === "split" && p.id === "hp") ||
        pumpProfiles[0];
      const aioProfile = pumpProfiles.find(
        (p) => p.type === "all-in-one" && p.id === "aio"
      );
      const recommendation = resolveCanonicalPumpRecommendationSnapshot(
        recommendationInput
      );
      const recommendedProfile = resolveRecommendedPumpProfile(
        pumpProfiles,
        recommendation
      );

      if (!splitProfile) {
        console.warn("[Configurator] Missing Split pump profile");
        return "";
      }

      // Pobierz dane z panasonic.json
      const splitData = getPumpDataFromDB(splitProfile.model);
      const aioData = aioProfile ? getPumpDataFromDB(aioProfile.model) : null;

      const splitCard = renderPumpCard(
        splitProfile,
        splitData,
        recommendedProfile?.id === splitProfile?.id
      );
      const aioCard =
        aioProfile && !aioProfile.disabled
          ? renderPumpCard(
            aioProfile,
            aioData,
            recommendedProfile?.id === aioProfile?.id
          )
          : "";

      const heatDemand = state.meta?.max_heating_power || null;
      const recommendedPumpPower =
        recommendedProfile?.power ||
        recommendedProfile?.power_kw ||
        splitProfile?.power ||
        splitProfile?.power_kw ||
        null;

      return `
      <div class="section-container">
        <div class="section-header">
          <div class="section-header-content">
            <div class="section-icon">⚡</div>
            <div>
              <h2 class="section-title">Pompa ciepła</h2>
              <p class="section-description">${heatDemand && recommendedPumpPower
          ? `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
            2
          )} kW. System rekomenduje pompę ciepła o mocy znamionowej ${recommendedPumpPower} kW jako optymalne rozwiązanie pod kątem komfortu, kosztów i żywotności urządzenia.`
          : "Wybierz preferowany model pompy ciepła."
        }</p>
            </div>
          </div>
        </div>
        <div class="options-grid">
          ${splitCard}
          ${aioCard}
        </div>
        <div class="recommendation-note">
          <p><strong>Wynik kalkulacji:</strong> ${heatDemand
          ? `Zapotrzebowanie: ${heatDemand.toFixed(2)} kW`
          : "Brak danych"
        }</p>
        </div>
      </div>
    `;
    }

    /* ==========================================================================
     CWU CARD RENDERING (nowa funkcjonalność)
     ========================================================================== */

    // Dane o zasobnikach CWU (fallback gdy brak configurator-presentation.json)
    const CWU_CARD_FALLBACK = {
      emalia: {
        name: "Galmet SG(S)",
        material: "Emalia",
        anode: "Magnezowa",
        warranty: "5 lat",
        description:
          "Zasobnik z wewnętrzną powłoką emaliowaną. Rozwiązanie ekonomiczne z 5-letnią gwarancją.",
        image: (config?.imgUrl || "../img") + "/cwu-emalia.png",
      },
      inox: {
        name: "Viqtis",
        material: "AISI 316L",
        anode: "Nie wymaga",
        warranty: "10 lat",
        description:
          "Zasobnik ze stali nierdzewnej AISI 316L. Maksymalna trwałość, bez konieczności wymiany anody magnezowej. Gwarancja 10 lat.",
        image: (config?.imgUrl || "../img") + "/cwu-nierdzewka.png",
      },
    };

    function getCwuPresentation() {
      const imgBase = config?.imgUrl || "../img";
      const types = presentationData?.cwu_cards?.types;
      function merge(key, fb) {
        const t = types && types[key];
        if (!t || typeof t !== "object") return fb;
        return {
          name: t.product_name || fb.name,
          material: t.material || fb.material,
          anode: t.anode || fb.anode,
          warranty: t.warranty || fb.warranty,
          description: t.description || fb.description,
          image: t.image_file ? `${imgBase}/${t.image_file}` : fb.image,
        };
      }
      return {
        emalia: merge("emalia", CWU_CARD_FALLBACK.emalia),
        inox: merge("inox", CWU_CARD_FALLBACK.inox),
      };
    }

    function getCwuCardSubtitle(type) {
      const subs = presentationData?.cwu_cards?.card_subtitles;
      if (type === "inox") {
        return subs?.inox || "Zasobnik ze stali nierdzewnej";
      }
      return subs?.emalia || "Zasobnik z powłoką emaliowaną";
    }

    // Renderuje kartę zasobnika CWU z peÄąâ€šnymi danymi
    function renderCwuCard(type, capacity, isRecommended = false) {
      const cwuData = getCwuPresentation();
      const data = cwuData[type];
      if (!data) return "";

      const subtitle = getCwuCardSubtitle(type);

      return `
      <button type="button" class="product-card ui-option" data-option-id="cwu-${type}-${capacity}">
        <div class="product-image">
          <img src="${data.image}" alt="${data.name
        } ${capacity}L" onerror="this.src='${config?.imgUrl || "../img"
        }/dom.png';" />
        </div>
        <div class="product-content">
          <span class="product-subtitle">${subtitle}</span>
          <h4 class="product-title">${data.name} ${capacity}L</h4>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Pojemność</span>
              <span class="spec-value">${capacity} L</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">${presentationData?.cwu_cards?.types?.[type]?.material_label ||
        (type === "inox" ? "Materiał" : "Powłoka")
        }</span>
              <span class="spec-value">${data.material}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Anoda</span>
              <span class="spec-value">${data.anode}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Gwarancja</span>
              <span class="spec-value">${data.warranty}</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję CWU z 2 kartami (Emalia + INOX) dla rekomendowanej pojemnoÄąâ€şci
    function renderCwuSection(recommendedCapacity) {
      if (!recommendedCapacity) {
        console.warn("[Configurator] No recommended DHW tank capacity");
        return "";
      }

      const emaliaCard = renderCwuCard("emalia", recommendedCapacity, true);
      const inoxCard = renderCwuCard("inox", recommendedCapacity, false);

      return emaliaCard + inoxCard;
    }

    // P2.2 Ă˘â‚¬â€ť Renderuje wykres koÄąâ€šowy breakdownu
    function renderBreakdownChart(sizingComponents) {
      if (!sizingComponents) return "";
      const vAnti = sizingComponents.antiCycling?.liters || 0;
      const vBiv = sizingComponents.bivalent?.liters || 0;
      const vHyd = sizingComponents.hydraulic?.liters || 0;
      const total = vAnti + vBiv + vHyd;
      if (total === 0) return "";
      const r = 50;
      const cx = 60;
      const cy = 60;
      let offset = 0;
      const colors = {
        antiCycling: "#666",
        bivalent: "#d4a574",
        hydraulic: "#999",
      };
      const labelDefaults = {
        antiCycling: "Anti-cycling",
        bivalent: "Biwalentne",
        hydraulic: "Hydrauliczne",
      };
      const presLabels = presentationData?.buffer_cards?.breakdown_chart_labels;
      const labels = {
        antiCycling: presLabels?.antiCycling || labelDefaults.antiCycling,
        bivalent: presLabels?.bivalent || labelDefaults.bivalent,
        hydraulic: presLabels?.hydraulic || labelDefaults.hydraulic,
      };
      let paths = "";
      let legend = "";
      if (vAnti > 0) {
        const percent = (vAnti / total) * 100;
        const dasharray = (percent / 100) * 2 * Math.PI * r;
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors.antiCycling}" stroke-width="12" stroke-dasharray="${dasharray} ${2 * Math.PI * r}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
        legend += `<div class="breakdown-chart-legend-item"><span class="legend-color" style="background: ${colors.antiCycling}"></span><span>${labels.antiCycling}: ${vAnti} L (${Math.round(percent)}%)</span></div>`;
        offset += dasharray;
      }
      if (vBiv > 0) {
        const percent = (vBiv / total) * 100;
        const dasharray = (percent / 100) * 2 * Math.PI * r;
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors.bivalent}" stroke-width="12" stroke-dasharray="${dasharray} ${2 * Math.PI * r}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
        legend += `<div class="breakdown-chart-legend-item"><span class="legend-color" style="background: ${colors.bivalent}"></span><span>${labels.bivalent}: ${vBiv} L (${Math.round(percent)}%)</span></div>`;
        offset += dasharray;
      }
      if (vHyd > 0) {
        const percent = (vHyd / total) * 100;
        const dasharray = (percent / 100) * 2 * Math.PI * r;
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors.hydraulic}" stroke-width="12" stroke-dasharray="${dasharray} ${2 * Math.PI * r}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
        legend += `<div class="breakdown-chart-legend-item"><span class="legend-color" style="background: ${colors.hydraulic}"></span><span>${labels.hydraulic}: ${vHyd} L (${Math.round(percent)}%)</span></div>`;
      }
      return `
        <div class="breakdown-chart">
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="max-width: 120px; height: auto;">
            ${paths}
          </svg>
          <div class="breakdown-chart-legend">${legend}</div>
        </div>
      `;
    }

    // P2.1 Ă˘â‚¬â€ť Renderuje schemat montaÄąÄ˝u SVG
    function renderInstallationDiagram(setupType) {
      const diagramMeta = presentationData?.buffer_cards?.diagram || {};
      const titleSeries =
        diagramMeta.series_bypass_title || "Schemat montażu szeregowego";
      const titleParallel =
        diagramMeta.parallel_clutch_title || "Schemat montażu równoległego";
      if (setupType === "SERIES_BYPASS") {
        return `
        <div class="installation-diagram">
          <svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#666" />
              </marker>
            </defs>
            <text x="150" y="15" text-anchor="middle" font-size="11" font-weight="600" fill="#333">${titleSeries}</text>
            <rect x="20" y="30" width="40" height="60" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5"/>
            <text x="40" y="70" text-anchor="middle" font-size="10" fill="#333">Pompa</text>
            <path d="M 60 60 L 100 60" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>
            <rect x="100" y="25" width="50" height="70" rx="5" fill="#d4a574" fill-opacity="0.2" stroke="#d4a574" stroke-width="2"/>
            <text x="125" y="50" text-anchor="middle" font-size="9" fill="#333">Bufor</text>
            <text x="125" y="65" text-anchor="middle" font-size="9" fill="#333">CO</text>
            <path d="M 150 60 L 190 60" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>
            <rect x="190" y="30" width="50" height="60" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5"/>
            <text x="215" y="70" text-anchor="middle" font-size="10" fill="#333">Instalacja</text>
            <path d="M 125 95 L 125 105 L 80 105 L 80 95" stroke="#666" stroke-width="1.5" fill="none" stroke-dasharray="3,3"/>
            <circle cx="80" cy="100" r="3" fill="#666"/>
            <text x="70" y="115" text-anchor="middle" font-size="8" fill="#666">By-pass</text>
          </svg>
        </div>
        `;
      } else if (setupType === "PARALLEL_CLUTCH") {
        return `
        <div class="installation-diagram">
          <svg viewBox="0 0 300 140" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
            <defs>
              <marker id="arrowhead2" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#666" />
              </marker>
            </defs>
            <text x="150" y="15" text-anchor="middle" font-size="11" font-weight="600" fill="#333">${titleParallel}</text>
            <rect x="20" y="30" width="40" height="60" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5"/>
            <text x="40" y="70" text-anchor="middle" font-size="10" fill="#333">Pompa</text>
            <path d="M 60 50 L 100 50" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead2)"/>
            <path d="M 60 70 L 100 70" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead2)"/>
            <rect x="100" y="20" width="60" height="80" rx="5" fill="#d4a574" fill-opacity="0.2" stroke="#d4a574" stroke-width="2"/>
            <text x="130" y="45" text-anchor="middle" font-size="9" fill="#333">Bufor</text>
            <text x="130" y="60" text-anchor="middle" font-size="9" fill="#333">(sprzęgło</text>
            <text x="130" y="75" text-anchor="middle" font-size="9" fill="#333">hydrauliczne)</text>
            <path d="M 160 50 L 200 50" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead2)"/>
            <path d="M 160 70 L 200 70" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead2)"/>
            <rect x="200" y="30" width="50" height="60" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5"/>
            <text x="225" y="70" text-anchor="middle" font-size="10" fill="#333">Instalacja</text>
            <path d="M 130 100 L 130 110 L 80 110 L 80 100" stroke="#666" stroke-width="1.5" fill="none"/>
            <path d="M 130 100 L 130 110 L 180 110 L 180 100" stroke="#666" stroke-width="1.5" fill="none"/>
            <text x="130" y="125" text-anchor="middle" font-size="8" fill="#666">Równoległe połączenie</text>
          </svg>
        </div>
        `;
      }
      return "";
    }

    // Renderuje kartę bufora CO
    // Opcjonalnie przyjmuje dodatkowy opis separatora i sposób montażu
    function renderBufferCard(
      capacity,
      isRecommended = false,
      allowZero = false,
      separatorInfo = null,
      setupType = null,
      installationNote = null
    ) {
      const bufferData = mergeBufferCatalogFromPresentation({
        50: { title: "Bufor 50L", description: "Zbiornik buforowy 50L. Przeznaczony dla mniejszych instalacji z ograniczoną przestrzenią maszynowni.", dimensions: "Ø400×600", image: null },
        80: { title: "Bufor 80L", description: "Zbiornik buforowy 80L. Kompaktowa pojemność dla małych i średnich instalacji.", dimensions: "Ø450×650", image: null },
        100: { title: "Bufor 100L", description: "Zbiornik buforowy 100L. Standardowa pojemność dla większości instalacji domowych.", dimensions: "Ø500×800", image: null },
        120: { title: "Bufor 120L", description: "Zbiornik buforowy 120L. Optymalny kompromis między pojemnością a wymaganą przestrzenią.", dimensions: "Ø500×900", image: null },
        150: { title: "Bufor 150L", description: "Zbiornik buforowy 150L. Dla instalacji o średnim zapotrzebowaniu.", dimensions: "Ø550×900", image: null },
        200: { title: "Bufor 200L", description: "Zbiornik buforowy 200L. Przeznaczony dla większych instalacji. Zapewnia dłuższe cykle pracy pompy.", dimensions: "Ø600×1000", image: null },
        300: { title: "Bufor 300L", description: "Zbiornik buforowy 300L. Dla większych budynków i systemów z dużym obciążeniem.", dimensions: "Ø700×1100", image: null },
        400: { title: "Bufor 400L", description: "Zbiornik buforowy 400L. Dla rozbudowanych instalacji grzewczych.", dimensions: "Ø750×1200", image: null },
        500: { title: "Bufor 500L", description: "Zbiornik buforowy 500L. Duża pojemność dla budynków o wysokim zapotrzebowaniu.", dimensions: "Ø800×1300", image: null },
        800: { title: "Bufor 800L", description: "Zbiornik buforowy 800L. Dla obiektów wielorodzinnych lub przemysłowych.", dimensions: "Ø900×1500", image: null },
        1000: { title: "Bufor 1000L", description: "Zbiornik buforowy 1000L. Maksymalna pojemność dla wymagających instalacji.", dimensions: "Ø1000×1600", image: null },
      });

      const data = bufferData[capacity];

      // Określ sposób montażu na podstawie setupType
      const instCopy = presentationData?.buffer_cards?.installation_copy || {};
      let installationText = "";
      if (setupType === "SERIES_BYPASS") {
        installationText =
          instCopy.SERIES_BYPASS ||
          'System rekomenduje wpięcie w instalację szeregowo - podłączenie na powrocie z instalacji + by-pass "krótki obieg" z zaworem różnicy ciśnień.';
      } else if (setupType === "PARALLEL_CLUTCH") {
        installationText =
          instCopy.PARALLEL_CLUTCH ||
          "System wskazuje na wpięcie bufora równolegle między pompą ciepła a odbiornikami ciepła - tzw. sprzęgło hydrauliczne. Wymagany dodatkowy zespół pompowy/pompowo-mieszający zostanie uwzględniony w wycenie.";
      } else if (installationNote) {
        installationText = installationNote;
      }

      // Brak per-pojemnościowych plików bufor*.png w wielu wdrożeniach — dom.png jest w pakiecie kalkulatora
      const imgUrl = config?.imgUrl || "../img";
      const imagePath = data?.image || `${imgUrl}/dom.png`;

      if (!data) {
        return `
        <button type="button" class="product-card ui-option ${isRecommended ? "selected" : ""
          }" data-option-id="buffer-${capacity}">
          <div class="product-image">
            <img src="${imagePath}" alt="Bufor ${capacity}L" onerror="this.src='${config?.imgUrl || "../img"
          }/dom.png';" />
          </div>
          <div class="product-content">
            <h4 class="product-title">Bufor ${capacity}L</h4>
            <p class="product-description">${separatorInfo ? separatorInfo : ""
          }Bufor centralnego ogrzewania.</p>
            ${installationText
            ? `<div class="installation-note"><strong>Sposób montażu:</strong> ${installationText}</div>`
            : ""
          }
            <div class="specs-list">
              <div class="spec-row">
                <span class="spec-label">Pojemność</span>
                <span class="spec-value">${capacity} L</span>
              </div>
            </div>
            <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
          </div>
        </button>
      `;
      }

      return `
      <button type="button" class="product-card ui-option ${isRecommended ? "selected" : ""}" data-option-id="buffer-${capacity}">
        <div class="product-image">
          <img src="${imagePath}" alt="${data.title}" onerror="this.src='${config?.imgUrl || "../img"
        }/dom.png';" />
        </div>
        <div class="product-content">
          <h4 class="product-title">${data.title}</h4>
          <p class="product-description">${separatorInfo ? separatorInfo : ""}${data.description
        }</p>
          ${installationText
          ? `<div class="installation-note"><strong>Sposób montażu:</strong> ${installationText}</div>`
          : ""
        }
          ${setupType === "SERIES_BYPASS" || setupType === "PARALLEL_CLUTCH" ? renderInstallationDiagram(setupType) : ""}
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Pojemność</span>
              <span class="spec-value">${capacity} L</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Wymiary</span>
              <span class="spec-value">${data.dimensions}</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcje bufora CO z kartami (pojemnosci z engineering-policy master-data)
    function renderBufferSection(recommendedCapacity, allowZero = false) {
      const rules = getBufferRules();
      const capacities = Array.isArray(rules?.availableCapacities?.buffer)
        ? rules.availableCapacities.buffer
        : [50, 80, 100, 120, 150, 200, 300, 400, 500, 800, 1000];
      let cards = "";

      capacities.forEach((capacity) => {
        const isRecommended = capacity === recommendedCapacity;
        cards += renderBufferCard(capacity, isRecommended, allowZero);
      });

      // Opcja "Bez bufora" tylko jeÄąâ€şli allowZero
      if (allowZero && recommendedCapacity === 0) {
        cards += `
        <button type="button" class="product-card ui-option" data-option-id="buffer-0">
          <div class="product-content">
            <span class="product-subtitle">Opcja specjalna</span>
            <h4 class="product-title">Bez bufora</h4>
            <p class="product-description">Tylko dla specyficznych instalacji po konsultacji.</p>
            <div class="specs-list">
              <div class="spec-row">
                <span class="spec-label">Uwaga</span>
                <span class="spec-value">Wymaga konsultacji</span>
              </div>
            </div>
            <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
          </div>
        </button>
      `;
      }

      return cards;
    }

    /* ==========================================================================
     HYDRAULICS INPUTS STEP (UI) — zapis do sessionStorage.config_data.hydraulics_inputs
     ========================================================================== */

    function syncHydraulicsInputsUi() {
      const completionState = getHydraulicsInputsCompletionState();
      const inputs = completionState.inputs;
      const bivalentTypeMissing =
        inputs.bivalent_enabled && !inputs.bivalent_source_type;

      const typeWrap = dom.byId("hydraulics-bivalent-type-wrap");
      if (typeWrap) {
        typeWrap.style.display = inputs.bivalent_enabled ? "" : "none";
      }

      const powerWrap = dom.byId("hydraulics-bivalent-power-wrap");
      if (powerWrap) {
        const showPower =
          inputs.bivalent_enabled &&
          (inputs.bivalent_source_type === "solid_fuel" ||
            inputs.bivalent_source_type === "fireplace_water_jacket");
        powerWrap.style.display = showPower ? "" : "none";
      }

      const bivalentSourceEl = dom.byId("hydraulics-bivalent-source-type");
      if (bivalentSourceEl) {
        bivalentSourceEl.classList.toggle("is-invalid", bivalentTypeMissing);
        bivalentSourceEl.setAttribute(
          "aria-invalid",
          bivalentTypeMissing ? "true" : "false"
        );
      }

      if (typeWrap) {
        let inlineAlert = typeWrap.querySelector('[data-role="hydraulics-inline-alert"]');
        if (bivalentTypeMissing) {
          if (!inlineAlert) {
            inlineAlert = doc.createElement("p");
            inlineAlert.className = "form-inline-alert";
            inlineAlert.setAttribute("data-role", "hydraulics-inline-alert");
            inlineAlert.textContent =
              "Wybierz typ drugiego źródła, aby policzyć konfigurację bufora.";
            const anchor = powerWrap || null;
            if (anchor) {
              typeWrap.insertBefore(inlineAlert, anchor);
            } else {
              typeWrap.appendChild(inlineAlert);
            }
          }
        } else if (inlineAlert) {
          inlineAlert.remove();
        }
      }

      const shell = root.querySelector(
        '[data-step-key="hydraulics_inputs"] .hydraulics-form-shell'
      );
      if (shell) {
        let topAlert = shell.querySelector('[data-role="hydraulics-top-alert"]');
        if (completionState.shouldBlockRecommendation && completionState.message) {
          if (!topAlert) {
            topAlert = doc.createElement("p");
            topAlert.className = "form-inline-alert hydraulics-inline-alert--top";
            topAlert.setAttribute("data-role", "hydraulics-top-alert");
            topAlert.style.margin = "0 0 12px 0";
            shell.insertBefore(topAlert, shell.firstChild);
          }
          topAlert.textContent = completionState.message;
        } else if (topAlert) {
          topAlert.remove();
        }
      }

      updateNavButtons();
    }

    function bindHydraulicsInputsHandlers() {
      const hasActuatorsEl = dom.byId("hydraulics-has-underfloor-actuators");
      const radiatorsIsHtEl = dom.byId("hydraulics-radiators-is-ht");
      const bivalentEnabledEl = dom.byId("hydraulics-bivalent-enabled");
      const bivalentSourceEl = dom.byId("hydraulics-bivalent-source-type");

      if (hasActuatorsEl) {
        trackEvent(hasActuatorsEl, "change", () => {
          setHydraulicsInputs({
            has_underfloor_actuators: !!hasActuatorsEl.checked,
          });
          updateNavButtons();
          requestRecompute();
        });
      }
      if (radiatorsIsHtEl) {
        trackEvent(radiatorsIsHtEl, "change", () => {
          setHydraulicsInputs({ radiators_is_ht: !!radiatorsIsHtEl.checked });
          updateNavButtons();
          requestRecompute();
        });
      }
      if (bivalentEnabledEl) {
        trackEvent(bivalentEnabledEl, "change", () => {
          const enabled = !!bivalentEnabledEl.checked;
          const currentInputs = getHydraulicsInputs();
          setHydraulicsInputs({
            bivalent_enabled: enabled,
            bivalent_source_type: enabled
              ? currentInputs?.bivalent_source_type || null
              : null,
            bivalent_source_power_kw: enabled
              ? currentInputs?.bivalent_source_power_kw ?? null
              : null,
          });
          if (!enabled && bivalentSourceEl) {
            bivalentSourceEl.value = "";
          }
          syncHydraulicsInputsUi();
          requestRecompute();
        });
      }
      if (bivalentSourceEl) {
        trackEvent(bivalentSourceEl, "change", () => {
          const v = bivalentSourceEl.value || null;
          setHydraulicsInputs({ bivalent_source_type: v });
          if (v !== "solid_fuel" && v !== "fireplace_water_jacket") {
            setHydraulicsInputs({ bivalent_source_power_kw: null });
            const powerInput = dom.byId("hydraulics-bivalent-source-power");
            if (powerInput) {
              powerInput.value = "";
            }
          }
          syncHydraulicsInputsUi();
          requestRecompute();
        });
      }

      const bivalentPowerEl = dom.byId("hydraulics-bivalent-source-power");
      if (bivalentPowerEl) {
        trackEvent(bivalentPowerEl, "input", () => {
          const v = bivalentPowerEl.value;
          const numValue = v === "" ? null : Number(v);
          const validatedValue =
            numValue == null
              ? null
              : isNaN(numValue)
                ? null
                : Math.max(1, Math.min(50, numValue));
          setHydraulicsInputs({ bivalent_source_power_kw: validatedValue });
          updateNavButtons();
          requestRecompute();
        });
      }
    }

    function renderHydraulicsInputsGrid() {
      const completionState = getHydraulicsInputsCompletionState();
      const inputs = completionState.inputs;
      const showUnderfloorActuators =
        completionState.showUnderfloorActuators;
      const showRadiatorsHT = completionState.showRadiatorsHT;
      const bivalentTypeMissing =
        inputs.bivalent_enabled && !inputs.bivalent_source_type;

      const underfloorActuatorsCard = showUnderfloorActuators
        ? `
        <div class="form-field-item">
          <label class="form-label">Siłowniki / sterowanie strefowe</label>
          <div class="form-field">
            <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;">
              <input id="hydraulics-has-underfloor-actuators" type="checkbox" style="margin-top:4px;width:20px;height:20px;flex-shrink:0;" ${inputs.has_underfloor_actuators ? "checked" : ""
        } />
            <span>
              Czy instalacja posiada siłowniki lub termostaty pokojowe sterujące pętlami ogrzewania podłogowego?
                <p class="micro-note" style="margin: 8px 0 0 0;">
                Jeżeli obiegi mogą się domknąć, silnik bufora musi zapewnić ochronę minimalnego przepływu.
                </p>
            </span>
          </label>
          </div>
        </div>
      `
        : "";

      const radiatorsHTCard = showRadiatorsHT
        ? `
        <div class="form-field-item">
          <label class="form-label">Grzejniki wysokotemperaturowe (HT)</label>
          <div class="form-field">
            <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;">
              <input id="hydraulics-radiators-is-ht" type="checkbox" style="margin-top:4px;width:20px;height:20px;flex-shrink:0;" ${inputs.radiators_is_ht ? "checked" : ""
        } />
                <span>
                  Czy instalacja wykorzystuje grzejniki wysokotemperaturowe (HT)?
                <p class="micro-note" style="margin: 8px 0 0 0;">
                    Zaznacz, jeżeli układ pracuje na wysokich temperaturach zasilania typowych dla starszych instalacji grzejnikowych.
                </p>
                </span>
              </label>
          </div>
        </div>
      `
        : "";

      const bivalentCard = `
      <div class="form-field-item">
        <label class="form-label">Biwalencja</label>
        <div class="form-field">
          <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;margin-bottom:16px;">
            <input id="hydraulics-bivalent-enabled" type="checkbox" style="margin-top:4px;width:20px;height:20px;flex-shrink:0;" ${inputs.bivalent_enabled ? "checked" : ""
        } />
          <span>Czy instalacja posiada dodatkowe źródło ciepła (biwalencja)?</span>
        </label>
          <div id="hydraulics-bivalent-type-wrap" class="hydraulics-subfield" style="${inputs.bivalent_enabled ? "" : "display:none;"
        }">
            <label for="hydraulics-bivalent-source-type" class="hydraulics-subfield__label">Typ drugiego źródła</label>
            <select id="hydraulics-bivalent-source-type" class="form-select ${bivalentTypeMissing ? "is-invalid" : ""
        }" aria-invalid="${bivalentTypeMissing ? "true" : "false"}">
            <option value="" ${inputs.bivalent_source_type ? "" : "selected"
        }>— wybierz —</option>
            <option value="gas" ${inputs.bivalent_source_type === "gas" ? "selected" : ""
        }>Gaz</option>
            <option value="solid_fuel" ${inputs.bivalent_source_type === "solid_fuel" ? "selected" : ""
        }>Kocioł stałopalny (węgiel/pellet/drewno)</option>
            <option value="fireplace_water_jacket" ${inputs.bivalent_source_type === "fireplace_water_jacket"
          ? "selected"
          : ""
        }>Kominek z płaszczem wodnym</option>
          </select>
            <p class="micro-note" style="margin: 8px 0 0 0;">
            Dla źródeł stałopalnych i kominków z płaszczem wodnym bufor i sprzęgło hydrauliczne są wymagane ze względów bezpieczeństwa.
            </p>
            ${bivalentTypeMissing
          ? `<p class="form-inline-alert" data-role="hydraulics-inline-alert">Wybierz typ drugiego źródła, aby policzyć konfigurację bufora.</p>`
          : ""
        }
            <div id="hydraulics-bivalent-power-wrap" class="hydraulics-subfield hydraulics-subfield--nested" style="${inputs.bivalent_enabled &&
          (inputs.bivalent_source_type === "solid_fuel" ||
            inputs.bivalent_source_type === "fireplace_water_jacket")
          ? ""
          : "display:none;"
        }">
              <label for="hydraulics-bivalent-source-power" class="hydraulics-subfield__label">
                Moc drugiego źródła [kW]
              </label>
              <input
                type="number"
                id="hydraulics-bivalent-source-power"
                class="form-input"
                min="1"
                max="50"
                step="0.5"
                value="${inputs.bivalent_source_power_kw != null
          ? inputs.bivalent_source_power_kw
          : ""
        }"
                placeholder="—"
              />
              <p class="micro-note" style="margin: 8px 0 0 0;">
                Pole opcjonalne. Gdy mocy nie znasz, przyjmiemy wartość bezpieczną i nadal policzymy bufor.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

      const alertBlock =
        completionState.shouldBlockRecommendation && completionState.message
          ? `<p class="form-inline-alert hydraulics-inline-alert--top" data-role="hydraulics-top-alert" style="margin:0 0 12px 0;">${completionState.message}</p>`
          : "";
      return `
      <div class="hydraulics-form-shell">
        ${alertBlock}
        <div class="form-row-mosaic form-card hydraulics-inputs-mosaic">
          ${underfloorActuatorsCard}
          ${radiatorsHTCard}
          ${bivalentCard}
        </div>
      </div>
    `;
    }

    function renderHydraulicsInputsStep() {
      const grid = dom.byId("hydraulics-inputs-grid");
      if (!grid) return;
      grid.innerHTML = renderHydraulicsInputsGrid();
      bindHydraulicsInputsHandlers();
      const stepEl = grid.closest(".config-step");
      sanitizeConfiguratorDom(stepEl || grid);
    }

    /* ==========================================================================
     HYDRAULICS CO RENDERING (UI) Ă˘â‚¬â€ť renderuje WYÄąÂĂ„â€žCZNIE z hydraulicsRecommendation
     ========================================================================== */

    function renderHydraulicsCOCard(hr) {
      if (!hr) return "";

      const badge =
        hr.severity === "MANDATORY"
          ? '<span class="badge-recommended">WYMAGANE</span>'
          : hr.severity === "RECOMMENDED"
            ? '<span class="badge-recommended">ZALECANE</span>'
            : '<span class="badge-recommended">INFO</span>';

      const pumpOptionIdLegacy = state?.selectedPump?.optionId || null;
      const pumpDataLegacy = pumpOptionIdLegacy
        ? pumpMatchingTable[pumpOptionIdLegacy]
        : null;
      const pumpPowerLegacy = Number(
        pumpDataLegacy?.power || state?.selectedPump?.power_kw || 0
      );
      const separatorSizeClass =
        pumpPowerLegacy < 7
          ? "small"
          : pumpPowerLegacy < 15
            ? "medium"
            : "large";

      let optionId = "hydraulics-none";
      let title = "Brak bufora i sprzęgła";
      let subtitle =
        "Instalacja bez dodatkowych komponentów hydraulicznych. Zapas wody w instalacji jest wystarczający.";

      if (hr.recommendation === "BUFOR_SZEREGOWO") {
        optionId = `buffer-${hr.buffer_liters || 0}`;
        title = `Bufor szeregowo ${hr.buffer_liters || "—"} L`;
        subtitle = "Szeregowo z zaworem różnicowym na by-passie";
      } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
        optionId = `buffer-${hr.buffer_liters || 0}`;
        title = `Bufor równolegle ${hr.buffer_liters || "—"} L`;
        subtitle = "Sprzęgło hydrauliczne (separacja obiegów)";
      }

      return `
      <button type="button" class="product-card ui-option" data-option-id="${optionId}">
        <div class="product-content">
          ${badge}
          <span class="product-subtitle">${subtitle}</span>
          <h4 class="product-title">${title}</h4>
          <p class="product-description">${hr.explanation?.short || ""}</p>
          <div class="specs-list">
            <div class="spec-row">
              <span class="spec-label">Oś: przepływ</span>
              <span class="spec-value">${hr.axes?.flow_protection || "—"}</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Oś: separacja</span>
              <span class="spec-value">${hr.axes?.hydraulic_separation || "—"
        }</span>
            </div>
            <div class="spec-row">
              <span class="spec-label">Oś: magazyn</span>
              <span class="spec-value">${hr.axes?.energy_storage || "—"}</span>
            </div>
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    /** Zwraca tylko rekomendowanĂ„â€¦ pojemność bufora do wyÄąâ€şwietlenia (jedna karta). */
    function getBufferCapacitiesToShow(recommendedCapacity) {
      return [recommendedCapacity];
    }

    function renderHydraulicsPreview(hr) {
      const previewEl = root.querySelector('[data-role="hydraulics-preview"]');
      const contentEl = root.querySelector('[data-role="hydraulics-preview-content"]');
      if (!previewEl || !contentEl) return;
      if (!hr) {
        previewEl.classList.add("is-hidden");
        contentEl.innerHTML = "";
        return;
      }
      previewEl.classList.remove("is-hidden");
      const typ = hr.recommendation === "NONE" ? "Bufor nie wymagany" : hr.recommendation === "BUFOR_SZEREGOWO" ? "Bufor szeregowo" : hr.recommendation === "BUFOR_RÓWNOLEGLE" ? "Bufor równolegle" : hr.recommendation || "—";
      const pojemnosc = hr.buffer_liters ? `${hr.buffer_liters} L` : "—";
      const montaz = hr.setupType === "SERIES_BYPASS" ? "Szeregowo z by-passem" : hr.setupType === "PARALLEL_CLUTCH" ? "Równolegle (sprzęgło hydrauliczne)" : "—";
      let dlaczego = "";
      if (hr.sizingComponents && hr.dominant && hr.sizingComponents[hr.dominant]) {
        const comp = hr.sizingComponents[hr.dominant];
        dlaczego = comp.rationale || hr.dominantReason || "";
      } else {
        dlaczego = hr.dominantReason || hr.explanation?.short || "";
      }
      contentEl.innerHTML = `
        <p class="recommendation-preview__summary"><strong>${typ}</strong>${pojemnosc !== "—" ? ` · ${pojemnosc}` : ""}${montaz !== "—" ? ` · ${montaz}` : ""}</p>
        ${dlaczego ? `<p class="recommendation-preview__why">${dlaczego}</p>` : ""}
      `;
    }

    /**
     * Renderuje blok "Dlaczego ten bufor?" pod kartĂ„â€¦ bufora.
     * Multi-instance: tylko root/bufferStep. Idempotent: data-role="buffer-explain".
     * ÄąÄ…rÄ‚Ĺ‚dÄąâ€šo typu: hr.recommendation + hr.setupType. Powody: hr.dominant, hr.sizingComponents + getHydraulicsInputs() (strefowanie/mixed/biwalencja).
     */
    function renderHydraulicsPendingState(snapshot = null) {
      const bufferStep =
        root.querySelector('[data-step-key="bufor"]') ||
        dom.qs('[data-step-key="bufor"]');
      if (!bufferStep) return;

      const completionState =
        snapshot?.hydraulicsCompletion || getHydraulicsInputsCompletionState();
      const needsInput =
        snapshot?.source === "input_required" ||
        completionState.shouldBlockRecommendation;
      const subtitle = needsInput
        ? "Potrzebujemy doprecyzowania instalacji"
        : "Oczekiwanie na wynik backendu";
      const title = needsInput
        ? "Uzupełnij dane hydrauliki przed wyborem bufora"
        : "Rekomendacja bufora w przygotowaniu";
      const description = needsInput
        ? completionState.message
        : "Konfigurator czeka na odświeżenie oferty z backendu. Wariant hydrauliki pojawi się po otrzymaniu kanonicznego OfferDTO.";

      clearSelectionState("bufor");
      bufferStep.setAttribute("data-buffer-state", "pending");

      const optionsGrid = bufferStep.querySelector(".options-grid");
      if (optionsGrid) {
        optionsGrid.classList.remove("grid-3-col");
        optionsGrid.innerHTML = `
          <div class="product-card disabled" data-role="hydraulics-pending" aria-busy="true">
            <div class="product-content">
              <span class="product-subtitle">${subtitle}</span>
              <h4 class="product-title">${title}</h4>
              <p class="product-description">${description}</p>
              <p class="product-description">${completionState.summaryLabel || ""}</p>
            </div>
          </div>
        `;
      }

      const sectionDescription = bufferStep.querySelector(".section-description");
      if (sectionDescription) {
        sectionDescription.textContent = description;
      }

      const breakdownEl = bufferStep.querySelector(".buffer-breakdown");
      if (breakdownEl) {
        breakdownEl.innerHTML = "";
        breakdownEl.classList.add("is-hidden");
      }
      renderBufferExplain(null);
      renderHydraulicsPreview(null);
      updateNavButtons();
    }

    function renderCanonicalHydraulicsUi(evaluated) {
      const snapshot = getCanonicalHydraulicsRenderSnapshot(evaluated);
      if (hydraulicsPreviewDebounceId != null) {
        clearTimeout(hydraulicsPreviewDebounceId);
        hydraulicsPreviewDebounceId = null;
      }
      if (!snapshot.recommendation) {
        renderHydraulicsPendingState(snapshot);
        return snapshot;
      }
      renderHydraulicsCOSectionFromRecommendation(snapshot.recommendation);
      const recommendation = snapshot.recommendation;
      hydraulicsPreviewDebounceId = setTimeout(() => {
        renderHydraulicsPreview(recommendation);
        hydraulicsPreviewDebounceId = null;
      }, 500);
      return snapshot;
    }

    function mapBufferReasonCodeToUiLabel(code) {
      switch (String(code || "").trim().toUpperCase()) {
        case "INSUFFICIENT_SYSTEM_VOLUME":
          return "za mały zapas wody w instalacji względem minimum pracy pompy";
        case "MANUFACTURER_3PH_K_200L":
          return null;
        case "FLOW_RISK_UNDERFLOOR_ACTUATORS":
          return "strefowanie / siłowniki mogą chwilowo zamykać przepływ";
        case "MIXED_CIRCUITS_SEPARATION":
          return "układ mieszany wymaga separacji hydraulicznej";
        case "BIVALENT_SOLID_FUEL":
          return "drugie źródło na paliwo stałe wymaga magazynu energii";
        case "BIVALENT_FIREPLACE_WATER_JACKET":
          return "kominek z płaszczem wodnym wymaga bufora i separacji";
        case "ANTI_CYCLING_STORAGE_REQUIRED":
          return "bufor ogranicza taktowanie przy niskim obciążeniu";
        case "BUFFER_NOT_REQUIRED":
          return "zapas wody w instalacji wystarcza — bufor nie jest wymagany";
        default:
          return null;
      }
    }

    function buildBufferSectionDescription(hr) {
      if (!hr || typeof hr !== "object") {
        return "Konfiguracja bufora zostanie pokazana po otrzymaniu backendowej rekomendacji.";
      }

      const setupType = String(hr?.setupType || "NONE").toUpperCase();
      const liters = toFiniteNumber(hr?.buffer_liters, 0);
      const requiredSystemVolume = toFiniteNumber(hr?.requiredSystemVolume, null);
      const estimatedSystemVolume = toFiniteNumber(hr?.estimatedSystemVolume, null);
      const systemVolumeSufficient =
        typeof hr?.systemVolumeSufficient === "boolean"
          ? hr.systemVolumeSufficient
          : null;
      const reasonLabels = Array.from(
        new Set(
          (Array.isArray(hr?.reason_codes) ? hr.reason_codes : [])
            .map((code) => mapBufferReasonCodeToUiLabel(code))
            .filter(Boolean)
        )
      );

      if (setupType === "NONE" || !setupType) {
        const sufficiencyText =
          systemVolumeSufficient === true &&
            estimatedSystemVolume !== null &&
            requiredSystemVolume !== null
            ? `Szacowany zapas wody w instalacji (${estimatedSystemVolume} l) pokrywa wymagane minimum (${requiredSystemVolume} l).`
            : "Dla tego układu bufor nie jest wymagany.";
        return `${sufficiencyText} Instalacja może pracować bez dodatkowego zbiornika buforowego.`;
      }

      const marketL =
        hr.marketCapacityLiters != null
          ? toFiniteNumber(hr.marketCapacityLiters, null)
          : null;
      const policyMin =
        hr.manufacturerPolicyMinimumLiters != null
          ? toFiniteNumber(hr.manufacturerPolicyMinimumLiters, null)
          : null;
      const policyApplied = !!hr.manufacturerPolicyApplied;

      const intro =
        setupType === "PARALLEL_CLUTCH"
          ? "Rekomendacja: bufor równolegle."
          : "Rekomendacja: bufor szeregowo z obejściem (bypass).";
      const reasonsText =
        reasonLabels.length > 0
          ? `Czynniki doboru: ${reasonLabels.join("; ")}.`
          : "";
      const volumeText =
        systemVolumeSufficient === false &&
          estimatedSystemVolume !== null &&
          requiredSystemVolume !== null
          ? `Hydraulika: szacowany zapas instalacji to ${estimatedSystemVolume} l (poniżej wymaganego minimum ${requiredSystemVolume} l — potrzebny bufor).`
          : "";
      const sizingLine =
        marketL != null && Number.isFinite(marketL)
          ? `Z obliczeń wynika nominacja ok. ${Math.round(marketL)} l (asortyment / zaokrąglenie).`
          : "";
      const policyLine =
        policyApplied && policyMin != null && liters > 0
          ? `Rekomendowana pojemność: ${Math.round(liters)} l.`
          : liters > 0
            ? `Rekomendowana pojemność: ${Math.round(liters)} l.`
            : "";

      return [intro, reasonsText, volumeText, sizingLine, policyLine]
        .filter((part) => typeof part === "string" && part.trim() !== "")
        .join(" ");
    }

    // Detailed rationale block for the currently rendered hydraulics recommendation.
    function renderBufferExplain(hr) {
      const bufferStep = root.querySelector('[data-step-key="bufor"]') || dom.qs('[data-step-key="bufor"]');
      if (!bufferStep) return;
      let explainEl = bufferStep.querySelector('[data-role="buffer-explain"]');
      if (!explainEl) {
        explainEl = doc.createElement("div");
        explainEl.className = "buffer-explain";
        explainEl.setAttribute("data-role", "buffer-explain");
        const optionsGrid = bufferStep.querySelector(".options-grid");
        if (optionsGrid) optionsGrid.after(explainEl);
        else bufferStep.appendChild(explainEl);
      }
      if (!hr) {
        explainEl.innerHTML = "";
        explainEl.classList.add("is-hidden");
        return;
      }
      const inputs = getHydraulicsInputs() || {};
      const heatingType = state?.meta?.heating_type || state?.meta?.installation_type || "";
      const strefowanie = !!inputs.has_underfloor_actuators;
      const mixed = heatingType === "mixed";
      const biwalencja = !!inputs.bivalent_enabled;
      const setupType = hr?.setupType || (hr?.recommendation === "BUFOR_SZEREGOWO" ? "SERIES_BYPASS" : hr?.recommendation === "BUFOR_RÓWNOLEGLE" ? "PARALLEL_CLUTCH" : "NONE");
      const dominant = hr?.dominant || null;
      const liters = hr?.buffer_liters;

      let html = "";
      if (setupType === "NONE" || !setupType) {
        html += "<h4 class=\"buffer-explain__title\">Dlaczego bez bufora?</h4>";
        html += "<p class=\"buffer-explain__lead\">Dla tego układu bufor nie jest wymagany: instalacja ma wystarczający zapas i nie ma przesłanek do separacji hydraulicznej.</p>";
        if (!strefowanie && !mixed && !biwalencja) {
          html += "<p class=\"buffer-explain__detail\">Brak strefowania, brak obiegów mieszanych i brak drugiego źródła.</p>";
        }
        html += "<div class=\"buffer-explain__benefits\">";
        html += "<strong>Korzyści instalacji bez bufora:</strong>";
        html += "<ul class=\"buffer-explain__list\">";
        html += "<li>Niższe koszty inwestycyjne — brak dodatkowego komponentu</li>";
        html += "<li>Prostsza instalacja — mniej elementów do montażu</li>";
        html += "<li>Mniejsze straty ciepła — brak dodatkowego zbiornika</li>";
        html += "<li>Mniejsza przestrzeń wymagana w maszynowni</li>";
        html += "<li>Wyższa sprawność systemu — bezpośrednie połączenie pompy z odbiornikami</li>";
        html += "</ul>";
        html += "</div>";
        html += "<p class=\"buffer-explain__benefit\"><strong>Co to daje?</strong> Prostszy układ, mniej elementów, niższy koszt, bez pogorszenia pracy pompy.</p>";
      } else if (setupType === "SERIES_BYPASS") {
        html += "<h4 class=\"buffer-explain__title\">Dlaczego bufor szeregowo?</h4>";
        html += "<ul class=\"buffer-explain__list\">";
        if (strefowanie) html += "<li>Strefowanie/siłowniki mogą domykać przepływ — bufor stabilizuje pracę źródła.</li>";
        if (dominant === "hydraulic") html += "<li>Instalacja ma zbyt mały zapas — bufor uzupełnia brakującą objętość.</li>";
        if (dominant === "antiCycling") html += "<li>Zmniejsza ryzyko taktowania — wydłuża cykle pracy przy niskim obciążeniu.</li>";
        if (!strefowanie && dominant !== "hydraulic" && dominant !== "antiCycling") html += "<li>Bufor szeregowo z by-passem zapewnia stabilną hydraulikę i ogranicza taktowanie.</li>";
        html += "</ul>";
        if (liters) html += "<p class=\"buffer-explain__capacity\">Rekomendowana pojemność: <strong>" + liters + " L</strong></p>";
        html += "<p class=\"buffer-explain__benefit\"><strong>Co to daje?</strong> Stabilniejsza hydraulika, mniej taktowania, lepsza kultura pracy.</p>";
      } else {
        html += "<h4 class=\"buffer-explain__title\">Dlaczego bufor równolegle?</h4>";
        html += "<ul class=\"buffer-explain__list\">";
        if (mixed) html += "<li>Obiegi mieszane wymagają separacji hydraulicznej — niezależność przepływów źródła i instalacji.</li>";
        if (biwalencja) html += "<li>Drugie źródło ciepła — bufor ułatwia współpracę i magazynuje energię.</li>";
        if (dominant === "bivalent") html += "<li>Wymagany magazyn energii dla biwalencji.</li>";
        if (!mixed && !biwalencja && dominant !== "bivalent") html += "<li>Bufor równolegle pełni rolę sprzęgła hydraulicznego i zapewnia separację obiegów.</li>";
        html += "</ul>";
        if (liters) html += "<p class=\"buffer-explain__capacity\">Rekomendowana pojemność: <strong>" + liters + " L</strong></p>";
        html += "<p class=\"buffer-explain__benefit\"><strong>Co to daje?</strong> Separacja przepływów, bezpieczna biwalencja, stabilna praca.</p>";
      }
      explainEl.innerHTML = html;
      explainEl.classList.remove("is-hidden");
    }

    function renderHydraulicsCOSectionFromRecommendation(hr) {
      const bufferStep = root.querySelector('[data-step-key="bufor"]') || dom.qs('[data-step-key="bufor"]');
      if (!bufferStep) return;
      const optionsGrid = bufferStep.querySelector(".options-grid");
      if (!optionsGrid) return;
      bufferStep.setAttribute("data-buffer-state", "ready");

      // Ă˘Ĺ›â€¦ Renderuj TYLKO jednĂ„â€¦ kartę zgodnie z rekomendacjĂ„â€¦ logiki bufora
      const recommendedCapacity = hr.buffer_liters || 0;
      let cards = "";

      // Decyzja na podstawie rekomendacji (NOWE: 3 typy)
      if (hr.recommendation === "NONE" || recommendedCapacity === 0) {
        // Brak bufora - renderuj kartę "Bez bufora" z informacjami o korzyÄąâ€şciach
        cards = `
        <button type="button" class="product-card ui-option" data-option-id="buffer-0">
          <div class="product-image">
            <img src="${config?.imgUrl || "../img"
          }/dom.png" alt="Instalacja bez bufora" />
            <span class="badge-recommended">✓ Optymalne rozwiązanie</span>
          </div>
          <div class="product-content">
            <span class="product-subtitle">Rekomendacja systemu</span>
            <h4 class="product-title">Bufor nie wymagany</h4>
            <p class="product-description">
              Zbiornik buforowy nie jest wymagany. Zapas wody w instalacji zapewnia stabilną pracę pompy ciepła i prawidłowy defrost.
            </p>
            <div class="specs-list">
              <div class="spec-row">
                <span class="spec-label">Uzasadnienie</span>
                <span class="spec-value">${hr.dominantReason || "Zapas wystarczający"
          }</span>
              </div>
            </div>
            <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
          </div>
        </button>
      `;
      } else if (
        hr.recommendation === "BUFOR_SZEREGOWO" &&
        recommendedCapacity > 0
      ) {
        const setupType = hr.setupType || "SERIES_BYPASS";
        const capacitiesToShow = getBufferCapacitiesToShow(recommendedCapacity);
        cards = capacitiesToShow
          .map((cap) =>
            renderBufferCard(
              cap,
              cap === recommendedCapacity,
              false,
              null,
              setupType,
              null
            )
          )
          .join("");
      } else if (
        hr.recommendation === "BUFOR_RÓWNOLEGLE" &&
        recommendedCapacity > 0
      ) {
        const setupType = hr.setupType || "PARALLEL_CLUTCH";
        const capacitiesToShow = getBufferCapacitiesToShow(recommendedCapacity);
        cards = capacitiesToShow
          .map((cap) =>
            renderBufferCard(
              cap,
              cap === recommendedCapacity,
              false,
              null,
              setupType,
              null
            )
          )
          .join("");
      } else {
        // Fallback - jeÄąâ€şli nie ma jasnej rekomendacji, użyj rekomendowanej pojemnoÄąâ€şci
        if (recommendedCapacity > 0) {
          cards = renderBufferCard(recommendedCapacity, true, false);
        } else {
          // JeÄąâ€şli brak pojemnoÄąâ€şci, pokaÄąÄ˝ "Bez bufora"
          cards = `
          <button type="button" class="product-card ui-option" data-option-id="buffer-0">
            <div class="product-content">
              <span class="product-subtitle">Opcja specjalna</span>
              <h4 class="product-title">Bez bufora</h4>
              <p class="product-description">Zbiornik buforowy nie jest wymagany. Zapas wody w instalacji zapewnia stabilną pracę pompy ciepła i prawidłowy defrost.</p>
              <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
            </div>
          </button>
        `;
        }
      }

      optionsGrid.innerHTML = cards;
      if (!state.selections?.bufor?.optionId) {
        const recommendedCard = optionsGrid.querySelector(
          ".product-card, .option-card"
        );
        const recommendedOptionId =
          recommendedCard?.getAttribute("data-option-id") ||
          recommendedCard?.dataset?.optionId ||
          null;
        if (recommendedOptionId) {
          UICallbacks.autoSelect(recommendedOptionId);
        }
      }
      syncSelectionForStep("bufor");
      if (hr.recommendation === "BUFOR_SZEREGOWO" || hr.recommendation === "BUFOR_RÓWNOLEGLE") {
        optionsGrid.classList.add("grid-3-col");
      } else {
        optionsGrid.classList.remove("grid-3-col");
      }

      let breakdownEl = bufferStep.querySelector(".buffer-breakdown");
      if (!breakdownEl) {
        breakdownEl = doc.createElement("div");
        breakdownEl.className = "buffer-breakdown";
        optionsGrid.after(breakdownEl);
      }
      breakdownEl.innerHTML = "";
      breakdownEl.classList.add("is-hidden");

      // Ä‘Ĺşâ€śĹ  KROK 3: BUFOR CO Ă˘â‚¬â€ť SzczegÄ‚Ĺ‚Äąâ€šowe logowanie
      if (debug.__DEBUG_CONFIGURATOR) {
        if (hr.sizing) {
        }

        if (hr.recommendation === "NONE") {
        } else if (hr.recommendation === "BUFOR_SZEREGOWO") {
        } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
        }
      }

      // USUNIĂ„ÂTO: Auto-wybieranie rekomendowanej karty - uÄąÄ˝ytkownik musi sam wybraĂ„â€ˇ
      // Ă˘Ĺ›â€¦ PrzywrÄ‚Ĺ‚Ă„â€ˇ wybÄ‚Ĺ‚r użytkownika jeÄąâ€şli istnieje
      const existingBufferSelection = state.selections.bufor;
      if (existingBufferSelection && existingBufferSelection.optionId) {
        const selectedCard = optionsGrid.querySelector(
          `[data-option-id="${existingBufferSelection.optionId}"]`
        );
        if (selectedCard) {
          selectedCard.classList.add("selected");
          // NIE wywoÄąâ€šuj captureSelectionForCard - selekcja juÄąÄ˝ jest w state
        }
      }

      // Ă˘Ĺ›â€¦ PrzenieÄąâ€ş recommendation-note do section-description (jak w kroku 1)
      const sectionDescription = bufferStep.querySelector(
        ".section-description"
      );
      if (sectionDescription) {
        // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
        const existingNote = bufferStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        let descriptionText = "";

        if (hr.recommendation === "BUFOR_SZEREGOWO") {
          descriptionText = `Ze względu na ryzyko automatycznego zamknięcia obiegu przez sterowniki pokojowe wymagany jest zbiornik buforowy. Rekomendacja: bufor wpięty szeregowo — podłączenie na powrocie z instalacji z by-passem i zaworem różnicy ciśnienia.`;
        } else if (hr.recommendation === "BUFOR_RÓWNOLEGLE") {
          descriptionText = `System rekomenduje zbiornik buforowy ${recommendedCapacity} L — separacja obiegów/źródeł + magazyn energii.`;
        } else {
          descriptionText =
            "Zbiornik buforowy nie jest wymagany. Zapas wody w instalacji zapewnia stabilną pracę pompy ciepła i prawidłowy defrost.";
        }

        sectionDescription.textContent = descriptionText;
        sectionDescription.textContent = buildBufferSectionDescription(hr);
      }

      renderBufferExplain(hr);
    }

    // Renderuje kartę cyrkulacji CWU
    function renderCirculationCard(type, isRecommended = false) {
      const fallback = {
        tak: {
          title: "Z cyrkulacją CWU",
          description:
            "System cyrkulacji zapewnia natychmiastowy dostęp do ciepłej wody w punktach czerpalnych. Wymaga dodatkowego zużycia energii.",
          optionId: "cyrkulacja-tak",
        },
        nie: {
          title: "Bez cyrkulacji",
          description:
            "Instalacja bez cyrkulacji. Niższe koszty eksploatacji, wymaga krótkiego czasu oczekiwania na ciepłą wodę.",
          optionId: "cyrkulacja-nie",
        },
      };
      const row = presentationData?.circulation_cwu?.[type];
      const base = fallback[type];
      const cardData = row && typeof row === "object"
        ? {
          title: row.title || base.title,
          description: row.description || base.description,
          optionId: row.option_id || base.optionId,
        }
        : base;
      if (!cardData) return "";

      return `
      <button type="button" class="product-card ui-option" data-option-id="${cardData.optionId
        }">
        <div class="product-content">
          <h4 class="product-title">${cardData.title}</h4>
          <p class="product-description">${cardData.description}</p>
        </div>
      </button>
    `;
    }

    // Renderuje sekcję cyrkulacji CWU
    function renderCirculationSection() {
      const withCard = renderCirculationCard("tak", false);
      const withoutCard = renderCirculationCard("nie", true);
      return withCard + withoutCard;
    }

    // Renderuje kartę Service Cloud z animacjĂ„â€¦ typewriter
    function renderServiceCard() {
      const imgUrl = config?.imgUrl || "../img";
      const card = presentationData?.service_cloud?.card || {};
      const imageFile = card.image_file || "service-cloud-adapter.png";
      const imagePath = `${imgUrl}/${imageFile}`;
      const alt = card.alt || "Service Cloud Adapter";

      return `
      <button type="button" class="product-card ui-option" data-option-id="service-cloud" data-service-cloud-card="true">
        <div class="product-image">
          <img src="${imagePath}" alt="${alt}" onerror="this.style.display='none';" />
        </div>
        <div class="product-content">
          <span class="product-subtitle">${card.subtitle || "Monitoring i opieka serwisowa"}</span>
          <h4 class="product-title">${card.title || "Service Cloud"}</h4>
          <div class="service-cloud-animation" style="min-height: 80px; display: flex; align-items: center; justify-content: center;">
            <div class="service-cloud-text" style="font-size: 15px; line-height: 1.5; text-align: center; color: var(--color-text-primary, #1A1A1A); opacity: 0;"></div>
          </div>
        </div>
      </button>
    `;
    }

    // Funkcja uruchamiajĂ„â€¦ca animację Service Cloud
    function startServiceCloudAnimation() {
      const card = dom.qs('[data-service-cloud-card="true"]');
      if (!card) return;

      const textEl = card.querySelector('.service-cloud-text');
      if (!textEl) return;

      const animationText =
        presentationData?.service_cloud?.animation_text ||
        "Moduł WiFi w standardzie. Zdalny dostęp serwisu do parametrów instalacji oraz aplikacja Comfort Cloud do sterowania z urządzenia mobilnego.";
      const chars = animationText.split('');
      const charDelay = 2000 / chars.length; // 2 sekundy
      let currentIndex = 0;

      function typeChar() {
        if (currentIndex < chars.length) {
          textEl.textContent += chars[currentIndex];
          textEl.style.opacity = '1';
          currentIndex++;
          setTimeout(typeChar, charDelay);
        } else {
          textEl.style.opacity = '1';
        }
      }

      // Start animacji po maÄąâ€šym opÄ‚Ĺ‚ÄąĹźnieniu
      setTimeout(() => {
        textEl.textContent = '';
        typeChar();
      }, 100);
    }

    // Renderuje kartę posadowienia
    function renderFoundationCard(type, isRecommended = false) {
      const fallback = {
        grunt: {
          subtitle: "Fundament po stronie inwestora",
          title: "Fundament przygotowany samodzielnie",
          description:
            "Montaż jednostki zewnętrznej na przygotowanym fundamencie klienta. Oferta nie dolicza osobnej pozycji za podstawę.",
          specs: [{ label: "Przygotowanie", value: "Po stronie inwestora" }],
          optionId: "posadowienie-grunt",
        },
        sciana: {
          subtitle: "Montaż na ścianie",
          title: "Montaż na konsoli ściennej",
          description:
            "Montaż jednostki zewnętrznej na konsoli ściennej z elementami antywibracyjnymi. Wymaga odpowiedniej ściany nośnej.",
          specs: [{ label: "Wymaganie", value: "Stabilna ściana nośna" }],
          optionId: "posadowienie-sciana",
        },
        eko: {
          subtitle: "Montaż naziemny",
          title: "Montaż na stojaku",
          description:
            "Montaż jednostki zewnętrznej na stojaku z gumową podstawą antywibracyjną.",
          specs: [{ label: "Wymiary stopy", value: "80×80 cm" }],
          optionId: "posadowienie-eko",
        },
      };
      const row = presentationData?.foundation?.cards?.[type];
      const base = fallback[type];
      if (!base) return "";
      const cardData =
        row && typeof row === "object"
          ? {
            subtitle: row.subtitle || base.subtitle,
            title: row.title || base.title,
            description: row.description || base.description,
            specs: Array.isArray(row.specs) ? row.specs : base.specs,
            optionId: row.option_id || base.optionId,
          }
          : base;
      if (!cardData) return "";

      return `
      <button type="button" class="product-card ui-option" data-option-id="${cardData.optionId
        }">
        <div class="product-content">
          <span class="product-subtitle">${cardData.subtitle}</span>
          <h4 class="product-title">${cardData.title}</h4>
          <p class="product-description">${cardData.description}</p>
          <div class="specs-list">
            ${cardData.specs
          .map(
            (spec) => `
              <div class="spec-row">
                <span class="spec-label">${spec.label}</span>
                <span class="spec-value">${spec.value}</span>
              </div>
            `
          )
          .join("")}
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję posadowienia
    function renderFoundationSection() {
      const gruntCard = renderFoundationCard("grunt", false);
      const scianaCard = renderFoundationCard("sciana", false);
      const ekoCard = renderFoundationCard("eko", false);
      return gruntCard + scianaCard + ekoCard;
    }

    // Renderuje kartę reduktora ciśnienia
    function renderReducerCard(isRecommended = false) {
      const withPres = presentationData?.pressure_reducer?.with || {};
      const selectedClass = isRecommended ? "selected" : "";
      const badgeText = withPres.badge_recommended || "✓ Rekomendowane";
      const recommendedBadge = isRecommended
        ? `<span class="badge-recommended">${badgeText}</span>`
        : "";
      const specs =
        Array.isArray(withPres.specs) && withPres.specs.length > 0
          ? withPres.specs
          : [{ label: "Zakres", value: "1-6 bar" }];

      return `
      <button type="button" class="product-card ui-option ${selectedClass}" data-option-id="reduktor-tak">
        <div class="product-content">
          ${recommendedBadge}
          <span class="product-subtitle">${withPres.subtitle || "Zalecane przy ciśnieniu wody sieciowej powyżej 4 bar"}</span>
          <h4 class="product-title">${withPres.title || "Z reduktorem ciśnienia"}</h4>
          <p class="product-description">${withPres.description || "Reduktor ciśnienia nastawny z manometrem i filtrem mechanicznym."}</p>
          <div class="specs-list">
            ${specs
          .map(
            (spec) => `
              <div class="spec-row">
                <span class="spec-label">${spec.label}</span>
                <span class="spec-value">${spec.value}</span>
              </div>
            `
          )
          .join("")}
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję reduktora ciśnienia
    function renderReducerSection(recommendedOptionId = "reduktor-tak") {
      const withoutPres = presentationData?.pressure_reducer?.without || {};
      const withoutSpecs =
        Array.isArray(withoutPres.specs) && withoutPres.specs.length > 0
          ? withoutPres.specs
          : [{ label: "Warunek", value: "Stabilne cisnienie < 3 bar" }];
      const withoutReducerCard = `
      <button type="button" class="product-card ui-option ${recommendedOptionId === "reduktor-nie" ? "selected" : ""
        }" data-option-id="reduktor-nie">
        <div class="product-content">
          ${recommendedOptionId === "reduktor-nie"
          ? '<span class="badge-recommended">Rekomendowane</span>'
          : ""
        }
          <span class="product-subtitle">${withoutPres.subtitle || "Dla niskiego i stabilnego ciśnienia wody"}</span>
          <h4 class="product-title">${withoutPres.title || "Bez reduktora ciśnienia"}</h4>
          <p class="product-description">${withoutPres.description || "Instalacja bez dodatkowego reduktora. To wariant dla stabilnego ciśnienia zasilania i prostych warunków pracy."}</p>
          <div class="specs-list">
            ${withoutSpecs
          .map(
            (spec) => `
            <div class="spec-row">
              <span class="spec-label">${spec.label}</span>
              <span class="spec-value">${spec.value}</span>
            </div>
          `
          )
          .join("")}
          </div>
        </div>
      </button>
    `;

      return (
        renderReducerCard(recommendedOptionId === "reduktor-tak") +
        withoutReducerCard
      );
    }

    // Renderuje kartę stacji uzdatniania wody
    function renderWaterStationCard(type, isRecommended = false) {
      const fallback = {
        kompleksowa: {
          subtitle: "Filtracja + zmiękczanie",
          title: "Stacja kompleksowa",
          description: "Kompleksowe uzdatnianie wody: zmiękczanie i filtracja mechaniczna.",
          specs: [{ label: "Funkcje", value: "Zmiękczanie + filtracja" }],
          optionId: "woda-tak",
        },
        podstawowa: {
          subtitle: "Filtr mechaniczny",
          title: "Filtracja podstawowa",
          description:
            "Filtracja mechaniczna — podstawowa ochrona przed zanieczyszczeniami stałymi.",
          specs: [{ label: "Filtracja", value: "50 μm" }],
          optionId: "woda-filtr",
        },
        brak: {
          subtitle: "Przy dobrej jakości wody",
          title: "Bez uzdatniania",
          description: "Brak uzdatniania — wymaga analizy parametrów wody sieciowej.",
          specs: [{ label: "Wymaga", value: "Analizy wody" }],
          optionId: "woda-nie",
        },
      };
      const stations = presentationData?.water_treatment?.stations || {};
      const mapKey = { kompleksowa: "kompleksowa", podstawowa: "podstawowa", brak: "brak" };
      const row = stations[mapKey[type]];
      const base = fallback[type];
      const cardData =
        row && typeof row === "object" && base
          ? {
            subtitle: row.subtitle || base.subtitle,
            title: row.title || base.title,
            description: row.description || base.description,
            specs: Array.isArray(row.specs) ? row.specs : base.specs,
            optionId: row.option_id || base.optionId,
          }
          : base;
      if (!cardData) return "";

      const selectedClass = isRecommended ? "selected" : "";
      const recommendedBadge = isRecommended
        ? '<span class="badge-recommended">✓ Rekomendowane</span>'
        : "";

      return `
      <button type="button" class="product-card ui-option ${selectedClass}" data-option-id="${cardData.optionId
        }">
        <div class="product-content">
          ${recommendedBadge}
          <span class="product-subtitle">${cardData.subtitle}</span>
          <h4 class="product-title">${cardData.title}</h4>
          <p class="product-description">${cardData.description}</p>
          <div class="specs-list">
            ${cardData.specs
          .map(
            (spec) => `
              <div class="spec-row">
                <span class="spec-label">${spec.label}</span>
                <span class="spec-value">${spec.value}</span>
              </div>
            `
          )
          .join("")}
          </div>
          <!-- ceny usunięte (UX: brak wyświetlania cen w konfiguratorze) -->
        </div>
      </button>
    `;
    }

    // Renderuje sekcję stacji uzdatniania wody
    function renderWaterStationSection(recommendedOptionId = "woda-tak") {
      const kompleksowaCard = renderWaterStationCard(
        "kompleksowa",
        recommendedOptionId === "woda-tak"
      );
      const podstawowaCard = renderWaterStationCard(
        "podstawowa",
        recommendedOptionId === "woda-filtr"
      );
      const brakCard = renderWaterStationCard("brak", false);
      return kompleksowaCard + podstawowaCard + brakCard;
    }

    /* ==========================================================================
     POPULATE WITH CALCULATOR DATA (z configurator-new.js + rozszerzone)
     ========================================================================== */

    async function populateConfiguratorWithCalculatorData(options = {}) {
      const appSnapshot =
        typeof getAppState === "function" ? getAppState() : null;
      const calcData =
        options.configData ||
        options.building ||
        options;
      if (
        appSnapshot?.draftRequest &&
        typeof appSnapshot.draftRequest === "object" &&
        !Array.isArray(appSnapshot.draftRequest)
      ) {
        state.baseDraftRequest = appSnapshot.draftRequest;
      } else if (
        calcData?.draft_request &&
        typeof calcData.draft_request === "object" &&
        !Array.isArray(calcData.draft_request)
      ) {
        state.baseDraftRequest = calcData.draft_request;
      }
      if (!calcData) {
        // To jest normalna sytuacja przy pierwszym zaÄąâ€šadowaniu strony (przed wykonaniem obliczeÄąâ€ž)
        // Nie logujemy jako bÄąâ€šĂ„â€¦d, tylko jako informację
        if (debug.__DEBUG_CONFIGURATOR) {
        }
        return;
      }

      // Ä‘Ĺşâ€śĹ  LOGOWANIE DANYCH PRZEKAZANYCH DO KONFIGURATORA

      // Logowanie zarekomendowanej pompy (jeÄąâ€şli dostępna)
      if (calcData.pump_selection) {
        const ps = calcData.pump_selection;
      } else if (konfigDebug()) {
        console.warn(
          "[Configurator] calcData has no pump_selection (calculator may not have run yet)"
        );
      }

      // Ă˘Ĺ›â€¦ PRZYWRÄ‚â€śĂ„â€  STAN KONFIGURATORA jeÄąâ€şli istnieje (z sessionStorage)
      const savedState = loadConfiguratorState();
      const hasRestoredState =
        savedState && Object.keys(savedState.selections || {}).length > 0;
      if (hasRestoredState) {
        // Tymczasowo zapisz meta (będzie nadpisane poniÄąÄ˝ej, ale potrzebne do restoreConfiguratorState)
        const tempMeta = state.meta;
        state.meta = savedState.meta || tempMeta;
        restoreConfiguratorState(savedState);
        // Meta zostanie zaktualizowane poniÄąÄ˝ej z calcData
      }

      // OZC SINGLE SOURCE OF TRUTH Ă˘â‚¬â€ť DO NOT DERIVE POWER ELSEWHERE
      // ARCHITECTURAL: max_heating_power is canonical from OZCEngine.designHeatLoss_kW
      // recommended_power_kw MUST equal max_heating_power (heating only, no CWU)
      // power_total_kw = max_heating_power + hot_water_power (for sizing, not selection)
      // Zapisz meta w state
      // NOTE: Część pÄ‚Ĺ‚l CWU moÄąÄ˝e ÄąÄ˝yĂ„â€ˇ w calcData.parameters (payload wejÄąâ€şciowy),
      // a nie w root obiekcie wyniku. Bez tego CWU bywa bÄąâ€šędnie skipowane jako "brak".
      const params =
        (calcData && (calcData.parameters || calcData.payload || calcData.input || null)) ||
        (typeof window !== "undefined" && window.lastSentPayload) ||
        {};

      const includeHotRaw =
        calcData.include_hot_water !== undefined
          ? calcData.include_hot_water
          : params.include_hot_water;
      const includeHot =
        includeHotRaw === true ||
        includeHotRaw === "yes" ||
        includeHotRaw === "true" ||
        includeHotRaw === 1 ||
        includeHotRaw === "1";

      const hotWaterPersonsRaw =
        calcData.hot_water_persons !== undefined
          ? calcData.hot_water_persons
          : params.hot_water_persons;
      const hotWaterPersons = Number(hotWaterPersonsRaw || 0) || 0;

      const hotWaterUsage =
        calcData.hot_water_usage !== undefined
          ? calcData.hot_water_usage
          : params.hot_water_usage;

      // P1 FIX: Normalizacja liczb przed zapisaniem do state.meta
      function safeNumber(value) {
        if (value == null) return null;
        const n = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(n) ? n : null;
      }

      const maxHeatingPower = safeNumber(calcData.max_heating_power);
      const recommendedPowerKw = safeNumber(calcData.recommended_power_kw) ?? maxHeatingPower;
      const hotWaterPower = safeNumber(calcData.hot_water_power) ?? 0;

      // Fail-fast: jeÄąâ€şli max_heating_power jest NaN/null, loguj bÄąâ€šĂ„â€¦d
      if (maxHeatingPower == null || !Number.isFinite(maxHeatingPower)) {
        console.error(
          "[Configurator] Invalid max_heating_power",
          calcData.max_heating_power,
          calcData
        );
      }

      state.meta = {
        max_heating_power: maxHeatingPower, // CANONICAL: from OZC
        hot_water_power: hotWaterPower,
        recommended_power_kw: recommendedPowerKw ?? maxHeatingPower, // MUST equal max_heating_power
        power_total_kw: (maxHeatingPower ?? 0) + (hotWaterPower ?? 0), // For sizing only
        heated_area: calcData.heated_area,
        total_area: calcData.total_area,
        heating_type: calcData.heating_type || calcData.installation_type,
        installation_type: calcData.heating_type || calcData.installation_type,
        include_hot_water: includeHot,
        hot_water_persons: hotWaterPersons,
        cwu_people: hotWaterPersons,
        hot_water_usage: hotWaterUsage,
        cwu_profile: hotWaterUsage,
        building_type: calcData.building_type,
        building_year: calcData.building_year || calcData.construction_year,
        construction_year: calcData.building_year || calcData.construction_year,
        construction_type: calcData.construction_type,
        indoor_temperature: calcData.indoor_temperature,
        heat_source_prev: calcData.heat_source_prev || calcData.source_type,
        ...(calcData.generation != null && String(calcData.generation).trim() !== ""
          ? { generation: String(calcData.generation).trim() }
          : {}),
      };

      if (isBackendCalcEnabled()) {
        if (
          state.backendOffer &&
          (!lastBackendRequestSignature || !lastBackendHydraulicsSignature)
        ) {
          lastBackendRequestSignature = buildCurrentBackendRequestSignature();
          lastBackendHydraulicsSignature =
            buildHydraulicsBackendRequestSignature();
          syncCanonicalOfferState(state.backendOffer);
        } else if (
          !state.backendOffer &&
          calcData?.offer_dto &&
          typeof calcData.offer_dto === "object"
        ) {
          lastBackendRequestSignature = buildCurrentBackendRequestSignature();
          lastBackendHydraulicsSignature =
            buildHydraulicsBackendRequestSignature();
          applyOfferToConfiguratorState(calcData.offer_dto);
        }

        if (!state.backendOffer) {
          try {
            await refreshOfferData({ force: true });
          } catch (backendRefreshError) {
            console.warn(
              "[Configurator] initial backend offer refresh failed:",
              backendRefreshError
            );
          }
        }
      }

      // Przygotuj profile pomp
      const pumpRecommendation = resolveCanonicalPumpRecommendationSnapshot(
        calcData,
        appSnapshot
      );
      const pumpProfiles = preparePumpProfiles(state.meta);
      if (pumpProfiles.length === 0) {
        if (konfigDebug()) {
          console.warn("[Configurator] No pump profiles (checking >25kW case)");
        }
        // JeÄąâ€şli moc >= 25kW, ukryj konfigurator i wyÄąâ€şwietl komunikat w profilu energetycznym
        if (state.meta.recommended_power_kw >= 25) {
          // Scope do root elementu (jeÄąâ€şli dostępny)
          const rootElement =
            options.rootElement ||
            dom.qs("#configurator-app")?.closest('[id*="configurator"]') ||
            root;
          const configuratorView =
            rootElement.querySelector("#configurator-view") ||
            rootElement.querySelector("#configurator-app");
          if (configuratorView) {
            configuratorView.innerHTML = `
            <div class="glass-box" style="padding: 40px; text-align: center;">
              <h2 style="color: #8b6914; margin-bottom: 20px;">Obsługa niedostępna</h2>
              <p style="font-size: 1.1em; line-height: 1.6;">
                Obsługa budynków o mocy w temp. projektowej większej niż 25 kW jest niedostępna.
              </p>
              <p style="margin-top: 20px; color: #666;">
                Zalecamy termomodernizację budynku przed doborem pompy ciepła.
              </p>
            </div>
          `;
          }
          return;
        }
        console.warn("[Configurator] No pump profiles; aborting populate");
        return;
      }

      // Scope do root elementu (jeÄąâ€şli dostępny)
      const rootElement =
        options.rootElement || dom.qs("#configurator-app") || root;

      // Renderuj sekcję pompy z peÄąâ€šnymi kartami
      const backendCalcEnabled = isBackendCalcEnabled();
      if (backendCalcEnabled) {
        await renderCanonicalPumpUi(rootElement, pumpRecommendation);
      } else {
        const pumpStep = rootElement.querySelector('[data-step-key="pompa"]');
        if (pumpStep) {
          const optionsGrid = pumpStep.querySelector(".options-grid");
          if (optionsGrid) {
            // Renderuj karty dynamicznie
            const splitProfile =
              pumpProfiles.find((p) => p.type === "split" && p.id === "hp") ||
              pumpProfiles[0];
            const aioProfile = pumpProfiles.find(
              (p) => p.type === "all-in-one" && p.id === "aio"
            );
            const recommendedProfile = resolveRecommendedPumpProfile(
              pumpProfiles,
              pumpRecommendation
            );
            // ZaÄąâ€šaduj panasonic.json jeÄąâ€şli jeszcze nie zaÄąâ€šadowany
            if (!panasonicDB) {
              await loadPanasonicDB();
            }

            const splitData = getPumpDataFromDB(splitProfile.model);
            const aioData = aioProfile
              ? getPumpDataFromDB(aioProfile.model)
              : null;

            const splitCard = renderPumpCard(
              splitProfile,
              splitData,
              recommendedProfile?.id === splitProfile?.id
            );
            const aioCard =
              aioProfile && !aioProfile.disabled
                ? renderPumpCard(
                  aioProfile,
                  aioData,
                  recommendedProfile?.id === aioProfile?.id
                )
                : "";

            optionsGrid.innerHTML = splitCard + aioCard;
            syncSelectionForStep("pompa");

            // KROK 1: POMPA CIEPÄąÂA Ă˘â‚¬â€ť szczegÄ‚Ĺ‚Äąâ€šowe logowanie
            if (debug.__DEBUG_CONFIGURATOR) {
              if (aioProfile && !aioProfile.disabled) {
              } else {
              }
            }

            // USUNIĂ„ÂTO: Auto-wybieranie rekomendowanej karty - uÄąÄ˝ytkownik musi sam wybraĂ„â€ˇ
            if (hasRestoredState) {
              // Ă˘Ĺ›â€¦ JeÄąâ€şli przywrÄ‚Ĺ‚cono stan, zaktualizuj tylko panasonicData dla wybranej pompy
              if (state.selectedPump && state.selectedPump.model) {
                const pumpData = getPumpDataFromDB(state.selectedPump.model);
                if (pumpData) {
                  state.selectedPump.panasonicData = pumpData;
                }
              }
            }

            // Aktualizuj treÄąâ€şci dla KROKU 1 - POMPA CIEPÄąÂA
            const heatDemand = state.meta?.max_heating_power || null;
            const recommendedPumpPower =
              recommendedProfile?.power ||
              recommendedProfile?.power_kw ||
              splitProfile?.power ||
              aioProfile?.power ||
              null;
            const sectionDescription = pumpStep.querySelector(
              ".section-description"
            );

            // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
            const existingNote = pumpStep.querySelector(".recommendation-note");
            if (existingNote) {
              existingNote.remove();
            }

            if (heatDemand && recommendedPumpPower) {
              // Mamy zapotrzebowanie i rekomendowanĂ„â€¦ moc znamionowĂ„â€¦ pompy
              if (sectionDescription) {
                const descriptionText = `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
                  2
                )} kW. System rekomenduje pompę ciepła o mocy znamionowej ${recommendedPumpPower} kW jako optymalne rozwiĂ„â€¦zanie pod kĂ„â€¦tem komfortu, kosztÄ‚Ĺ‚w i ÄąÄ˝ywotnoÄąâ€şci urzĂ„â€¦dzenia.`;
                if (
                  evaluated.cwuRules.source === "backend" &&
                  evaluated.cwuRules.explanation?.long
                ) {
                  descriptionText = evaluated.cwuRules.explanation.long;
                }
                sectionDescription.textContent = descriptionText;
              }
            } else if (heatDemand) {
              // Mamy tylko zapotrzebowanie
              if (sectionDescription) {
                sectionDescription.textContent = `Szacunkowe zapotrzebowanie cieplne Twojego budynku w temperaturze projektowej wynosi ${heatDemand.toFixed(
                  2
                )} kW. Wybierz preferowany model pompy ciepła.`;
              }
            } else {
              // Brak danych
              if (sectionDescription) {
                sectionDescription.textContent =
                  "Na podstawie obliczeÄąâ€ž rekomendujemy pompę o odpowiedniej mocy. Wybierz preferowany model.";
              }
            }
          }
        }
      }

      // Ă˘Ĺ›â€¦ JeÄąâ€şli przywrÄ‚Ĺ‚cono stan, NIE nadpisuj selekcji - tylko zaktualizuj meta i przelicz
      // hasRestoredState jest juÄąÄ˝ zdefiniowane wyÄąÄ˝ej (linia 4117)

      // Przelicz reguły przed auto-wyborem
      const evaluated = evaluateRules();

      // Ä‘Ĺşâ€śĹ  LOGOWANIE WYNIKÄ‚â€śW DOBORU KOMPONENTÄ‚â€śW

      if (!evaluated) {
        console.error(
          "[Configurator] evaluateRules() returned null/undefined; check state.meta"
        );
      } else {
        // 1. Dobrana pojemność CWU
        if (evaluated.cwuRules) {
          if (evaluated.cwuRules.skip) {
          } else if (evaluated.cwuRules.recommendedCapacity) {
          } else if (konfigDebug()) {
            console.warn("[Configurator] DHW tank: no recommended capacity", evaluated.cwuRules);
          }
        } else {
          console.error("[Configurator] evaluated.cwuRules is null");
        }

        // 2. Dobrany bufor i pojemność
        if (evaluated.bufferRules) {
          const bufferRules = evaluated.bufferRules;
          const hydraulicsRec = bufferRules.hydraulicsRecommendation || null;

          if (bufferRules.required) {
            const bufferLiters =
              hydraulicsRec?.buffer_liters ||
              bufferRules.recommendedCapacity ||
              null;
            const bufferType =
              hydraulicsRec?.type || bufferRules.type || "unknown";

            if (!bufferLiters && konfigDebug()) {
              console.warn(
                "[Configurator] Buffer required but no recommended liters",
                { bufferRules, hydraulicsRec }
              );
            }
          } else {
          }
        } else {
          console.error("[Configurator] evaluated.bufferRules is null");
        }
      }

      // Krok: pytania instalacyjne (sessionStorage.config_data.hydraulics_inputs)
      renderHydraulicsInputsStep();

      // Renderuj karty CWU dynamicznie
      if (evaluated && evaluated.cwuRules.skip) {
        // Ă˘Ĺ›â€¦ NOWA LOGIKA: Ukryj sekcję i ustaw "brak" w sticky bar
        const cwuStep = dom.qs('[data-step-key="cwu"]');
        if (cwuStep) {
          cwuStep.style.display = "none";
          cwuStep.classList.add("section-skipped");
        }
        // Ustaw "Nie dotyczy" w sticky bar
        const skipReason = evaluated.cwuRules.skipReason || "Nie dotyczy";
        updateSelectionsBar("cwu", skipReason);
        // Ustaw w state.selections dla wynikÄ‚Ĺ‚w
        state.selections.cwu = {
          optionId: "cwu-none",
          label: skipReason,
          system: true,
        };
      } else if (evaluated && evaluated.cwuRules.enabled) {
        const cwuStep = dom.qs('[data-step-key="cwu"]');
        if (cwuStep) {
          // Upewnij się, ÄąÄ˝e sekcja jest widoczna (moÄąÄ˝e byĂ„â€ˇ ukryta z poprzedniego stanu)
          cwuStep.style.display = "";
          cwuStep.classList.remove("section-skipped");

          // Ă˘Ĺ›â€¦ FALLBACK: JeÄąâ€şli brak recommendedCapacity, użyj domyÄąâ€şlnej wartoÄąâ€şci
          const recommendedCapacity =
            evaluated.cwuRules.recommendedCapacity || 200;
          const optionsGrid = cwuStep.querySelector(".options-grid");

          if (optionsGrid) {
            // Renderuj karty dynamicznie
            const cards = renderCwuSection(recommendedCapacity);
            optionsGrid.innerHTML = cards;
            syncSelectionForStep("cwu");

            // Ä‘Ĺşâ€śĹ  KROK 2: ZASOBNIK CWU Ă˘â‚¬â€ť SzczegÄ‚Ĺ‚Äąâ€šowe logowanie
            if (debug.__DEBUG_CONFIGURATOR) {
              if (evaluated.cwuRules.recommendedCapacity) {
                const people =
                  evaluated.cwuRules.persons ??
                  state.meta?.hot_water_persons ??
                  state.meta?.cwu_people ??
                  null;
                const profile =
                  evaluated.cwuRules.usageProfile ||
                  state.meta?.hot_water_usage ||
                  state.meta?.cwu_profile ||
                  null;
              }
            }

            // USUNIĂ„ÂTO: Auto-wybieranie rekomendowanej karty - uÄąÄ˝ytkownik musi sam wybraĂ„â€ˇ

            // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
            const existingNote = cwuStep.querySelector(".recommendation-note");
            if (existingNote) {
              existingNote.remove();
            }

            // Zaktualizuj opis w headerze zgodnie z tabelĂ„â€¦ WARUNEK Ă˘â€ â€™ TEKST
            const sectionDescription = cwuStep.querySelector(
              ".section-description"
            );
            if (sectionDescription) {
              // Zaktualizuj recommendation-note zgodnie z tabelĂ„â€¦ WARUNEK Ă˘â€ â€™ TEKST
              const people =
                evaluated.cwuRules.persons ??
                state.meta?.hot_water_persons ??
                state.meta?.cwu_people ??
                null;
              const profile =
                evaluated.cwuRules.usageProfile ||
                state.meta?.hot_water_usage ||
                state.meta?.cwu_profile ||
                null;
              let profileLabel = "";
              if (profile === "bath" || profile === "comfort") {
                profileLabel = "podwy\u017cszone zu\u017cycie";
              } else if (profile === "shower_bath" || profile === "standard") {
                profileLabel = "standardowe zu\u017cycie";
              } else if (profile === "eco") {
                profileLabel = "ma\u0142e zu\u017cycie";
              } else {
                profileLabel = "standardowe zu\u017cycie";
              }

              let peopleText = "";
              if (people) {
                if (people === 1) {
                  peopleText = "1 osoba";
                } else if (people < 5) {
                  peopleText = `${people} osoby`;
                } else {
                  peopleText = `${people} osób`;
                }
              }

              // Generuj opis w nowym formacie
              let descriptionText = "";
              if (people && profile) {
                // Mamy peÄąâ€šne dane: osoby i profil
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody dobrana do liczby domowników i stylu użytkowania (${peopleText}, ${profileLabel}) to ${recommendedCapacity} L.`;
              } else if (people) {
                // Mamy tylko liczbę osÄ‚Ĺ‚b
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody dobrana do liczby domowników (${peopleText}) to ${recommendedCapacity} L.`;
              } else if (profile) {
                // Mamy tylko profil
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody dobrana do stylu użytkowania (${profileLabel}) to ${recommendedCapacity} L.`;
              } else {
                // Brak danych - ogÄ‚Ĺ‚lny opis
                descriptionText = `Rekomendowana pojemność zasobnika ciepłej wody to ${recommendedCapacity} L.`;
              }

              sectionDescription.textContent = descriptionText;
            }
          }
        }
      }

      // Renderuj HYDRAULIKĂ„Â CO wyÄąâ€šĂ„â€¦cznie z hydraulicsRecommendation (single source)
      // Ă˘Ĺ›â€¦ FIX: UÄąÄ˝yj hydraulicsRecommendation z evaluateRules() (juÄąÄ˝ Äąâ€şwieÄąÄ˝e, obliczone w rulesEngine.buffer())
      // Usunięto podwÄ‚Ĺ‚jne wywoÄąâ€šanie computeHydraulicsRecommendation() - byÄąâ€šo niepotrzebne
      // Hydraulics UI is rendered canonically in recompute().

      // Renderuj karty cyrkulacji CWU dynamicznie
      if (evaluated && evaluated.circulationRules) {
        const circulationStep = dom.qs('[data-step-key="cyrkulacja"]');
        if (circulationStep) {
          const isEnabled = evaluated.circulationRules.enabled === true;
          const isRecommended = evaluated.circulationRules.recommended === true;

          if (isEnabled) {
            const optionsGrid = circulationStep.querySelector(".options-grid");
            if (optionsGrid) {
              const cards = renderCirculationSection();
              optionsGrid.innerHTML = cards;
              syncSelectionForStep("cyrkulacja");

              // USUNIĂ„ÂTO: Auto-wybieranie - uÄąÄ˝ytkownik musi sam wybraĂ„â€ˇ
            }
          }

          // Aktualizuj treÄąâ€şci dla KROKU 4 - CYRKULACJA CWU
          const sectionDescription = circulationStep.querySelector(
            ".section-description"
          );

          // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
          const existingNote = circulationStep.querySelector(
            ".recommendation-note"
          );
          if (existingNote) {
            existingNote.remove();
          }

          if (!isEnabled) {
            // enabled = false
            const optionsGrid = circulationStep.querySelector(".options-grid");
            if (optionsGrid) {
              optionsGrid.innerHTML = "";
            }
            if (sectionDescription) {
              sectionDescription.innerHTML =
                "Sekcja nie dotyczy — wybrana konfiguracja zawiera wbudowany zasobnik CWU w pompie ciepła typu All-in-One.";
            }
          } else if (isRecommended) {
            // recommended = true
            if (sectionDescription) {
              sectionDescription.innerHTML =
                "Cyrkulacja CWU zapewnia natychmiastowy dostęp do ciepłej wody w punktach czerpalnych. Rekomendowana dla większych budynków lub gdy priorytetem jest maksymalny komfort użytkowania.";
            }
          } else {
            // recommended = false
            if (sectionDescription) {
              sectionDescription.innerHTML =
                "Cyrkulacja CWU zapewnia wygodę użytkowania ciepłej wody.<br>Cyrkulacja jest opcjonalna. W tej instalacji czas oczekiwania na ciepłą wodę będzie krótki nawet bez niej.";
            }
          }
        }
      }

      // Renderuj kartę Service Cloud dynamicznie (tylko 1 karta - Basic)
      const serviceStep = dom.qs('[data-step-key="service"]');
      if (serviceStep) {
        const isEnabled = evaluated?.scRules?.enabled === true;
        const optionsGrid = serviceStep.querySelector(".options-grid");
        if (optionsGrid) {
          if (isEnabled) {
            const card = renderServiceCard();
            optionsGrid.innerHTML = card;
            syncSelectionForStep("service");

            // Uruchom animację Service Cloud
            startServiceCloudAnimation();
          } else {
            optionsGrid.innerHTML = "";
          }

          // USUNIĂ„ÂTO: Auto-wybieranie - uÄąÄ˝ytkownik musi sam wybraĂ„â€ˇ
        }

        // Aktualizuj treÄąâ€şci dla KROKU 5 - SERVICE CLOUD
        const sectionDescription = serviceStep.querySelector(
          ".section-description"
        );

        // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
        const existingNote = serviceStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        if (isEnabled) {
          if (sectionDescription) {
            sectionDescription.innerHTML =
              "Zdalne monitorowanie i opieka serwisowa instalacji przez specjalistów TOP-INSTAL.<br>Service Cloud jest w standardzie TOP-INSTAL — bez dopłat. Umożliwia zdalną diagnostykę, optymalizację ustawień i szybszą reakcję serwisową.";
          }
        } else {
          if (sectionDescription) {
            sectionDescription.innerHTML =
              "Service Cloud — monitoring i wsparcie serwisowe. Wybierz kartę powyżej, aby potwierdzić udział w usłudze.";
          }
        }
      }

      // Renderuj karty posadowienia dynamicznie
      const foundationStep = dom.qs('[data-step-key="posadowienie"]');
      if (foundationStep) {
        const optionsGrid = foundationStep.querySelector(".options-grid");
        if (optionsGrid) {
          const cards = renderFoundationSection();
          optionsGrid.innerHTML = cards;
          syncSelectionForStep("posadowienie");

          // USUNIĂ„ÂTO: Auto-wybieranie - uÄąÄ˝ytkownik musi sam wybraĂ„â€ˇ
        }

        // Aktualizuj treÄąâ€şci dla KROKU 6 - POSADOWIENIE
        const pumpWeight =
          state.selectedPump?.weight ||
          state.selectedPump?.panasonicData?.weight ||
          70;
        const isHeavy = pumpWeight > 65;
        const sectionDescription = foundationStep.querySelector(
          ".section-description"
        );

        // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
        const existingNote = foundationStep.querySelector(
          ".recommendation-note"
        );
        if (existingNote) {
          existingNote.remove();
        }

        // Zawsze
        if (sectionDescription) {
          const mainText =
            "Sposób montażu jednostki zewnętrznej wpływa na stabilność pracy, hałas i trwałość instalacji.";
          let noteText =
            "Do wyboru są trzy warianty: fundament przygotowany przez inwestora, stojak naziemny oraz montaż ścienny. Każdy z nich ma inny wpływ na cenę i warunki montażowe.";

          if (isHeavy) {
            noteText +=
              " Uwaga: masa pompy przekracza 65 kg — montaż na konsoli ściennej wymaga dodatkowej analizy konstrukcyjnej.";
          }

          sectionDescription.innerHTML = `${mainText}<br>${noteText}`;
        }
      }

      // Renderuj kartę reduktora ciśnienia dynamicznie
      const reducerStep = dom.qs('[data-step-key="reduktor"]');
      if (reducerStep) {
        const waterPressure = state.meta?.water_pressure || null;
        const recommendedReducerOptionId =
          waterPressure !== null && waterPressure < 3
            ? "reduktor-nie"
            : "reduktor-tak";
        const optionsGrid = reducerStep.querySelector(".options-grid");
        if (optionsGrid) {
          const cards = renderReducerSection(recommendedReducerOptionId);
          optionsGrid.innerHTML = cards;
          if (!state.selections?.reduktor?.optionId) {
            UICallbacks.autoSelect(recommendedReducerOptionId);
          }
          syncSelectionForStep("reduktor");
        }

        // Aktualizuj treÄąâ€şci dla KROKU 7 - REDUKTOR CIÄąĹˇNIENIA
        const sectionDescription = reducerStep.querySelector(
          ".section-description"
        );

        // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
        const existingNote = reducerStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        let descText = "";
        let noteText = "";

        if (waterPressure === null) {
          descText =
            "Reduktor chroni instalację przed zbyt wysokim ciśnieniem wody.";
          noteText =
            "Rekomendujemy reduktor dla większości instalacji — zapewnia poprawność montażu i komfort użytkowania.";
        } else if (waterPressure > 5) {
          descText =
            "Reduktor chroni instalację przed zbyt wysokim ciśnieniem wody.";
          noteText =
            "Reduktor ciśnienia jest wymagany. Zbyt wysokie ciśnienie może prowadzić do uszkodzeń armatury i zbiornika CWU.";
        } else if (waterPressure >= 3) {
          descText = "Reduktor chroni instalację przed skokami ciśnienia.";
          noteText =
            "Rekomendujemy reduktor ciśnienia dla stabilnej pracy instalacji i komfortu użytkowania.";
        } else {
          descText = "Reduktor chroni instalację przed nadmiernym ciśnieniem.";
          noteText =
            "Reduktor nie jest wymagany, ale można go dodać opcjonalnie jako dodatkowe zabezpieczenie.";
        }

        if (sectionDescription) {
          sectionDescription.innerHTML = `${descText}<br>${noteText}`;
        }
      }

      // Renderuj karty stacji uzdatniania wody dynamicznie
      const waterStep = dom.qs('[data-step-key="woda"]');
      if (waterStep) {
        const recommendedWaterOptionId =
          evaluated?.waterRules?.recommendSoftener === true
            ? "woda-tak"
            : "woda-filtr";
        const optionsGrid = waterStep.querySelector(".options-grid");
        if (optionsGrid) {
          const cards = renderWaterStationSection(recommendedWaterOptionId);
          optionsGrid.innerHTML = cards;
          if (!state.selections?.woda?.optionId) {
            UICallbacks.autoSelect(recommendedWaterOptionId);
          }
          syncSelectionForStep("woda");

          // USUNIĂ„ÂTO: Auto-wybieranie - uÄąÄ˝ytkownik musi sam wybraĂ„â€ˇ
        }

        // Aktualizuj treÄąâ€şci dla KROKU 8 - UZDATNIANIE WODY
        const waterHardness = state.meta?.water_hardness || null;
        const sectionDescription = waterStep.querySelector(
          ".section-description"
        );

        // UsuÄąâ€ž istniejĂ„â€¦ce recommendation-note jeÄąâ€şli istnieje
        const existingNote = waterStep.querySelector(".recommendation-note");
        if (existingNote) {
          existingNote.remove();
        }

        // Zawsze
        if (sectionDescription) {
          const mainText =
            "Jakość wody ma bezpośredni wpływ na trwałość pompy ciepła i zasobnika CWU.";
          let noteText =
            "Rekomendujemy uzdatnianie wody w celu ochrony instalacji przed kamieniem i korozją.";

          if (waterHardness && waterHardness > 15) {
            noteText +=
              " Dla twardej wody zalecana jest stacja kompleksowa (filtracja + zmiękczanie), aby wydłużyć żywotność instalacji.";
          }

          sectionDescription.innerHTML = `${mainText}<br>${noteText}`;
        }
      }

      // Zastosuj reguły do UI
      applyRulesToUI(evaluated);

      recompute();
    }

    function renderInstallationDiagram(setupType) {
      if (setupType === "SERIES_BYPASS") {
        return `
        <div class="installation-diagram">
          <svg viewBox="0 0 340 180" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
            <defs>
              <marker id="arrowhead-series" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#666" />
              </marker>
            </defs>
            <text x="170" y="18" text-anchor="middle" font-size="11" font-weight="600" fill="#333">
              Schemat szeregowy z buforem na powrocie
            </text>
            <rect x="18" y="44" width="58" height="68" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5" />
            <text x="47" y="82" text-anchor="middle" font-size="10" fill="#333">Pompa</text>
            <rect x="264" y="44" width="58" height="68" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5" />
            <text x="293" y="82" text-anchor="middle" font-size="10" fill="#333">Instalacja</text>
            <rect x="141" y="102" width="58" height="58" rx="5" fill="#d4a574" fill-opacity="0.18" stroke="#d4a574" stroke-width="2" />
            <text x="170" y="129" text-anchor="middle" font-size="10" fill="#333">Bufor</text>
            <text x="170" y="143" text-anchor="middle" font-size="10" fill="#333">CO</text>
            <path d="M 76 66 L 264 66" stroke="#666" stroke-width="2.5" fill="none" marker-end="url(#arrowhead-series)" />
            <text x="170" y="54" text-anchor="middle" font-size="9" fill="#666">zasilanie do instalacji</text>
            <path d="M 264 92 L 199 92 L 199 131" stroke="#666" stroke-width="2.5" fill="none" marker-end="url(#arrowhead-series)" />
            <path d="M 141 131 L 76 131 L 76 92" stroke="#666" stroke-width="2.5" fill="none" marker-end="url(#arrowhead-series)" />
            <text x="170" y="173" text-anchor="middle" font-size="9" fill="#666">powrót z instalacji przez bufor do pompy</text>
            <path d="M 108 66 L 108 150 L 136 150" stroke="#666" stroke-width="1.5" fill="none" stroke-dasharray="4,4" />
            <circle cx="108" cy="108" r="4" fill="#666" />
            <text x="92" y="162" text-anchor="middle" font-size="8" fill="#666">by-pass</text>
          </svg>
        </div>
        `;
      }

      if (setupType === "PARALLEL_CLUTCH") {
        return `
        <div class="installation-diagram">
          <svg viewBox="0 0 300 140" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
            <defs>
              <marker id="arrowhead-parallel" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#666" />
              </marker>
            </defs>
            <text x="150" y="15" text-anchor="middle" font-size="11" font-weight="600" fill="#333">
              Schemat montażu równoległego
            </text>
            <rect x="20" y="30" width="40" height="60" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5" />
            <text x="40" y="70" text-anchor="middle" font-size="10" fill="#333">Pompa</text>
            <path d="M 60 50 L 100 50" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead-parallel)" />
            <path d="M 60 70 L 100 70" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead-parallel)" />
            <rect x="100" y="20" width="60" height="80" rx="5" fill="#d4a574" fill-opacity="0.2" stroke="#d4a574" stroke-width="2" />
            <text x="130" y="45" text-anchor="middle" font-size="9" fill="#333">Bufor</text>
            <text x="130" y="60" text-anchor="middle" font-size="9" fill="#333">(sprzęgło</text>
            <text x="130" y="75" text-anchor="middle" font-size="9" fill="#333">hydrauliczne)</text>
            <path d="M 160 50 L 200 50" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead-parallel)" />
            <path d="M 160 70 L 200 70" stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead-parallel)" />
            <rect x="200" y="30" width="50" height="60" rx="4" fill="#e0e0e0" stroke="#666" stroke-width="1.5" />
            <text x="225" y="70" text-anchor="middle" font-size="10" fill="#333">Instalacja</text>
            <path d="M 130 100 L 130 110 L 80 110 L 80 100" stroke="#666" stroke-width="1.5" fill="none" />
            <path d="M 130 100 L 130 110 L 180 110 L 180 100" stroke="#666" stroke-width="1.5" fill="none" />
            <text x="130" y="125" text-anchor="middle" font-size="8" fill="#666">połączenie równoległe</text>
          </svg>
        </div>
        `;
      }

      return "";
    }

    function readInitialSelections() {
      steps.forEach((step) => {
        const stepKey = step.dataset.stepKey;
        if (!stepKey || stepKey === "summary") return;

        const preselected = step.querySelector(
          ".option-card.selected, .product-card.selected"
        );
        if (preselected) {
          captureSelectionForCard(preselected);
        }
      });

      updateSummary();
    }

    /* ==========================================================================
     STICKY SELECTIONS BAR CONTROLLER (jak progress bar w kalkulatorze)
     ========================================================================== */

    const SelectionsBarController = {
      selectionsBar: null,
      placeholder: null,
      header: null,
      triggerOffset: 0,

      init() {
        this.selectionsBar = dom.byId("configurator-selections-bar");
        this.placeholder = dom.byId("selections-sticky-placeholder");
        this.header = dom.qs(".top-preview-header");

        if (!this.selectionsBar) {
          console.warn("[SelectionsBar] #configurator-selections-bar not found");
          return;
        }

        // Upewnij się, ÄąÄ˝e selections bar nie ma klasy sticky na poczĂ„â€¦tku
        this.selectionsBar.classList.remove("sticky");

        // Upewnij się, ÄąÄ˝e placeholder jest ukryty na poczĂ„â€¦tku
        if (this.placeholder) {
          this.placeholder.style.display = "none";
          this.placeholder.classList.remove("active");
        }

        // Ustaw poczĂ„â€¦tkowĂ„â€¦ pozycję triggera
        this.updateTriggerOffset();

        // Setup sticky behavior
        this.setupSticky();

        // Recalculate trigger po zaÄąâ€šadowaniu obrazÄ‚Ĺ‚w
        trackEvent(view, "load", () => {
          setTimeout(() => {
            this.updateTriggerOffset();
            // WywoÄąâ€šaj handleScroll po updateTriggerOffset, aby ustawiĂ„â€ˇ poczĂ„â€¦tkowy stan
            if (this.setupSticky && typeof this.handleScroll === "function") {
              this.handleScroll();
            }
          }, 100);
        });

        // Recalculate on window resize
        trackEvent(view, "resize", () => {
          this.updateTriggerOffset();
        });

        // Log tylko w trybie debug
        if (debug.__DEBUG_SELECTIONS_BAR) {
        }
      },

      updateTriggerOffset() {
        if (this.selectionsBar && this.header) {
          const headerHeight = this.header.offsetHeight || 60;
          // Pobierz pozycję selections bar względem viewport (nie offsetTop, bo moÄąÄ˝e byĂ„â€ˇ zmieniony przez sticky)
          const barRect = this.selectionsBar.getBoundingClientRect();
          const scrollTop = view.pageYOffset || doc.documentElement.scrollTop;
          const barTop = barRect.top + scrollTop;

          // Trigger: standardowo przykleja się gdy bar dojedzie pod header.
          // UX tweak (desktop): nie przyklejaj "za wczeÄąâ€şnie" Ă˘â‚¬â€ť dopiero gdy user realnie zjedzie w dÄ‚Ĺ‚Äąâ€š
          // (np. po mini przewinięciu headera / wynikÄ‚Ĺ‚w). Dzięki temu nie "zjada" ekranu od razu.
          const isDesktop =
            !!(view.matchMedia && view.matchMedia("(min-width: 1024px)").matches);
          const desktopExtra = isDesktop ? Math.max(160, Math.min(320, barRect.height * 2)) : 0;
          this.triggerOffset = barTop - headerHeight + desktopExtra;

          // Ustaw CSS variable dla sticky top position
          doc.documentElement.style.setProperty(
            "--header-height",
            `${headerHeight}px`
          );

          // Log tylko w trybie debug
          if (debug.__DEBUG_SELECTIONS_BAR) {
          }
        }
      },

      setupSticky() {
        let ticking = false;

        this.handleScroll = () => {
          if (!ticking) {
            view.requestAnimationFrame(() => {
              const scrollTop =
                view.pageYOffset ||
                doc.documentElement.scrollTop ||
                view.scrollY;

              if (this.selectionsBar) {
                // SprawdÄąĹź czy scroll przekroczyÄąâ€š trigger
                const shouldBeSticky = scrollTop > this.triggerOffset;

                if (
                  shouldBeSticky &&
                  !this.selectionsBar.classList.contains("sticky")
                ) {
                  // Przyklej do gÄ‚Ĺ‚ry
                  this.selectionsBar.classList.add("sticky");
                  if (this.placeholder) {
                    // Ustaw wysokość placeholder na wysokość paska (zapobiega skokowi treÄąâ€şci)
                    const barHeight = this.selectionsBar.offsetHeight;
                    this.placeholder.style.height = `${barHeight}px`;
                    this.placeholder.style.display = "block";
                    this.placeholder.classList.add("active");
                  }
                  // Log tylko w trybie debug
                  if (debug.__DEBUG_SELECTIONS_BAR) {
                  }
                } else if (
                  !shouldBeSticky &&
                  this.selectionsBar.classList.contains("sticky")
                ) {
                  // Odklej od gÄ‚Ĺ‚ry
                  this.selectionsBar.classList.remove("sticky");
                  if (this.placeholder) {
                    this.placeholder.style.display = "none";
                    this.placeholder.classList.remove("active");
                  }
                  // Log tylko w trybie debug
                  if (debug.__DEBUG_SELECTIONS_BAR) {
                  }
                }
              }

              ticking = false;
            });
            ticking = true;
          }
        };

        // WywoÄąâ€šaj na poczĂ„â€¦tku, aby ustawiĂ„â€ˇ poczĂ„â€¦tkowy stan
        this.handleScroll();

        trackEvent(view, "scroll", this.handleScroll);
      },
    };

    /* ==========================================================================
     INITIALIZATION (z configurator-new.js)
     ========================================================================== */

    function initConfigurator(rootElement, options = {}) {
      // Scope do root elementu
      if (!rootElement) {
        console.error("[Configurator] rootElement is required");
        return false;
      }

      const app = rootElement.querySelector("#configurator-app") || rootElement;
      if (!app) {
        console.warn("[Configurator] Missing #configurator-app under rootElement");
        return false;
      }

      if (app.dataset.initialized === "true") {
        return true;
      }

      const stepsContainer = app.querySelector("#configurator-steps");
      if (!stepsContainer) {
        console.error("[Configurator] Missing #configurator-steps");
        return false;
      }

      steps = Array.from(stepsContainer.querySelectorAll(".config-step"));
      if (!steps.length) {
        console.error("[Configurator] No .config-step elements");
        return false;
      }

      navPrev = app.querySelector("#nav-prev");
      navNext = app.querySelector("#nav-next");
      currentStepNumberEl = app.querySelector("#current-step-number");
      totalStepsNumberEl = app.querySelector("#total-steps-number");
      summaryBody = app.querySelector("#summary-rows");

      totalSteps = steps.length;
      currentStepIndex = 0;

      if (totalStepsNumberEl) {
        totalStepsNumberEl.textContent = String(totalSteps);
      }

      bindCardClicks();
      bindNavigation();
      bindSummaryActions();
      bindSelectionsBar();
      bindTooltips();

      readInitialSelections();
      showStep(0, true); // noScroll = true przy pierwszym pokazaniu

      // Przelicz reguły i ceny po inicjalizacji
      const evaluated = evaluateRules();
      if (evaluated) {
        applyRulesToUI(evaluated);
      }
      recompute();

      // Inicjalizuj sticky selections bar controller
      SelectionsBarController.init();

      app.dataset.initialized = "true";
      return true;
    }

    function initConfiguratorApp(rootElement, options = {}) {
      if (!rootElement) {
        console.error("[Configurator] rootElement is required");
        return false;
      }

      loadBufferRules().catch((e) => {
        console.warn("[Configurator] Failed to load buffer rules; using defaults", e);
      });

      loadPricesData().catch((e) => {
        console.warn("[Configurator] Failed to load pricing catalog; using fallback", e);
      });

      loadPresentationData().catch((e) => {
        console.warn("[Configurator] Failed to load presentation JSON; using inline fallback", e);
      });

      const result = initConfigurator(rootElement, options);

      if (result && (options.building || options.configData)) {
        setTimeout(() => {
          populateConfiguratorWithCalculatorData(options).catch((e) => {
            console.warn(
              "[Configurator] populateConfiguratorWithCalculatorData failed:",
              e
            );
          });
        }, 100);
      }

      return result;
    }

    function destroyConfiguratorApp() {
      const app = dom.byId("configurator-app");
      if (app) {
        app.dataset.initialized = "false";
      }
    }

    const runtimeConfiguratorApi = {
      init: initConfiguratorApp,
      destroy: destroyConfiguratorApp,
      saveState: saveConfiguratorState,
      loadState: loadConfiguratorState,
      restoreState: restoreConfiguratorState,
      recompute: recompute,
      loadFromCanonicalState(input) {
        const configData = input && typeof input === "object" ? input : null;
        if (!configData) {
          console.warn("[KONFIG:INIT] loadFromCanonicalState() called without configData");
          return false;
        }

        const app = dom.byId("configurator-app");
        if (!app) {
          console.error("[KONFIG:INIT] #configurator-app not found in DOM");
          return false;
        }

        const heatPumpModel =
          configData?.offer_dto?.engineering?.selection?.pumpModel ||
          configData?.pump_selection?.hp?.model ||
          configData?.pump_selection?.aio?.model ||
          configData?.selected_pump ||
          null;

        const bootOptions = {
          configData: configData,
          building: configData,
          system: {
            heatPumpModel: heatPumpModel,
            mode: "mono",
          },
          defaults: {
            buffer: "auto",
            cwu: "standard",
          },
          rootElement: app,
        };

        if (!configuratorInitDone) {
          configuratorInitDone = true;
          initConfiguratorApp(app, bootOptions);
          return true;
        }

        populateConfiguratorWithCalculatorData(bootOptions).catch((error) => {
          console.warn("[Configurator] loadFromCanonicalState repopulate failed:", error);
        });
        return true;
      },
    };

    if (runtimeAppState) {
      runtimeAppState.configurator = runtimeConfiguratorApi;
    }
    if (
      window.__HP_MODULES__ &&
      window.__HP_MODULES__.configurator &&
      typeof window.__HP_MODULES__.configurator === "object"
    ) {
      window.__HP_MODULES__.configurator.__lastRuntimeApi = runtimeConfiguratorApi;
    }

    if (konfigDebug()) {
      console.log("[KONFIG:INIT] dispatch heatpump:configuratorReady");
    }
    view.dispatchEvent(
      new CustomEvent("heatpump:configuratorReady", { detail: { root } })
    );
    if (konfigDebug()) {
      console.log("[KONFIG:INIT] init complete");
    }

    return function disposer() {
      if (konfigDebug()) {
        console.log("[KONFIG:INIT] disposer");
      }

      disposers.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error("[KONFIG:INIT] disposer callback failed", e);
        }
      });
    };
  }

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.configurator = {
    init,
    __lastRuntimeApi: null,
    getLastRuntimeApi() {
      return this.__lastRuntimeApi || null;
    },
    __test: {
      resolvePricingSource,
      isMasterPricingDataReady,
      PRICING_SOURCE_REASON_MASTER_UNAVAILABLE,
    },
  };
})(window);
