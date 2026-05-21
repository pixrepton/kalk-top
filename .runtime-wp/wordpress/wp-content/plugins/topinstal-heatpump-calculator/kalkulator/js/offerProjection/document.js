(function (global) {
  "use strict";

  const namespace =
    global.__HP_OFFER_PROJECTION__ || (global.__HP_OFFER_PROJECTION__ = {});
  const core =
    namespace.core ||
    (typeof require === "function" ? require("./core.js") : null);

  function readExtendedOzc(offerDto) {
    return offerDto?.engineering?.ozc?.extended &&
      typeof offerDto.engineering.ozc.extended === "object"
      ? offerDto.engineering.ozc.extended
      : {};
  }

  function normalizeEnergyLosses(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const name =
          typeof entry.name === "string" && entry.name.trim() !== ""
            ? entry.name.trim()
            : typeof entry.label === "string" && entry.label.trim() !== ""
            ? entry.label.trim()
            : null;
        const percent = core.clampNumber(
          entry.percent ?? entry.share_percent ?? entry.value,
          null
        );
        if (!name || percent === null) return null;
        return {
          ...entry,
          name,
          percent,
        };
      })
      .filter(Boolean);
  }

  function normalizeImprovements(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const title =
          typeof entry.title === "string" && entry.title.trim() !== ""
            ? entry.title.trim()
            : typeof entry.name === "string" && entry.name.trim() !== ""
            ? entry.name.trim()
            : typeof entry.label === "string" && entry.label.trim() !== ""
            ? entry.label.trim()
            : null;
        if (!title) return null;
        return {
          ...entry,
          title,
          saving: core.clampNumber(
            entry.saving ?? entry.saving_percent ?? entry.potential_saving_percent,
            null
          ),
        };
      })
      .filter(Boolean);
  }

  function normalizeBivalentPoints(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const temp = core.clampNumber(
          entry.temp ?? entry.temperature ?? entry.outdoor_temp_c,
          null
        );
        const powerKw = core.clampNumber(
          entry.power_kw ?? entry.power_kW ?? entry.required_power_kw,
          null
        );
        if (temp === null && powerKw === null) return null;
        return {
          ...entry,
          temp,
          power_kw: powerKw,
        };
      })
      .filter(Boolean);
  }

  function selectDesignOutdoorTemperature(context, offerDto) {
    return core.pickFirst(
      [
        core.clampNumber(
          context?.uiContext?.requestBuildingSnapshot?.design_outdoor_temperature,
          null
        ),
        core.clampNumber(
          context?.uiContext?.requestBuildingSnapshot?.outdoor_design_temperature,
          null
        ),
        core.clampNumber(
          context?.uiContext?.requestBuildingSnapshot?.temperature_outside,
          null
        ),
        core.clampNumber(
          offerDto?.engineering?.ozc?.metrics?.design_outdoor_temperature,
          null
        ),
        core.clampNumber(
          offerDto?.engineering?.ozc?.design_outdoor_temperature,
          null
        ),
        core.clampNumber(context?.uiContext?.configData?.design_outdoor_temperature, null),
      ],
      null
    );
  }

  function buildDocumentPayload(input) {
    const context = core.buildOfferProjectionContext(input);
    const offerDto = core.requireOfferDto(context, "document");
    const buildingInfo = core.buildDocumentBuildingInfo(context);

    if (!offerDto) {
      return {
        offer_dto: null,
        projection_blocked_reason: "missing_offer_dto",
        recommended_power_kw: null,
        max_heating_power: null,
        heated_area: null,
        design_outdoor_temperature: selectDesignOutdoorTemperature(context, null),
        indoor_temperature: core.clampNumber(
          context?.uiContext?.formData?.indoor_temperature,
          null
        ),
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
          "Wybrane modele gwarantuja stabilna, cicha i ekonomiczna prace przez caly sezon grzewczy.",
        models_outro:
          "Zestaw obejmuje pelny pakiet komponentow dopasowanych do Twojego budynku.",
        ...buildingInfo,
      };
    }

    core.markProjectionUsed(context, "document_projection_used", "document");
    const extendedOzc = readExtendedOzc(offerDto);

    return {
      offer_dto: offerDto,
      projection_blocked_reason: null,
      recommended_power_kw: core.selectRecommendedPowerKw(context),
      max_heating_power: core.selectHeatLoadKw(context),
      heated_area: core.selectHeatedAreaM2(context),
      design_outdoor_temperature: selectDesignOutdoorTemperature(context, offerDto),
      indoor_temperature: core.pickFirst(
        [
          core.clampNumber(context?.uiContext?.formData?.indoor_temperature, null),
          core.clampNumber(context?.uiContext?.formData?.indoor_temp, null),
          core.clampNumber(
            context?.uiContext?.requestBuildingSnapshot?.indoor_temperature,
            null
          ),
        ],
        null
      ),
      energy_profile_rows: core.buildDocumentEnergyProfileRows(context),
      recommended_models: core.buildDocumentRecommendedModels(context),
      energy_losses: normalizeEnergyLosses(extendedOzc?.energy_losses),
      improvements: normalizeImprovements(extendedOzc?.improvements),
      costs_comparison: Array.isArray(extendedOzc?.heating_costs)
        ? extendedOzc.heating_costs
        : [],
      costs_assumptions:
        extendedOzc?.heating_costs_assumptions &&
        typeof extendedOzc.heating_costs_assumptions === "object"
          ? extendedOzc.heating_costs_assumptions
          : null,
      bivalent_points: normalizeBivalentPoints(extendedOzc?.bivalent_points),
      pricing: offerDto?.pricing || null,
      selections:
        context?.configuratorSelection?.selections ||
        offerDto?.engineering?.selection ||
        null,
      machine_room: core.buildMachineRoomSnapshot(context),
      models_intro:
        "Wybrane modele gwarantuja stabilna, cicha i ekonomiczna prace przez caly sezon grzewczy.",
      models_outro:
        "Zestaw obejmuje pelny pakiet komponentow dopasowanych do Twojego budynku.",
      ...buildingInfo,
      building_type_label: core.resolveBuildingTypeFromContext(context),
      heating_type_label: core.resolveHeatingTypeLabel(context),
    };
  }

  const api = {
    buildDocumentPayload,
  };

  namespace.document = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
