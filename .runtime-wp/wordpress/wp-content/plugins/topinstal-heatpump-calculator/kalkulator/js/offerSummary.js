// === FILE: offerSummary.js ===
// FINAL SUMMARY / LAST SCREEN controller (Step 10/10).
// - Updates header badges (heat load, pump model, total gross)
// - Handles intent tiles + lead form open/UX
// - Handles "Pokaż szczegóły pozycji" toggle
// - Handles "Skopiuj link do konfiguracji"
// - Emits required funnel events via ctx.state.analytics (if available)

(function (global) {
  "use strict";

  function init(ctx) {
    const { root, dom, state } = ctx || {};
    if (!root || !dom) return () => { };

    const disposers = [];
    const view = root.ownerDocument.defaultView || global;

    const analytics = state?.analytics || null;
    const offerPayloadApi = state?.offerPayload || null;
    const projectionApi = state?.offerProjection || null;

    function on(el, eventName, handler, options) {
      if (!el) return;
      el.addEventListener(eventName, handler, options);
      disposers.push(() => el.removeEventListener(eventName, handler, options));
    }

    function qs(sel) {
      return dom.qs(sel);
    }

    function qsa(sel) {
      return dom.qsa(sel);
    }

    function formatPln(n) {
      const x = typeof n === "number" ? n : n != null ? Number(n) : NaN;
      if (!Number.isFinite(x)) return "â€”";
      try {
        return x.toLocaleString("pl-PL");
      } catch (_) {
        return String(Math.round(x));
      }
    }

    function normalizeVisiblePriceLabel(value) {
      const raw = typeof value === "string" ? value : String(value || "");
      const normalized = raw.replace(/\s+(zł|zl|PLN)\s*$/i, "").trim();
      return normalized || raw.trim() || "—";
    }

    function getSummaryEls() {
      return {
        heatLoad: root.querySelector('[data-role="offer-heat-load-kw"]'),
        pumpModel: root.querySelector('[data-role="offer-heatpump-model"]'),
        priceBadge: root
          .querySelector('[data-role="offer-total-gross-pln"]')
          ?.closest(".offer-badge"),
        totalGrossSmall: root.querySelector('[data-role="offer-total-gross-pln"]'),
        priceAmount: root.querySelector(".offer-price-card__amount"),
        totalGrossBig: root.querySelector('[data-role="offer-total-gross-pln-big"]'),
        vatNote: root.querySelector('[data-role="offer-vat-note"]'),
        pricingStatus: root.querySelector('[data-role="offer-pricing-status"]'),
        validUntil: root.querySelector('[data-role="offer-valid-until"]'),
        detailsToggle: root.querySelector('[data-action="toggle-summary-details"]'),
        detailsContainer: root.querySelector('[data-role="summary-details"]'),
        breakdownTable: root.querySelector('[data-role="offer-breakdown-table"]'),
        breakdownRows: root.querySelector('[data-role="offer-breakdown-rows"]'),
        breakdownTfoot: root.querySelector('[data-role="offer-breakdown-table"]'),
        gallerySection: root.querySelector('[data-role="offer-selected-gallery"]'),
        galleryGrid: root.querySelector('[data-role="offer-gallery-grid"]'),
      };
    }

    function toFiniteNumber(value, fallback = null) {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : fallback;
    }

    function readAppStateSnapshot() {
      try {
        return (
          (typeof state.getAppState === "function" && state.getAppState()) ||
          (typeof global.getAppState === "function" ? global.getAppState() : null) ||
          {}
        );
      } catch (_) {
        return {};
      }
    }

    function getCanonicalOfferDto() {
      try {
        const appSnapshot = readAppStateSnapshot();
        if (typeof state.getCanonicalOffer === "function") {
          const fromState = state.getCanonicalOffer(appSnapshot);
          if (fromState && typeof fromState === "object") {
            return fromState;
          }
        }
        if (typeof global.getCanonicalOffer === "function") {
          const fromGlobal = global.getCanonicalOffer(appSnapshot);
          if (fromGlobal && typeof fromGlobal === "object") {
            return fromGlobal;
          }
        }
        const dto = appSnapshot?.canonicalOffer || appSnapshot?.offer || null;
        return dto && typeof dto === "object" ? dto : null;
      } catch (_) {
        return null;
      }
    }

    function mapOfferDtoToSummaryOffer(offerDto) {
      if (!offerDto || typeof offerDto !== "object") return null;
      return {
        building: {
          designHeatLoss_kW: toFiniteNumber(
            offerDto?.engineering?.ozc?.designHeatLoss_kW,
            null
          ),
        },
        selection: {
          heatpump: {
            model: offerDto?.engineering?.selection?.pumpModel || null,
          },
        },
        pricing: {
          total_net_pln: toFiniteNumber(offerDto?.pricing?.totals?.net, null),
          total_vat_pln: toFiniteNumber(offerDto?.pricing?.totals?.vat, null),
          total_gross_pln: toFiniteNumber(offerDto?.pricing?.totals?.gross, null),
          vat_rate: toFiniteNumber(
            offerDto?.pricing?.items?.[0]?.vatRate,
            toFiniteNumber(offerDto?.pricing?.vatRate, 0.08)
          ),
          items: Array.isArray(offerDto?.pricing?.items) ? offerDto.pricing.items : [],
        },
        meta: {},
        __offerDto: offerDto,
      };
    }

    function mapOfferDtoItemsToBreakdown(offerDto) {
      const pricing = offerDto?.pricing || {};
      const items = Array.isArray(pricing.items) ? pricing.items : [];
      if (!items.length) return null;

      const normalized = items.map((item) => {
        const quantity = toFiniteNumber(item?.qty, 1) || 1;
        const unitNet = toFiniteNumber(item?.unitPriceNet, 0) || 0;
        const totalNet = toFiniteNumber(item?.totalNet, unitNet * quantity) || 0;
        const vatRate = toFiniteNumber(item?.vatRate, 0.08) || 0.08;
        const totalGross = toFiniteNumber(item?.totalGross, totalNet * (1 + vatRate));

        return {
          name: item?.name || item?.sku || "â€”",
          quantity: quantity,
          unit_price_pln: unitNet,
          vat_rate: vatRate,
          total_price_pln: totalGross,
        };
      });

      const totalsFromDto = pricing?.totals || {};
      const totals = {
        net:
          toFiniteNumber(totalsFromDto?.net, null) ??
          normalized.reduce(
            (sum, item) => sum + (toFiniteNumber(item.unit_price_pln, 0) || 0) * (toFiniteNumber(item.quantity, 1) || 1),
            0
          ),
        vat:
          toFiniteNumber(totalsFromDto?.vat, null) ??
          normalized.reduce((sum, item) => {
            const gross = toFiniteNumber(item.total_price_pln, 0) || 0;
            const rate = toFiniteNumber(item.vat_rate, 0.08) || 0.08;
            return sum + gross - gross / (1 + rate);
          }, 0),
        gross:
          toFiniteNumber(totalsFromDto?.gross, null) ??
          normalized.reduce((sum, item) => sum + (toFiniteNumber(item.total_price_pln, 0) || 0), 0),
      };

      return { items: normalized, totals: totals };
    }

    function mapOfferPayloadLineItemsToBreakdown(offer) {
      const vatRate = Number.isFinite(Number(offer?.pricing?.vat_rate))
        ? Number(offer.pricing.vat_rate)
        : 0.08;
      const lineItems = Array.isArray(offer?.pricing?.line_items)
        ? offer.pricing.line_items
        : [];
      if (!lineItems.length) return null;

      const normalized = lineItems.map((item) => {
        const quantity = Number.isFinite(Number(item?.qty)) ? Number(item.qty) : 1;
        const unitNet = Number.isFinite(Number(item?.unit_price))
          ? Number(item.unit_price)
          : 0;
        const totalNet = Number.isFinite(Number(item?.total))
          ? Number(item.total)
          : unitNet * quantity;
        return {
          name: item?.name || item?.sku || "â€”",
          quantity: quantity,
          unit_price_pln: unitNet,
          vat_rate: vatRate,
          total_price_pln: Math.round(totalNet * (1 + vatRate) * 100) / 100,
        };
      });

      const totalNet = normalized.reduce(
        (sum, item) => sum + (Number(item.unit_price_pln) || 0) * (Number(item.quantity) || 1),
        0
      );
      const totalGross = normalized.reduce(
        (sum, item) => sum + (Number(item.total_price_pln) || 0),
        0
      );

      return {
        items: normalized,
        totals: {
          net: Math.round(totalNet * 100) / 100,
          vat: Math.round((totalGross - totalNet) * 100) / 100,
          gross: Math.round(totalGross * 100) / 100,
        },
      };
    }

    function readOfferSnapshot() {
      if (
        projectionApi &&
        typeof projectionApi.resolveInputFromRuntime === "function" &&
        typeof projectionApi.buildSummaryViewModel === "function"
      ) {
        const input = projectionApi.resolveInputFromRuntime({
          target: "summary",
          channel: "ui",
        });
        return {
          ...projectionApi.buildSummaryViewModel(input),
          __summaryInput: input,
        };
      }

      try {
        if (
          offerPayloadApi &&
          typeof offerPayloadApi.buildPresentationSnapshot === "function"
        ) {
          const presentation = offerPayloadApi.buildPresentationSnapshot({
            includePii: false,
          });
          if (presentation?.summaryOffer) {
            return {
              ...presentation.summaryOffer,
              __presentationSnapshot: presentation,
            };
          }
        }
      } catch (_) { }

      try {
        if (!offerPayloadApi || typeof offerPayloadApi.buildOfferPayload !== "function") {
          const offerDto = getCanonicalOfferDto();
          const mappedFromDto = mapOfferDtoToSummaryOffer(offerDto);
          return mappedFromDto || null;
        }
        const offer = offerPayloadApi.buildOfferPayload({ includePii: false });
        return offer;
      } catch (_) {
        return null;
      }
    }

    function normalizeOptionId(value) {
      if (!value) return "";
      if (typeof value === "string") return value.trim().toLowerCase();
      if (typeof value === "object" && typeof value.optionId === "string") {
        return value.optionId.trim().toLowerCase();
      }
      return "";
    }

    function getOfferDtoFromSummaryOffer(offer) {
      return (
        offer?.offerDto ||
        offer?.__offerDto ||
        offer?.__summaryInput?.offerDto ||
        null
      );
    }

    function getSummarySelection(offer) {
      return offer?.__summaryInput?.configuratorSelection || null;
    }

    function getRuntimePricingState(offer) {
      const fromSummaryInput =
        offer?.__summaryInput?.uiContext?.runtimeMeta?.configuratorPricingState;
      if (fromSummaryInput && typeof fromSummaryInput === "object") {
        return fromSummaryInput;
      }

      const appSnapshot = readAppStateSnapshot();
      if (
        appSnapshot?.configuratorPricingState &&
        typeof appSnapshot.configuratorPricingState === "object"
      ) {
        return appSnapshot.configuratorPricingState;
      }

      if (
        appSnapshot?.configuratorState?.configuratorPricingState &&
        typeof appSnapshot.configuratorState.configuratorPricingState === "object"
      ) {
        return appSnapshot.configuratorState.configuratorPricingState;
      }

      return null;
    }

    function getPricingItems(offer) {
      const offerDto = getOfferDtoFromSummaryOffer(offer);
      const dtoItems = Array.isArray(offerDto?.pricing?.items)
        ? offerDto.pricing.items
        : [];
      if (dtoItems.length > 0) {
        return dtoItems;
      }
      return Array.isArray(offer?.pricing?.items) ? offer.pricing.items : [];
    }

    function resolveExpectedPricingSkus(offer) {
      const configuratorSelection = getSummarySelection(offer);
      const selections = configuratorSelection?.selections || {};
      const products = configuratorSelection?.products || {};
      const offerDto = getOfferDtoFromSummaryOffer(offer);
      const pumpType = String(
        products?.pump?.type ||
        offerDto?.engineering?.selection?.type ||
        ""
      )
        .trim()
        .toLowerCase();
      const hasPumpSelection =
        !!products?.pump ||
        !!offerDto?.engineering?.selection?.pumpModel ||
        !!offer?.pumpModel;
      const expected = [];

      if (hasPumpSelection) {
        expected.push("PUMP", "HYDRAULIC", "INSTALLATION");
      }

      const cwuOptionId = normalizeOptionId(selections?.cwu);
      if (
        hasPumpSelection &&
        cwuOptionId &&
        cwuOptionId !== "cwu-nie" &&
        !pumpType.includes("all-in-one") &&
        !pumpType.includes("aio")
      ) {
        expected.push("CWU");
      }

      const bufferOptionId = normalizeOptionId(selections?.bufor);
      if (
        bufferOptionId &&
        bufferOptionId !== "buffer-0" &&
        bufferOptionId !== "bufor-nie"
      ) {
        expected.push("BUFFER");
      }

      if (normalizeOptionId(selections?.cyrkulacja) === "cyrkulacja-tak") {
        expected.push("ACCESSORY_CIRCULATION");
      }
      if (normalizeOptionId(selections?.reduktor) === "reduktor-tak") {
        expected.push("ACCESSORY_PRESSURE");
      }

      const waterOptionId = normalizeOptionId(selections?.woda);
      if (waterOptionId === "woda-tak") {
        expected.push("ACCESSORY_WATER_SOFTENER");
      } else if (waterOptionId === "woda-filtr") {
        expected.push("ACCESSORY_WATER_FILTER");
      }

      const foundationOptionId = normalizeOptionId(selections?.posadowienie);
      if (foundationOptionId === "posadowienie-sciana") {
        expected.push("ACCESSORY_FOUNDATION_WALL");
      } else if (foundationOptionId === "posadowienie-eko") {
        expected.push("ACCESSORY_FOUNDATION_ECO");
      }

      return Array.from(new Set(expected));
    }

    function mapPricingSkuToFriendlyLabel(sku) {
      const key = String(sku || "").trim().toUpperCase();
      const map = {
        PUMP: "pompa i dobór",
        HYDRAULIC: "hydraulika / montaż",
        INSTALLATION: "montaż",
        CWU: "zasobnik CWU",
        BUFFER: "bufor",
        ACCESSORY_CIRCULATION: "cyrkulacja CWU",
        ACCESSORY_PRESSURE: "reduktor ciśnienia",
        ACCESSORY_WATER_SOFTENER: "uzdatnianie wody",
        ACCESSORY_WATER_FILTER: "filtr wody",
        ACCESSORY_FOUNDATION_WALL: "posadowienie scienne",
        ACCESSORY_FOUNDATION_ECO: "posadowienie eco",
      };
      return map[key] || "";
    }

    function buildPendingRepriceUserMessage() {
      return "Cena brutto odswiezy sie po ponownym przeliczeniu oferty dla biezacej konfiguracji.";
    }

    function buildPricingHiddenUserMessage(totalGross, missingSkus) {
      const neutral =
        "Część elementów zestawu wymaga indywidualnej wyceny. Skontaktuj się z TOP-INSTAL - doprecyzujemy zakres i koszt.";

      if (Array.isArray(missingSkus) && missingSkus.length > 0) {
        const labels = missingSkus
          .map(mapPricingSkuToFriendlyLabel)
          .filter(Boolean);
        if (labels.length > 0) {
          const short = labels.slice(0, 4).join(", ");
          return `Część zestawu wymaga doprecyzowania wyceny (${short}). Napisz do nas po pełną wycenę.`;
        }
        return neutral;
      }

      if (!Number.isFinite(totalGross) || totalGross <= 0) {
        return "Kwota brutto pojawi się po przeliczeniu oferty. Jeśli potrzebujesz od razu wyceny, skontaktuj się z TOP-INSTAL.";
      }

      return "O cenę zapytaj TOP-INSTAL";
    }

    function resolvePricingVisibilityState(offer) {
      const expectedSkus = resolveExpectedPricingSkus(offer);
      const presentSkus = new Set(
        getPricingItems(offer)
          .map((item) => String(item?.sku || "").trim().toUpperCase())
          .filter(Boolean)
      );
      const missingSkus = expectedSkus.filter((sku) => !presentSkus.has(sku));
      const runtimePricingState = getRuntimePricingState(offer);
      const totalGross = toFiniteNumber(
        offer?.totalGross ??
        offer?.pricing?.total_gross_pln ??
        getOfferDtoFromSummaryOffer(offer)?.pricing?.totals?.gross,
        null
      );
      const needsReprice =
        runtimePricingState?.needsReprice === true ||
        runtimePricingState?.offerFresh === false;

      if (needsReprice) {
        return {
          visible: false,
          message: buildPendingRepriceUserMessage(),
          missingSkus,
          reason: "pending_reprice",
          runtimePricingState,
        };
      }

      const visible =
        Number.isFinite(totalGross) &&
        totalGross > 0 &&
        missingSkus.length === 0;

      const message = buildPricingHiddenUserMessage(totalGross, missingSkus);

      return {
        visible,
        message,
        missingSkus,
        reason: visible
          ? "ready"
          : missingSkus.length > 0
            ? "missing_expected_items"
            : "missing_total_gross",
        runtimePricingState,
      };
    }

    function setPriceBadgeDisplay(els, visible, value) {
      if (!els?.priceBadge) return;
      const displayValue = visible ? normalizeVisiblePriceLabel(value) : value;
      els.priceBadge.innerHTML = visible
        ? `Cena brutto: <strong data-role="offer-total-gross-pln">${escapeHtml(
          displayValue
        )}</strong> PLN`
        : `Cena brutto: <strong data-role="offer-total-gross-pln">${escapeHtml(
          displayValue
        )}</strong>`;
    }

    function setPriceAmountDisplay(els, visible, value) {
      if (!els?.priceAmount) return;
      const displayValue = visible ? normalizeVisiblePriceLabel(value) : value;
      els.priceAmount.innerHTML = visible
        ? `<span data-role="offer-total-gross-pln-big">${escapeHtml(displayValue)}</span> zł`
        : escapeHtml(displayValue);
    }

    function hideLegacyPricingBreakdown(els) {
      if (!els) return;
      if (els.detailsToggle) {
        els.detailsToggle.hidden = true;
      }
      if (els.detailsContainer) {
        els.detailsContainer.hidden = true;
      }
      if (els.breakdownTable) {
        els.breakdownTable.hidden = true;
      }
    }

    function ensureGalleryEls() {
      let section = root.querySelector('[data-role="offer-selected-gallery"]');
      if (!section) {
        const priceCard = root.querySelector(".offer-price-card");
        if (!priceCard || !priceCard.parentNode) {
          return { section: null, grid: null };
        }
        section = document.createElement("section");
        section.className = "offer-gallery";
        section.setAttribute("data-role", "offer-selected-gallery");
        section.hidden = true;
        section.setAttribute("aria-label", "Wybrane urządzenia");
        section.innerHTML = `
          <div class="offer-gallery__header">
            <h2 class="offer-summary-section__title">Wybrane urządzenia</h2>
            <p class="offer-gallery__subtitle">
              Zdjęcia głównych komponentów zestawu (pompa, zasobnik CWU, bufor), jeśli były dostępne w konfiguratorze.
            </p>
          </div>
          <div class="offer-gallery__grid" data-role="offer-gallery-grid"></div>
        `;
        priceCard.insertAdjacentElement("afterend", section);
      }
      return {
        section,
        grid: section.querySelector('[data-role="offer-gallery-grid"]'),
      };
    }

    function collectSelectedProductImages() {
      const definitions = [
        { stepKey: "pompa", fallbackTitle: "Pompa ciepła" },
        { stepKey: "cwu", fallbackTitle: "Zasobnik CWU" },
        { stepKey: "bufor", fallbackTitle: "Bufor CO" },
      ];
      const seen = new Set();

      return definitions
        .map(({ stepKey, fallbackTitle }) => {
          const card = root.querySelector(
            `[data-step-key="${stepKey}"] .product-card.selected`
          );
          const image = card?.querySelector("img");
          const src = image?.getAttribute("src") || "";
          if (!src || seen.has(src)) {
            return null;
          }
          seen.add(src);
          return {
            src,
            alt: image?.getAttribute("alt") || fallbackTitle,
            title:
              card?.querySelector(".product-title")?.textContent?.trim() ||
              fallbackTitle,
            subtitle:
              card?.querySelector(".product-subtitle")?.textContent?.trim() || "",
          };
        })
        .filter(Boolean);
    }

    function renderSelectedProductsGallery() {
      const galleryEls = ensureGalleryEls();
      if (!galleryEls.section || !galleryEls.grid) return;

      const items = collectSelectedProductImages();
      galleryEls.grid.innerHTML = "";

      if (!items.length) {
        galleryEls.section.hidden = true;
        return;
      }

      items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "offer-gallery-card";
        card.innerHTML = `
          <div class="offer-gallery-card__image">
            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" />
          </div>
          <div class="offer-gallery-card__content">
            <div class="offer-gallery-card__title">${escapeHtml(item.title)}</div>
            ${item.subtitle
            ? `<div class="offer-gallery-card__subtitle">${escapeHtml(
              item.subtitle
            )}</div>`
            : ""
          }
          </div>
        `;
        galleryEls.grid.appendChild(card);
      });

      galleryEls.section.hidden = false;
    }

    function renderSummaryOffer(offer, els = getSummaryEls()) {
      if (!offer || !els || !els.heatLoad || !els.pumpModel) return;

      const heatLoadLabel =
        typeof offer?.heatLoadLabel === "string" && offer.heatLoadLabel.trim() !== ""
          ? offer.heatLoadLabel
          : typeof offer?.building?.designHeatLoss_kW === "number" &&
            Number.isFinite(offer.building.designHeatLoss_kW)
            ? String(Math.round(offer.building.designHeatLoss_kW * 100) / 100)
            : "â€”";
      const modelLabel =
        offer?.pumpModel || offer?.selection?.heatpump?.model || "â€”";
      const totalGrossLabel =
        typeof offer?.totalGrossLabel === "string" && offer.totalGrossLabel.trim() !== ""
          ? offer.totalGrossLabel
          : formatPln(
            offer?.totalGross != null
              ? offer.totalGross
              : offer?.pricing?.total_gross_pln
          );
      const pricingState = resolvePricingVisibilityState(offer);

      els.heatLoad.textContent = heatLoadLabel;
      els.pumpModel.textContent = modelLabel || "â€”";
      setPriceBadgeDisplay(
        els,
        pricingState.visible,
        pricingState.visible ? totalGrossLabel : pricingState.message
      );
      setPriceAmountDisplay(
        els,
        pricingState.visible,
        pricingState.visible ? totalGrossLabel : pricingState.message
      );

      if (els.vatNote) {
        const vatVisible =
          pricingState.visible &&
          (typeof offer?.vatNoteVisible === "boolean"
            ? offer.vatNoteVisible
            : offer?.pricing?.vat_rate === 0.08);
        els.vatNote.hidden = !vatVisible;
      }

      if (els.pricingStatus) {
        els.pricingStatus.hidden = pricingState.visible;
        els.pricingStatus.textContent = pricingState.visible ? "" : pricingState.message;
        els.pricingStatus.style.display = pricingState.visible ? "none" : "";
      }

      if (els.validUntil) {
        els.validUntil.textContent =
          offer?.validUntilLabel || offer?.meta?.offer_valid_until_label || "â€”";
      }

      hideLegacyPricingBreakdown(els);
      renderSelectedProductsGallery();
    }

    function renderSummaryBadges() {
      const offer = readOfferSnapshot();
      const els = getSummaryEls();
      if (!offer || !els.heatLoad || !els.pumpModel || !els.totalGrossSmall) return;
      renderSummaryOffer(offer, els);
    }

    function renderPricingBreakdown() {
      hideLegacyPricingBreakdown(getSummaryEls());
    }

    function renderSummaryBadgesProjection() {
      const offer = readOfferSnapshot();
      const els = getSummaryEls();
      if (!offer || !els.heatLoad || !els.pumpModel || !els.totalGrossSmall) return;
      renderSummaryOffer(offer, els);
    }

    function renderPricingBreakdownProjection() {
      hideLegacyPricingBreakdown(getSummaryEls());
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Toggle summary details
    function toggleDetails(btn) {
      const details = root.querySelector('[data-role="summary-details"]');
      if (!btn || !details) return;
      const isOpen = details.hidden === false;
      details.hidden = isOpen;
      btn.setAttribute("aria-expanded", String(!isOpen));
      btn.textContent = isOpen ? "Pokaż szczegóły pozycji" : "Ukryj szczegóły pozycji";
      if (analytics) analytics.emit("pricing_breakdown_opened", { open: !isOpen, step_key: "summary" });
    }

    // Lead form open / intent handling
    function openLeadForm(intent) {
      const form = dom.byId("pdf-contact-form");
      if (!form) return;

      form.classList.remove("hidden");
      form.style.display = "block";
      form.setAttribute("data-intent", intent || "");

      const titleEl = form.querySelector('[data-role="lead-form-title"]');
      const subtitleEl = form.querySelector('[data-role="lead-form-subtitle"]');
      const emailReq = form.querySelector('[data-role="email-required-indicator"]');
      const phoneReq = form.querySelector('[data-role="phone-required-indicator"]');
      const phoneHelper = form.querySelector('[data-role="phone-helper"]');
      const btnEmail = form.querySelector('[data-role="lead-submit-email"]');
      const btnContact = form.querySelector('[data-role="lead-submit-contact"]');
      const emailInput = dom.byId("customer-email");
      const phoneInput = dom.byId("customer-phone");
      const isContact = intent === "order_contact";
      if (titleEl) titleEl.textContent = isContact ? "Zamów kontakt" : "Wyślij ofertę na e-mail";
      if (subtitleEl) {
        subtitleEl.textContent = isContact
          ? "Podaj dane, a wrócimy z terminami i potwierdzimy szczegóły."
          : "Podaj dane, a wyślemy ofertę PDF na e-mail.";
      }

      if (emailReq) emailReq.style.display = isContact ? "none" : "inline";
      if (phoneReq) phoneReq.style.display = isContact ? "inline" : "none";
      if (phoneHelper) {
        phoneHelper.textContent = isContact
          ? "Oddzwonimy, żeby potwierdzić warunki montażu."
          : "Telefon opcjonalny - przyda się tylko, jeśli poprosisz o kontakt.";
      }
      if (emailInput) {
        emailInput.required = !isContact;
        emailInput.setAttribute("aria-required", !isContact ? "true" : "false");
      }
      if (phoneInput) {
        phoneInput.required = isContact;
        phoneInput.setAttribute("aria-required", isContact ? "true" : "false");
      }
      if (btnEmail) btnEmail.hidden = isContact;
      if (btnContact) btnContact.hidden = !isContact;

      try {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) { }

      if (analytics) {
        analytics.emit("lead_form_opened", { intent: intent || null, step_key: "summary" });
      }
    }

    function hideLeadForm() {
      const form = dom.byId("pdf-contact-form");
      if (form) {
        form.classList.add("hidden");
        form.style.display = "none";
        form.setAttribute("data-intent", "");
      }
    }

    function focusPrimaryIntent() {
      const primaryIntent = root.querySelector(".offer-intent--primary");
      if (!primaryIntent) return;
      try {
        primaryIntent.focus();
      } catch (_) { }
    }

    function normalizePhoneInput(raw) {
      const digits = String(raw || "").replace(/\D/g, "");
      if (!digits) return "";

      if (digits.length === 9) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
      }
      if (digits.length === 11 && digits.startsWith("48")) {
        const local = digits.slice(2);
        return `+48 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`;
      }
      return String(raw || "").trim();
    }

    function normalizePostalCode(raw) {
      const digits = String(raw || "").replace(/\D/g, "").slice(0, 5);
      if (digits.length <= 2) return digits;
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }

    function updateConsentGate() {
      const form = dom.byId("pdf-contact-form");
      if (!form) return;
      const terms = !!dom.byId("consent-terms-accept")?.checked;
      const rodo = !!dom.byId("consent-rodo-contact")?.checked;
      const canSubmit = terms && rodo;

      const btnEmail = form.querySelector('[data-role="lead-submit-email"]');
      const btnContact = form.querySelector('[data-role="lead-submit-contact"]');
      if (btnEmail) btnEmail.disabled = !canSubmit;
      if (btnContact) btnContact.disabled = !canSubmit;
    }

    // Copy config URL (best-effort)
    async function copyConfigLink() {
      let url = null;
      try {
        if (global.TopInstalCalculator && typeof global.TopInstalCalculator.generateURLWithParams === "function") {
          url = global.TopInstalCalculator.generateURLWithParams();
        } else if (view.location) {
          url = String(view.location.href);
        }
      } catch (_) { }

      if (!url) return;

      // Add lead/session if available (non-PII)
      try {
        const offer = readOfferSnapshot();
        const u = new URL(url, view.location ? view.location.origin : "https://example.invalid");
        if (offer?.lead?.lead_id) u.searchParams.set("lead_id", offer.lead.lead_id);
        if (offer?.lead?.session_id) u.searchParams.set("session_id", offer.lead.session_id);
        url = u.toString();
      } catch (_) { }

      try {
        if (view.navigator?.clipboard?.writeText) {
          await view.navigator.clipboard.writeText(url);
        } else {
          // Fallback
          const ta = view.document.createElement("textarea");
          ta.value = url;
          ta.setAttribute("readonly", "true");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          view.document.body.appendChild(ta);
          ta.select();
          view.document.execCommand("copy");
          view.document.body.removeChild(ta);
        }
        if (global.ErrorHandler?.showToast) {
          global.ErrorHandler.showToast("Link skopiowany do schowka.", "success", 2500);
        }
        if (analytics) analytics.emit("copy_config_link_clicked", { step_key: "summary" });
      } catch (e) {
        if (global.ErrorHandler?.showToast) {
          global.ErrorHandler.showToast("Nie udało się skopiować linku. Skopiuj ręcznie z paska adresu.", "error", 3500);
        }
        if (analytics) analytics.emit("validation_error", { field_name: "copy_link", reason: "clipboard_failed", step_key: "summary" });
      }
    }

    // Click delegation inside summary step
    function onClick(e) {
      const actionEl = e.target.closest("[data-action]");
      const action = actionEl ? actionEl.getAttribute("data-action") : null;
      if (!action) return;

      if (action === "toggle-summary-details") {
        e.preventDefault();
        toggleDetails(actionEl);
        return;
      }
      if (action === "open-lead-form") {
        e.preventDefault();
        const intent = actionEl.getAttribute("data-intent") || "";
        if (analytics) {
          const analyticsIntent =
            intent === "order_contact" ? "contact" : intent === "pdf_download" ? "pdf" : "email";
          analytics.emit(`intent_selected_${analyticsIntent}`, { intent, step_key: "summary" });
        }
        if (intent === "order_contact") {
          openLeadForm(intent);
          return;
        }
        hideLeadForm();
        const leadGate = global.__topinstalPdfLeadGate;
        if (leadGate && typeof leadGate.openLeadForIntent === "function") {
          leadGate.openLeadForIntent(dom, { root, dom, state }, intent === "email_pdf" ? "email_pdf" : "pdf_download");
        }
        return;
      }
      if (action === "download-offer-pdf" || action === "download-pdf") {
        if (analytics) {
          analytics.emit("intent_selected_pdf", {
            intent: "pdf_download",
            step_key: "summary",
          });
        }
      }
      if (action === "copy-config-link") {
        e.preventDefault();
        copyConfigLink();
        return;
      }
      if (action === "print") {
        if (analytics) analytics.emit("print_clicked", { step_key: "summary" });
      }
      if (action === "back-to-config") {
        if (analytics) analytics.emit("back_to_config_clicked", { step_key: "summary" });
      }
    }

    function onBlur(e) {
      const t = e.target;
      if (!t) return;
      const id = t.getAttribute && t.getAttribute("id");
      if (!id) return;
      if (id === "customer-phone") {
        t.value = normalizePhoneInput(t.value);
      }
      if (id === "customer-email" || id === "customer-phone" || id === "customer-postal-code" || id === "preferred-contact-time") {
        if (analytics) analytics.emit("lead_form_field_changed", { field_name: id, step_key: "summary" });
      }
    }

    function onInput(e) {
      const t = e.target;
      if (!t) return;
      const id = t.getAttribute && t.getAttribute("id");
      if (!id) return;
      if (id === "customer-postal-code") {
        const next = normalizePostalCode(t.value);
        if (next !== t.value) t.value = next;
      }
    }

    function onChange(e) {
      const t = e.target;
      if (!t) return;
      const id = t.getAttribute && t.getAttribute("id");
      if (!id) return;
      if (id === "consent-terms-accept" || id === "consent-rodo-contact" || id === "consent-marketing-opt-in") {
        if (analytics) analytics.emit("consent_toggled", { which: id, checked: !!t.checked, step_key: "summary" });
        updateConsentGate();
      }
    }

    function collectSelectedProductImages() {
      const definitions = [
        { stepKey: "pompa", fallbackTitle: "Pompa ciepła" },
        { stepKey: "cwu", fallbackTitle: "Zasobnik CWU" },
        { stepKey: "bufor", fallbackTitle: "Bufor CO" },
      ];
      const seen = new Set();

      return definitions
        .map(({ stepKey, fallbackTitle }) => {
          const card = root.querySelector(
            `[data-step-key="${stepKey}"] .product-card.selected`
          );
          const image = card?.querySelector("img");
          const src = image?.getAttribute("src") || "";
          if (!src || seen.has(src)) {
            return null;
          }
          seen.add(src);
          return {
            src,
            alt: image?.getAttribute("alt") || fallbackTitle,
            title:
              card?.querySelector(".product-title")?.textContent?.trim() ||
              fallbackTitle,
            subtitle:
              card?.querySelector(".product-subtitle")?.textContent?.trim() || "",
          };
        })
        .filter(Boolean);
    }

    function renderSelectedProductsGallery() {
      const galleryEls = ensureGalleryEls();
      if (!galleryEls.section || !galleryEls.grid) return;

      const items = collectSelectedProductImages();
      galleryEls.grid.innerHTML = "";

      if (!items.length) {
        galleryEls.section.hidden = true;
        return;
      }

      items.forEach((item) => {
        const card = root.ownerDocument.createElement("article");
        card.className = "offer-gallery-card";
        card.innerHTML = `
          <div class="offer-gallery-card__image">
            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" />
          </div>
          <div class="offer-gallery-card__content">
            <div class="offer-gallery-card__title">${escapeHtml(item.title)}</div>
            ${item.subtitle
            ? `<div class="offer-gallery-card__subtitle">${escapeHtml(
              item.subtitle
            )}</div>`
            : ""
          }
          </div>
        `;
        galleryEls.grid.appendChild(card);
      });

      galleryEls.section.hidden = false;
    }

    function renderSummaryOffer(offer, els = getSummaryEls()) {
      if (!offer || !els || !els.heatLoad || !els.pumpModel) return;

      const heatLoadLabel =
        typeof offer?.heatLoadLabel === "string" && offer.heatLoadLabel.trim() !== ""
          ? offer.heatLoadLabel
          : typeof offer?.building?.designHeatLoss_kW === "number" &&
            Number.isFinite(offer.building.designHeatLoss_kW)
            ? String(Math.round(offer.building.designHeatLoss_kW * 100) / 100)
            : "â€”";
      const modelLabel =
        offer?.pumpModel || offer?.selection?.heatpump?.model || "â€”";
      const totalGrossLabel =
        typeof offer?.totalGrossLabel === "string" && offer.totalGrossLabel.trim() !== ""
          ? offer.totalGrossLabel
          : formatPln(
            offer?.totalGross != null
              ? offer.totalGross
              : offer?.pricing?.total_gross_pln
          );
      const pricingState = resolvePricingVisibilityState(offer);

      els.heatLoad.textContent = heatLoadLabel;
      els.pumpModel.textContent = modelLabel || "â€”";
      setPriceBadgeDisplay(
        els,
        pricingState.visible,
        pricingState.visible ? totalGrossLabel : pricingState.message
      );
      setPriceAmountDisplay(
        els,
        pricingState.visible,
        pricingState.visible ? totalGrossLabel : pricingState.message
      );

      if (els.vatNote) {
        const vatVisible =
          pricingState.visible &&
          (typeof offer?.vatNoteVisible === "boolean"
            ? offer.vatNoteVisible
            : offer?.pricing?.vat_rate === 0.08);
        els.vatNote.hidden = !vatVisible;
      }

      if (els.pricingStatus) {
        els.pricingStatus.hidden = pricingState.visible;
        els.pricingStatus.textContent = pricingState.visible ? "" : pricingState.message;
        els.pricingStatus.style.display = pricingState.visible ? "none" : "";
      }

      if (els.validUntil) {
        els.validUntil.textContent =
          offer?.validUntilLabel || offer?.meta?.offer_valid_until_label || "â€”";
      }

      hideLegacyPricingBreakdown(els);
      renderSelectedProductsGallery();
    }

    function escapeHtml(text) {
      const div = root.ownerDocument.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    function toggleDetails(btn) {
      hideLegacyPricingBreakdown(getSummaryEls());
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
      }
      if (analytics) {
        analytics.emit("pricing_breakdown_opened", {
          open: false,
          suppressed: true,
          step_key: "summary",
        });
      }
    }

    async function copyConfigLink() {
      let url = null;
      try {
        if (
          global.TopInstalCalculator &&
          typeof global.TopInstalCalculator.generateURLWithParams === "function"
        ) {
          url = global.TopInstalCalculator.generateURLWithParams();
        } else if (view.location) {
          url = String(view.location.href);
        }
      } catch (_) { }

      if (!url) return;

      try {
        const offer = readOfferSnapshot();
        const u = new URL(
          url,
          view.location ? view.location.origin : "https://example.invalid"
        );
        if (offer?.lead?.lead_id) u.searchParams.set("lead_id", offer.lead.lead_id);
        if (offer?.lead?.session_id) {
          u.searchParams.set("session_id", offer.lead.session_id);
        }
        url = u.toString();
      } catch (_) { }

      try {
        if (view.navigator?.clipboard?.writeText) {
          await view.navigator.clipboard.writeText(url);
        } else {
          const ta = view.document.createElement("textarea");
          ta.value = url;
          ta.setAttribute("readonly", "true");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          view.document.body.appendChild(ta);
          ta.select();
          view.document.execCommand("copy");
          view.document.body.removeChild(ta);
        }
        if (global.ErrorHandler?.showToast) {
          global.ErrorHandler.showToast(
            "Link skopiowany do schowka.",
            "success",
            2500
          );
        }
        if (analytics) {
          analytics.emit("copy_config_link_clicked", { step_key: "summary" });
        }
      } catch (_) {
        if (global.ErrorHandler?.showToast) {
          global.ErrorHandler.showToast(
            "Nie udało się skopiować linku. Skopiuj go ręcznie z paska adresu.",
            "error",
            3500
          );
        }
        if (analytics) {
          analytics.emit("validation_error", {
            field_name: "copy_link",
            reason: "clipboard_failed",
            step_key: "summary",
          });
        }
      }
    }

    // Summary step lifecycle
    on(root, "hp:summaryStepShown", () => {
      renderSummaryBadgesProjection();
      updateConsentGate();
      setTimeout(focusPrimaryIntent, 20);
      if (analytics) analytics.emitOnce("summary_viewed", "summary_viewed", { step_key: "summary" });
    });

    on(root, "hp:summaryDataChanged", () => {
      renderSummaryBadgesProjection();
      updateConsentGate();
    });

    // Also render once on init (in case summary is already active)
    renderSummaryBadgesProjection();
    updateConsentGate();

    on(root, "click", onClick);
    on(root, "input", onInput, true);
    on(root, "blur", onBlur, true);
    on(root, "change", onChange, true);

    // Hide form when cancel clicked (existing data-action handler also exists; keep idempotent)
    on(root, "hp:hidePdfForm", () => hideLeadForm());

    return function disposeOfferSummary() {
      disposers.forEach((fn) => {
        try {
          fn();
        } catch (_) { }
      });
    };
  }

  global.__HP_MODULES__ = global.__HP_MODULES__ || {};
  global.__HP_MODULES__.offerSummary = { init };
})(window);
