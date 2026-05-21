(function (global) {
  "use strict";

  const BUILDING_LABELS = {
    single_house: "Dom wolnostojący",
    double_house: "Bliźniak",
    row_house: "Szeregowiec",
    apartment: "Mieszkanie",
  };

  const HEATING_LABELS = {
    floor_heating: "Podłogowe",
    underfloor: "Podłogowe",
    radiators: "Grzejniki",
    mixed: "Mieszane",
    fan_coil: "Fan-coil",
  };

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function yesNo(value) {
    if (value === true) return true;
    const normalized = String(value == null ? "" : value).toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "1";
  }

  function getCanonicalOffer(appState, state) {
    try {
      if (typeof state?.getCanonicalOffer === "function") {
        return state.getCanonicalOffer(appState) || null;
      }
    } catch (_) {}
    try {
      if (typeof global.getCanonicalOffer === "function") {
        return global.getCanonicalOffer(appState) || null;
      }
    } catch (_) {}
    return appState?.canonicalOffer || appState?.offer || null;
  }

  function getUiSummaryFromState(appState, runtimeState) {
    const snapshot = appState && typeof appState === "object" ? appState : {};
    const formData = snapshot.formData && typeof snapshot.formData === "object" ? snapshot.formData : {};
    const offer = getCanonicalOffer(snapshot, runtimeState);

    const buildingType = String(formData.building_type || "");
    const buildingTypeLabel = BUILDING_LABELS[buildingType] || "—";
    const area =
      toNumber(formData.heated_area) ||
      toNumber(formData.floor_area) ||
      toNumber(formData.total_area) ||
      toNumber(offer?.engineering?.ozc?.heatedArea_m2) ||
      null;
    const dhw = yesNo(formData.include_hot_water);
    const heatingType = String(formData.heating_type || formData.installation_type || "");
    const heatingLabel = HEATING_LABELS[heatingType] || (heatingType ? heatingType : "—");

    const currentTab = Number.isFinite(Number(snapshot.currentTab)) ? Number(snapshot.currentTab) : 0;
    const completedTabs = Math.max(0, Math.min(6, currentTab + 1));

    const kwValue = toNumber(
      offer?.engineering?.ozc?.recommendedPower_kW ??
      offer?.engineering?.ozc?.designHeatLoss_kW ??
      null
    );

    const gross = toNumber(offer?.pricing?.totals?.gross ?? offer?.pricing?.total_gross_pln ?? null);

    return {
      buildingTypeLabel,
      area,
      dhw,
      heatingLabel,
      completedTabs,
      hasOffer: !!offer,
      kwMin: kwValue,
      kwMax: kwValue,
      selectedModel:
        offer?.engineering?.selection?.pumpSelection?.hp?.model ||
        offer?.engineering?.selection?.pumpSelection?.aio?.model ||
        offer?.engineering?.selection?.pumpModel ||
        "—",
      priceGross: gross,
      traceId: offer?.traceId || null,
    };
  }

  function formatNumber(value, suffix = "") {
    if (!Number.isFinite(Number(value))) return "—";
    return `${Number(value).toLocaleString("pl-PL")}${suffix}`;
  }

  function createPanel() {
    const panel = document.createElement("aside");
    panel.className = "ti-ui-summary-panel glass-box";
    panel.innerHTML = `
      <h3>Podsumowanie wyceny</h3>
      <p class="ti-ui-summary-panel__desc">Uzupełnij dane — wynik będzie bardziej precyzyjny.</p>
      <ul class="ti-ui-summary-panel__rows">
        <li><span>Budynek:</span> <strong data-ui-summary="building">—</strong></li>
        <li><span>Metraż:</span> <strong data-ui-summary="area">—</strong></li>
        <li><span>CWU:</span> <strong data-ui-summary="dhw">—</strong></li>
        <li><span>Ogrzewanie:</span> <strong data-ui-summary="heating">—</strong></li>
        <li><span>Postęp:</span> <strong data-ui-summary="progress">0/6</strong></li>
      </ul>
      <div class="ti-ui-summary-panel__offer" data-ui-summary="offer" hidden>
        <p><strong>Wynik kalkulacji:</strong></p>
        <p>Moc: <strong data-ui-summary="kw">—</strong></p>
        <p>Zestaw: <strong data-ui-summary="model">—</strong></p>
        <p data-ui-summary="priceRow" hidden>Cena brutto: <strong data-ui-summary="price">—</strong></p>
      </div>
      <div class="ti-ui-summary-panel__actions">
        <button type="button" class="action-btn primary" data-ui-summary-action="calculate">Oblicz / odśwież wynik</button>
        <button type="button" class="action-btn secondary" data-ui-summary-action="pdf">Pobierz PDF z podsumowaniem</button>
      </div>
      <p class="ti-ui-summary-panel__pdf-note">PDF zawiera podsumowanie doboru i zakres prac.</p>
    `;
    return panel;
  }

  function init(ctx) {
    const root = ctx?.root;
    const state = ctx?.state || {};
    if (!root || !root.querySelectorAll) {
      return function noop() {};
    }

    const wrappers = Array.from(root.querySelectorAll(".formularz-z-mapa"));
    if (!wrappers.length) {
      return function noop() {};
    }

    const panels = [];
    wrappers.forEach((wrapper) => {
      if (wrapper.querySelector(".ti-ui-summary-panel")) {
        panels.push(wrapper.querySelector(".ti-ui-summary-panel"));
        return;
      }
      const panel = createPanel();
      wrapper.appendChild(panel);
      panels.push(panel);
    });

    function refresh() {
      const appState =
        (typeof state.getAppState === "function" && state.getAppState()) ||
        (typeof global.getAppState === "function" ? global.getAppState() : {});
      const data = getUiSummaryFromState(appState, state);

      panels.forEach((panel) => {
        panel.querySelector('[data-ui-summary="building"]').textContent = data.buildingTypeLabel || "—";
        panel.querySelector('[data-ui-summary="area"]').textContent = data.area != null ? `${formatNumber(data.area)} m²` : "—";
        panel.querySelector('[data-ui-summary="dhw"]').textContent = data.dhw ? "tak" : "nie";
        panel.querySelector('[data-ui-summary="heating"]').textContent = data.heatingLabel || "—";
        panel.querySelector('[data-ui-summary="progress"]').textContent = `${data.completedTabs}/6`;

        const offerBox = panel.querySelector('[data-ui-summary="offer"]');
        if (data.hasOffer) {
          offerBox.hidden = false;
          panel.querySelector('[data-ui-summary="kw"]').textContent = data.kwMin != null ? `${formatNumber(data.kwMin)} kW` : "—";
          panel.querySelector('[data-ui-summary="model"]').textContent = data.selectedModel || "—";
          const priceRow = panel.querySelector('[data-ui-summary="priceRow"]');
          if (data.priceGross != null) {
            priceRow.hidden = false;
            panel.querySelector('[data-ui-summary="price"]').textContent = `${formatNumber(data.priceGross)} zł`;
          } else {
            priceRow.hidden = true;
          }
        } else {
          offerBox.hidden = true;
        }
      });
    }

    const clickHandler = (event) => {
      const target = event.target.closest("[data-ui-summary-action]");
      if (!target) return;
      const action = target.getAttribute("data-ui-summary-action");
      if (action === "calculate") {
        const finishButton = root.querySelector(".btn-finish");
        if (Number(global.currentTab) !== 5 && typeof global.showTab === "function") {
          global.showTab(5);
          global.setTimeout(() => {
            finishButton && finishButton.click();
          }, 120);
          return;
        }
        finishButton && finishButton.click();
        return;
      }
      if (action === "pdf") {
        const pdfBtn = root.querySelector('[data-action="download-offer-pdf"]');
        if (pdfBtn) {
          pdfBtn.click();
          return;
        }
        if (typeof global.downloadOfferPdf === "function") {
          global.downloadOfferPdf({ root, state: ctx?.state || {}, dom: ctx?.dom || null });
        }
      }
    };

    root.addEventListener("click", clickHandler, true);
    root.addEventListener("topinstal:tabChanged", refresh);
    root.addEventListener("topinstal:tracked", (event) => {
      if (event?.detail?.event === "calc_result_view") refresh();
    });

    const fieldHandler = (event) => {
      const name = event?.target?.name || event?.target?.id || "";
      if (/heated_area|floor_area|include_hot_water|heating_type|building_type/.test(String(name))) {
        refresh();
      }
    };
    root.addEventListener("change", fieldHandler, true);
    root.addEventListener("input", fieldHandler, true);

    const interval = global.setInterval(refresh, 1500);
    refresh();

    return function dispose() {
      root.removeEventListener("click", clickHandler, true);
      root.removeEventListener("change", fieldHandler, true);
      root.removeEventListener("input", fieldHandler, true);
      global.clearInterval(interval);
    };
  }

  global.getUiSummaryFromState = getUiSummaryFromState;
  global.__HP_MODULES__ = global.__HP_MODULES__ || {};
  global.__HP_MODULES__.uiSummary = { init };
})(typeof window !== "undefined" ? window : globalThis);
