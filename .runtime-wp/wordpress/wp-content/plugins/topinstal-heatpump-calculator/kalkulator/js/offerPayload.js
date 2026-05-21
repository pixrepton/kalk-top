// === FILE: offerPayload.js ===
// Canonical offer payload builder (CRM/PDF/Email) – scoped, multi-instance safe.
// Exposes as ctx.state.offerPayload via __HP_MODULES__.offerPayload.init(ctx).
// Also supports Node tests via module.exports (no DOM required).

(function (global) {
  "use strict";

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch (_) {
      return null;
    }
  }

  function clampNumber(n, fallback = null) {
    const x = typeof n === "number" ? n : n != null ? Number(n) : NaN;
    return Number.isFinite(x) ? x : fallback;
  }

  function deriveFootprintAreaM2(lengthValue, widthValue) {
    const length = clampNumber(lengthValue, null);
    const width = clampNumber(widthValue, null);
    if (length === null || width === null) return null;
    return Math.round(length * width * 100) / 100;
  }

  function normalizePhone(input) {
    if (!input) return null;
    const raw = String(input).trim();
    if (!raw) return null;
    // Keep + and digits; remove spaces/dashes.
    const cleaned = raw.replace(/[^\d+]/g, "");
    return cleaned.length >= 7 ? cleaned : cleaned;
  }

  function normalizeEmail(input) {
    if (!input) return null;
    const v = String(input).trim().toLowerCase();
    return v || null;
  }

  function normalizePostalCode(input) {
    if (!input) return null;
    const v = String(input).trim();
    return v || null;
  }

  function parseUtmFromUrl(urlLike) {
    try {
      const u = new URL(String(urlLike || ""), "https://example.invalid");
      const p = u.searchParams;
      const utm = {
        source: p.get("utm_source"),
        medium: p.get("utm_medium"),
        campaign: p.get("utm_campaign"),
        term: p.get("utm_term"),
        content: p.get("utm_content"),
      };
      // Normalize empty -> null
      Object.keys(utm).forEach((k) => {
        if (utm[k] == null) utm[k] = null;
        else if (String(utm[k]).trim() === "") utm[k] = null;
      });
      return utm;
    } catch (_) {
      return { source: null, medium: null, campaign: null, term: null, content: null };
    }
  }

  function getDeviceType(view) {
    try {
      const v = view || (typeof window !== "undefined" ? window : null);
      if (v && v.matchMedia && v.matchMedia("(max-width: 767px)").matches) return "mobile";
      return "desktop";
    } catch (_) {
      return "desktop";
    }
  }

  function uuidV4() {
    try {
      const cryptoObj = global.crypto || (global.window && global.window.crypto);
      if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
        return cryptoObj.randomUUID();
      }
    } catch (_) {}
    // Fallback: RFC4122-ish (good enough for client correlation)
    const rnd = () => Math.floor(Math.random() * 0xffffffff);
    const hex = (n, len) => n.toString(16).padStart(len, "0");
    const a = rnd();
    const b = rnd();
    const c = rnd();
    const d = rnd();
    return (
      hex(a, 8) +
      "-" +
      hex((b >>> 16) & 0xffff, 4) +
      "-" +
      hex(((b >>> 0) & 0x0fff) | 0x4000, 4) +
      "-" +
      hex(((c >>> 16) & 0x3fff) | 0x8000, 4) +
      "-" +
      hex(((c & 0xffff) << 16) | ((d >>> 16) & 0xffff), 12)
    );
  }

  function getStorage(preferLocal = true) {
    try {
      if (preferLocal && global.localStorage) return global.localStorage;
    } catch (_) {}
    try {
      if (global.sessionStorage) return global.sessionStorage;
    } catch (_) {}
    return null;
  }

  function getOrCreateIds(storage, storageKey) {
    const nowIso = new Date().toISOString();
    const s = storage || getStorage(true);
    const key = String(storageKey || "wycena2025_offer_ids::default");
    if (!s) {
      return { lead_id: uuidV4(), session_id: uuidV4(), created_at_iso: nowIso, persisted: false };
    }
    const existing = safeJsonParse(s.getItem(key) || "");
    if (existing && existing.lead_id && existing.session_id) {
      return {
        lead_id: String(existing.lead_id),
        session_id: String(existing.session_id),
        created_at_iso: String(existing.created_at_iso || nowIso),
        persisted: true,
      };
    }
    const created = { lead_id: uuidV4(), session_id: uuidV4(), created_at_iso: nowIso };
    try {
      s.setItem(key, JSON.stringify(created));
      return { ...created, persisted: true };
    } catch (_) {
      return { ...created, persisted: false };
    }
  }

  function getConfiguratorSelection(ctx) {
    const state = ctx?.state || {};
    const appState =
      (typeof state.getAppState === "function" && state.getAppState()) ||
      (typeof global.getAppState === "function" ? global.getAppState() : null);
    const configuratorApi = state?.configuratorApi || appState?.configuratorApi || null;
    const selection =
      (configuratorApi && typeof configuratorApi.getSelection === "function"
        ? configuratorApi.getSelection()
        : null) ||
      appState?.configuratorSelection ||
      appState?.configuratorSelectionPayload ||
      global.configuratorSelection ||
      null;
    return selection;
  }

  function isStrictBackendMode() {
    const cfg = global.HEATPUMP_CONFIG || {};
    return cfg.useBackendCalc === true;
  }

  function getCanonicalOffer(appState, configurator) {
    try {
      if (typeof global.getCanonicalOffer === "function") {
        const fromState = global.getCanonicalOffer(appState);
        if (fromState) {
          return fromState;
        }
      }
    } catch (_) {}

    return appState?.canonicalOffer || appState?.offer || null;
  }

  function getCanonicalDraftRequest(appState) {
    return appState?.draftRequest || appState?.lastCalculationRequest || null;
  }

  function readSelectionOptionId(selection) {
    if (!selection) return null;
    if (typeof selection === "string") {
      const normalized = selection.trim();
      return normalized !== "" ? normalized : null;
    }
    if (typeof selection !== "object") return null;
    const optionId =
      selection.optionId != null
        ? String(selection.optionId).trim()
        : selection.id != null
        ? String(selection.id).trim()
        : "";
    return optionId !== "" ? optionId : null;
  }

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

  function sanitizeSupportedConfiguratorSelections(selections) {
    const rawSelections =
      selections && typeof selections === "object" ? selections : {};
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

  function sanitizeConfiguratorSnapshot(configurator) {
    if (!configurator || typeof configurator !== "object") {
      return configurator || null;
    }
    return {
      ...configurator,
      selections: sanitizeSupportedConfiguratorSelections(configurator.selections),
    };
  }

  function hasExplicitConfiguratorSelection(selection) {
    const optionId = readSelectionOptionId(selection);
    if (!optionId) return false;
    if (selection?.system === true) return false;
    if (optionId === "cwu-none") return false;
    return !/-na$/i.test(optionId);
  }

  function resolveServiceCloudVariantLabel(selection) {
    const explicitLabel =
      selection && typeof selection.label === "string" && selection.label.trim() !== ""
        ? selection.label.trim()
        : null;
    if (explicitLabel) return explicitLabel;

    const optionId = readSelectionOptionId(selection);
    if (optionId === "service-cloud") {
      return "Service Cloud";
    }

    return null;
  }

  function normalizeBooleanLike(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return null;
    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "tak"
    ) {
      return true;
    }
    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no" ||
      normalized === "nie"
    ) {
      return false;
    }
    return null;
  }

  function toYesNoLabel(value) {
    const normalized = normalizeBooleanLike(value);
    if (normalized === null) return null;
    return normalized ? "Tak" : "Nie";
  }

  function resolveBuildingTypeLabel(value) {
    const map = {
      single_house: "Dom jednorodzinny",
      single_family: "Dom jednorodzinny",
      double_house: "Bliźniak",
      semi_detached: "Bliźniak",
      row_house: "Szeregowiec",
      terraced_house: "Szeregowiec",
      apartment: "Mieszkanie",
      multifamily: "Budynek wielorodzinny",
    };
    if (!value) return null;
    return map[String(value)] || String(value);
  }

  function resolveConstructionTypeLabel(value) {
    if (!value) return null;
    if (value === "traditional") return "Tradycyjna";
    if (value === "canadian") return "Szkieletowa";
    return String(value);
  }

  function resolveWindowsLabel(value) {
    const map = {
      "2021_triple_glass": "Trójszybowe 2021+",
      "2021_double_glass": "Nowoczesne (2021+), dwuszybowe",
      "new_triple_glass": "Trójszybowe",
      "new_double_glass": "Dwuszybowe nowe",
      "semi_new_double_glass": "Dwuszybowe",
      "old_double_glass": "Dwuszybowe stare",
      "old_single_glass": "Jednoszybowe",
    };
    if (!value) return null;
    return map[String(value)] || String(value);
  }

  function resolveHeatingTypeLabel(offerDto, requestBuilding, formData) {
    const raw =
      offerDto?.engineering?.selection?.type ||
      requestBuilding?.heating_type ||
      requestBuilding?.installation_type ||
      formData?.heating_type ||
      formData?.installation_type ||
      null;
    if (!raw) return null;
    if (raw === "surface" || raw === "underfloor" || raw === "floor") {
      return "Ogrzewanie podłogowe";
    }
    if (raw === "radiators") {
      return "Grzejniki";
    }
    if (raw === "mixed") {
      return "Mieszane";
    }
    return String(raw);
  }

  function resolveProjectionContext(ctx, options = {}) {
    const state = ctx?.state || {};
    const root = ctx?.root || null;
    const view =
      root?.ownerDocument?.defaultView ||
      (typeof window !== "undefined" ? window : null) ||
      global;
    const appState =
      (typeof state.getAppState === "function" && state.getAppState()) ||
      (typeof global.getAppState === "function" ? global.getAppState() : null) ||
      {};
    const configurator = sanitizeConfiguratorSnapshot(getConfiguratorSelection(ctx));
    const safeConfigurator = sanitizeConfiguratorSnapshot(configurator);
    const configuratorSelections = sanitizeSupportedConfiguratorSelections(
      safeConfigurator?.selections
    );
    const canonicalOffer = getCanonicalOffer(appState, safeConfigurator);
    const draftRequest = getCanonicalDraftRequest(appState);
    const requestBuilding =
      draftRequest?.building && typeof draftRequest.building === "object"
        ? draftRequest.building
        : {};
    const formData =
      appState?.formData && typeof appState.formData === "object"
        ? appState.formData
        : {};

    return {
      state,
      root,
      view,
      appState,
      configurator,
      canonicalOffer,
      draftRequest,
      requestBuilding,
      formData,
      strictBackendMode: isStrictBackendMode(),
      options: options && typeof options === "object" ? options : {},
    };
  }

  function emitProjectionEvent(ctx, eventName, meta = {}) {
    const details = meta && typeof meta === "object" ? meta : {};
    try {
      if (typeof global.topinstalTrackEvent === "function") {
        global.topinstalTrackEvent(eventName, {
          source: "calc",
          tab: 5,
          stepKey: "projection",
          meta: details,
        });
      }
    } catch (_) {}
    try {
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(`[offerPayload] ${eventName}`, details);
      }
    } catch (_) {}
  }

  function requireOfferDtoForProjection(ctx, target, meta = {}) {
    const context = resolveProjectionContext(ctx, meta);
    if (context.canonicalOffer && typeof context.canonicalOffer === "object") {
      return context.canonicalOffer;
    }
    emitProjectionEvent(ctx, "offer_projection_missing_offer_dto", {
      target: target || "projection",
      ...(meta && typeof meta === "object" ? meta : {}),
    });
    return null;
  }

  function buildDocumentEnergyProfileRows(offerDto, requestBuilding, formData) {
    const rows = [];
    const pushRow = (label, value) => {
      if (value === null || value === undefined || value === "") return;
      rows.push({ label: String(label), value: String(value) });
    };

    const heatedArea =
      clampNumber(offerDto?.engineering?.ozc?.heatedArea_m2, null) ??
      clampNumber(requestBuilding?.heated_area, null) ??
      clampNumber(requestBuilding?.floor_area, null) ??
      clampNumber(requestBuilding?.total_area, null);
    const indoorTemperature =
      clampNumber(formData?.indoor_temperature, null) ??
      clampNumber(formData?.indoor_temp, null) ??
      clampNumber(requestBuilding?.indoor_temperature, null);
    const outdoorTemperature =
      clampNumber(requestBuilding?.design_outdoor_temperature, null) ??
      clampNumber(requestBuilding?.outdoor_design_temperature, null) ??
      clampNumber(requestBuilding?.temperature_outside, null);
    const heatingType = resolveHeatingTypeLabel(offerDto, requestBuilding, formData);
    const dhwEnabled =
      normalizeBooleanLike(requestBuilding?.include_hot_water) ??
      normalizeBooleanLike(formData?.include_hot_water);

    if (heatedArea !== null) {
      pushRow("Pow. ogrzewana", `${Math.round(heatedArea * 10) / 10} m²`);
    }
    if (indoorTemperature !== null) {
      pushRow("Temp. wew.", `${Math.round(indoorTemperature * 10) / 10} °C`);
    }
    if (outdoorTemperature !== null) {
      pushRow("Temp. projektowa", `${Math.round(outdoorTemperature * 10) / 10} °C`);
    }
    pushRow("System ogrzewania", heatingType);
    if (dhwEnabled !== null) {
      pushRow("CWU", dhwEnabled ? "Tak" : "Nie");
    }

    return rows;
  }

  function buildDocumentRecommendedModels(offerDto) {
    const selection = offerDto?.engineering?.selection || {};
    const fromOffer = Array.isArray(selection?.recommendedModels)
      ? selection.recommendedModels
          .map((entry) => {
            if (typeof entry === "string" && entry.trim() !== "") {
              return {
                title: entry.trim(),
                type: selection?.type || "",
                kit: entry.trim(),
                power_kw:
                  clampNumber(selection?.capacity_kW, null) != null
                    ? String(clampNumber(selection.capacity_kW, null))
                    : "",
              };
            }
            if (!entry || typeof entry !== "object") return null;
            const title = entry?.name || entry?.model || selection?.pumpModel || null;
            if (!title) return null;
            return {
              title: String(title),
              type: entry?.type || selection?.type || "",
              kit: entry?.kit || entry?.model || selection?.pumpModel || "",
              power_kw:
                entry?.power_kW ||
                entry?.powerKw ||
                entry?.capacity_kW ||
                entry?.capacityKw ||
                clampNumber(selection?.capacity_kW, null) ||
                "",
            };
          })
          .filter(Boolean)
      : [];

    if (fromOffer.length > 0) {
      return fromOffer;
    }

    const pumpModel =
      selection?.pumpModel ||
      selection?.pumpSelection?.hp?.model ||
      selection?.pumpSelection?.aio?.model ||
      null;
    if (!pumpModel) {
      return [];
    }

    return [
      {
        title: String(pumpModel),
        type: selection?.type || "",
        kit: String(pumpModel),
        power_kw:
          clampNumber(selection?.capacity_kW, null) != null
            ? String(clampNumber(selection.capacity_kW, null))
            : "",
      },
    ];
  }

  function buildDocumentBuildingInfo(requestBuilding, formData) {
    const includeHotWater =
      normalizeBooleanLike(requestBuilding?.include_hot_water) ??
      normalizeBooleanLike(formData?.include_hot_water);
    const buildingLength =
      clampNumber(requestBuilding?.building_length, null) ??
      clampNumber(formData?.building_length, null);
    const buildingWidth =
      clampNumber(requestBuilding?.building_width, null) ??
      clampNumber(formData?.building_width, null);
    const footprintArea =
      clampNumber(requestBuilding?.floor_area, null) ??
      clampNumber(formData?.floor_area, null) ??
      deriveFootprintAreaM2(buildingLength, buildingWidth);

    return {
      building_type: requestBuilding?.building_type || null,
      building_type_label: resolveBuildingTypeLabel(requestBuilding?.building_type),
      construction_year:
        requestBuilding?.construction_year ?? formData?.construction_year ?? null,
      construction_type: resolveConstructionTypeLabel(
        requestBuilding?.construction_type ?? formData?.construction_type
      ),
      building_length: buildingLength,
      building_width: buildingWidth,
      floor_area: footprintArea,
      floor_perimeter:
        clampNumber(requestBuilding?.floor_perimeter, null) ??
        clampNumber(formData?.floor_perimeter, null),
      building_floors:
        requestBuilding?.building_floors ?? formData?.building_floors ?? null,
      floor_height:
        clampNumber(requestBuilding?.floor_height, null) ??
        clampNumber(formData?.floor_height, null),
      building_roof: requestBuilding?.building_roof ?? formData?.building_roof ?? null,
      has_basement: toYesNoLabel(requestBuilding?.has_basement ?? formData?.has_basement),
      has_balcony: toYesNoLabel(requestBuilding?.has_balcony ?? formData?.has_balcony),
      has_garage: toYesNoLabel(requestBuilding?.has_garage ?? formData?.has_garage),
      garage_type: requestBuilding?.garage_type ?? formData?.garage_type ?? null,
      wall_size:
        clampNumber(requestBuilding?.wall_size, null) ??
        clampNumber(formData?.wall_size, null),
      external_wall_isolation_size:
        requestBuilding?.external_wall_isolation?.size ??
        formData?.external_wall_isolation?.size ??
        null,
      external_wall_isolation_material:
        requestBuilding?.external_wall_isolation?.material ??
        formData?.external_wall_isolation?.material ??
        null,
      top_isolation_material:
        requestBuilding?.top_isolation?.material ??
        formData?.top_isolation?.material ??
        null,
      top_isolation_size:
        requestBuilding?.top_isolation?.size ??
        formData?.top_isolation?.size ??
        null,
      bottom_isolation_material:
        requestBuilding?.bottom_isolation?.material ??
        formData?.bottom_isolation?.material ??
        null,
      bottom_isolation_size:
        requestBuilding?.bottom_isolation?.size ??
        formData?.bottom_isolation?.size ??
        null,
      internal_wall_isolation_material:
        requestBuilding?.internal_wall_isolation?.material ??
        formData?.internal_wall_isolation?.material ??
        null,
      internal_wall_isolation_size:
        requestBuilding?.internal_wall_isolation?.size ??
        formData?.internal_wall_isolation?.size ??
        null,
      primary_wall_material:
        requestBuilding?.primary_wall_material ??
        formData?.primary_wall_material ??
        null,
      secondary_wall_material:
        requestBuilding?.secondary_wall_material ??
        formData?.secondary_wall_material ??
        null,
      doors_type: requestBuilding?.doors_type ?? formData?.doors_type ?? null,
      number_doors: requestBuilding?.number_doors ?? formData?.number_doors ?? null,
      windows: resolveWindowsLabel(
        requestBuilding?.windows_type ?? formData?.windows_type
      ),
      number_windows:
        requestBuilding?.number_windows ?? formData?.number_windows ?? null,
      indoor_temperature:
        clampNumber(formData?.indoor_temperature, null) ??
        clampNumber(formData?.indoor_temp, null) ??
        clampNumber(requestBuilding?.indoor_temperature, null),
      ventilation_type:
        requestBuilding?.ventilation_type ?? formData?.ventilation_type ?? null,
      include_hot_water: includeHotWater === null ? null : includeHotWater ? "Tak" : "Nie",
      hot_water_persons:
        requestBuilding?.hot_water_persons ?? formData?.hot_water_persons ?? null,
      hot_water_usage:
        requestBuilding?.hot_water_usage ?? formData?.hot_water_usage ?? null,
      on_corner: toYesNoLabel(requestBuilding?.on_corner ?? formData?.on_corner),
      whats_over: requestBuilding?.whats_over ?? formData?.whats_over ?? null,
      whats_under: requestBuilding?.whats_under ?? formData?.whats_under ?? null,
      whats_north: requestBuilding?.whats_north ?? formData?.whats_north ?? null,
      whats_south: requestBuilding?.whats_south ?? formData?.whats_south ?? null,
      whats_east: requestBuilding?.whats_east ?? formData?.whats_east ?? null,
      whats_west: requestBuilding?.whats_west ?? formData?.whats_west ?? null,
      detailed_insulation_mode: formData?.detailed_insulation_mode === true,
      walls_insulation_level:
        formData?.walls_insulation_level ??
        requestBuilding?.walls_insulation_level ??
        null,
      roof_insulation_level:
        formData?.roof_insulation_level ??
        requestBuilding?.roof_insulation_level ??
        null,
      floor_insulation_level:
        formData?.floor_insulation_level ??
        requestBuilding?.floor_insulation_level ??
        null,
    };
  }

  function mapOfferItemsToLineItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((it) => ({
      sku: it?.sku || null,
      name: it?.name || it?.sku || null,
      qty: it?.qty != null ? clampNumber(it.qty, 1) : 1,
      unit_price: it?.unitPriceNet != null ? clampNumber(it.unitPriceNet, null) : null,
      total: it?.totalNet != null ? clampNumber(it.totalNet, null) : null,
    }));
  }

  function mapOfferItemsToMachineRoomItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
      const quantity = clampNumber(item?.qty, 1) || 1;
      const unitNet = clampNumber(item?.unitPriceNet, 0) || 0;
      const totalNet = clampNumber(item?.totalNet, unitNet * quantity) || 0;
      const vatRate = clampNumber(item?.vatRate, 0.08) || 0.08;
      return {
        name: item?.name || item?.sku || "Pozycja",
        quantity: quantity,
        qty: quantity,
        unit_price_pln: unitNet,
        unit_price: unitNet,
        total_pln: totalNet,
        total: totalNet,
        vat_rate: vatRate,
        total_brutto_pln:
          clampNumber(item?.totalGross, null) ??
          Math.round(totalNet * (1 + vatRate) * 100) / 100,
      };
    });
  }

  function normalizeHydraulicsRecommendationFromOffer(bufferResult) {
    if (!bufferResult || typeof bufferResult !== "object") return null;

    const rawSetup = String(bufferResult?.setupType || "")
      .trim()
      .toUpperCase();
    const litersRaw = clampNumber(bufferResult?.liters, 0);
    const liters = litersRaw > 0 ? litersRaw : null;

    let recommendation = "NONE";
    let setupType = "NONE";

    if (rawSetup.indexOf("SZEREG") !== -1 || rawSetup === "SERIES_BYPASS") {
      recommendation = "BUFOR_SZEREGOWO";
      setupType = "SERIES_BYPASS";
    } else if (
      rawSetup.indexOf("ROWNO") !== -1 ||
      rawSetup.indexOf("RÓWNO") !== -1 ||
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
      ? bufferResult.reasonCodes.map((code) => String(code))
      : [];
    const dominantReason = reasonCodes.length > 0 ? reasonCodes[0] : null;

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

  function mergeHydraulicsRecommendation(offerHydraulics, configuratorHydraulics) {
    if (!offerHydraulics) return configuratorHydraulics || null;
    if (!configuratorHydraulics || typeof configuratorHydraulics !== "object") {
      return offerHydraulics;
    }

    return {
      ...configuratorHydraulics,
      ...offerHydraulics,
      axes: configuratorHydraulics.axes || offerHydraulics.axes || null,
      explanation: {
        ...(configuratorHydraulics.explanation || {}),
        ...(offerHydraulics.explanation || {}),
      },
    };
  }

  function buildOfferPayload(ctx, options = {}) {
    const state = ctx?.state || {};
    const root = ctx?.root || null;
    const view =
      root?.ownerDocument?.defaultView ||
      (typeof window !== "undefined" ? window : null) ||
      global;

    const instanceId =
      state.instanceId ||
      root?.getAttribute?.("data-hp-instance") ||
      "default";

    const ids = getOrCreateIds(getStorage(true), `wycena2025_offer_ids::${String(instanceId)}`);

    const appState =
      (typeof state.getAppState === "function" && state.getAppState()) ||
      (typeof global.getAppState === "function" ? global.getAppState() : null) ||
      {};
    const includePii = options.includePii === true;
    const leadInput = options.leadInput || {};

    const utm = parseUtmFromUrl(
      options.page_url || (view && view.location ? view.location.href : "")
    );

    const configurator = getConfiguratorSelection(ctx);
    const safeConfigurator = sanitizeConfiguratorSnapshot(configurator);
    const configuratorSelections = sanitizeSupportedConfiguratorSelections(
      safeConfigurator?.selections
    );
    const canonicalOffer = getCanonicalOffer(appState, safeConfigurator);
    const draftRequest = getCanonicalDraftRequest(appState);
    const requestBuilding =
      draftRequest?.building && typeof draftRequest.building === "object"
        ? draftRequest.building
        : {};
    const lastResult =
      appState?.lastResult && typeof appState.lastResult === "object"
        ? appState.lastResult
        : global.lastResult && typeof global.lastResult === "object"
        ? global.lastResult
        : {};
    const canonicalPricing =
      canonicalOffer?.pricing && typeof canonicalOffer.pricing === "object"
        ? canonicalOffer.pricing
        : null;
    const pricingCatalogVersion =
      canonicalPricing?.catalogVersion != null &&
      String(canonicalPricing.catalogVersion).trim() !== ""
        ? String(canonicalPricing.catalogVersion).trim()
        : canonicalOffer?.engineMeta?.masterDataVersion != null &&
          String(canonicalOffer.engineMeta.masterDataVersion).trim() !== ""
        ? String(canonicalOffer.engineMeta.masterDataVersion).trim()
        : null;
    const pricingSource =
      canonicalPricing?.source != null && String(canonicalPricing.source).trim() !== ""
        ? String(canonicalPricing.source).trim()
        : canonicalOffer
        ? "backend_pricebook"
        : null;
    const totalGross = clampNumber(canonicalPricing?.totals?.gross, null);
    const totalNet = clampNumber(canonicalPricing?.totals?.net, null);
    const pricingVatRate =
      clampNumber(canonicalPricing?.vatRate, null) ??
      clampNumber(canonicalPricing?.items?.[0]?.vatRate, null) ??
      (options.vat_rate != null ? clampNumber(options.vat_rate, null) : null);

    const pumpModel =
      canonicalOffer?.engineering?.selection?.pumpModel ||
      (safeConfigurator?.products?.pump &&
        (safeConfigurator.products.pump.model || safeConfigurator.products.pump.name)) ||
      configuratorSelections.pompa?.label ||
      null;

    const designHeatLossKw =
      clampNumber(canonicalOffer?.engineering?.ozc?.designHeatLoss_kW, null) ??
      clampNumber(canonicalOffer?.engineering?.ozc?.recommendedPower_kW, null) ??
      clampNumber(requestBuilding?.design_heat_loss_kw, null) ??
      null;

    const indoorTempC =
      clampNumber(appState?.formData?.indoor_temperature, null) ??
      clampNumber(appState?.formData?.indoor_temp, null) ??
      clampNumber(draftRequest?.preferences?.heating?.indoorTemperatureC, null) ??
      clampNumber(requestBuilding?.indoor_temperature, null);
    const circulationSelection = configuratorSelections.cyrkulacja || null;
    const serviceSelection =
      configuratorSelections.service || null;
    const mountingSelection = configuratorSelections.posadowienie || null;
    const reducerSelection = configuratorSelections.reduktor || null;
    const waterTreatmentSelection = configuratorSelections.woda || null;

    // Valid until: current date + 14 days
    const OFFER_VALIDITY_DAYS = 14;
    const now = new Date();
    const validUntilIso = new Date(now.getTime() + OFFER_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const validUntilLabel = validUntilIso.split('T')[0];

    const payload = {
      schema_version: "offer_v1",
      calc_version: String(options.calc_version || state?.config?.calcVersion || "unknown"),
      pricing_version: String(
        options.pricing_version ||
          pricingCatalogVersion ||
          state?.config?.pricingVersion ||
          "unknown"
      ),
      created_at_iso: new Date().toISOString(),
      lead: {
        lead_id: ids.lead_id,
        session_id: ids.session_id,
        name: includePii ? (leadInput.name || null) : null,
        email: includePii ? normalizeEmail(leadInput.email) : null,
        phone: includePii ? normalizePhone(leadInput.phone) : null,
        city: includePii ? (leadInput.city || null) : null,
        postal_code: includePii ? normalizePostalCode(leadInput.postal_code) : null,
        preferred_contact_time: includePii ? (leadInput.preferred_contact_time || null) : null,
        consents: {
          terms_accept: !!leadInput.consents?.terms_accept,
          rodo_contact: !!leadInput.consents?.rodo_contact,
          marketing_opt_in: !!leadInput.consents?.marketing_opt_in,
        },
        utm: utm,
      },
      building: {
        designHeatLoss_kW: designHeatLossKw,
        heatedArea_m2:
          clampNumber(canonicalOffer?.engineering?.ozc?.heatedArea_m2, null) ??
          clampNumber(requestBuilding?.heated_area, null) ??
          clampNumber(requestBuilding?.floor_area, null) ??
          clampNumber(lastResult?.heated_area, null),
        indoor_temp_C: indoorTempC,
        location_zip: includePii ? normalizePostalCode(leadInput.postal_code) : null,
        insulation_level: {
          construction_year: appState?.formData?.construction_year ?? null,
          construction_type: appState?.formData?.construction_type ?? null,
          walls_insulation_level: appState?.formData?.walls_insulation_level ?? null,
          roof_insulation_level: appState?.formData?.roof_insulation_level ?? null,
          floor_insulation_level: appState?.formData?.floor_insulation_level ?? null,
          windows_type: appState?.formData?.windows_type ?? null,
        },
      },
      selection: {
        heatpump: {
          brand:
            canonicalOffer?.engineering?.selection?.brand ||
            safeConfigurator?.products?.pump?.brand ||
            (pumpModel && /panasonic/i.test(pumpModel) ? "Panasonic" : null),
          model: pumpModel,
          type:
            canonicalOffer?.engineering?.selection?.type ||
            safeConfigurator?.products?.pump?.type ||
            null,
          power_kW:
            clampNumber(canonicalOffer?.engineering?.selection?.capacity_kW, null) ??
            clampNumber(safeConfigurator?.products?.pump?.power_kW, null),
          cop: clampNumber(safeConfigurator?.products?.pump?.cop, null),
          refrigerant: safeConfigurator?.products?.pump?.refrigerant || null,
          noise_db: clampNumber(safeConfigurator?.products?.pump?.noise_db, null),
          dimensions: safeConfigurator?.products?.pump?.dimensions || null,
        },
        cwu: safeConfigurator?.products?.cwu
          ? {
              model:
                safeConfigurator.products.cwu.model ||
                safeConfigurator.products.cwu.name ||
                null,
              liters: clampNumber(safeConfigurator.products.cwu.liters, null),
            }
          : null,
        buffer: safeConfigurator?.products?.buffer
          ? {
              liters:
                clampNumber(canonicalOffer?.engineering?.buffer?.liters, null) ??
                clampNumber(safeConfigurator.products.buffer.liters, null),
              mount_type:
                canonicalOffer?.engineering?.buffer?.setupType ||
                safeConfigurator.products.buffer.mount_type ||
                null,
            }
          : canonicalOffer?.engineering?.buffer
          ? {
              liters: clampNumber(canonicalOffer.engineering.buffer.liters, null),
              mount_type: canonicalOffer.engineering.buffer.setupType || null,
            }
          : null,
        circulation_cwu: hasExplicitConfiguratorSelection(circulationSelection)
          ? {
              enabled: readSelectionOptionId(circulationSelection) === "cyrkulacja-tak",
              variant: circulationSelection.label || null,
            }
          : null,
        service_cloud: hasExplicitConfiguratorSelection(serviceSelection)
          ? {
              enabled: readSelectionOptionId(serviceSelection) === "service-cloud",
              variant: resolveServiceCloudVariantLabel(serviceSelection),
            }
          : null,
        outdoor_unit_mount: hasExplicitConfiguratorSelection(mountingSelection)
          ? {
              variant: mountingSelection.label || null,
            }
          : null,
        pressure_reducer: hasExplicitConfiguratorSelection(reducerSelection)
          ? {
              enabled: readSelectionOptionId(reducerSelection) === "reduktor-tak",
              variant: reducerSelection.label || null,
            }
          : null,
        water_treatment: hasExplicitConfiguratorSelection(waterTreatmentSelection)
          ? {
              variant: waterTreatmentSelection.label || null,
            }
          : null,
      },
      pricing: {
        total_gross_pln: totalGross,
        total_net_pln: totalNet,
        vat_rate: pricingVatRate,
        margin_pln: options.margin_pln != null ? clampNumber(options.margin_pln, null) : null,
        source: pricingSource,
        catalog_version: pricingCatalogVersion,
        line_items:
          Array.isArray(canonicalPricing?.items) && canonicalPricing.items.length > 0
            ? mapOfferItemsToLineItems(canonicalPricing.items)
            : [],
      },
      meta: {
        page_url: (view && view.location ? String(view.location.href) : null) || null,
        referrer: (view && view.document ? String(view.document.referrer || "") : "") || null,
        device: getDeviceType(view),
        offer_valid_until_iso: validUntilIso,
        offer_valid_until_label: validUntilLabel,
      },
    };

    return payload;
  }

  function buildPricingBreakdownSnapshot(canonicalOffer) {
    const pricing = canonicalOffer?.pricing || {};
    const offerItems = Array.isArray(pricing.items) ? pricing.items : [];

    if (!canonicalOffer) {
      return {
        source: "pending",
        items: [],
        totals: { net: 0, vat: 0, gross: 0 },
        vat_rate: 0.08,
      };
    }

    const items = offerItems.map((item) => {
        const quantity = clampNumber(item?.qty, 1) || 1;
        const unitNet = clampNumber(item?.unitPriceNet, 0) || 0;
        const totalNet = clampNumber(item?.totalNet, unitNet * quantity) || 0;
        const vatRate = clampNumber(item?.vatRate, 0.08) || 0.08;
        return {
          name: item?.name || item?.sku || "—",
          quantity: quantity,
          unit_price_pln: unitNet,
          vat_rate: vatRate,
          total_price_pln:
            clampNumber(item?.totalGross, null) ??
            Math.round(totalNet * (1 + vatRate) * 100) / 100,
        };
      });

    return {
      source: "offer_dto",
      items: items,
      totals: {
        net:
          clampNumber(pricing?.totals?.net, null) ??
          Math.round(
            items.reduce(
              (sum, item) =>
                sum +
                (clampNumber(item.unit_price_pln, 0) || 0) *
                  (clampNumber(item.quantity, 1) || 1),
              0
            ) * 100
          ) / 100,
        vat:
          clampNumber(pricing?.totals?.vat, null) ??
          Math.round(
            items.reduce((sum, item) => {
              const gross = clampNumber(item.total_price_pln, 0) || 0;
              const rate = clampNumber(item.vat_rate, 0.08) || 0.08;
              return sum + gross - gross / (1 + rate);
            }, 0) * 100
          ) / 100,
        gross:
          clampNumber(pricing?.totals?.gross, null) ??
          Math.round(
            items.reduce((sum, item) => sum + (clampNumber(item.total_price_pln, 0) || 0), 0) *
              100
          ) / 100,
      },
      vat_rate:
        clampNumber(offerItems?.[0]?.vatRate, null) ??
        clampNumber(pricing?.vatRate, null) ??
        0.08,
    };

  }

  function buildMachineRoomSnapshot(canonicalOffer, configurator) {
    const safeConfigurator = sanitizeConfiguratorSnapshot(configurator);
    const offerItems = mapOfferItemsToMachineRoomItems(canonicalOffer?.pricing?.items);
    const offerHydraulics = normalizeHydraulicsRecommendationFromOffer(
      canonicalOffer?.engineering?.buffer || null
    );
    const configuratorHydraulics = safeConfigurator?.recommendations?.hydraulics || null;

    if (!canonicalOffer) {
      return {
        source: "empty",
        items: [],
        total_netto_pln: 0,
        total_brutto_pln: 0,
        selections: safeConfigurator?.selections || {},
        products: safeConfigurator?.products || {},
        recommendations: {
          ...(safeConfigurator?.recommendations || {}),
          hydraulics: mergeHydraulicsRecommendation(
            offerHydraulics,
            configuratorHydraulics
          ),
        },
      };
    }

    return {
      source: "offer_dto",
      items: offerItems,
      total_netto_pln:
        clampNumber(canonicalOffer?.pricing?.totals?.net, null) ?? 0,
      total_brutto_pln:
        clampNumber(canonicalOffer?.pricing?.totals?.gross, null) ?? 0,
      selections: safeConfigurator?.selections || {},
      products: safeConfigurator?.products || {},
      recommendations: {
        ...(safeConfigurator?.recommendations || {}),
        hydraulics: mergeHydraulicsRecommendation(
          offerHydraulics,
          configuratorHydraulics
        ),
      },
    };
  }

  function buildPresentationSnapshot(ctx, options = {}) {
    const state = ctx?.state || {};
    const appState =
      (typeof state.getAppState === "function" && state.getAppState()) ||
      (typeof global.getAppState === "function" ? global.getAppState() : null) ||
      {};
    const configurator = getConfiguratorSelection(ctx);
    const canonicalOffer = getCanonicalOffer(appState, configurator);
    const offerPayload = buildOfferPayload(ctx, options);
    const pricingBreakdown = buildPricingBreakdownSnapshot(canonicalOffer);
    const machineRoom = buildMachineRoomSnapshot(canonicalOffer, configurator);

    return {
      offerDto: canonicalOffer || null,
      configuratorSnapshot: configurator || null,
      offerPayload: offerPayload,
      pricingBreakdown: pricingBreakdown,
      machineRoom: machineRoom,
      summaryOffer: {
        building: {
          designHeatLoss_kW:
            clampNumber(canonicalOffer?.engineering?.ozc?.designHeatLoss_kW, null) ??
            clampNumber(canonicalOffer?.engineering?.ozc?.recommendedPower_kW, null),
        },
        selection: {
          heatpump: {
            model: offerPayload?.selection?.heatpump?.model || null,
          },
        },
        pricing: {
          total_net_pln: clampNumber(offerPayload?.pricing?.total_net_pln, null),
          total_vat_pln:
            clampNumber(pricingBreakdown?.totals?.vat, null) ??
            clampNumber(canonicalOffer?.pricing?.totals?.vat, null),
          total_gross_pln: clampNumber(offerPayload?.pricing?.total_gross_pln, null),
          vat_rate:
            clampNumber(pricingBreakdown?.vat_rate, null) ??
            clampNumber(canonicalOffer?.pricing?.vatRate, null) ??
            0.08,
          items: pricingBreakdown?.items || [],
        },
        meta: {
          offer_valid_until_label: offerPayload?.meta?.offer_valid_until_label || "—",
        },
        __offerDto: canonicalOffer || null,
      },
    };
  }

  // Minimal helper: build configData shape consumed by pdfGenerator.js (download & email).
  // Intentionally conservative (only must-have fields for PDF generation).
  function buildPdfConfigData(ctx, options = {}) {
    const state = ctx?.state || {};
    const root = ctx?.root || null;
    const view =
      root?.ownerDocument?.defaultView ||
      (typeof window !== "undefined" ? window : null) ||
      global;

    const appState =
      (typeof state.getAppState === "function" && state.getAppState()) ||
      (typeof global.getAppState === "function" ? global.getAppState() : null) ||
      {};
    const presentationSnapshot = buildPresentationSnapshot(ctx, options);
    const configurator = presentationSnapshot.configuratorSnapshot;
    const canonicalOffer = presentationSnapshot.offerDto;
    const draftRequest = getCanonicalDraftRequest(appState);
    const requestBuilding =
      draftRequest?.building && typeof draftRequest.building === "object"
        ? draftRequest.building
        : {};

    const configData = {
      offer_dto: canonicalOffer || null,
      recommended_power_kw:
        clampNumber(canonicalOffer?.engineering?.ozc?.recommendedPower_kW, null) ??
        clampNumber(canonicalOffer?.engineering?.ozc?.designHeatLoss_kW, null) ??
        clampNumber(requestBuilding?.recommended_power_kw, null) ??
        clampNumber(requestBuilding?.design_heat_loss_kw, null),
      max_heating_power:
        clampNumber(canonicalOffer?.engineering?.ozc?.designHeatLoss_kW, null) ??
        clampNumber(requestBuilding?.design_heat_loss_kw, null),
      heated_area:
        clampNumber(canonicalOffer?.engineering?.ozc?.heatedArea_m2, null) ??
        clampNumber(requestBuilding?.heated_area, null) ??
        clampNumber(requestBuilding?.floor_area, null) ??
        clampNumber(requestBuilding?.total_area, null),
      design_outdoor_temperature:
        clampNumber(requestBuilding?.design_outdoor_temperature, null) ??
        clampNumber(requestBuilding?.outdoor_design_temperature, null) ??
        clampNumber(requestBuilding?.temperature_outside, null),
      indoor_temperature: appState?.formData?.indoor_temperature ?? null,
      models_intro:
        "Wybrane modele gwarantują stabilną, cichą i ekonomiczną pracę przez cały sezon grzewczy.",
      models_outro:
        "Zestaw obejmuje pełny pakiet komponentów dopasowanych do Twojego budynku.",
      pricing: canonicalOffer?.pricing || null,
      selections:
        sanitizeSupportedConfiguratorSelections(configurator?.selections) ||
        canonicalOffer?.engineering?.selection ||
        null,
      machine_room: presentationSnapshot.machineRoom,
    };

    // Attach canonical contract (optional field – never breaks existing PDF templates)
    try {
      configData.offer_payload = presentationSnapshot.offerPayload;
    } catch (_) {}

    return configData;
  }

  function buildCanonicalPdfConfigData(ctx, options = {}) {
    const context = resolveProjectionContext(ctx, options);
    const canonicalOffer = requireOfferDtoForProjection(
      ctx,
      options?.target || "document",
      { channel: options?.channel || "document" }
    );
    const configData = {
      offer_dto: canonicalOffer || null,
      projection_blocked_reason: canonicalOffer ? null : "missing_offer_dto",
      energy_profile_rows: [],
      recommended_models: [],
      energy_losses: [],
      improvements: [],
      costs_comparison: [],
      costs_assumptions: null,
      bivalent_points: [],
      pricing: null,
      selections: null,
      machine_room: {
        source: "empty",
        items: [],
        total_netto_pln: 0,
        total_brutto_pln: 0,
        selections: {},
        products: {},
        recommendations: {},
      },
      models_intro:
        "Wybrane modele gwarantują stabilną, cichą i ekonomiczną pracę przez cały sezon grzewczy.",
      models_outro:
        "Zestaw obejmuje pełny pakiet komponentów dopasowanych do Twojego budynku.",
      offer_payload: null,
      building_type: context.requestBuilding?.building_type || null,
      building_type_label: resolveBuildingTypeLabel(context.requestBuilding?.building_type),
      heating_type_label: resolveHeatingTypeLabel(
        canonicalOffer,
        context.requestBuilding,
        context.formData
      ),
      recommended_power_kw: null,
      max_heating_power: null,
      heated_area: null,
      design_outdoor_temperature:
        clampNumber(context.requestBuilding?.design_outdoor_temperature, null) ??
        clampNumber(context.requestBuilding?.outdoor_design_temperature, null) ??
        clampNumber(context.requestBuilding?.temperature_outside, null),
      indoor_temperature:
        clampNumber(context.formData?.indoor_temperature, null) ??
        clampNumber(context.formData?.indoor_temp, null) ??
        clampNumber(context.requestBuilding?.indoor_temperature, null),
      ...buildDocumentBuildingInfo(context.requestBuilding, context.formData),
    };

    if (!canonicalOffer) {
      return configData;
    }

    const offerPayload = buildOfferPayload(ctx, options);
    const machineRoom = buildMachineRoomSnapshot(
      canonicalOffer,
      context.configurator
    );

    configData.recommended_power_kw =
      clampNumber(canonicalOffer?.engineering?.ozc?.recommendedPower_kW, null) ??
      clampNumber(canonicalOffer?.engineering?.ozc?.designHeatLoss_kW, null);
    configData.max_heating_power =
      clampNumber(canonicalOffer?.engineering?.ozc?.designHeatLoss_kW, null);
    configData.heated_area =
      clampNumber(canonicalOffer?.engineering?.ozc?.heatedArea_m2, null) ??
      clampNumber(offerPayload?.building?.heatedArea_m2, null);
    configData.energy_profile_rows = buildDocumentEnergyProfileRows(
      canonicalOffer,
      context.requestBuilding,
      context.formData
    );
    configData.recommended_models = buildDocumentRecommendedModels(canonicalOffer);
    configData.pricing = canonicalOffer?.pricing || null;
    configData.selections =
      sanitizeSupportedConfiguratorSelections(context.configurator?.selections) ||
      canonicalOffer?.engineering?.selection ||
      null;
    configData.machine_room = machineRoom;
    configData.offer_payload = offerPayload;

    return configData;
  }

  function init(ctx) {
    const state = ctx?.state || (ctx.state = {});
    const root = ctx?.root || null;
    const instanceId =
      state.instanceId ||
      root?.getAttribute?.("data-hp-instance") ||
      "default";

    const storageKey = `wycena2025_offer_ids::${String(instanceId)}`;
    const ids = getOrCreateIds(getStorage(true), storageKey);

    state.offerIds = { lead_id: ids.lead_id, session_id: ids.session_id };
    const projectionApi = state.offerProjection || null;
    state.offerPayload = {
      buildOfferPayload: (options) => buildOfferPayload(ctx, options),
      buildPdfConfigData: (options) => {
        if (projectionApi && typeof projectionApi.resolveInputFromRuntime === "function") {
          const input = projectionApi.resolveInputFromRuntime({
            ...(options || {}),
            target: options?.target || "document",
            channel: options?.channel || "document",
          });
          return projectionApi.buildDocumentPayload(input);
        }
        return buildCanonicalPdfConfigData(ctx, options);
      },
      buildPresentationSnapshot: (options) => {
        if (projectionApi && typeof projectionApi.resolveInputFromRuntime === "function") {
          const input = projectionApi.resolveInputFromRuntime({
            ...(options || {}),
            target: options?.target || "summary",
            channel: options?.channel || "ui",
          });
          return {
            offerDto: input.offerDto || null,
            configuratorSnapshot: input.configuratorSelection || null,
            summaryOffer: projectionApi.buildSummaryViewModel(input),
            pricingBreakdown: projectionApi.buildSummaryViewModel(input)?.breakdown || null,
            machineRoom: projectionApi.buildDocumentPayload(input)?.machine_room || null,
          };
        }
        return buildPresentationSnapshot(ctx, options);
      },
      emitProjectionEvent: (eventName, meta) => emitProjectionEvent(ctx, eventName, meta),
      getCanonicalOfferDto: () =>
        projectionApi && typeof projectionApi.resolveInputFromRuntime === "function"
          ? projectionApi.resolveInputFromRuntime({ target: "projection" }).offerDto || null
          : requireOfferDtoForProjection(ctx, "projection"),
      parseUtmFromUrl,
      getDeviceType,
    };

    return function disposeOfferPayload() {
      // Keep ids persisted, but remove helpers from ctx.state on dispose.
      try {
        if (state.offerPayload) delete state.offerPayload;
      } catch (_) {}
    };
  }

  // Register module for app boot
  if (global && typeof global === "object") {
    global.__HP_MODULES__ = global.__HP_MODULES__ || {};
    global.__HP_MODULES__.offerPayload = { init };
  }

  // Node test exports
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      parseUtmFromUrl,
      getDeviceType,
      getOrCreateIds,
      uuidV4,
      buildOfferPayload,
      buildPdfConfigData: buildCanonicalPdfConfigData,
      buildPresentationSnapshot,
      buildMachineRoomSnapshot,
      emitProjectionEvent,
      requireOfferDtoForProjection,
      normalizeEmail,
      normalizePhone,
      normalizePostalCode,
    };
  }
})(typeof window !== "undefined" ? window : globalThis);

