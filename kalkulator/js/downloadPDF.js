//* downloadPDF.js/

function isBackendCalcEnabled() {
  return !!(window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.useBackendCalc === true);
}

// OPTIMIZATION: Lazy load PDF libraries on-demand (dynamic import)
// Helper – ładuje biblioteki PDF dynamicznie tylko gdy potrzebne
async function loadPdfLibraries() {
  // Helper function - checks all possible jsPDF namespace variants
  const hasJsPDF = () => {
    // Check both jspdf namespace variants (jspdf.jsPDF from UMD, jsPDF from direct)
    const hasJspdfJsPdf = typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF;
    const hasDirectJsPDF = typeof window.jsPDF !== 'undefined';
    return hasJspdfJsPdf || hasDirectJsPDF;
  };

  // Sprawdź czy już załadowane (hasJsPDF uwzględnia window.jspdf.jsPDF i window.jsPDF)
  if (typeof html2pdf !== 'undefined' && hasJsPDF()) {
    return Promise.resolve();
  }

  try {
    // OPTIMIZATION: Dynamic import zamiast synchronicznego ładowania
    const librariesUrl = window.HEATPUMP_CONFIG?.librariesUrl || '../libraries';

    // Ładuj biblioteki równolegle
    await Promise.all([
      new Promise((resolve, reject) => {
        if (typeof html2pdf !== 'undefined') {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = `${librariesUrl}/html2pdf.bundle.min.js`;
        script.async = true;
        script.onload = () => {
          // Poczekaj aż html2pdf będzie dostępne
          const check = setInterval(() => {
            if (typeof html2pdf !== 'undefined') {
              clearInterval(check);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(check);
            if (typeof html2pdf === 'undefined') {
              reject(new Error('html2pdf nie załadowane'));
            }
          }, 5000);
        };
        script.onerror = () => reject(new Error('Błąd ładowania html2pdf'));
        document.head.appendChild(script);
      }),
      new Promise((resolve, reject) => {
        if (typeof html2canvas !== 'undefined') {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = `${librariesUrl}/html2canvas.min.js`;
        script.async = true;
        script.onload = () => {
          const check = setInterval(() => {
            if (typeof html2canvas !== 'undefined') {
              clearInterval(check);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(check);
            if (typeof html2canvas === 'undefined') {
              reject(new Error('html2canvas nie załadowane'));
            }
          }, 5000);
        };
        script.onerror = () => reject(new Error('Błąd ładowania html2canvas'));
        document.head.appendChild(script);
      }),
      new Promise((resolve, reject) => {
        if (hasJsPDF()) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = `${librariesUrl}/jspdf.umd.min.js`;
        script.async = true;
        script.onload = () => {
          const check = setInterval(() => {
            if (hasJsPDF()) {
              clearInterval(check);
              if (typeof window.jsPDF === 'undefined' && window.jspdf && window.jspdf.jsPDF) {
                window.jsPDF = window.jspdf.jsPDF;
              }
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(check);
            if (!hasJsPDF()) {
              reject(new Error('jsPDF nie załadowane'));
            }
          }, 5000);
        };
        script.onerror = () => reject(new Error('Błąd ładowania jsPDF'));
        document.head.appendChild(script);
      })
    ]);

  } catch (error) {
    console.error('❌ Błąd ładowania bibliotek PDF:', error);
    throw new Error('Nie udało się załadować bibliotek PDF. Sprawdź połączenie internetowe.');
  }
}

function _hpFiniteNumber(value) {
  const n = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function _hpIsAirWaterHeatPumpCostRow(row) {
  const t = String(row && (row.label || row.variant || row.name || '')).toLowerCase();
  return t.includes('pompa') && t.includes('ciep');
}

/**
 * Dla PDF raportu energetycznego: przelicza koszt pompy na energię elektryczną
 * z uwzględnieniem SCOP (jak w silniku OZC), niezależnie od ewentualnej rozbieżności w DTO.
 */
function _hpNormalizeHeatingCostsForEnergyPdf(costRows, assumptions) {
  const list = Array.isArray(costRows) ? costRows.map((r) => ({ ...r })) : [];
  const scop =
    _hpFiniteNumber(assumptions && assumptions.scopUsed) != null &&
      _hpFiniteNumber(assumptions.scopUsed) > 0
      ? _hpFiniteNumber(assumptions.scopUsed)
      : 4;
  const price = _hpFiniteNumber(assumptions && assumptions.electricityPLNperKWh);
  const annualCo = _hpFiniteNumber(assumptions && assumptions.annualKWhCO);
  const annualCwu = _hpFiniteNumber(assumptions && assumptions.annualKWhCWU);
  const annualTotal =
    _hpFiniteNumber(assumptions && assumptions.annualKWhTotal) != null
      ? _hpFiniteNumber(assumptions.annualKWhTotal)
      : annualCo != null && annualCwu != null
        ? Math.max(0, annualCo) + Math.max(0, annualCwu)
        : null;

  const next = list.map((row) => {
    if (!_hpIsAirWaterHeatPumpCostRow(row)) {
      return row;
    }
    if (
      annualTotal != null &&
      annualTotal >= 0 &&
      price != null &&
      price > 0 &&
      scop > 0
    ) {
      const total = Math.round((annualTotal / scop) * price);
      const co =
        annualCo != null && annualCo > 0 ? Math.round((annualCo / scop) * price) : null;
      const cwu =
        annualCwu != null && annualCwu > 0 ? Math.round((annualCwu / scop) * price) : null;
      return {
        ...row,
        annual_cost_total_pln: total,
        annual_cost_pln: total,
        cost: total,
        annual_cost_co_pln: co,
        annual_cost_cwu_pln: cwu,
        efficiency_display: `SCOP ${String(scop).replace('.', ',')}`,
        efficiency_factor: scop,
      };
    }
    return row;
  });

  const best = next.reduce((minValue, row) => {
    const value = _hpFiniteNumber(
      row.annual_cost_total_pln ?? row.annual_cost_pln ?? row.cost
    );
    if (value == null) return minValue;
    if (minValue == null) return value;
    return value < minValue ? value : minValue;
  }, null);
  return next.map((row) => {
    const v = _hpFiniteNumber(row.annual_cost_total_pln ?? row.annual_cost_pln ?? row.cost);
    const leader = v != null && best != null && v === best;
    return { ...row, is_cost_leader: leader };
  });
}

/**
 * Raport pokazuje standardow\u0105 siatk\u0119 temperatur (-5 / -7 / -9 / -11 \u00b0C),
 * typow\u0105 dla zestawienia pracy pompy w warunkach zimowych; gdy brak wpis\u00f3w,
 * bierzemy do 6 najni\u017cszych temperatur z danych OZC.
 */
function _hpPickBivalentPointsForPdf(points) {
  const list = Array.isArray(points)
    ? points.filter((p) => p && Number.isFinite(Number(p.temp)))
    : [];
  const wanted = [-5, -7, -9, -11];
  const picked = [];
  wanted.forEach((t) => {
    const hit = list.find((p) => Number(p.temp) === t);
    if (hit) picked.push(hit);
  });
  if (picked.length) return picked;
  return list
    .slice()
    .sort((a, b) => Number(b.temp) - Number(a.temp))
    .slice(0, 6);
}

function _hpPumpModelLooksClientFriendly(name) {
  const s = typeof name === 'string' ? name.trim() : '';
  if (s.length < 4 || s.length > 85) return false;
  if (!/[A-Za-z\u0100-\u017F]/.test(s)) return false;
  if (/^[A-Z0-9._-]+$/i.test(s) && !/\s/.test(s)) return false;
  return true;
}

function _hpPickClientFacingPumpName(selection) {
  const sel = selection && typeof selection === 'object' ? selection : {};
  const candidates = [
    Array.isArray(sel.recommendedModels) &&
      sel.recommendedModels[0] &&
      typeof sel.recommendedModels[0] === 'object'
      ? sel.recommendedModels[0].name || sel.recommendedModels[0].model
      : null,
    Array.isArray(sel.recommendedModels) &&
      typeof sel.recommendedModels[0] === 'string'
      ? sel.recommendedModels[0]
      : null,
    sel.pumpDisplayName,
    sel.pumpLabel,
    sel.pumpTitle,
    sel.pumpName,
    sel.pumpSelection && sel.pumpSelection.hp && sel.pumpSelection.hp.label,
    sel.pumpSelection && sel.pumpSelection.hp && sel.pumpSelection.hp.title,
    sel.pumpSelection && sel.pumpSelection.hp && sel.pumpSelection.hp.name,
    sel.pumpSelection && sel.pumpSelection.aio && sel.pumpSelection.aio.label,
    sel.pumpSelection && sel.pumpSelection.aio && sel.pumpSelection.aio.title,
    sel.pumpSelection && sel.pumpSelection.aio && sel.pumpSelection.aio.name,
    sel.pumpModel,
    sel.pumpSelection && sel.pumpSelection.hp && sel.pumpSelection.hp.model,
    sel.pumpSelection && sel.pumpSelection.aio && sel.pumpSelection.aio.model,
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = typeof candidates[index] === 'string' ? candidates[index].trim() : '';
    if (candidate && _hpPumpModelLooksClientFriendly(candidate)) {
      return candidate;
    }
  }

  return null;
}

function _hpPickSelectionEngineRecommendation(selection) {
  const sel = selection && typeof selection === 'object' ? selection : {};
  const entries = Array.isArray(sel.recommendedModels) ? sel.recommendedModels : [];
  const first = entries[0];
  if (typeof first === 'string' && first.trim() !== '') {
    return {
      name: first.trim(),
      powerKw: null,
      phase: null,
    };
  }
  if (!first || typeof first !== 'object') {
    return null;
  }
  return {
    name:
      typeof first.name === 'string' && first.name.trim() !== ''
        ? first.name.trim()
        : typeof first.model === 'string' && first.model.trim() !== ''
          ? first.model.trim()
          : null,
    powerKw: _hpFiniteNumber(first.power_kw ?? first.power ?? first.capacity_kW),
    phase: _hpFiniteNumber(first.phase ?? first.minPhase),
  };
}

function _hpExtractPumpSelectionSummary(offerDto, heatDemandKw) {
  const sel = (offerDto && offerDto.engineering && offerDto.engineering.selection) || {};
  const recommendation = _hpPickSelectionEngineRecommendation(sel);
  let cap = _hpFiniteNumber(
    recommendation && recommendation.powerKw != null ? recommendation.powerKw : sel.capacity_kW
  );
  if (cap == null) {
    const hp = sel.pumpSelection && (sel.pumpSelection.hp || sel.pumpSelection.aio);
    if (hp) cap = _hpFiniteNumber(hp.power ?? hp.power_kw);
  }
  let phase = _hpFiniteNumber(
    recommendation && recommendation.phase != null ? recommendation.phase : sel.phase
  );
  if (phase == null) {
    const hp = sel.pumpSelection && (sel.pumpSelection.hp || sel.pumpSelection.aio);
    if (hp) phase = _hpFiniteNumber(hp.phase);
  }
  const phaseLabel = phase === 3 ? '3-fazowa' : phase === 1 ? '1-fazowa' : '';
  let primary = '';
  if (cap != null) {
    const capLabel = cap % 1 === 0 ? String(Math.round(cap)) : String(cap).replace('.', ',');
    primary = phaseLabel ? `${capLabel} kW, ${phaseLabel}` : `${capLabel} kW`;
  } else if (_hpFiniteNumber(heatDemandKw) != null) {
    primary = `${_hpFiniteNumber(heatDemandKw).toLocaleString('pl-PL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} kW (dobór orientacyjny)`;
  } else {
    primary = '\u2014';
  }
  return {
    primary_line: primary,
    secondary_line: null,
    note: '',
  };
}

function _hpBuildEnergyOzcRowSplit(offerDto, flat) {
  const ozc = (offerDto && offerDto.engineering && offerDto.engineering.ozc) || {};
  const metrics = (ozc && ozc.metrics) || {};
  const left = [];
  const right = [];
  const pushL = (label, value) => {
    if (value === null || value === undefined || value === '') return;
    left.push({ label, value: String(value) });
  };
  const pushR = (label, value) => {
    if (value === null || value === undefined || value === '') return;
    right.push({ label, value: String(value) });
  };

  const ha = _hpFiniteNumber(ozc.heatedArea_m2 != null ? ozc.heatedArea_m2 : flat && flat.heated_area);
  if (ha != null) {
    pushL(
      'Powierzchnia ogrzewana',
      `${ha.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} m²`
    );
  }

  const maxCo = _hpFiniteNumber(
    ozc.designHeatLoss_kW != null ? ozc.designHeatLoss_kW : flat && flat.max_heating_power
  );
  if (maxCo != null) {
    const rounded = Math.round(maxCo * 10) / 10;
    pushL(
      'Projektowa strata ciepła',
      `${rounded.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kW`
    );
  }

  const annual = _hpFiniteNumber(metrics.annual_energy_consumption);
  if (annual != null) {
    const roundedAnnual =
      Math.abs(annual) >= 1000 ? Math.round(annual / 100) * 100 : Math.round(annual);
    pushL(
      'Roczne zapotrzebowanie na energię',
      `${roundedAnnual.toLocaleString('pl-PL')} kWh`
    );
  }

  const designT =
    _hpFiniteNumber(flat && flat.design_outdoor_temperature) ||
    _hpFiniteNumber(metrics.design_outdoor_temperature);
  if (designT != null) {
    pushR(
      'Temperatura projektowa (zewn.)',
      `${Math.round(designT * 10) / 10} °C`
    );
  }

  return { left, right };
}

function _hpSanitizeCostAssumptionsForPdf(assumptions) {
  if (!assumptions || typeof assumptions !== 'object') return null;
  const copy = { ...assumptions };
  delete copy.displayLine;
  return copy;
}

/**
 * Payload wyłącznie pod PDF raportu energetycznego — bez oferty, cen, maszynowni i DTO.
 */
function buildEnergyReportData(baseData = {}) {
  const src = baseData && typeof baseData === 'object' ? baseData : {};
  const offerDto = src.offer_dto && typeof src.offer_dto === 'object' ? src.offer_dto : null;

  const heatDemand =
    _hpFiniteNumber(src.max_heating_power) ||
    (offerDto &&
      offerDto.engineering &&
      offerDto.engineering.ozc &&
      _hpFiniteNumber(offerDto.engineering.ozc.designHeatLoss_kW));

  const ozcSplit = offerDto
    ? _hpBuildEnergyOzcRowSplit(offerDto, src)
    : { left: [], right: [] };

  const pump_selection_summary = offerDto
    ? _hpExtractPumpSelectionSummary(offerDto, heatDemand)
    : _hpExtractPumpSelectionSummary(null, heatDemand);

  const assumptions = _hpSanitizeCostAssumptionsForPdf(src.costs_assumptions);
  const costs_comparison = _hpNormalizeHeatingCostsForEnergyPdf(
    src.costs_comparison,
    assumptions || src.costs_assumptions || {}
  );
  const bivalent_points = _hpPickBivalentPointsForPdf(src.bivalent_points);
  const heated_area =
    _hpFiniteNumber(
      offerDto &&
      offerDto.engineering &&
      offerDto.engineering.ozc &&
      offerDto.engineering.ozc.heatedArea_m2
    ) || _hpFiniteNumber(src.heated_area);

  const report_date_label = new Date().toLocaleDateString('pl-PL');

  return {
    report_date_label,
    energy_ozc_rows_left: ozcSplit.left,
    energy_ozc_rows_right: ozcSplit.right,
    pump_selection_summary,
    costs_comparison,
    costs_assumptions: assumptions,
    energy_losses: Array.isArray(src.energy_losses) ? src.energy_losses : [],
    bivalent_points,
    heated_area,
    max_heating_power: heatDemand,
    building_type: src.building_type,
    building_type_label: src.building_type_label,
    construction_year: src.construction_year,
    construction_type: src.construction_type,
    building_length: src.building_length,
    building_width: src.building_width,
    floor_area: src.floor_area,
    floor_perimeter: src.floor_perimeter,
    building_floors: src.building_floors,
    floor_height: src.floor_height,
    building_roof: src.building_roof,
    has_basement: src.has_basement,
    has_balcony: src.has_balcony,
    has_garage: src.has_garage,
    garage_type: src.garage_type,
    wall_size: src.wall_size,
    primary_wall_material: src.primary_wall_material,
    secondary_wall_material: src.secondary_wall_material,
    detailed_insulation_mode: src.detailed_insulation_mode,
    walls_insulation_level: src.walls_insulation_level,
    roof_insulation_level: src.roof_insulation_level,
    floor_insulation_level: src.floor_insulation_level,
    top_isolation_material: src.top_isolation_material,
    top_isolation_size: src.top_isolation_size,
    bottom_isolation_material: src.bottom_isolation_material,
    bottom_isolation_size: src.bottom_isolation_size,
    external_wall_isolation_material: src.external_wall_isolation_material,
    external_wall_isolation_size: src.external_wall_isolation_size,
    internal_wall_isolation_material: src.internal_wall_isolation_material,
    internal_wall_isolation_size: src.internal_wall_isolation_size,
    doors_type: src.doors_type,
    number_doors: src.number_doors,
    windows: src.windows,
    number_windows: src.number_windows,
    indoor_temperature: src.indoor_temperature,
    ventilation_type: src.ventilation_type,
    include_hot_water: src.include_hot_water,
    hot_water_persons: src.hot_water_persons,
    hot_water_usage: src.hot_water_usage,
    on_corner: src.on_corner,
    whats_over: src.whats_over,
    whats_under: src.whats_under,
    whats_north: src.whats_north,
    whats_south: src.whats_south,
    whats_east: src.whats_east,
    whats_west: src.whats_west,
  };
}

function buildOfferData(baseData = {}) {
  return {
    ...baseData,
    pricing: baseData.pricing || baseData.offer_payload?.pricing || null,
    selections: baseData.selections || baseData.offer_payload?.selections || null,
  };
}

function cloneMachineRoomSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const items = Array.isArray(snapshot.items)
    ? snapshot.items.map((item) => ({ ...item }))
    : [];
  const summaryRows = Array.isArray(snapshot.summary_rows)
    ? snapshot.summary_rows.map((row) => ({ ...row }))
    : [];

  return {
    ...snapshot,
    items,
    summary_rows: summaryRows,
    selections:
      snapshot.selections && typeof snapshot.selections === "object"
        ? { ...snapshot.selections }
        : {},
    products:
      snapshot.products && typeof snapshot.products === "object"
        ? { ...snapshot.products }
        : {},
    selected_components:
      snapshot.selected_components && typeof snapshot.selected_components === "object"
        ? { ...snapshot.selected_components }
        : {},
    recommendations:
      snapshot.recommendations && typeof snapshot.recommendations === "object"
        ? { ...snapshot.recommendations }
        : {},
  };
}

function buildOfferDocumentContext(configData = {}, options = {}) {
  const machineRoomSnapshot = cloneMachineRoomSnapshot(configData?.machine_room);
  const traceId =
    (typeof configData?.traceId === "string" && configData.traceId.trim()) ||
    (typeof configData?.offer_dto?.traceId === "string" &&
      configData.offer_dto.traceId.trim()) ||
    null;

  return {
    source: "kalk-top",
    channel: "calculator_summary",
    documentMode: options?.documentMode || "offer",
    generatedAt: new Date().toISOString(),
    traceId,
    machineRoomSnapshot,
  };
}

async function downloadGeneratedOfferPdf(configData = {}) {
  const api = window.topinstalApi || null;
  if (!api || typeof api.generateOfferDocument !== 'function') {
    throw new Error('Brak klienta API generatora oferty.');
  }

  const offerDto =
    configData.offer_dto && typeof configData.offer_dto === 'object'
      ? configData.offer_dto
      : null;
  if (!offerDto) {
    throw new Error('Brak kanonicznego offer_dto dla generatora PDF.');
  }

  const response = await api.generateOfferDocument({
    mode: 'from-offer-dto',
    documentType: 'offer_document',
    outputFormat: 'pdf',
    traceId: offerDto.traceId || null,
    offerDto: offerDto,
    context: buildOfferDocumentContext(configData, { documentMode: "offer" }),
  }, {
    timeoutMs:
      Number(window?.HEATPUMP_CONFIG?.offerDocumentTimeoutMs) > 0
        ? Number(window.HEATPUMP_CONFIG.offerDocumentTimeoutMs)
        : 150000,
  });

  const documentPayload =
    response && response.document && typeof response.document === 'object'
      ? response.document
      : response;
  const downloadUrl =
    documentPayload && typeof documentPayload.downloadUrl === 'string'
      ? documentPayload.downloadUrl.trim()
      : '';

  if (!downloadUrl) {
    throw new Error('Generator nie zwrócił linku do pobrania PDF.');
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  if (documentPayload.filename) {
    link.download = String(documentPayload.filename);
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ======================
// 🔥 Główna funkcja
// ======================

async function downloadPdfWithMode(ctx = {}, mode = 'energy') {
  try {
    if (
      mode === 'offer' &&
      window.__topinstalPdfLeadGate &&
      typeof window.__topinstalPdfLeadGate.requireLeadForPdfDownload === 'function'
    ) {
      const allowed = window.__topinstalPdfLeadGate.requireLeadForPdfDownload(ctx);
      if (!allowed) {
        return;
      }
    }

    const root = ctx.root || (ctx.dom && ctx.dom.root) || window.__HP_ACTIVE_ROOT__ || null;
    const dom =
      ctx.dom ||
      (root && typeof window.createScopedDom === 'function' ? window.createScopedDom(root) : null);
    const configuratorApi = ctx.state?.configuratorApi || null;
    const analytics = ctx.state?.analytics || null;
    const pdfType = mode === 'offer' ? 'offer' : 'summary';
    const pdfStartedAt = Date.now();

    if (!root || !dom) {
      console.error('[PDF] Brak kontekstu root/dom');
      return;
    }

    if (typeof window.__HP_SET_ACTIVE_ROOT__ === 'function') {
      window.__HP_SET_ACTIVE_ROOT__(root);
    }

    // Funnel tracking (safe no-op if analytics missing)
    try {
      analytics && analytics.emit && analytics.emit('pdf_download_clicked', { step_key: 'summary', mode });
      analytics && analytics.emit && analytics.emit('pdf_generation_started', { step_key: 'summary', mode });
    } catch (_) { }
    try {
      if (typeof window.topinstalTrackEvent === 'function') {
        window.topinstalTrackEvent('pdf_download_click', {
          source: 'calc',
          tab: 5,
          stepKey: 'results',
          meta: { type: pdfType },
        });
        window.topinstalTrackEvent('pdf_generate_start', {
          source: 'calc',
          tab: 5,
          stepKey: 'results',
          meta: { type: pdfType },
        });
      }
    } catch (_) { }

    // ═══════════════════════════════════════════════════════════════════════════
    // UPEWNIJ SIĘ, ŻE DANE Z KONFIGURATORA SĄ ZAKTUALIZOWANE
    // ═══════════════════════════════════════════════════════════════════════════
    const strictBackendMode = isBackendCalcEnabled();
    if (configuratorApi && typeof configuratorApi.refreshOffer === 'function') {
      try {
        await configuratorApi.refreshOffer();
      } catch (refreshError) {
        if (strictBackendMode) {
          throw refreshError;
        }
        console.warn('[PDF] Backend offer refresh failed before PDF, continuing with fallback data.', refreshError);
      }
    } else if (configuratorApi && typeof configuratorApi.recompute === 'function') {
      configuratorApi.recompute();
    } else if (typeof window.configuratorRecompute === 'function') {
      window.configuratorRecompute();
    }

    const projectionApi = ctx.state?.offerProjection || null;
    if (
      !projectionApi ||
      typeof projectionApi.resolveInputFromRuntime !== 'function' ||
      typeof projectionApi.buildDocumentPayload !== 'function'
    ) {
      throw new Error('Brak buildera projekcji dokumentu (offerProjection).');
    }

    const runtimeInput = projectionApi.resolveInputFromRuntime({
      target: 'document',
      channel: 'pdf',
      mode,
      documentMode: mode,
    });
    const configData = projectionApi.buildDocumentPayload({
      offerDto: runtimeInput?.offerDto || null,
      leadData: runtimeInput?.leadData || null,
      configuratorSelection: runtimeInput?.configuratorSelection || null,
      uiContext: {
        ...(runtimeInput?.uiContext || {}),
        target: 'document',
        channel: 'pdf',
        documentMode: mode,
      },
    });

    if (!configData?.offer_dto || configData.projection_blocked_reason === 'missing_offer_dto') {
      const errorMsg =
        'Brak backendowego wyniku oferty. Generacja PDF jest zablokowana do czasu zakończenia obliczeń.';
      console.error('[PDF]', errorMsg, {
        blockedReason: configData?.projection_blocked_reason || 'missing_offer_dto',
      });
      try {
        analytics && analytics.emit && analytics.emit('pdf_generated_error', {
          reason: 'missing_offer_dto',
          step_key: 'summary',
          mode,
        });
      } catch (_) { }
      try {
        if (typeof window.topinstalTrackEvent === 'function') {
          window.topinstalTrackEvent('pdf_generation_blocked_no_offer_dto', {
            source: 'calc',
            tab: 5,
            stepKey: 'results',
            meta: { mode, reason: configData?.projection_blocked_reason || 'missing_offer_dto' },
          });
        }
      } catch (_) { }
      if (typeof ErrorHandler !== 'undefined' && ErrorHandler.showToast) {
        ErrorHandler.showToast(errorMsg, 'error', 5000);
      } else {
        alert(errorMsg);
      }
      return;
    }

    if (mode === 'offer') {
      await downloadGeneratedOfferPdf(configData);
    } else {
      // OPTIMIZATION: Lazy load PDF libraries on-demand only for legacy energy report rendering.
      await loadPdfLibraries();
      const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (window.__HP_DEBUG__) console.log('[PDF] libraries loaded ok + wykryto jsPDFCtor:', !!jsPDFCtor);
      if (typeof generatePdf === 'undefined') {
        throw new Error('Brak funkcji generatePdf — sprawdź czy pdfGenerator.js jest załadowany.');
      }

      const payload = buildEnergyReportData(configData);
      await generatePdf(payload, { mode });
    }

    try {
      analytics && analytics.emit && analytics.emit('pdf_generated_success', { step_key: 'summary', mode });
    } catch (_) { }
    try {
      if (typeof window.topinstalTrackEvent === 'function') {
        window.topinstalTrackEvent('pdf_generate_success', {
          source: 'calc',
          tab: 5,
          stepKey: 'results',
          meta: {
            type: pdfType,
            durationMs: Math.max(0, Date.now() - pdfStartedAt),
          },
        });
      }
    } catch (_) { }

  } catch (err) {
    console.error('❌ Błąd podczas generowania PDF:', err);
    const kind = mode === 'offer' ? 'oferty' : 'raportu';
    if (typeof ErrorHandler !== 'undefined' && ErrorHandler.showToast) {
      ErrorHandler.showToast(`Nie udało się wygenerować PDF ${kind}: ` + err.message, 'error', 5000);
    } else {
      alert(`Nie udało się wygenerować PDF ${kind}: ${err.message}`);
    }
    try {
      const analytics = ctx.state?.analytics || null;
      analytics && analytics.emit && analytics.emit('pdf_generated_error', { reason: String(err && err.message ? err.message : 'error'), step_key: 'summary', mode });
    } catch (_) { }
    try {
      if (typeof window.topinstalTrackEvent === 'function') {
        window.topinstalTrackEvent('calc_error', {
          source: 'calc',
          tab: 5,
          stepKey: 'results',
          meta: {
            reasonCode: 'pdf_error',
            httpStatus: Number.isFinite(Number(err && err.status)) ? Number(err.status) : 0,
            durationMs: Math.max(0, Date.now() - pdfStartedAt),
          },
        });
      }
    } catch (_) { }
  }
}

// ======================
// Obsługa przycisku
// ======================

function setupPDFButtonListener(ctx) {
  if (!ctx || !ctx.dom || !ctx.root) {
    console.warn('[PDF] Brak kontekstu root/dom dla bindów PDF');
    return () => { };
  }
  const root = ctx.root;
  const dom = ctx.dom;
  const state = ctx.state;

  // P1: delegacja na root — jeden listener, działa przy dynamicznym DOM i multi-instance
  const handler = (e) => {
    const btn = e.target.closest(
      '[data-action="download-energy-report"], [data-action="download-offer-pdf"]'
    );
    if (!btn || !root.contains(btn)) return;
    const action = btn.getAttribute('data-action');
    if (window.__HP_DEBUG__) console.log('[PDF] pdf click', action);
    e.preventDefault();
    if (action === 'download-offer-pdf') {
      downloadOfferPdf({ root, dom, state });
      return;
    }
    downloadEnergyReportPdf({ root, dom, state });
  };
  root.addEventListener('click', handler, true);

  return function disposePdfButtons() {
    try {
      root.removeEventListener('click', handler, true);
    } catch (_) { }
  };
}

// Eksport globalny

// Eksport globalny
async function downloadEnergyReportPdf(ctx = {}) {
  return downloadPdfWithMode(ctx, 'energy');
}

async function downloadOfferPdf(ctx = {}) {
  return downloadPdfWithMode(ctx, 'offer');
}

window.downloadPDF = downloadEnergyReportPdf;
window.downloadEnergyReportPdf = downloadEnergyReportPdf;
window.downloadOfferPdf = downloadOfferPdf;
window.buildEnergyReportData = buildEnergyReportData;
// OPTIMIZATION: Export loadPdfLibraries for use in other modules
window.loadPdfLibraries = loadPdfLibraries;

// Export init function for bootApp (no auto-init)
// Auto-init removed - must be called from bootApp
if (typeof window !== 'undefined') {
  window.__initDownloadPDF = function initDownloadPDF(ctx = {}) {
    const root = ctx.root || window.__HP_ACTIVE_ROOT__ || null;
    const dom =
      ctx.dom ||
      (root && typeof window.createScopedDom === 'function' ? window.createScopedDom(root) : null);
    if (!root || !dom) {
      console.warn('[PDF] Brak kontekstu root/dom dla inicjalizacji');
      return () => { };
    }
    const disposeButtons = setupPDFButtonListener({ root, dom, state: ctx.state });

    // Return disposer (minimal - listeners are on buttons that will be removed with DOM)
    return function disposeDownloadPDF() {
      if (typeof disposeButtons === 'function') {
        disposeButtons();
      }
    };
  };
}
