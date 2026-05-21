(function (global) {
  'use strict';

  function safeObject(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function hasOwnKeys(value) {
    return !!value && typeof value === 'object' && Object.keys(value).length > 0;
  }

  function normalizeBool(value) {
    return value === true || value === 'yes' || value === 'true' || value === 1 || value === '1';
  }

  function normalizeHeatingType(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!raw) return null;
    if (
      raw === 'underfloor' ||
      raw === 'surface' ||
      raw === 'floor_heating' ||
      raw === 'podlogowe' ||
      raw === 'podłogowe'
    ) {
      return 'underfloor';
    }
    if (raw === 'mixed' || raw === 'mieszane') {
      return 'mixed';
    }
    if (raw === 'radiators_ht' || raw === 'grzejniki_ht') {
      return 'radiators_ht';
    }
    if (raw === 'radiators_lt' || raw === 'grzejniki_lt') {
      return 'radiators_lt';
    }
    if (raw === 'radiators' || raw === 'grzejniki') {
      return 'radiators';
    }
    return value;
  }

  function normalizeLocationId(value) {
    const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!raw) return null;
    if (raw === 'PL_I') return 'PL_STREFA_I';
    if (raw === 'PL_II') return 'PL_STREFA_II';
    if (raw === 'PL_III') return 'PL_STREFA_III';
    if (raw === 'PL_IV') return 'PL_STREFA_IV';
    if (raw === 'PL_V') return 'PL_STREFA_V';
    return raw;
  }

  function normalizeSecondarySourceType(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!raw) return null;
    if (['gas', 'gas_boiler', 'boiler_gas'].includes(raw)) return 'gas';
    if (['solid_fuel', 'solid_fuel_boiler', 'boiler_solid_fuel', 'pellet', 'coal', 'wood'].includes(raw)) {
      return 'solid_fuel';
    }
    if (['fireplace_water_jacket', 'fireplace_back_boiler', 'kominek', 'kominek_plaszcz'].includes(raw)) {
      return 'fireplace_water_jacket';
    }
    return raw;
  }

  function toPositiveNumber(value) {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function normalizePayload(payload, formData) {
    const normalized = safeObject(payload);
    const output = Object.assign({}, normalized);
    const heatingType = normalizeHeatingType(formData.heating_type || normalized.heating_type || normalized.installation_type);
    const locationId = normalizeLocationId(normalized.location_id || normalized.climate_zone);
    const secondarySourceType = normalizeSecondarySourceType(
      normalized.secondary_source_type || normalized.secondary_source || normalized.bivalent_source_type
    );
    const existingArea =
      toPositiveNumber(normalized.heated_area) ||
      toPositiveNumber(normalized.floor_area) ||
      toPositiveNumber(normalized.total_area);
    const buildingLength = toPositiveNumber(normalized.building_length);
    const buildingWidth = toPositiveNumber(normalized.building_width);

    if (heatingType) {
      output.heating_type = heatingType;
      output.installation_type = heatingType;
    }
    if (locationId) {
      output.location_id = locationId;
      if (!output.climate_zone) {
        output.climate_zone = locationId;
      }
    }
    if (secondarySourceType) {
      output.secondary_source_type = secondarySourceType;
      output.secondary_source = secondarySourceType;
      output.bivalent_source_type = secondarySourceType;
      if (output.bivalent_enabled == null) {
        output.bivalent_enabled = true;
      }
    }
    if (!existingArea && buildingLength && buildingWidth) {
      output.floor_area = Math.round(buildingLength * buildingWidth * 100) / 100;
    }

    return output;
  }

  function readAppState() {
    if (typeof global.getAppState === 'function') {
      return safeObject(global.getAppState());
    }
    return {};
  }

  function resolveSelectionOptionId(value) {
    if (!value) return null;
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized === '' || normalized === 'cwu-none' || /-na$/i.test(normalized)) {
        return null;
      }
      return normalized;
    }
    if (typeof value === 'object') {
      if (value.system === true) return null;
      const optionId = typeof value.optionId === 'string' ? value.optionId.trim() : '';
      if (optionId !== '' && optionId !== 'cwu-none' && !/-na$/i.test(optionId)) {
        return optionId;
      }
      const id = typeof value.id === 'string' ? value.id.trim() : '';
      if (id !== '' && id !== 'cwu-none' && !/-na$/i.test(id)) {
        return id;
      }
    }
    return null;
  }

  function readConfiguratorSelections(opts, appState) {
    if (opts.configuratorSelections && typeof opts.configuratorSelections === 'object') {
      return safeObject(opts.configuratorSelections);
    }
    if (appState.configuratorSelections && typeof appState.configuratorSelections === 'object') {
      return safeObject(appState.configuratorSelections);
    }
    return {};
  }

  function mapPreferencesOptions(selections) {
    const mapped = {
      pumpOptionId: resolveSelectionOptionId(selections.pompa),
      dhwOptionId: resolveSelectionOptionId(selections.cwu),
      bufferOptionId: resolveSelectionOptionId(selections.bufor),
      circulationOptionId: resolveSelectionOptionId(selections.cyrkulacja),
      pressureReducerOptionId: resolveSelectionOptionId(selections.reduktor),
      waterTreatmentOptionId: resolveSelectionOptionId(selections.woda),
      foundationOptionId: resolveSelectionOptionId(selections.posadowienie),
      serviceOptionId: resolveSelectionOptionId(selections.service),
    };

    const compact = {};
    Object.keys(mapped).forEach((key) => {
      if (mapped[key]) {
        compact[key] = mapped[key];
      }
    });
    return compact;
  }

  function mapUiStateToCalcRequestDTO(options) {
    const opts = safeObject(options);
    const appState = safeObject(opts.appState || readAppState());
    const formData = safeObject(appState.formData);
    const leadInput = safeObject(opts.leadInput);
    const preserveExistingDraftRequest =
      opts.preserveExistingDraftRequest === true || opts.source === 'configurator';
    const baseDraftRequest = preserveExistingDraftRequest
      ? safeObject(appState.draftRequest)
      : {};
    const baseBuilding = safeObject(baseDraftRequest.building);
    const baseLead = safeObject(baseDraftRequest.lead);
    const baseLeadContact = safeObject(baseLead.contact);
    const basePreferences = safeObject(baseDraftRequest.preferences);
    const baseHeating = safeObject(basePreferences.heating);
    const baseDhw = safeObject(basePreferences.dhw);
    const baseContext = safeObject(baseDraftRequest.context);
    const providedSourcePayload = safeObject(opts.sourcePayload);
    const payloadSource = hasOwnKeys(providedSourcePayload)
      ? (preserveExistingDraftRequest
          ? Object.assign({}, baseBuilding, providedSourcePayload)
          : providedSourcePayload)
      : (preserveExistingDraftRequest && hasOwnKeys(baseBuilding)
          ? baseBuilding
          : (typeof global.buildJsonData === 'function' ? safeObject(global.buildJsonData()) : {}));
    const payload = normalizePayload(payloadSource, formData);
    const traceIdSeed = opts.traceId || baseDraftRequest.traceId || null;
    const traceId = typeof global.ensureTraceId === 'function' ? global.ensureTraceId(traceIdSeed) : traceIdSeed;
    const configuratorSelections = readConfiguratorSelections(opts, appState);
    const preferencesOptions = mapPreferencesOptions(configuratorSelections);
    const emitterType = normalizeHeatingType(
      formData.heating_type ||
      payload.heating_type ||
      payload.installation_type ||
      baseHeating.emitterType
    );
    const leadConsents = hasOwnKeys(leadInput.consents)
      ? safeObject(leadInput.consents)
      : safeObject(baseLead.consents);
    const indoorTemperatureC =
      payload.indoor_temperature != null
        ? Number(payload.indoor_temperature)
        : (baseHeating.indoorTemperatureC != null ? Number(baseHeating.indoorTemperatureC) : null);
    const dhwEnabled =
      payload.include_hot_water != null
        ? normalizeBool(payload.include_hot_water)
        : normalizeBool(baseDhw.enabled);
    const dhwPersons =
      payload.hot_water_persons != null
        ? Number(payload.hot_water_persons)
        : (baseDhw.persons != null ? Number(baseDhw.persons) : null);
    const hasBuffer =
      opts.hasBuffer != null
        ? normalizeBool(opts.hasBuffer)
        : (basePreferences.hasBuffer != null ? normalizeBool(basePreferences.hasBuffer) : true);

    return {
      schemaVersion: '1.0',
      traceId: traceId,
      lead: {
        name: leadInput.name || formData.client_name || baseLead.name || null,
        contact: {
          email: leadInput.email || formData.email || baseLeadContact.email || null,
          phone: leadInput.phone || formData.phone || baseLeadContact.phone || null,
          postalCode: leadInput.postal_code || baseLeadContact.postalCode || null,
          preferredContactTime:
            leadInput.preferred_contact_time || baseLeadContact.preferredContactTime || null,
        },
        consents: leadConsents,
        intent: leadInput.intent || baseLead.intent || null,
      },
      building: payload,
      preferences: {
        heating: {
          emitterType: emitterType,
          sourceType: formData.source_type || payload.source_type || baseHeating.sourceType || null,
          indoorTemperatureC: indoorTemperatureC,
          ventilationType: payload.ventilation_type || baseHeating.ventilationType || null,
        },
        dhw: {
          enabled: dhwEnabled,
          persons: dhwPersons,
          usageProfile: payload.hot_water_usage || baseDhw.usageProfile || null,
        },
        hasBuffer: hasBuffer,
        options: preferencesOptions,
      },
      context: {
        source: opts.source || baseContext.source || 'configurator',
        pluginVersion: global.HEATPUMP_CONFIG?.pluginVersion || baseContext.pluginVersion || null,
        uiVersion: global.HEATPUMP_CONFIG?.uiVersion || baseContext.uiVersion || null,
      },
    };
  }

  global.mapUiStateToCalcRequestDTO = mapUiStateToCalcRequestDTO;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mapUiStateToCalcRequestDTO };
  }
})(typeof window !== 'undefined' ? window : globalThis);
