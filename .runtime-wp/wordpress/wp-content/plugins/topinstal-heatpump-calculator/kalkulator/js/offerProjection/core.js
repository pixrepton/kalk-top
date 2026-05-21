(function (global) {
  "use strict";

  const namespace =
    global.__HP_OFFER_PROJECTION__ || (global.__HP_OFFER_PROJECTION__ = {});

  function getOnceStore() {
    if (!global.__HP_OFFER_PROJECTION_ONCE__) {
      global.__HP_OFFER_PROJECTION_ONCE__ = new Set();
    }
    return global.__HP_OFFER_PROJECTION_ONCE__;
  }

  function clampNumber(value, fallback = null) {
    const numberValue =
      typeof value === "number" ? value : value != null ? Number(value) : NaN;
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  function pickFirst(values, fallback = null) {
    const list = Array.isArray(values) ? values : [];
    for (let index = 0; index < list.length; index += 1) {
      const value = list[index];
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }
    return fallback;
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

  function deriveFootprintAreaM2(lengthValue, widthValue) {
    const length = clampNumber(lengthValue, null);
    const width = clampNumber(widthValue, null);
    if (length === null || width === null) return null;
    return Math.round(length * width * 100) / 100;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readSelectionOptionId(selection) {
    if (!selection) return null;
    if (typeof selection === "string") {
      const normalized = selection.trim();
      return normalized !== "" ? normalized : null;
    }
    if (typeof selection !== "object") return null;
    const optionId =
      typeof selection.optionId === "string" && selection.optionId.trim() !== ""
        ? selection.optionId.trim()
        : typeof selection.id === "string" && selection.id.trim() !== ""
        ? selection.id.trim()
        : null;
    return optionId;
  }

  function hasExplicitConfiguratorSelection(selection) {
    const optionId = readSelectionOptionId(selection);
    if (!optionId) return false;
    if (selection?.system === true) return false;
    if (optionId === "cwu-none") return false;
    return !/-na$/i.test(optionId);
  }

  function normalizeLeadData(leadData) {
    const input = leadData && typeof leadData === "object" ? leadData : {};
    return {
      name: input.name || null,
      email: input.email || null,
      phone: input.phone || null,
      city: input.city || null,
      postal_code: input.postal_code || null,
      preferred_contact_time: input.preferred_contact_time || null,
      consents: input.consents && typeof input.consents === "object" ? input.consents : {},
    };
  }

  function normalizeUiContext(uiContext) {
    const input = uiContext && typeof uiContext === "object" ? uiContext : {};
    return {
      locale:
        typeof input.locale === "string" && input.locale.trim() !== ""
          ? input.locale.trim()
          : "pl-PL",
      target:
        typeof input.target === "string" && input.target.trim() !== ""
          ? input.target.trim()
          : "projection",
      channel:
        typeof input.channel === "string" && input.channel.trim() !== ""
          ? input.channel.trim()
          : "ui",
      documentMode:
        typeof input.documentMode === "string" && input.documentMode.trim() !== ""
          ? input.documentMode.trim()
          : "offer",
      featureFlags:
        input.featureFlags && typeof input.featureFlags === "object"
          ? input.featureFlags
          : {},
      requestBuildingSnapshot:
        input.requestBuildingSnapshot && typeof input.requestBuildingSnapshot === "object"
          ? input.requestBuildingSnapshot
          : {},
      formData:
        input.formData && typeof input.formData === "object" ? input.formData : {},
      runtimeMeta:
        input.runtimeMeta && typeof input.runtimeMeta === "object"
          ? input.runtimeMeta
          : {},
    };
  }

  function buildOfferProjectionContext(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      offerDto:
        source.offerDto && typeof source.offerDto === "object" ? source.offerDto : null,
      leadData: normalizeLeadData(source.leadData),
      configuratorSelection:
        source.configuratorSelection && typeof source.configuratorSelection === "object"
          ? source.configuratorSelection
          : null,
      uiContext: normalizeUiContext(source.uiContext),
      rawInput: source,
    };
  }

  function emitProjectionEvent(context, eventName, meta = {}, options = {}) {
    const details = meta && typeof meta === "object" ? meta : {};
    const onceKey =
      options && typeof options === "object" ? options.onceKey || null : null;

    if (onceKey) {
      const onceStore = getOnceStore();
      if (onceStore.has(onceKey)) {
        return false;
      }
      onceStore.add(onceKey);
    }

    try {
      if (typeof global.topinstalTrackEvent === "function") {
        global.topinstalTrackEvent(eventName, {
          source: "calc",
          tab: 5,
          stepKey: "projection",
          meta: {
            target: context?.uiContext?.target || "projection",
            channel: context?.uiContext?.channel || "ui",
            ...(details || {}),
          },
        });
      }
    } catch (_) {}

    try {
      const logger =
        eventName.indexOf("missing") >= 0 || eventName.indexOf("legacy") >= 0
          ? console.warn
          : console.info;
      if (typeof logger === "function") {
        logger(`[offerProjection] ${eventName}`, details);
      }
    } catch (_) {}

    return true;
  }

  function markProjectionUsed(context, eventName, target) {
    emitProjectionEvent(
      context,
      eventName,
      {
        target: target || context?.uiContext?.target || "projection",
      },
      {
        onceKey: `${String(eventName)}::${String(
          target || context?.uiContext?.target || "projection"
        )}`,
      }
    );
  }

  function requireOfferDto(context, target) {
    if (context?.offerDto && typeof context.offerDto === "object") {
      return context.offerDto;
    }

    emitProjectionEvent(
      context,
      "offer_projection_missing_offer_dto",
      {
        target: target || context?.uiContext?.target || "projection",
      },
      {
        onceKey: `offer_projection_missing_offer_dto::${String(
          target || context?.uiContext?.target || "projection"
        )}`,
      }
    );

    return null;
  }

  function formatCurrencyPln(value, locale = "pl-PL") {
    const numeric = clampNumber(value, null);
    if (numeric === null) return "—";
    try {
      return `${Math.round(numeric).toLocaleString(locale)} zl`;
    } catch (_) {
      return `${String(Math.round(numeric))} zl`;
    }
  }

  function formatDemandKw(value) {
    const numeric = clampNumber(value, null);
    if (numeric === null) return "—";
    const rounded = Math.round(numeric * 10) / 10;
    return rounded.toFixed(rounded % 1 === 0 ? 0 : 1);
  }

  function resolveBuildingTypeLabel(value) {
    const map = {
      single_house: "Dom jednorodzinny",
      single_family: "Dom jednorodzinny",
      house: "Dom jednorodzinny",
      double_house: "Blizniak",
      semi_detached: "Blizniak",
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
      "2021_triple_glass": "Trojszybowe 2021+",
      "2021_double_glass": "Nowoczesne 2021+, dwuszybowe",
      "new_triple_glass": "Trojszybowe",
      "new_double_glass": "Dwuszybowe nowe",
      "semi_new_double_glass": "Dwuszybowe",
      "old_double_glass": "Dwuszybowe stare",
      "old_single_glass": "Jednoszybowe",
    };
    if (!value) return null;
    return map[String(value)] || String(value);
  }

  function selectTraceId(context) {
    return (
      context?.offerDto?.traceId ||
      context?.uiContext?.runtimeMeta?.traceId ||
      null
    );
  }

  function selectPumpModel(context) {
    return pickFirst([
      context?.offerDto?.engineering?.selection?.pumpSelection?.hp?.model,
      context?.offerDto?.engineering?.selection?.pumpSelection?.aio?.model,
      context?.offerDto?.engineering?.selection?.pumpModel,
      context?.configuratorSelection?.products?.pump?.model,
      context?.configuratorSelection?.products?.pump?.name,
      context?.configuratorSelection?.selections?.pompa?.label,
    ]);
  }

  function selectHeatLoadKw(context) {
    return pickFirst(
      [
        clampNumber(context?.offerDto?.engineering?.ozc?.designHeatLoss_kW, null),
        clampNumber(context?.offerDto?.engineering?.ozc?.recommendedPower_kW, null),
      ],
      null
    );
  }

  function selectRecommendedPowerKw(context) {
    return pickFirst(
      [
        clampNumber(context?.offerDto?.engineering?.ozc?.recommendedPower_kW, null),
        clampNumber(context?.offerDto?.engineering?.ozc?.designHeatLoss_kW, null),
      ],
      null
    );
  }

  function selectHeatedAreaM2(context) {
    return pickFirst(
      [
        clampNumber(context?.offerDto?.engineering?.ozc?.heatedArea_m2, null),
        clampNumber(context?.uiContext?.requestBuildingSnapshot?.heated_area, null),
        clampNumber(context?.uiContext?.requestBuildingSnapshot?.floor_area, null),
        clampNumber(context?.uiContext?.requestBuildingSnapshot?.total_area, null),
      ],
      null
    );
  }

  function selectTotalGross(context) {
    return pickFirst(
      [
        clampNumber(context?.offerDto?.pricing?.totals?.gross, null),
        clampNumber(context?.offerDto?.pricing?.total_gross_pln, null),
      ],
      null
    );
  }

  function selectTotalNet(context) {
    return pickFirst(
      [
        clampNumber(context?.offerDto?.pricing?.totals?.net, null),
        clampNumber(context?.offerDto?.pricing?.total_net_pln, null),
      ],
      null
    );
  }

  function selectTotalVat(context) {
    return pickFirst(
      [
        clampNumber(context?.offerDto?.pricing?.totals?.vat, null),
        clampNumber(context?.offerDto?.pricing?.total_vat_pln, null),
      ],
      null
    );
  }

  function selectVatRate(context) {
    return pickFirst(
      [
        clampNumber(context?.offerDto?.pricing?.vatRate, null),
        clampNumber(context?.offerDto?.pricing?.items?.[0]?.vatRate, null),
      ],
      0.08
    );
  }

  function resolveHeatingTypeLabel(context) {
    const raw = pickFirst([
      context?.offerDto?.engineering?.selection?.type,
      context?.uiContext?.requestBuildingSnapshot?.heating_type,
      context?.uiContext?.requestBuildingSnapshot?.installation_type,
      context?.uiContext?.formData?.heating_type,
      context?.uiContext?.formData?.installation_type,
    ]);

    if (!raw) return null;
    if (raw === "surface" || raw === "underfloor" || raw === "floor") {
      return "Ogrzewanie podlogowe";
    }
    if (raw === "radiators") {
      return "Grzejniki";
    }
    if (raw === "mixed") {
      return "Mieszane";
    }
    return String(raw);
  }

  function resolveBuildingTypeFromContext(context) {
    return resolveBuildingTypeLabel(
      pickFirst([
        context?.offerDto?.context?.buildingType,
        context?.offerDto?.engineering?.ozc?.buildingType,
        context?.uiContext?.requestBuildingSnapshot?.building_type,
        context?.uiContext?.formData?.building_type,
      ])
    );
  }

  function buildPricingBreakdown(context) {
    const items = Array.isArray(context?.offerDto?.pricing?.items)
      ? context.offerDto.pricing.items
      : [];

    const normalizedItems = items.map((item) => {
      const quantity = clampNumber(item?.qty, 1) || 1;
      const unitNet = clampNumber(item?.unitPriceNet, 0) || 0;
      const totalNet = clampNumber(item?.totalNet, unitNet * quantity) || 0;
      const vatRate = clampNumber(item?.vatRate, 0.08) || 0.08;
      const totalGross =
        clampNumber(item?.totalGross, null) ??
        Math.round(totalNet * (1 + vatRate) * 100) / 100;

      return {
        name: item?.name || item?.sku || "Pozycja",
        quantity,
        unit_price_pln: unitNet,
        total_net_pln: totalNet,
        vat_rate: vatRate,
        total_price_pln: totalGross,
      };
    });

    return {
      items: normalizedItems,
      totals: {
        net:
          clampNumber(context?.offerDto?.pricing?.totals?.net, null) ??
          normalizedItems.reduce(
            (sum, item) => sum + (clampNumber(item.total_net_pln, 0) || 0),
            0
          ),
        vat:
          clampNumber(context?.offerDto?.pricing?.totals?.vat, null) ??
          normalizedItems.reduce((sum, item) => {
            const gross = clampNumber(item.total_price_pln, 0) || 0;
            const net = clampNumber(item.total_net_pln, 0) || 0;
            return sum + (gross - net);
          }, 0),
        gross:
          clampNumber(context?.offerDto?.pricing?.totals?.gross, null) ??
          normalizedItems.reduce(
            (sum, item) => sum + (clampNumber(item.total_price_pln, 0) || 0),
            0
          ),
      },
      vat_rate: selectVatRate(context),
    };
  }

  function mapOfferItemsToMachineRoomItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
      const quantity = clampNumber(item?.qty, 1) || 1;
      const unitNet = clampNumber(item?.unitPriceNet, 0) || 0;
      const totalNet = clampNumber(item?.totalNet, unitNet * quantity) || 0;
      const vatRate = clampNumber(item?.vatRate, 0.08) || 0.08;
      return {
        sku:
          typeof item?.sku === "string" && item.sku.trim() !== ""
            ? item.sku.trim()
            : typeof item?.code === "string" && item.code.trim() !== ""
            ? item.code.trim()
            : "",
        code:
          typeof item?.code === "string" && item.code.trim() !== ""
            ? item.code.trim()
            : typeof item?.sku === "string" && item.sku.trim() !== ""
            ? item.sku.trim()
            : "",
        option_id:
          typeof item?.optionId === "string" && item.optionId.trim() !== ""
            ? item.optionId.trim()
            : "",
        name: item?.name || item?.sku || "Pozycja",
        quantity,
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

  function pickConfiguratorSelection(selections, keys) {
    const source = selections && typeof selections === "object" ? selections : {};
    const aliases = Array.isArray(keys) ? keys : [keys];
    for (let index = 0; index < aliases.length; index += 1) {
      const key = aliases[index];
      const value = source?.[key];
      if (value && typeof value === "object") {
        return value;
      }
    }
    return null;
  }

  function pickConfiguratorProduct(products, keys) {
    const source = products && typeof products === "object" ? products : {};
    const aliases = Array.isArray(keys) ? keys : [keys];
    for (let index = 0; index < aliases.length; index += 1) {
      const key = aliases[index];
      const value = source?.[key];
      if (value && typeof value === "object") {
        return value;
      }
    }
    return null;
  }

  function parseCapacityFromOptionId(optionId) {
    const normalized =
      typeof optionId === "string" && optionId.trim() !== ""
        ? optionId.trim()
        : "";
    if (!normalized) return null;
    const match = normalized.match(/(\d+)(?!.*\d)/);
    return match ? clampNumber(match[1], null) : null;
  }

  function resolveMachineRoomComponentLabel(selection, product, fallbackLabel) {
    const explicitSelectionLabel =
      typeof selection?.label === "string" && selection.label.trim() !== ""
        ? selection.label.trim()
        : null;
    if (explicitSelectionLabel) {
      return explicitSelectionLabel;
    }

    const explicitProductLabel = pickFirst(
      [
        typeof product?.label === "string" ? product.label.trim() : null,
        typeof product?.name === "string" ? product.name.trim() : null,
        typeof product?.title === "string" ? product.title.trim() : null,
        typeof product?.model === "string" ? product.model.trim() : null,
      ],
      null
    );

    return explicitProductLabel || fallbackLabel || null;
  }

  function buildMachineRoomSelectedComponents(context) {
    const selections = context?.configuratorSelection?.selections || {};
    const products = context?.configuratorSelection?.products || {};
    const offerSelection = context?.offerDto?.engineering?.selection || {};

    const pumpSelection = pickConfiguratorSelection(selections, ["pompa", "pump"]);
    const pumpProduct = pickConfiguratorProduct(products, ["pump", "pompa"]);
    const cwuSelection = pickConfiguratorSelection(selections, ["cwu"]);
    const cwuProduct = pickConfiguratorProduct(products, ["cwu"]);
    const bufferSelection = pickConfiguratorSelection(selections, ["bufor", "buffer"]);
    const serviceSelection = pickFirst(
      [selections?.service, selections?.service_cloud],
      null
    );
    const bufferProduct = pickConfiguratorProduct(products, ["buffer", "bufor"]);

    const pumpType = pickFirst(
      [
        typeof pumpProduct?.type === "string" ? pumpProduct.type.trim() : null,
        typeof offerSelection?.type === "string" ? offerSelection.type.trim() : null,
      ],
      null
    );

    const cwuOptionId = readSelectionOptionId(cwuSelection);
    const bufferOptionId = readSelectionOptionId(bufferSelection);

    return {
      pump: {
        label: resolveMachineRoomComponentLabel(
          pumpSelection,
          pumpProduct,
          typeof offerSelection?.pumpModel === "string"
            ? offerSelection.pumpModel
            : null
        ),
        optionId: readSelectionOptionId(pumpSelection),
        model: pickFirst(
          [
            typeof pumpProduct?.model === "string" ? pumpProduct.model.trim() : null,
            typeof offerSelection?.pumpModel === "string"
              ? offerSelection.pumpModel.trim()
              : null,
          ],
          null
        ),
        name: pickFirst(
          [
            typeof pumpProduct?.name === "string" ? pumpProduct.name.trim() : null,
            typeof pumpProduct?.title === "string" ? pumpProduct.title.trim() : null,
          ],
          null
        ),
        type: pumpType,
        power_kw: pickFirst(
          [
            clampNumber(pumpProduct?.power_kW, null),
            clampNumber(pumpProduct?.power, null),
            clampNumber(offerSelection?.capacity_kW, null),
          ],
          null
        ),
      },
      cwu: {
        label: resolveMachineRoomComponentLabel(cwuSelection, cwuProduct, null),
        optionId: cwuOptionId,
        capacity_l: pickFirst(
          [
            clampNumber(cwuProduct?.liters, null),
            clampNumber(cwuProduct?.capacity_l, null),
            parseCapacityFromOptionId(cwuOptionId),
          ],
          null
        ),
        material: pickFirst(
          [
            typeof cwuProduct?.material === "string" ? cwuProduct.material.trim() : null,
            cwuOptionId && cwuOptionId.indexOf("inox") >= 0 ? "inox" : null,
            cwuOptionId && cwuOptionId.indexOf("emalia") >= 0 ? "emalia" : null,
          ],
          null
        ),
        name: pickFirst(
          [
            typeof cwuProduct?.name === "string" ? cwuProduct.name.trim() : null,
            typeof cwuProduct?.title === "string" ? cwuProduct.title.trim() : null,
          ],
          null
        ),
      },
      buffer: {
        label: resolveMachineRoomComponentLabel(bufferSelection, bufferProduct, null),
        optionId: bufferOptionId,
        capacity_l: pickFirst(
          [
            clampNumber(bufferProduct?.liters, null),
            clampNumber(bufferProduct?.capacity_l, null),
            parseCapacityFromOptionId(bufferOptionId),
          ],
          null
        ),
        setup_type: pickFirst(
          [
            typeof bufferProduct?.mount_type === "string"
              ? bufferProduct.mount_type.trim()
              : null,
            typeof bufferProduct?.setupType === "string"
              ? bufferProduct.setupType.trim()
              : null,
            typeof context?.offerDto?.engineering?.buffer?.setupType === "string"
              ? context.offerDto.engineering.buffer.setupType.trim()
              : null,
          ],
          null
        ),
      },
      circulation: {
        label: resolveMachineRoomComponentLabel(
          pickConfiguratorSelection(selections, ["cyrkulacja"]),
          null,
          null
        ),
        optionId: readSelectionOptionId(
          pickConfiguratorSelection(selections, ["cyrkulacja"])
        ),
      },
      service: {
        label: resolveMachineRoomComponentLabel(
          serviceSelection,
          null,
          readSelectionOptionId(serviceSelection) === "service-cloud"
            ? "Service Cloud"
            : null
        ),
        optionId: readSelectionOptionId(serviceSelection),
      },
      foundation: {
        label: resolveMachineRoomComponentLabel(
          pickConfiguratorSelection(selections, ["posadowienie"]),
          null,
          null
        ),
        optionId: readSelectionOptionId(
          pickConfiguratorSelection(selections, ["posadowienie"])
        ),
      },
      pressure_reducer: {
        label: resolveMachineRoomComponentLabel(
          pickConfiguratorSelection(selections, ["reduktor"]),
          null,
          null
        ),
        optionId: readSelectionOptionId(pickConfiguratorSelection(selections, ["reduktor"])),
      },
      water_treatment: {
        label: resolveMachineRoomComponentLabel(
          pickConfiguratorSelection(selections, ["woda"]),
          null,
          null
        ),
        optionId: readSelectionOptionId(pickConfiguratorSelection(selections, ["woda"])),
      },
    };
  }

  function buildMachineRoomSummaryRows(selectedComponents) {
    const components =
      selectedComponents && typeof selectedComponents === "object"
        ? selectedComponents
        : {};
    const rows = [];
    const pushRow = (key, label, value) => {
      if (typeof value !== "string" || value.trim() === "") return;
      rows.push({
        key,
        label,
        value: value.trim(),
      });
    };

    pushRow("pump", "Pompa ciepła", components?.pump?.label);
    pushRow("cwu", "Zasobnik CWU", components?.cwu?.label);
    pushRow("buffer", "Bufor CO", components?.buffer?.label);
    pushRow("circulation", "Cyrkulacja CWU", components?.circulation?.label);
    pushRow("service", "Service Cloud", components?.service?.label);
    pushRow("foundation", "Posadowienie", components?.foundation?.label);
    pushRow(
      "pressure_reducer",
      "Reduktor ciśnienia",
      components?.pressure_reducer?.label
    );
    pushRow("water_treatment", "Uzdatnianie wody", components?.water_treatment?.label);

    return rows;
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
      rawSetup.indexOf("ROWNO") !== -1 ||
      rawSetup === "PARALLEL_CLUTCH"
    ) {
      recommendation = "BUFOR_ROWNOLEGLE";
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
      recommendation,
      buffer_liters: liters,
      setupType,
      reason_codes: reasonCodes,
      severity: recommendation === "NONE" ? "INFO" : "MANDATORY",
      type:
        recommendation === "NONE"
          ? "none"
          : recommendation === "BUFOR_SZEREGOWO"
          ? "storage"
          : "both",
      dominantReason,
      explanation: {
        short: dominantReason || "Backend recommendation",
        long: dominantReason || "Backend recommendation",
      },
    };
  }

  function mergeHydraulicsRecommendation(offerHydraulics, configuratorHydraulics) {
    if (offerHydraulics && typeof offerHydraulics === "object") {
      return offerHydraulics;
    }
    return configuratorHydraulics || null;
  }

  function buildMachineRoomSnapshot(context) {
    const selectedComponents = buildMachineRoomSelectedComponents(context);
    return {
      source: context?.offerDto?.pricing?.items?.length ? "offer_dto" : "empty",
      trace_id: selectTraceId(context),
      generated_at: new Date().toISOString(),
      items: mapOfferItemsToMachineRoomItems(context?.offerDto?.pricing?.items),
      total_netto_pln: selectTotalNet(context) || 0,
      total_brutto_pln: selectTotalGross(context) || 0,
      selections: context?.configuratorSelection?.selections || {},
      products: context?.configuratorSelection?.products || {},
      selected_components: selectedComponents,
      summary_rows: buildMachineRoomSummaryRows(selectedComponents),
      recommendations: {
        ...(context?.configuratorSelection?.recommendations || {}),
        hydraulics: mergeHydraulicsRecommendation(
          normalizeHydraulicsRecommendationFromOffer(
            context?.offerDto?.engineering?.buffer || null
          ),
          context?.configuratorSelection?.recommendations?.hydraulics || null
        ),
      },
    };
  }

  function buildDocumentEnergyProfileRows(context) {
    const rows = [];
    const pushRow = (label, value) => {
      if (value === null || value === undefined || value === "") return;
      rows.push({ label: String(label), value: String(value) });
    };

    const heatedArea = selectHeatedAreaM2(context);
    const indoorTemperature = pickFirst(
      [
        clampNumber(context?.uiContext?.formData?.indoor_temperature, null),
        clampNumber(context?.uiContext?.formData?.indoor_temp, null),
        clampNumber(
          context?.uiContext?.requestBuildingSnapshot?.indoor_temperature,
          null
        ),
      ],
      null
    );
    const outdoorTemperature = pickFirst(
      [
        clampNumber(
          context?.uiContext?.requestBuildingSnapshot?.design_outdoor_temperature,
          null
        ),
        clampNumber(
          context?.uiContext?.requestBuildingSnapshot?.outdoor_design_temperature,
          null
        ),
        clampNumber(
          context?.uiContext?.requestBuildingSnapshot?.temperature_outside,
          null
        ),
        clampNumber(
          context?.offerDto?.engineering?.ozc?.metrics?.design_outdoor_temperature,
          null
        ),
        clampNumber(
          context?.offerDto?.engineering?.ozc?.design_outdoor_temperature,
          null
        ),
        clampNumber(
          context?.uiContext?.configData?.design_outdoor_temperature,
          null
        ),
      ],
      null
    );

    if (heatedArea !== null) {
      pushRow("Pow. ogrzewana", `${Math.round(heatedArea * 10) / 10} m2`);
    }
    if (indoorTemperature !== null) {
      pushRow("Temp. wew.", `${Math.round(indoorTemperature * 10) / 10} C`);
    }
    if (outdoorTemperature !== null) {
      pushRow("Temp. projektowa", `${Math.round(outdoorTemperature * 10) / 10} C`);
    }
    pushRow("System ogrzewania", resolveHeatingTypeLabel(context));

    const hotWaterEnabled =
      normalizeBooleanLike(
        context?.uiContext?.requestBuildingSnapshot?.include_hot_water
      ) ??
      normalizeBooleanLike(context?.uiContext?.formData?.include_hot_water);
    if (hotWaterEnabled !== null) {
      pushRow("CWU", hotWaterEnabled ? "Tak" : "Nie");
    }

    return rows;
  }

  function buildDocumentRecommendedModels(context) {
    const selection = context?.offerDto?.engineering?.selection || {};
    const recommendedModels = Array.isArray(selection?.recommendedModels)
      ? selection.recommendedModels
      : [];

    if (recommendedModels.length === 0) {
      const model = selectPumpModel(context);
      if (!model) return [];
      return [
        {
          title: String(model),
          type: selection?.type || "",
          kit: String(model),
          power_kw:
            clampNumber(selection?.capacity_kW, null) != null
              ? String(clampNumber(selection.capacity_kW, null))
              : "",
        },
      ];
    }

    return recommendedModels
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
            clampNumber(entry?.power_kW, null) != null
              ? String(clampNumber(entry.power_kW, null))
              : clampNumber(selection?.capacity_kW, null) != null
              ? String(clampNumber(selection.capacity_kW, null))
              : "",
        };
      })
      .filter(Boolean);
  }

  function buildDocumentBuildingInfo(context) {
    const requestBuilding = context?.uiContext?.requestBuildingSnapshot || {};
    const formData = context?.uiContext?.formData || {};
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
        requestBuilding?.top_isolation?.size ?? formData?.top_isolation?.size ?? null,
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
        requestBuilding?.primary_wall_material ?? formData?.primary_wall_material ?? null,
      secondary_wall_material:
        requestBuilding?.secondary_wall_material ??
        formData?.secondary_wall_material ??
        null,
      doors_type: requestBuilding?.doors_type ?? formData?.doors_type ?? null,
      number_doors: requestBuilding?.number_doors ?? formData?.number_doors ?? null,
      windows: resolveWindowsLabel(requestBuilding?.windows_type ?? formData?.windows_type),
      number_windows:
        requestBuilding?.number_windows ?? formData?.number_windows ?? null,
      indoor_temperature: pickFirst(
        [
          clampNumber(formData?.indoor_temperature, null),
          clampNumber(formData?.indoor_temp, null),
          clampNumber(requestBuilding?.indoor_temperature, null),
        ],
        null
      ),
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

  const api = {
    clampNumber,
    pickFirst,
    normalizeBooleanLike,
    toYesNoLabel,
    escapeHtml,
    readSelectionOptionId,
    hasExplicitConfiguratorSelection,
    buildOfferProjectionContext,
    emitProjectionEvent,
    markProjectionUsed,
    requireOfferDto,
    formatCurrencyPln,
    formatDemandKw,
    resolveBuildingTypeLabel,
    resolveConstructionTypeLabel,
    resolveWindowsLabel,
    resolveHeatingTypeLabel,
    resolveBuildingTypeFromContext,
    selectTraceId,
    selectPumpModel,
    selectHeatLoadKw,
    selectRecommendedPowerKw,
    selectHeatedAreaM2,
    selectTotalGross,
    selectTotalNet,
    selectTotalVat,
    selectVatRate,
    buildPricingBreakdown,
    buildMachineRoomSnapshot,
    buildDocumentEnergyProfileRows,
    buildDocumentRecommendedModels,
    buildDocumentBuildingInfo,
  };

  namespace.core = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
