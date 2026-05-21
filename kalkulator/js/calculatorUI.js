/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * CALCULATOR UI - Wszystkie skrypty UI przeniesione z calculator.html
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *
 * Ten plik zawiera wszystkie inline skrypty JavaScript z calculator.html
 * przeniesione do dedykowanego pliku .js dla lepszej organizacji kodu.
 *
 * REFACTOR: Przeniesione z calculator.html (2025)
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

(function (window) {
  "use strict";

  function init(ctx) {
    const LOG = (typeof window !== "undefined" && window.HP_LOG) || {
      info: function () { },
      warn: function () { },
      error: function () { },
      group: function () { },
      groupEnd: function () { },
    };

    LOG.info("module:calculatorUI", "init called", {
      hasFormEngine: !!ctx?.state?.formEngine,
    });
    const { root, dom, state } = ctx;
    const disposers = [];
    const config = state?.config || {};
    const doc = root.ownerDocument;
    const view = doc.defaultView || window;
    const debug = state?.debug || view;
    const formEngine = state?.formEngine || null;
    const progressiveDisclosure = state?.progressiveDisclosure || null;
    const motion = state?.motion || null;
    const getAppState = state?.getAppState;
    const updateAppState = state?.updateAppState;

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

    function setSliderPlaceholder(thumb, bubble, ticks, placeholder = "—") {
      if (thumb) {
        thumb.style.left = "0%";
      }
      if (bubble) {
        bubble.style.left = "0%";
        bubble.textContent = placeholder;
        bubble.classList.add("custom-bubble--placeholder");
      }
      if (ticks && typeof ticks.forEach === "function") {
        ticks.forEach((tick) => tick.classList.remove("active"));
      }
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

    function normalizeAccordionItems(items) {
      if (!Array.isArray(items)) return [];
      return items
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
        .filter(Boolean);
    }

    function toggleAccordionSection(section, items, willCollapse) {
      if (!section || section.dataset.motionBusy === "1") return;
      const detailItems = normalizeAccordionItems(items);
      const motionApi = motion || window.MotionSystem;
      const canAnimate =
        motionApi &&
        typeof motionApi.animateDetailsToggle === "function" &&
        !isReducedMotionPreferred();

      section.dataset.motionBusy = "1";

      const finish = () => {
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
          finish();
        };

        if (canAnimate && detailItems.length) {
          motionApi
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

      const finalizeExpand = () => {
        finish();
      };

      if (canAnimate && detailItems.length) {
        motionApi
          .animateDetailsToggle(section, detailItems, true)
          .then(finalizeExpand, finalizeExpand);
      } else {
        finalizeExpand();
      }
    }

    // state dependencies are provided via ctx; avoid global assignments

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 1. KONFIGURACJA STANDALONE
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 2. OPTION CARDS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initOptionCards() {
      const optionCards = dom.qsa(".option-card");
      if (optionCards.length === 0) {
        return;
      }

      const cardsByField = {};
      optionCards.forEach((card) => {
        const fieldName = card.dataset.field;
        if (!fieldName) return;
        if (!cardsByField[fieldName]) {
          cardsByField[fieldName] = [];
        }
        cardsByField[fieldName].push(card);
      });

      Object.keys(cardsByField).forEach((fieldName) => {
        const cards = cardsByField[fieldName];
        const hiddenInput = dom.byId(fieldName);
        if (!hiddenInput) {
          console.warn(`Nie znaleziono ukrytego inputa dla ${fieldName}`);
          return;
        }

        const updateCardsFromInput = () => {
          const value = hiddenInput.value;
          cards.forEach((card) => {
            if (card.dataset.value === value) {
              card.classList.add("option-card--selected");
            } else {
              card.classList.remove("option-card--selected");
            }
          });
        };

        const triggerOptionChange = (value) => {
          hiddenInput.value = value;
          updateCardsFromInput();

          // formEngine automatycznie zareaguje na te eventy
          const changeEvent = new Event("change", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(changeEvent);

          const inputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(inputEvent);
        };

        cards.forEach((card) => {
          trackEvent(card, "click", function () {
            const value = this.dataset.value;
            if (!value || this.classList.contains("option-card--disabled"))
              return;
            triggerOptionChange(value);
          });

          trackEvent(card, "keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              const value = this.dataset.value;
              if (!value || this.classList.contains("option-card--disabled"))
                return;
              triggerOptionChange(value);
            }
          });
        });

        trackEvent(hiddenInput, "change", updateCardsFromInput);
        updateCardsFromInput();
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 4. COLLAPSIBLE INSTRUCTION
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initCollapsibleInstruction() {
      const toggle = dom.qs(".instruction-toggle");
      const content = dom.qs(".instruction-content");

      if (toggle && content) {
        trackEvent(toggle, "click", function () {
          const isExpanded = toggle.getAttribute("aria-expanded") === "true";

          if (isExpanded) {
            // Zwiń
            content.style.display = "none";
            toggle.setAttribute("aria-expanded", "false");
          } else {
            // Rozwiń
            content.style.display = "block";
            toggle.setAttribute("aria-expanded", "true");
          }
        });
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 5. BUILDING TYPE CARDS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Globalna funkcja pomocnicza do odczytu wartości building_type z hidden inputa
    // Inicjalizacja kart building_type
    let buildingTypeCardsInitialized = false; // ✅ Flaga zapobiegająca wielokrotnej inicjalizacji
    function initBuildingTypeCards() {
      // ✅ Zapobiegaj wielokrotnej inicjalizacji
      if (buildingTypeCardsInitialized) {
        return;
      }

      const buildingTypeCards = dom.qsa(".building-type-card");
      const hiddenInput = dom.byId("building_type");

      if (buildingTypeCards.length === 0 || !hiddenInput) {
        if (!hiddenInput) {
          console.warn("Nie znaleziono ukrytego pola building_type");
        }
        return;
      }

      // ✅ Oznacz jako zainicjalizowane PRZED dodaniem event listenerów
      buildingTypeCardsInitialized = true;

      function updateCardsFromValue(value) {
        buildingTypeCards.forEach((card) => {
          if (card.dataset.value === value) {
            card.classList.add("building-type-card--selected");
          } else {
            card.classList.remove("building-type-card--selected");
          }
        });
      }

      // Funkcja wywołująca wszystkie potrzebne eventy i aktualizacje
      function triggerBuildingTypeChangeInternal(value) {
        // 🔒 Ochrona: nigdy nie ustawiaj building_type na undefined / null / pusty
        if (value === undefined || value === null) {
          console.warn(
            "[BuildingType] Ignoruję próbę ustawienia building_type na undefined/null"
          );
          return;
        }
        if (typeof value === "string") {
          value = value.trim();
          if (!value) {
            console.warn(
              "[BuildingType] Ignoruję próbę ustawienia building_type na pusty string"
            );
            return;
          }
        }

        // Aktualizuj wizualny stan kart
        updateCardsFromValue(value);

        if (hiddenInput.value !== value) {
          hiddenInput.value = value;

          // formEngine automatycznie zareaguje na te eventy
          const changeEventHidden = new Event("change", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(changeEventHidden);

          const inputEventHidden = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(inputEventHidden);
        }

        // Utwórz wirtualny event change dla kompatybilności z istniejącymi skryptami (np. urlManager.js)
        const changeEvent = new CustomEvent("building_type_change", {
          bubbles: true,
          cancelable: true,
          detail: { value: value },
        });
        root.dispatchEvent(changeEvent);
      }

      // Eksportuj funkcję globalnie dla urlManager.js i innych skryptów
      // Obsługa kliknięć na karty
      buildingTypeCards.forEach((card) => {
        trackEvent(card, "click", function () {
          const value = this.dataset.value;
          if (!value || String(value).trim() === "") {
            // Karta bez poprawnej wartości – pomiń cicho (bez ostrzeżeń)
            return;
          }
          LOG.info("ui:buildingType", "card clicked", { value });
          triggerBuildingTypeChangeInternal(value);
        });

        // Obsługa klawiatury (Enter, Space)
        trackEvent(card, "keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const value = this.dataset.value;
            if (!value || String(value).trim() === "") {
              return;
            }
            LOG.info("ui:buildingType", "card keydown", {
              value,
              key: e.key,
            });
            triggerBuildingTypeChangeInternal(value);
          }
        });
      });

      trackEvent(hiddenInput, "change", () => {
        updateCardsFromValue(hiddenInput.value);
      });

      // Zsynchronizuj początkowy stan
      updateCardsFromValue(hiddenInput.value);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 6. INICJALIZACJA UI PIERWSZEGO KROKU (typ budynku + karty opcji)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initStep0UI() {
      try {
        initOptionCards();
      } catch (e) {
        LOG.warn("module:calculatorUI", "initOptionCards error", e);
      }
      try {
        initBuildingTypeCards();
      } catch (e) {
        LOG.warn("module:calculatorUI", "initBuildingTypeCards error", e);
      }
      try {
        initCollapsibleInstruction();
      } catch (e) {
        LOG.warn("module:calculatorUI", "initCollapsibleInstruction error", e);
      }
      try {
        initYesNoCards();
      } catch (e) {
        LOG.warn("module:calculatorUI", "initYesNoCards error", e);
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 7. CONSTRUCTION YEAR CHECKMARK
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initConstructionYearCheckmark() {
      const constructionYearSelect = dom.byId("construction_year");
      const wrapper = dom.qs(".construction-year-wrapper");
      if (!constructionYearSelect || !wrapper) {
        return;
      }

      function updateCheckmark() {
        const value = constructionYearSelect.value;
        // Sprawdź czy select ma wartość
        if (value && value !== "" && value !== "-- Wybierz --") {
          // Stan zakończony pojawia się natychmiast po wybraniu opcji
          wrapper.classList.add("has-value");
          wrapper.classList.add("completed");
        } else {
          wrapper.classList.remove("has-value");
          wrapper.classList.remove("completed");
        }
      }

      // Nasłuchuj na zmiany wartości
      trackEvent(constructionYearSelect, "change", () => {
        // Zaktualizuj stan (has-value + completed)
        updateCheckmark();
        // Po wybraniu opcji natychmiast „wyjdź z pola”,
        // żeby nie dało się przypadkowo zmienić wyboru scrollowaniem itp.
        constructionYearSelect.blur();
      });
      trackEvent(constructionYearSelect, "input", updateCheckmark);

      // Stany focus/blur – sterują tylko klasą is-active (completed ustawia updateCheckmark)
      trackEvent(constructionYearSelect, "focus", () => {
        wrapper.classList.add("is-active");
      });

      trackEvent(constructionYearSelect, "blur", () => {
        wrapper.classList.remove("is-active");
      });

      // Obserwuj zmiany wartości
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "value"
          ) {
            updateCheckmark();
          }
        });
        updateCheckmark();
      });
      observer.observe(constructionYearSelect, {
        attributes: true,
        attributeFilter: ["value", "selectedIndex"],
      });

      // Inicjalizuj stan na starcie
      updateCheckmark();
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 7. UNIVERSAL SELECT CHECKMARKS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Uniwersalny system checkmarków dla wszystkich selectów (oprócz construction_year)
    function initSelectCheckmarks() {
      // Znajdź wszystkie selecty (oprócz construction_year)
      const allSelects = dom.qsa("select.form-select:not(#construction_year)");

      function updateSelectCheckmark(select) {
        const formFieldItem = select.closest(".form-field-item");
        if (!formFieldItem) return;

        const value = select.value;
        const isEmpty =
          !value ||
          value === "" ||
          value === "-- Wybierz --" ||
          value === "-- Wybierz rok budowy --" ||
          value === "-- Wybierz rodzaj budynku --";

        // Dodaj/usuń klasę w zależności od stanu
        if (isEmpty) {
          formFieldItem.classList.remove("has-selected-value");
        } else {
          formFieldItem.classList.add("has-selected-value");
        }
      }

      allSelects.forEach((select) => {
        // Nasłuchuj na zmiany
        trackEvent(select, "change", function () {
          updateSelectCheckmark(this);
          // Po wybraniu opcji natychmiast „wyjdź z pola”,
          // żeby nie dało się przypadkowo zmienić wyboru scrollowaniem itp.
          this.blur();
        });

        // Focus / blur – sterują klasą is-active-select (stan niebieskiej ramki)
        trackEvent(select, "focus", function () {
          const formFieldItem = this.closest(".form-field-item");
          if (!formFieldItem) return;
          formFieldItem.classList.add("is-active-select");
        });

        trackEvent(select, "blur", function () {
          const formFieldItem = this.closest(".form-field-item");
          if (!formFieldItem) return;
          formFieldItem.classList.remove("is-active-select");
        });

        // Obserwuj zmiany wartości
        const observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "value"
            ) {
              updateSelectCheckmark(select);
            }
          });
        });
        observer.observe(select, {
          attributes: true,
          attributeFilter: ["value", "selectedIndex"],
        });

        // Inicjalizuj stan na starcie
        updateSelectCheckmark(select);
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 8. UNIVERSAL NUMBER INPUT CHECKMARKS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Uniwersalny system checkmarków dla wszystkich input[type="number"]
    function initNumberInputCheckmarks() {
      // Znajdź wszystkie inputy numeryczne (oprócz tych w quantity-input i custom-slider)
      const allNumberInputs = dom.qsa(
        'input[type="number"]:not(.quantity-input input):not([data-slider-value])'
      );

      // Wartości domyślne dla pól które mają je w HTML
      const defaultValues = {};

      function updateNumberInputCheckmark(input) {
        const formFieldItem = input.closest(".form-field-item");
        if (!formFieldItem) return;

        const value = input.value;
        const fieldName = input.name || input.id;
        const defaultValue = defaultValues[fieldName];

        // Sprawdź czy wartość jest rzeczywiście wpisana przez użytkownika
        const isEmpty =
          !value || value === "" || value === null || value === undefined;
        const isDefaultValue = defaultValue && value === defaultValue;

        // Dodaj/usuń klasę w zależności od stanu
        // Checkmark tylko gdy: nie jest puste, i nie jest wartością domyślną (jeśli istnieje)
        // Uwaga: 0 jest ważną wartością, więc pokazujemy checkmark dla 0 jeśli użytkownik ją wpisał
        if (isEmpty || isDefaultValue) {
          formFieldItem.classList.remove("has-number-value");
        } else {
          formFieldItem.classList.add("has-number-value");
        }
      }

      allNumberInputs.forEach((input) => {
        // Zapisz wartość początkową dla pól z wartościami domyślnymi
        const fieldName = input.name || input.id;
        if (defaultValues[fieldName] && !input.dataset.originalValue) {
          input.dataset.originalValue = input.value || defaultValues[fieldName];
        }

        // Nasłuchuj na zmiany
        trackEvent(input, "input", function () {
          updateNumberInputCheckmark(this);
        });

        trackEvent(input, "change", function () {
          updateNumberInputCheckmark(this);
        });

        // Obserwuj zmiany wartości
        const observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "value"
            ) {
              updateNumberInputCheckmark(input);
            }
          });
        });
        observer.observe(input, {
          attributes: true,
          attributeFilter: ["value"],
        });

        // Inicjalizuj stan na starcie
        updateNumberInputCheckmark(input);
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 9. YES/NO CARDS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Uniwersalny system kart Tak/Nie
    const YES_NO_RESET_FIELDS = Object.freeze({
      has_balcony: ["number_balcony_doors"],
      has_secondary_wall_material: ["secondary_wall_material"],
      has_external_isolation: [
        "external_wall_isolation[material]",
        "external_wall_isolation[size]",
      ],
      top_isolation: ["top_isolation[material]", "top_isolation[size]"],
      bottom_isolation: [
        "bottom_isolation[material]",
        "bottom_isolation[size]",
      ],
      include_hot_water: ["hot_water_persons", "hot_water_usage"],
    });

    const SLIDER_RESET_UI = Object.freeze({
      number_balcony_doors: {
        thumbId: "customSliderThumb",
        bubbleId: "customBalconyBubble",
      },
      "external_wall_isolation[size]": {
        thumbId: "customWallInsulationThumb",
        bubbleId: "customWallInsulationBubble",
      },
      "top_isolation[size]": {
        thumbId: "customRoofInsulationThumb",
        bubbleId: "customRoofInsulationBubble",
      },
      "bottom_isolation[size]": {
        thumbId: "customFloorInsulationThumb",
        bubbleId: "customFloorInsulationBubble",
      },
      hot_water_persons: {
        thumbId: "customPersonsThumb",
        bubbleId: "customPersonsBubble",
      },
    });

    function toFieldElementArray(elements) {
      if (!elements) return [];
      if (elements instanceof NodeList || Array.isArray(elements)) {
        return Array.from(elements).filter(Boolean);
      }
      return [elements].filter(Boolean);
    }

    function dispatchFieldEvent(element, type) {
      if (!element) return;
      element.dispatchEvent(
        new Event(type, {
          bubbles: true,
          cancelable: true,
        })
      );
    }

    function getFieldElementsForReset(fieldName) {
      const registeredElements =
        formEngine &&
          formEngine.state &&
          typeof formEngine.state.getFieldElements === "function"
          ? toFieldElementArray(formEngine.state.getFieldElements(fieldName))
          : [];

      if (registeredElements.length) {
        return registeredElements;
      }

      const namedElements = dom.qsa(`[name="${fieldName}"]`);
      if (namedElements.length) {
        return namedElements;
      }

      const idElement = dom.byId(fieldName);
      return idElement ? [idElement] : [];
    }

    function clearCardState(fieldName) {
      dom.qsa(`.option-card[data-field="${fieldName}"]`).forEach((card) => {
        card.classList.remove("option-card--selected");
      });
      dom.qsa(`.yes-no-card[data-field="${fieldName}"]`).forEach((card) => {
        card.classList.remove("yes-no-card--selected");
      });
    }

    function resetSliderFieldUi(fieldName, elements) {
      const sliderConfig = SLIDER_RESET_UI[fieldName];
      if (!sliderConfig) return;

      const thumb = dom.byId(sliderConfig.thumbId);
      const bubble = dom.byId(sliderConfig.bubbleId);
      const container =
        elements[0] && elements[0].closest
          ? elements[0].closest(".custom-slider-container")
          : null;
      const ticks = container
        ? container.querySelectorAll(".custom-slider-ticks .tick")
        : [];

      setSliderPlaceholder(thumb, bubble, ticks);
    }

    function clearDependentField(fieldName) {
      const elements = getFieldElementsForReset(fieldName);

      if (!elements.length) {
        if (
          formEngine &&
          formEngine.state &&
          typeof formEngine.state.setValue === "function"
        ) {
          formEngine.state.setValue(fieldName, "");
        }
        clearCardState(fieldName);
        return;
      }

      elements.forEach((element) => {
        if (!element) return;
        if (element.type === "checkbox" || element.type === "radio") {
          element.checked = false;
        } else {
          element.value = "";
        }
      });

      resetSliderFieldUi(fieldName, elements);
      clearCardState(fieldName);

      elements.forEach((element) => {
        dispatchFieldEvent(element, "input");
        dispatchFieldEvent(element, "change");
      });
    }

    function fieldHasResettableValue(fieldName) {
      const elements = getFieldElementsForReset(fieldName);

      if (!elements.length) {
        const storedValue =
          formEngine &&
            formEngine.state &&
            typeof formEngine.state.getValue === "function"
            ? formEngine.state.getValue(fieldName)
            : undefined;

        if (Array.isArray(storedValue)) {
          return storedValue.length > 0;
        }

        if (storedValue === undefined || storedValue === null) {
          return false;
        }

        return String(storedValue).trim() !== "";
      }

      return elements.some((element) => {
        if (!element) return false;
        if (element.type === "checkbox" || element.type === "radio") {
          return element.checked === true;
        }
        return typeof element.value === "string"
          ? element.value.trim() !== ""
          : element.value !== undefined && element.value !== null && element.value !== "";
      });
    }

    function resetDependentYesNoFields(fieldName, previousValue, nextValue) {
      if (previousValue === nextValue) return;

      const dependentFields = YES_NO_RESET_FIELDS[fieldName];
      if (!Array.isArray(dependentFields) || dependentFields.length === 0) return;

      const shouldReset =
        previousValue === "yes" ||
        previousValue === "no" ||
        dependentFields.some((dependentField) => fieldHasResettableValue(dependentField));

      if (!shouldReset) return;

      dependentFields.forEach((dependentField) => {
        clearDependentField(dependentField);
      });
    }

    function initYesNoCards() {
      const yesNoCards = dom.qsa(".yes-no-card");
      if (yesNoCards.length === 0) {
        return;
      }

      // Grupuj karty według pola (data-field)
      const cardsByField = {};
      yesNoCards.forEach((card) => {
        const fieldName = card.dataset.field;
        if (!cardsByField[fieldName]) {
          cardsByField[fieldName] = [];
        }
        cardsByField[fieldName].push(card);
      });

      // Inicjalizuj każdą grupę kart
      Object.keys(cardsByField).forEach((fieldName) => {
        const cards = cardsByField[fieldName];
        const hiddenInput = dom.byId(fieldName);

        if (!hiddenInput) {
          console.warn(`Nie znaleziono inputa dla pola: ${fieldName}`);
          return;
        }

        // Funkcja aktualizująca stan kart na podstawie inputa
        function updateCardsFromInput() {
          const selectedValue = hiddenInput.value;
          cards.forEach((card) => {
            if (card.dataset.value === selectedValue) {
              card.classList.add("yes-no-card--selected");
            } else {
              card.classList.remove("yes-no-card--selected");
            }
          });
        }

        // Funkcja wywołująca wszystkie potrzebne eventy i aktualizacje
        function triggerYesNoChange(value) {
          const previousValue = hiddenInput.value;
          resetDependentYesNoFields(fieldName, previousValue, value);

          // Aktualizuj ukryty input
          hiddenInput.value = value;

          // Aktualizuj wizualny stan kart
          updateCardsFromInput();

          // Wywołaj natywny event change
          const changeEvent = new Event("change", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(changeEvent);

          // Wywołaj również input event
          const inputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(inputEvent);

          // formEngine automatycznie zareaguje na te eventy
        }

        // Obsługa kliknięć na karty
        cards.forEach((card) => {
          trackEvent(card, "click", function () {
            // Sprawdź czy karta nie jest disabled
            if (this.classList.contains("yes-no-card--disabled")) {
              return;
            }
            const value = this.dataset.value;
            triggerYesNoChange(value);
          });

          // Obsługa klawiatury (Enter, Space)
          trackEvent(card, "keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              // Sprawdź czy karta nie jest disabled
              if (this.classList.contains("yes-no-card--disabled")) {
                return;
              }
              const value = this.dataset.value;
              triggerYesNoChange(value);
            }
          });
        });

        // Obsługa zmian w input (na wypadek, gdyby coś innego zmieniło wartość)
        trackEvent(hiddenInput, "change", function () {
          updateCardsFromInput();
        });

        // Inicjalizuj stan na starcie
        updateCardsFromInput();
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 10. HELP-BOX VISIBILITY FOR HOT WATER USAGE
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function updateHotWaterUsageHelpBox() {
      const includeHotWaterInput = dom.byId("include_hot_water");
      const helpBox = dom.byId("hotWaterUsageHelpBox");

      if (!includeHotWaterInput || !helpBox) {
        return;
      }

      // Pokaż help-box tylko gdy CWU = "yes"
      if (includeHotWaterInput.value === "yes") {
        helpBox.style.display = "block";
      } else {
        helpBox.style.display = "none";
      }
    }

    // Inicjalizuj przy załadowaniu
    function initHotWaterUsageHelpBox() {
      const includeHotWaterInput = dom.byId("include_hot_water");
      if (!includeHotWaterInput) {
        return;
      }

      // Ustaw początkowy stan
      updateHotWaterUsageHelpBox();

      // Nasłuchuj zmian
      trackEvent(includeHotWaterInput, "change", updateHotWaterUsageHelpBox);
      trackEvent(includeHotWaterInput, "input", updateHotWaterUsageHelpBox);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 11. PROGRESS LABEL ANIMATION
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initProgressLabelAnimation() {
      const progressFill = dom.byId("top-progress-fill");
      const progressLabel = dom.qs(".form-progress-label");
      const progressPercentage = dom.byId("progress-percentage");

      if (progressFill && progressLabel && progressPercentage) {
        // Obserwuj zmiany w szerokości progress-bara
        const observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            if (
              mutation.type === "attributes" &&
              mutation.attributeName === "style"
            ) {
              const dataProgress = parseFloat(
                progressFill.dataset.progress || "0"
              );
              const progressValue = Number.isNaN(dataProgress)
                ? 0
                : dataProgress;

              // Aktualizuj procent
              progressPercentage.textContent = Math.round(progressValue) + "%";

              if (progressValue > 0) {
                // Przesuń napis razem z paskiem (maksymalnie ~16px w prawo)
                const translateX = Math.min(progressValue * 0.18, 16);
                progressLabel.style.transform = `translateX(${translateX}px)`;
                progressLabel.style.transition =
                  "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
              } else {
                // Reset pozycji gdy progress = 0
                progressLabel.style.transform = "translateX(0)";
              }
            }
          });
        });

        // Rozpocznij obserwację
        observer.observe(progressFill, {
          attributes: true,
          attributeFilter: ["style"],
        });
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 12. HELPER FUNCTION FOR UNLOCKING FIELDS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Uniwersalna funkcja do odblokowywania pól (używana przez slidery)
    function unlockFields(fieldNames) {
      if (!Array.isArray(fieldNames)) return;

      fieldNames.forEach((fieldName) => {
        // Znajdź elementy pola
        let elements;
        try {
          if (fieldName.includes("[")) {
            elements = dom.qsa(`[name="${fieldName}"]`);
          } else {
            elements = dom.qsa(`[name="${fieldName}"], #${fieldName}`);
          }
        } catch (e) {
          console.warn("[unlockFields] Błąd selektora dla:", fieldName, e);
          return;
        }

        elements.forEach((el) => {
          el.classList.remove("field-disabled");

          const container =
            el.closest(".form-field-item") ||
            el.closest(".form-field__radio-group") ||
            el.closest(".option-cards") ||
            el.closest(".form-field");
          if (container) {
            container.classList.remove("field-disabled");
          }
        });

        // Odblokuj karty Tak/Nie jeśli są
        const yesNoCards = dom.qsa(`.yes-no-card[data-field="${fieldName}"]`);
        yesNoCards.forEach((card) => {
          card.classList.remove("yes-no-card--disabled");
        });
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 13. PROGRESS STEPS UPDATER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initProgressStepsUpdater() {
      // Funkcja do aktualizacji progress steps na podstawie aktywnej sekcji
      function updateProgressSteps() {
        const activeSection = dom.qs(".section.active");
        if (!activeSection) return;

        const currentTab =
          parseInt(activeSection.getAttribute("data-tab")) || 0;
        const allSteps = dom.qsa(".progress-step");

        allSteps.forEach((step, index) => {
          const stepNumber = index + 1;

          // Usuń wszystkie klasy
          step.classList.remove("active", "completed");

          if (stepNumber < currentTab + 1) {
            // Ukończone kroki
            step.classList.add("completed");
            step.textContent = ""; // Checkmark będzie z CSS ::after
          } else if (stepNumber === currentTab + 1) {
            // Aktywny krok
            step.classList.add("active");
            step.textContent = stepNumber;
          } else {
            // Przyszłe kroki
            step.textContent = stepNumber;
          }
        });
      }

      // Aktualizuj na starcie
      updateProgressSteps();

      // Obserwuj zmiany w klasie 'active' na sekcjach
      const sections = dom.qsa(".section");
      const sectionObserver = new MutationObserver(updateProgressSteps);

      sections.forEach((section) => {
        sectionObserver.observe(section, {
          attributes: true,
          attributeFilter: ["class"],
        });
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 14. AKORDEONY DLA WSZYSTKICH SEKCJI WYNIKÓW
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initAccordions() {
      // Akordeon dla profilu energetycznego
      const energyProfileSections = dom.qsa(".energy-profile-section");
      energyProfileSections.forEach((section) => {
        const title = section.querySelector(".result-title");
        if (title) {
          trackEvent(title, "click", function () {
            const content = section.querySelector(".result-grid");
            const subtitle = section.querySelector(".result-subtitle");
            const dataComment = section.nextElementSibling; // .data-comment jest zaraz po sekcji
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
          });
        }
      });

      // Akordeon dla extended-section
      const extendedSections = dom.qsa(".extended-section.accordion-section");
      extendedSections.forEach((section) => {
        const title = section.querySelector(".section-title");
        if (title) {
          trackEvent(title, "click", function () {
            const willCollapse = !section.classList.contains("collapsed");
            const accordionContent = section.querySelector(".accordion-content");
            toggleAccordionSection(
              section,
              accordionContent ? [accordionContent] : [],
              willCollapse
            );
          });
        }
      });

      // Akordeon dla sekcji rekomendacji pomp
      const pumpRecommendationSection = dom.qs(
        ".pump-recommendation-section.accordion-section"
      );
      if (pumpRecommendationSection) {
        const header =
          pumpRecommendationSection.querySelector(".slider-header h3");
        if (header) {
          trackEvent(header, "click", function () {
            const willCollapse =
              !pumpRecommendationSection.classList.contains("collapsed");
            const accordionContent =
              pumpRecommendationSection.querySelector(".accordion-content");
            toggleAccordionSection(
              pumpRecommendationSection,
              accordionContent ? [accordionContent] : [],
              willCollapse
            );
          });
        }
      }

      // Akordeon dla haier-slider-wrapper
      const pumpSections = dom.qsa(".haier-slider-wrapper.accordion-section");
      pumpSections.forEach((section) => {
        const header = section.querySelector(".slider-header h3");
        if (header) {
          trackEvent(header, "click", function () {
            const willCollapse = !section.classList.contains("collapsed");
            const animatedItems = Array.from(section.children)
              .filter((child) => !child.classList.contains("slider-header"))
              .map((el) => ({ el }));
            toggleAccordionSection(section, animatedItems, willCollapse);
          });
        }
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 15. CUSTOM BALCONY SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initCustomBalconySlider() {
      let currentValue = 1;
      const MIN = 1;
      const MAX = 6;

      const track = dom.byId("customSliderTrack");
      const thumb = dom.byId("customSliderThumb");
      const bubble = dom.byId("customBalconyBubble");
      const hiddenInput = dom.byId("number_balcony_doors");
      const container = track
        ? track.closest(".custom-slider-container")
        : null;
      const ticks = container
        ? container.querySelectorAll(".custom-slider-ticks .tick")
        : [];

      if (!track || !thumb || !bubble || !hiddenInput) {
        console.warn("[Slider Balkonów] Brak wymaganych elementów:", {
          track: !!track,
          thumb: !!thumb,
          bubble: !!bubble,
          hiddenInput: !!hiddenInput,
        });
        return;
      }

      if (window.__HP_DEBUG__) {
      }

      // Funkcja do ustawienia wartości i pozycji
      function setValue(value) {
        // Ogranicz wartość do zakresu MIN-MAX
        value = Math.max(MIN, Math.min(MAX, Math.round(value)));
        currentValue = value;

        if (window.__HP_DEBUG__) {
        }

        // Oblicz pozycję w procentach (0% dla MIN, 100% dla MAX)
        const percent = ((value - MIN) / (MAX - MIN)) * 100;

        // Ustaw pozycję thumba i bąbelka
        thumb.style.left = percent + "%";
        bubble.style.left = percent + "%";

        // Aktualizuj tekst w bąbelku i hidden input
        bubble.classList.remove("custom-bubble--placeholder");
        bubble.textContent = value;
        hiddenInput.value = value;

        if (window.__HP_DEBUG__) {
        }

        const sliderInputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        hiddenInput.dispatchEvent(sliderInputEvent);
        if (window.__HP_DEBUG__) {
        }

        // Odblokuj pola poniżej slidera (bez wywoływania recompute)
        if (typeof unlockFields === "function") {
          unlockFields(["building_floors"]);
        }

        // Zaznacz aktywny tick
        ticks.forEach((tick) => {
          if (parseInt(tick.dataset.value) === value) {
            tick.classList.add("active");
          } else {
            tick.classList.remove("active");
          }
        });
      }

      // Funkcja do obliczenia wartości na podstawie pozycji kliknięcia
      function getValueFromPosition(clientX) {
        const rect = track.getBoundingClientRect();
        const x = clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const value = Math.round((percent / 100) * (MAX - MIN) + MIN);
        return value;
      }

      // Obsługa przeciągania thumba
      let isDragging = false;

      trackEvent(thumb, "mousedown", function (e) {
        isDragging = true;
        e.preventDefault();
      });

      trackEvent(doc, "mousemove", function (e) {
        if (!isDragging) return;
        const value = getValueFromPosition(e.clientX);
        setValue(value);
      });

      trackEvent(doc, "mouseup", function () {
        if (isDragging) {
          isDragging = false;
        }
      });

      // Obsługa kliknięcia na track
      trackEvent(track, "click", function (e) {
        if (e.target === thumb) return;
        const value = getValueFromPosition(e.clientX);
        setValue(value);
      });

      // Obsługa kliknięcia na ticki
      ticks.forEach((tick) => {
        trackEvent(tick, "click", function () {
          const value = parseInt(this.dataset.value);
          setValue(value);
        });
      });

      // Touch support dla urządzeń mobilnych
      trackEvent(thumb, "touchstart", function (e) {
        isDragging = true;
        e.preventDefault();
      });

      trackEvent(doc, "touchmove", function (e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const value = getValueFromPosition(touch.clientX);
        setValue(value);
      });

      trackEvent(doc, "touchend", function () {
        if (isDragging) {
          isDragging = false;
        }
      });

      const initial = parseInt(hiddenInput.value, 10);
      if (Number.isFinite(initial)) {
        setValue(initial);
      } else {
        setSliderPlaceholder(thumb, bubble, ticks);
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 16. CUSTOM WINDOWS SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initCustomWindowsSlider() {
      let currentValue = 14;
      const MIN = 4;
      const MAX = 24;

      const track = dom.byId("customWindowsTrack");
      const thumb = dom.byId("customWindowsThumb");
      const bubble = dom.byId("customWindowsBubble");
      const hiddenInput = dom.byId("number_windows");
      const container = track ? track.closest(".custom-slider-container") : null;
      const ticks = container
        ? container.querySelectorAll(".custom-slider-ticks .tick")
        : [];

      if (!track || !thumb || !bubble || !hiddenInput) return;
      if (container && container.dataset.customSliderInit === "true") return;
      if (container) container.dataset.customSliderInit = "true";

      function setValue(value) {
        value = Math.max(MIN, Math.min(MAX, Math.round(value)));
        currentValue = value;
        const percent = ((value - MIN) / (MAX - MIN)) * 100;
        thumb.style.left = percent + "%";
        bubble.style.left = percent + "%";
        bubble.classList.remove("custom-bubble--placeholder");
        bubble.textContent = value;
        hiddenInput.value = value;
        const sliderInputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        hiddenInput.dispatchEvent(sliderInputEvent);

        // Odblokuj pola poniżej slidera (jeśli są zdefiniowane)
        const unlockMap = {
          number_windows: ["number_huge_windows"],
          top_isolation_size: ["bottom_isolation"],
          indoor_temperature: ["ventilation_type"],
          hot_water_persons: ["hot_water_usage"],
        };

        if (
          hiddenInput &&
          hiddenInput.id &&
          unlockMap[hiddenInput.id] &&
          typeof unlockFields === "function"
        ) {
          unlockFields(unlockMap[hiddenInput.id]);
        }

        ticks.forEach((tick) => {
          if (parseInt(tick.dataset.value) === value) {
            tick.classList.add("active");
          } else {
            tick.classList.remove("active");
          }
        });
      }

      function getValueFromPosition(clientX) {
        const rect = track.getBoundingClientRect();
        const x = clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const value = Math.round((percent / 100) * (MAX - MIN) + MIN);
        return value;
      }

      let isDragging = false;

      trackEvent(thumb, "mousedown", function (e) {
        isDragging = true;
        e.preventDefault();
      });

      // Pointer Events (mobile-friendly, avoids passive touch quirks)
      trackEvent(thumb, "pointerdown", function (e) {
        isDragging = true;
        try {
          thumb.setPointerCapture && thumb.setPointerCapture(e.pointerId);
        } catch (err) { }
        e.preventDefault();
      });

      trackEvent(doc, "mousemove", function (e) {
        if (!isDragging) return;
        const value = getValueFromPosition(e.clientX);
        setValue(value);
      });

      trackEvent(doc, "pointermove", function (e) {
        if (!isDragging) return;
        const value = getValueFromPosition(e.clientX);
        setValue(value);
      });

      trackEvent(doc, "mouseup", function () {
        if (isDragging) isDragging = false;
      });

      trackEvent(doc, "pointerup", function () {
        if (isDragging) isDragging = false;
      });

      trackEvent(track, "click", function (e) {
        if (e.target === thumb) return;
        const value = getValueFromPosition(e.clientX);
        setValue(value);
      });

      ticks.forEach((tick) => {
        trackEvent(tick, "click", function () {
          const value = parseInt(this.dataset.value);
          setValue(value);
        });
      });

      trackEvent(thumb, "touchstart", function (e) {
        isDragging = true;
        e.preventDefault();
      }, { passive: false });

      trackEvent(doc, "touchmove", function (e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const value = getValueFromPosition(touch.clientX);
        setValue(value);
      }, { passive: false });

      trackEvent(doc, "touchend", function () {
        if (isDragging) isDragging = false;
      });

      // Initial sync from DOM value (avoid mismatch where bubble has default text but thumb stays at 0)
      const initial = parseInt(hiddenInput.value, 10);
      if (Number.isFinite(initial)) {
        setValue(initial);
      } else {
        setSliderPlaceholder(thumb, bubble, ticks);
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 17. CUSTOM DOORS SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initCustomDoorsSlider() {
      let currentValue = 1;
      const MIN = 1;
      const MAX = 4;

      const track = dom.byId("customDoorsTrack");
      const thumb = dom.byId("customDoorsThumb");
      const bubble = dom.byId("customDoorsBubble");
      const hiddenInput = dom.byId("number_doors");
      const container = track ? track.closest(".custom-slider-container") : null;
      const ticks = container
        ? container.querySelectorAll(".custom-slider-ticks .tick")
        : [];

      if (!track || !thumb || !bubble || !hiddenInput) return;
      if (container && container.dataset.customSliderInit === "true") return;
      if (container) container.dataset.customSliderInit = "true";

      function setValue(value) {
        value = Math.max(MIN, Math.min(MAX, Math.round(value)));
        currentValue = value;
        const percent = ((value - MIN) / (MAX - MIN)) * 100;
        thumb.style.left = percent + "%";
        bubble.style.left = percent + "%";
        bubble.textContent = value;
        hiddenInput.value = value;
        const sliderInputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        hiddenInput.dispatchEvent(sliderInputEvent);

        // Odblokuj pola poniżej slidera (jeśli są zdefiniowane)
        const unlockMap = {
          number_windows: ["number_huge_windows"],
          top_isolation_size: ["bottom_isolation"],
          indoor_temperature: ["ventilation_type"],
          hot_water_persons: ["hot_water_usage"],
        };

        if (
          hiddenInput &&
          hiddenInput.id &&
          unlockMap[hiddenInput.id] &&
          typeof unlockFields === "function"
        ) {
          unlockFields(unlockMap[hiddenInput.id]);
        }

        ticks.forEach((tick) => {
          if (parseInt(tick.dataset.value) === value) {
            tick.classList.add("active");
          } else {
            tick.classList.remove("active");
          }
        });
      }

      function getValueFromPosition(clientX) {
        const rect = track.getBoundingClientRect();
        const x = clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const value = Math.round((percent / 100) * (MAX - MIN) + MIN);
        return value;
      }

      let isDragging = false;

      trackEvent(thumb, "mousedown", function (e) {
        isDragging = true;
        e.preventDefault();
      });

      trackEvent(doc, "mousemove", function (e) {
        if (!isDragging) return;
        const value = getValueFromPosition(e.clientX);
        setValue(value);
      });

      trackEvent(doc, "mouseup", function () {
        if (isDragging) isDragging = false;
      });

      trackEvent(track, "click", function (e) {
        if (e.target === thumb) return;
        const value = getValueFromPosition(e.clientX);
        setValue(value);
      });

      ticks.forEach((tick) => {
        trackEvent(tick, "click", function () {
          const value = parseInt(this.dataset.value);
          setValue(value);
        });
      });

      trackEvent(thumb, "touchstart", function (e) {
        isDragging = true;
        e.preventDefault();
      });

      trackEvent(doc, "touchmove", function (e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const value = getValueFromPosition(touch.clientX);
        setValue(value);
      });

      trackEvent(doc, "touchend", function () {
        if (isDragging) isDragging = false;
      });

      setValue(1);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 18. CUSTOM HUGE WINDOWS SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      let currentValue = 0;
      const MIN = 0;
      const MAX = 5;

      trackEvent(doc, "DOMContentLoaded", function () {
        const track = dom.byId("customHugeWindowsTrack");
        const thumb = dom.byId("customHugeWindowsThumb");
        const bubble = dom.byId("customHugeWindowsBubble");
        const hiddenInput = dom.byId("number_huge_windows");
        const container = track ? track.closest(".custom-slider-container") : null;
        const ticks = container
          ? container.querySelectorAll(".custom-slider-ticks .tick")
          : [];

        if (!track || !thumb || !bubble || !hiddenInput) return;

        function setValue(value) {
          value = Math.max(MIN, Math.min(MAX, Math.round(value)));
          currentValue = value;
          const percent = ((value - MIN) / (MAX - MIN)) * 100;
          thumb.style.left = percent + "%";
          bubble.style.left = percent + "%";
          bubble.classList.remove("custom-bubble--placeholder");
          bubble.textContent = value;
          hiddenInput.value = value;
          const sliderInputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderInputEvent);

          // Odblokuj pola poniżej slidera (jeśli są zdefiniowane)
          const unlockMap = {
            number_windows: ["number_huge_windows"],
            top_isolation_size: ["bottom_isolation"],
            indoor_temperature: ["ventilation_type"],
            hot_water_persons: ["hot_water_usage"],
          };

          if (
            hiddenInput &&
            hiddenInput.id &&
            unlockMap[hiddenInput.id] &&
            typeof unlockFields === "function"
          ) {
            unlockFields(unlockMap[hiddenInput.id]);
          }

          ticks.forEach((tick) => {
            if (parseInt(tick.dataset.value) === value) {
              tick.classList.add("active");
            } else {
              tick.classList.remove("active");
            }
          });
        }

        function getValueFromPosition(clientX) {
          const rect = track.getBoundingClientRect();
          const x = clientX - rect.left;
          const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
          const value = Math.round((percent / 100) * (MAX - MIN) + MIN);
          return value;
        }

        let isDragging = false;

        trackEvent(thumb, "mousedown", function (e) {
          isDragging = true;
          e.preventDefault();
        });

        trackEvent(doc, "mousemove", function (e) {
          if (!isDragging) return;
          const value = getValueFromPosition(e.clientX);
          setValue(value);
        });

        trackEvent(doc, "mouseup", function () {
          if (isDragging) isDragging = false;
        });

        trackEvent(track, "click", function (e) {
          if (e.target === thumb) return;
          const value = getValueFromPosition(e.clientX);
          setValue(value);
        });

        ticks.forEach((tick) => {
          trackEvent(tick, "click", function () {
            const value = parseInt(this.dataset.value);
            setValue(value);
          });
        });

        trackEvent(thumb, "touchstart", function (e) {
          isDragging = true;
          e.preventDefault();
        });

        trackEvent(doc, "touchmove", function (e) {
          if (!isDragging) return;
          const touch = e.touches[0];
          const value = getValueFromPosition(touch.clientX);
          setValue(value);
        });

        trackEvent(doc, "touchend", function () {
          if (isDragging) isDragging = false;
        });

        const initial = parseInt(hiddenInput.value, 10);
        if (Number.isFinite(initial)) {
          setValue(initial);
        } else {
          setSliderPlaceholder(thumb, bubble, ticks);
        }
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 19. CUSTOM PERSONS SLIDER (niestandardowe wartości)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      // Mapowanie pozycji slidera na wartości formularza
      const VALUES = [2, 3, 4, 6, 8]; // Odpowiada pozycjom 0, 1, 2, 3, 4
      const LABELS = ["1-2", "3", "4", "5-6", "7+"];
      let currentPosition = 2; // Domyślnie pozycja 2 (wartość 4)

      trackEvent(doc, "DOMContentLoaded", function () {
        const track = dom.byId("customPersonsTrack");
        const thumb = dom.byId("customPersonsThumb");
        const bubble = dom.byId("customPersonsBubble");
        const hiddenInput = dom.byId("hot_water_persons");
        const container = track ? track.closest(".custom-slider-container") : null;
        const ticks = container
          ? container.querySelectorAll(".custom-slider-ticks .tick")
          : [];

        if (!track || !thumb || !bubble || !hiddenInput) return;

        function setValue(position) {
          position = Math.max(
            0,
            Math.min(VALUES.length - 1, Math.round(position))
          );
          currentPosition = position;

          const percent = (position / (VALUES.length - 1)) * 100;
          thumb.style.left = percent + "%";
          bubble.style.left = percent + "%";

          const actualValue = VALUES[position];
          const label = LABELS[position];

          bubble.classList.remove("custom-bubble--placeholder");
          bubble.textContent = label;
          hiddenInput.value = actualValue;
          const sliderInputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderInputEvent);
          const sliderChangeEvent = new Event("change", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderChangeEvent);

          ticks.forEach((tick, index) => {
            if (index === position) {
              tick.classList.add("active");
            } else {
              tick.classList.remove("active");
            }
          });
        }

        function getPositionFromClick(clientX) {
          const rect = track.getBoundingClientRect();
          const x = clientX - rect.left;
          const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
          const position = Math.round((percent / 100) * (VALUES.length - 1));
          return position;
        }

        let isDragging = false;

        trackEvent(thumb, "mousedown", function (e) {
          isDragging = true;
          e.preventDefault();
        });

        trackEvent(doc, "mousemove", function (e) {
          if (!isDragging) return;
          const position = getPositionFromClick(e.clientX);
          setValue(position);
        });

        trackEvent(doc, "mouseup", function () {
          if (isDragging) isDragging = false;
        });

        trackEvent(track, "click", function (e) {
          if (e.target === thumb) return;
          const position = getPositionFromClick(e.clientX);
          setValue(position);
        });

        ticks.forEach((tick, index) => {
          trackEvent(tick, "click", function () {
            setValue(index);
          });
        });

        trackEvent(thumb, "touchstart", function (e) {
          isDragging = true;
          e.preventDefault();
        });

        trackEvent(doc, "touchmove", function (e) {
          if (!isDragging) return;
          const touch = e.touches[0];
          const position = getPositionFromClick(touch.clientX);
          setValue(position);
        });

        trackEvent(doc, "touchend", function () {
          if (isDragging) isDragging = false;
        });

        const initial = parseInt(hiddenInput.value, 10);
        const initialPosition = VALUES.indexOf(initial);
        if (initialPosition !== -1) {
          setValue(initialPosition);
        } else {
          setSliderPlaceholder(thumb, bubble, ticks);
        }
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 20. CUSTOM WALL INSULATION SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    function initCustomWallInsulationSlider() {
      const MIN = 5,
        MAX = 35,
        STEP = 5,
        DEFAULT = 15;

      const track = dom.byId("customWallInsulationTrack");
      const thumb = dom.byId("customWallInsulationThumb");
      const bubble = dom.byId("customWallInsulationBubble");
      const hiddenInput = dom.byId("external_wall_isolation_size");
      const container = track
        ? track.closest(".custom-slider-container")
        : null;
      const ticks = container
        ? container.querySelectorAll(".custom-slider-ticks .tick")
        : [];

      if (!track || !thumb || !bubble || !hiddenInput) return;

      function setValue(value) {
        value = Math.max(MIN, Math.min(MAX, Math.round(value / STEP) * STEP));
        const percent = ((value - MIN) / (MAX - MIN)) * 100;
        thumb.style.left = percent + "%";
        bubble.style.left = percent + "%";
        bubble.classList.remove("custom-bubble--placeholder");
        bubble.textContent = value;
        hiddenInput.value = value;
        const sliderInputEvent = new Event("input", {
          bubbles: true,
          cancelable: true,
        });
        hiddenInput.dispatchEvent(sliderInputEvent);
        // formEngine automatycznie obsłuży event input (updateFieldState → recompute)

        ticks.forEach((tick) =>
          tick.classList.toggle(
            "active",
            parseInt(tick.dataset.value) === value
          )
        );
      }

      function getValueFromPosition(clientX) {
        const rect = track.getBoundingClientRect();
        const percent = Math.max(
          0,
          Math.min(100, ((clientX - rect.left) / rect.width) * 100)
        );
        return Math.round((percent / 100) * (MAX - MIN) + MIN);
      }

      let isDragging = false;
      trackEvent(thumb, "mousedown", (e) => {
        isDragging = true;
        e.preventDefault();
      });
      trackEvent(
        doc,
        "mousemove",
        (e) => isDragging && setValue(getValueFromPosition(e.clientX))
      );
      trackEvent(doc, "mouseup", () => (isDragging = false));
      trackEvent(
        track,
        "click",
        (e) => e.target !== thumb && setValue(getValueFromPosition(e.clientX))
      );
      ticks.forEach((tick) =>
        trackEvent(tick, "click", () => setValue(parseInt(tick.dataset.value)))
      );
      trackEvent(thumb, "touchstart", (e) => {
        isDragging = true;
        e.preventDefault();
      });
      trackEvent(
        doc,
        "touchmove",
        (e) =>
          isDragging && setValue(getValueFromPosition(e.touches[0].clientX))
      );
      trackEvent(doc, "touchend", () => (isDragging = false));
      const initial = parseInt(hiddenInput.value, 10);
      if (Number.isFinite(initial)) {
        setValue(initial);
      } else {
        setSliderPlaceholder(thumb, bubble, ticks);
      }
    }

    // FIX: slider ścian (external_wall_isolation_size) wcześniej NIE był inicjalizowany,
    // bo initCustomWallInsulationSlider() było tylko zdefiniowane. Na mobile wyglądało jak „zepsuty suwak”.
    (function () {
      function boot() {
        try {
          initCustomWallInsulationSlider();
        } catch (e) {
          console.warn("[CalculatorUI] initCustomWallInsulationSlider failed:", e);
        }
      }

      if (doc.readyState === "loading") {
        trackEvent(doc, "DOMContentLoaded", boot);
      } else {
        boot();
      }

      trackEvent(view, "load", () => setTimeout(boot, 100));
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 21. CUSTOM ROOF INSULATION SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      const MIN = 10,
        MAX = 45,
        STEP = 5,
        DEFAULT = 30;

      trackEvent(doc, "DOMContentLoaded", function () {
        const track = dom.byId("customRoofInsulationTrack");
        const thumb = dom.byId("customRoofInsulationThumb");
        const bubble = dom.byId("customRoofInsulationBubble");
        const hiddenInput = dom.byId("top_isolation_size");
        const container = track
          ? track.closest(".custom-slider-container")
          : null;
        const ticks = container
          ? container.querySelectorAll(".custom-slider-ticks .tick")
          : [];

        if (!track || !thumb || !bubble || !hiddenInput) return;

        function setValue(value) {
          value = Math.max(MIN, Math.min(MAX, Math.round(value / STEP) * STEP));
          const percent = ((value - MIN) / (MAX - MIN)) * 100;
          thumb.style.left = percent + "%";
          bubble.style.left = percent + "%";
          bubble.classList.remove("custom-bubble--placeholder");
          bubble.textContent = value;
          hiddenInput.value = value;
          const sliderInputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderInputEvent);
          // formEngine automatycznie obsłuży event input (updateFieldState → recompute)

          ticks.forEach((tick) =>
            tick.classList.toggle(
              "active",
              parseInt(tick.dataset.value) === value
            )
          );
        }

        function getValueFromPosition(clientX) {
          const rect = track.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(100, ((clientX - rect.left) / rect.width) * 100)
          );
          return Math.round((percent / 100) * (MAX - MIN) + MIN);
        }

        let isDragging = false;
        trackEvent(thumb, "mousedown", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "mousemove",
          (e) => isDragging && setValue(getValueFromPosition(e.clientX))
        );
        trackEvent(doc, "mouseup", () => (isDragging = false));
        trackEvent(
          track,
          "click",
          (e) => e.target !== thumb && setValue(getValueFromPosition(e.clientX))
        );
        ticks.forEach((tick) =>
          trackEvent(tick, "click", () =>
            setValue(parseInt(tick.dataset.value))
          )
        );
        trackEvent(thumb, "touchstart", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "touchmove",
          (e) =>
            isDragging && setValue(getValueFromPosition(e.touches[0].clientX))
        );
        trackEvent(doc, "touchend", () => (isDragging = false));
        const initial = parseInt(hiddenInput.value, 10);
        if (Number.isFinite(initial)) {
          setValue(initial);
        } else {
          setSliderPlaceholder(thumb, bubble, ticks);
        }
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 22. CUSTOM FLOOR INSULATION SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      const MIN = 5,
        MAX = 30,
        STEP = 5,
        DEFAULT = 15;

      trackEvent(doc, "DOMContentLoaded", function () {
        const track = dom.byId("customFloorInsulationTrack");
        const thumb = dom.byId("customFloorInsulationThumb");
        const bubble = dom.byId("customFloorInsulationBubble");
        const hiddenInput = dom.byId("bottom_isolation_size");
        const container = track
          ? track.closest(".custom-slider-container")
          : null;
        const ticks = container
          ? container.querySelectorAll(".custom-slider-ticks .tick")
          : [];

        if (!track || !thumb || !bubble || !hiddenInput) return;

        function setValue(value) {
          value = Math.max(MIN, Math.min(MAX, Math.round(value / STEP) * STEP));
          const percent = ((value - MIN) / (MAX - MIN)) * 100;
          thumb.style.left = percent + "%";
          bubble.style.left = percent + "%";
          bubble.classList.remove("custom-bubble--placeholder");
          bubble.textContent = value;
          hiddenInput.value = value;
          const sliderInputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderInputEvent);
          // formEngine automatycznie obsłuży event input (updateFieldState → recompute)

          ticks.forEach((tick) =>
            tick.classList.toggle(
              "active",
              parseInt(tick.dataset.value) === value
            )
          );
        }

        function getValueFromPosition(clientX) {
          const rect = track.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(100, ((clientX - rect.left) / rect.width) * 100)
          );
          return Math.round((percent / 100) * (MAX - MIN) + MIN);
        }

        let isDragging = false;
        trackEvent(thumb, "mousedown", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "mousemove",
          (e) => isDragging && setValue(getValueFromPosition(e.clientX))
        );
        trackEvent(doc, "mouseup", () => (isDragging = false));
        trackEvent(
          track,
          "click",
          (e) => e.target !== thumb && setValue(getValueFromPosition(e.clientX))
        );
        ticks.forEach((tick) =>
          trackEvent(tick, "click", () =>
            setValue(parseInt(tick.dataset.value))
          )
        );
        trackEvent(thumb, "touchstart", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "touchmove",
          (e) =>
            isDragging && setValue(getValueFromPosition(e.touches[0].clientX))
        );
        trackEvent(doc, "touchend", () => (isDragging = false));
        const initial = parseInt(hiddenInput.value, 10);
        if (Number.isFinite(initial)) {
          setValue(initial);
        } else {
          setSliderPlaceholder(thumb, bubble, ticks);
        }
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 23. CUSTOM INTERNAL WALL INSULATION SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      const MIN = 5,
        MAX = 30,
        STEP = 5,
        DEFAULT = 5;

      trackEvent(doc, "DOMContentLoaded", function () {
        const track = dom.byId("customInternalInsulationTrack");
        const thumb = dom.byId("customInternalInsulationThumb");
        const bubble = dom.byId("customInternalInsulationBubble");
        const hiddenInput = dom.byId("internal_wall_isolation_size");
        const container = track
          ? track.closest(".custom-slider-container")
          : null;
        const ticks = container
          ? container.querySelectorAll(".custom-slider-ticks .tick")
          : [];

        if (!track || !thumb || !bubble || !hiddenInput) return;

        function setValue(value) {
          value = Math.max(MIN, Math.min(MAX, Math.round(value / STEP) * STEP));
          const percent = ((value - MIN) / (MAX - MIN)) * 100;
          thumb.style.left = percent + "%";
          bubble.style.left = percent + "%";
          bubble.classList.remove("custom-bubble--placeholder");
          bubble.textContent = value;
          hiddenInput.value = value;
          const sliderInputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderInputEvent);
          // formEngine automatycznie obsłuży event input (updateFieldState → recompute)

          ticks.forEach((tick) =>
            tick.classList.toggle(
              "active",
              parseInt(tick.dataset.value) === value
            )
          );
        }

        function getValueFromPosition(clientX) {
          const rect = track.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(100, ((clientX - rect.left) / rect.width) * 100)
          );
          return Math.round((percent / 100) * (MAX - MIN) + MIN);
        }

        let isDragging = false;
        trackEvent(thumb, "mousedown", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "mousemove",
          (e) => isDragging && setValue(getValueFromPosition(e.clientX))
        );
        trackEvent(doc, "mouseup", () => (isDragging = false));
        trackEvent(
          track,
          "click",
          (e) => e.target !== thumb && setValue(getValueFromPosition(e.clientX))
        );
        ticks.forEach((tick) =>
          trackEvent(tick, "click", () =>
            setValue(parseInt(tick.dataset.value))
          )
        );
        trackEvent(thumb, "touchstart", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "touchmove",
          (e) =>
            isDragging && setValue(getValueFromPosition(e.touches[0].clientX))
        );
        trackEvent(doc, "touchend", () => (isDragging = false));
        const initial = parseInt(hiddenInput.value, 10);
        if (Number.isFinite(initial)) {
          setValue(initial);
        } else {
          setSliderPlaceholder(thumb, bubble, ticks);
        }
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 24. CUSTOM TEMPERATURE SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      const MIN = 17,
        MAX = 25,
        DEFAULT = 21;

      trackEvent(doc, "DOMContentLoaded", function () {
        const track = dom.byId("customTemperatureTrack");
        const thumb = dom.byId("customTemperatureThumb");
        const bubble = dom.byId("customTemperatureBubble");
        const hiddenInput = dom.byId("indoor_temperature");
        const container = track
          ? track.closest(".custom-slider-container")
          : null;
        const ticks = container
          ? container.querySelectorAll(".custom-slider-ticks .tick")
          : [];

        if (!track || !thumb || !bubble || !hiddenInput) return;

        function setValue(value) {
          value = Math.max(MIN, Math.min(MAX, Math.round(value)));
          const percent = ((value - MIN) / (MAX - MIN)) * 100;
          thumb.style.left = percent + "%";
          bubble.style.left = percent + "%";
          bubble.classList.remove("custom-bubble--placeholder");
          bubble.textContent = value;
          hiddenInput.value = value;
          const sliderInputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderInputEvent);
          // formEngine automatycznie obsłuży event input (updateFieldState → recompute)

          ticks.forEach((tick) =>
            tick.classList.toggle(
              "active",
              parseInt(tick.dataset.value) === value
            )
          );
        }

        function getValueFromPosition(clientX) {
          const rect = track.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(100, ((clientX - rect.left) / rect.width) * 100)
          );
          return Math.round((percent / 100) * (MAX - MIN) + MIN);
        }

        let isDragging = false;
        trackEvent(thumb, "mousedown", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "mousemove",
          (e) => isDragging && setValue(getValueFromPosition(e.clientX))
        );
        trackEvent(doc, "mouseup", () => (isDragging = false));
        trackEvent(
          track,
          "click",
          (e) => e.target !== thumb && setValue(getValueFromPosition(e.clientX))
        );
        ticks.forEach((tick) =>
          trackEvent(tick, "click", () =>
            setValue(parseInt(tick.dataset.value))
          )
        );
        trackEvent(thumb, "touchstart", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "touchmove",
          (e) =>
            isDragging && setValue(getValueFromPosition(e.touches[0].clientX))
        );
        trackEvent(doc, "touchend", () => (isDragging = false));
        const initial = parseInt(hiddenInput.value, 10);
        if (Number.isFinite(initial)) {
          setValue(initial);
        } else {
          setSliderPlaceholder(thumb, bubble, ticks);
        }
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 25. CUSTOM WALL SIZE SLIDER
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      const MIN = 20,
        MAX = 80,
        STEP = 5,
        DEFAULT = 50;

      trackEvent(doc, "DOMContentLoaded", function () {
        const track = dom.byId("customWallSizeTrack");
        const thumb = dom.byId("customWallSizeThumb");
        const bubble = dom.byId("customWallSizeBubble");
        const hiddenInput = dom.byId("wall_size");
        const container = track
          ? track.closest(".custom-slider-container")
          : null;
        const ticks = container
          ? container.querySelectorAll(".custom-slider-ticks .tick")
          : [];

        if (!track || !thumb || !bubble || !hiddenInput) return;

        function setValue(value) {
          value = Math.max(MIN, Math.min(MAX, Math.round(value / STEP) * STEP));
          const percent = ((value - MIN) / (MAX - MIN)) * 100;
          thumb.style.left = percent + "%";
          bubble.style.left = percent + "%";
          bubble.classList.remove("custom-bubble--placeholder");
          bubble.textContent = value;
          hiddenInput.value = value;
          const sliderInputEvent = new Event("input", {
            bubbles: true,
            cancelable: true,
          });
          hiddenInput.dispatchEvent(sliderInputEvent);
          // formEngine automatycznie obsłuży event input (updateFieldState → recompute)

          ticks.forEach((tick) =>
            tick.classList.toggle(
              "active",
              parseInt(tick.dataset.value) === value
            )
          );
        }

        function getValueFromPosition(clientX) {
          const rect = track.getBoundingClientRect();
          const percent = Math.max(
            0,
            Math.min(100, ((clientX - rect.left) / rect.width) * 100)
          );
          return Math.round((percent / 100) * (MAX - MIN) + MIN);
        }

        let isDragging = false;
        trackEvent(thumb, "mousedown", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "mousemove",
          (e) => isDragging && setValue(getValueFromPosition(e.clientX))
        );
        trackEvent(doc, "mouseup", () => (isDragging = false));
        trackEvent(
          track,
          "click",
          (e) => e.target !== thumb && setValue(getValueFromPosition(e.clientX))
        );
        ticks.forEach((tick) =>
          trackEvent(tick, "click", () =>
            setValue(parseInt(tick.dataset.value))
          )
        );
        trackEvent(thumb, "touchstart", (e) => {
          isDragging = true;
          e.preventDefault();
        });
        trackEvent(
          doc,
          "touchmove",
          (e) =>
            isDragging && setValue(getValueFromPosition(e.touches[0].clientX))
        );
        trackEvent(doc, "touchend", () => (isDragging = false));
        const initial = parseInt(hiddenInput.value, 10);
        if (Number.isFinite(initial)) {
          setValue(initial);
        } else {
          setSliderPlaceholder(thumb, bubble, ticks);
        }
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 26. QUANTITY INPUT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      function initQuantityInputs() {
        const quantityInputs = dom.qsa(".quantity-input");

        quantityInputs.forEach((fieldset) => {
          const input = fieldset.querySelector('input[type="number"]');
          const subBtn = fieldset.querySelector(".quantity-btn--sub");
          const addBtn = fieldset.querySelector(".quantity-btn--add");

          if (!input || !subBtn || !addBtn) return;

          const step = parseFloat(input.getAttribute("step")) || 0.5;
          const min = parseFloat(input.getAttribute("min")) || 0;
          const max = parseFloat(input.getAttribute("max")) || Infinity;

          function updateButtons() {
            const value = parseFloat(input.value) || 0;
            subBtn.disabled = value <= min;
            addBtn.disabled = value >= max;
          }

          function changeValue(delta) {
            const currentValue = parseFloat(input.value) || 0;
            const newValue = Math.max(min, Math.min(max, currentValue + delta));

            input.value = newValue;

            // Wywołaj event change dla progressive disclosure
            const changeEvent = new Event("change", {
              bubbles: true,
              cancelable: true,
            });
            input.dispatchEvent(changeEvent);

            const inputEvent = new Event("input", {
              bubbles: true,
              cancelable: true,
            });
            input.dispatchEvent(inputEvent);

            updateButtons();
          }

          trackEvent(subBtn, "click", () => changeValue(-step));
          trackEvent(addBtn, "click", () => changeValue(step));

          trackEvent(input, "input", updateButtons);
          trackEvent(input, "change", updateButtons);

          updateButtons();
        });
      }

      if (doc.readyState === "loading") {
        trackEvent(doc, "DOMContentLoaded", initQuantityInputs);
      } else {
        initQuantityInputs();
      }

      trackEvent(view, "load", () => {
        setTimeout(initQuantityInputs, 100);
      });
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 27. SLIDER CONFIRM BUTTONS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Slider values are now treated as final input immediately, without
    // any extra "confirm" interaction layer.

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 27B. DIMENSIONS CONFIRM BUTTON
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Rectangular dimensions are now considered complete as soon as both
    // values are filled, so no explicit confirmation step is needed.

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 28. FORCE VISIBILITY OF BALCONY FIELDS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      function forceBalconyVisibility() {
        // Wymuś widoczność pola balkonów
        const balconyFieldItem = dom
          .byId("has_balcony")
          ?.closest(".form-field-item");
        if (balconyFieldItem) {
          balconyFieldItem.style.display = "block";
          balconyFieldItem.classList.remove("hidden");
          if (window.__HP_DEBUG__) {
          }
        }

        // Wymuś widoczność kontenera balconyFields (slider) - tylko jeśli has_balcony === 'yes'
        // To jest OK, że jest ukryty na początku
      }

      // Wykonaj natychmiast
      forceBalconyVisibility();

      // Wykonaj po załadowaniu DOM
      if (doc.readyState === "loading") {
        trackEvent(doc, "DOMContentLoaded", forceBalconyVisibility);
      }

      // Wykonaj po załadowaniu wszystkich skryptów
      trackEvent(view, "load", function () {
        setTimeout(forceBalconyVisibility, 100);
      });

      // Wykonaj po inicjalizacji formEngine
      const checkFormEngine = setInterval(function () {
        if (formEngine && formEngine.init) {
          setTimeout(forceBalconyVisibility, 200);
          clearInterval(checkFormEngine);
        }
      }, 100);

      // Zatrzymaj sprawdzanie po 5 sekundach
      setTimeout(function () {
        clearInterval(checkFormEngine);
      }, 5000);
    })();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // 29. UPROSZCZONY TRYB IZOLACJI - przełączanie trybów dla single_house
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    (function () {
      "use strict";

      // NOWA FUNKCJA: Per-field przełączanie trybu izolacji
      function setupPerFieldInsulationMode() {
        const wallsCheckbox = dom.byId("walls_insulation_detailed_mode");
        const roofCheckbox = dom.byId("roof_insulation_detailed_mode");
        const floorCheckbox = dom.byId("floor_insulation_detailed_mode");

        if (!wallsCheckbox || !roofCheckbox || !floorCheckbox) {
          // Jeśli checkboxy nie istnieją, spróbuj ponownie później
          setTimeout(setupPerFieldInsulationMode, 100);
          return;
        }

        // Funkcja do przełączania widoczności pola (uproszczone vs szczegółowe)
        function toggleFieldVisibility(fieldType, isDetailed) {
          const simplifiedField = dom.byId(`${fieldType}-simplified-field`);
          const detailedField = dom.byId(`${fieldType}-detailed-field`);

          if (simplifiedField && detailedField) {
            if (isDetailed) {
              // Ukryj pole uproszczone
              simplifiedField.classList.add("hidden");
              simplifiedField.style.display = "none";
              simplifiedField.style.visibility = "hidden";
              // Pokaż pole szczegółowe
              detailedField.classList.remove("hidden");
              detailedField.style.display = "";
              detailedField.style.visibility = "visible";
            } else {
              // Ukryj pole szczegółowe
              detailedField.classList.add("hidden");
              detailedField.style.display = "none";
              detailedField.style.visibility = "hidden";
              // Pokaż pole uproszczone
              simplifiedField.classList.remove("hidden");
              simplifiedField.style.display = "";
              simplifiedField.style.visibility = "visible";
            }

            // Force reflow na mobile (pomaga z renderowaniem)
            void simplifiedField.offsetHeight;
            void detailedField.offsetHeight;
          }
        }

        // Funkcja do aktualizacji widoczności wszystkich pól
        function updateAllFieldsVisibility() {
          toggleFieldVisibility("walls", wallsCheckbox.checked);
          toggleFieldVisibility("roof", roofCheckbox.checked);
          toggleFieldVisibility("floor", floorCheckbox.checked);

          // Odśwież formEngine
          if (formEngine && formEngine.softRefresh) {
            setTimeout(() => {
              formEngine.softRefresh();
            }, 100);
          }
        }

        // Listenery dla każdego checkboxa
        trackEvent(wallsCheckbox, "change", function () {
          const value = this.checked ? "yes" : "no";
          if (formEngine && formEngine.state && formEngine.state.setValue) {
            formEngine.state.setValue("walls_insulation_detailed_mode", value);
            if (formEngine.refreshField) {
              formEngine.refreshField("walls_insulation_detailed_mode");
            }
          }
          toggleFieldVisibility("walls", this.checked);
          updateAllFieldsVisibility();
        });

        trackEvent(roofCheckbox, "change", function () {
          const value = this.checked ? "yes" : "no";
          if (formEngine && formEngine.state && formEngine.state.setValue) {
            formEngine.state.setValue("roof_insulation_detailed_mode", value);
            if (formEngine.refreshField) {
              formEngine.refreshField("roof_insulation_detailed_mode");
            }
          }
          toggleFieldVisibility("roof", this.checked);
          updateAllFieldsVisibility();
        });

        trackEvent(floorCheckbox, "change", function () {
          const value = this.checked ? "yes" : "no";
          if (formEngine && formEngine.state && formEngine.state.setValue) {
            formEngine.state.setValue("floor_insulation_detailed_mode", value);
            if (formEngine.refreshField) {
              formEngine.refreshField("floor_insulation_detailed_mode");
            }
          }
          toggleFieldVisibility("floor", this.checked);
          updateAllFieldsVisibility();
        });

        // Inicjalizacja widoczności przy załadowaniu
        updateAllFieldsVisibility();
      }


      // Inicjalizuj po załadowaniu DOM i formEngine
      if (doc.readyState === "loading") {
        trackEvent(doc, "DOMContentLoaded", function () {
          // Poczekaj na formEngine
          const checkEngine = setInterval(function () {
            if (formEngine && formEngine.state) {
              setupPerFieldInsulationMode();
              clearInterval(checkEngine);
            }
          }, 100);

          setTimeout(() => clearInterval(checkEngine), 5000);
        });
      } else {
        // DOM już załadowany
        const checkEngine = setInterval(function () {
          if (formEngine && formEngine.state) {
            // Używamy per-field toggli (walls/roof/floor) dla trybu szczegółowego izolacji
            setupPerFieldInsulationMode();
            clearInterval(checkEngine);
          }
        }, 100);

        setTimeout(() => clearInterval(checkEngine), 5000);
      }
    })();

    // OBSŁUGA PRZYCISKÓW NAWIGACJI (btn-next1, btn-next2, ..., btn-finish)
    function initNavigationButtons() {
      const showTab = state?.showTab;
      if (!showTab || typeof showTab !== "function") {
        console.warn("[CalculatorUI] showTab nie jest dostępny");
        return;
      }

      // Mapowanie przycisków do indeksów sekcji
      const buttonMap = [
        { selector: ".btn-next1", nextTab: 1 },
        { selector: ".btn-next2", nextTab: 2 },
        { selector: ".btn-next3", nextTab: 3 },
        { selector: ".btn-next4", nextTab: 4 },
        { selector: ".btn-next5", nextTab: 5 },
      ];

      // Obsługa przycisków "Dalej"
      buttonMap.forEach(({ selector, nextTab }) => {
        const button = dom.qs(selector);
        if (!button) return;

        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (button.disabled) {
            return;
          }

          const activeSection = dom.qs(".section.active[data-tab]");
          const currentTab = activeSection
            ? Number(activeSection.getAttribute("data-tab"))
            : Math.max(0, nextTab - 1);

          if (typeof window.validateTab === "function" && Number.isFinite(currentTab)) {
            const valid = window.validateTab(currentTab, { focusSummary: true });
            if (!valid) {
              const invalidField =
                activeSection?.querySelector?.(".field-invalid") ||
                activeSection?.querySelector?.("[aria-invalid='true']") ||
                null;
              if (typeof window.topinstalTrackEvent === "function") {
                window.topinstalTrackEvent("calc_validation_error", {
                  source: "calc",
                  tab: currentTab,
                  stepKey: `tab_${currentTab}`,
                  meta: {
                    tab: currentTab,
                    field:
                      invalidField?.name ||
                      invalidField?.id ||
                      "unknown",
                    rule: "required",
                  },
                });
              }
              return;
            }

            if (typeof window.topinstalTrackEvent === "function") {
              const viewTs =
                window.__TOPINSTAL_TAB_VIEW_TS &&
                  Number.isFinite(Number(window.__TOPINSTAL_TAB_VIEW_TS[currentTab]))
                  ? Number(window.__TOPINSTAL_TAB_VIEW_TS[currentTab])
                  : Date.now();
              window.topinstalTrackEvent("calc_tab_complete", {
                source: "calc",
                tab: currentTab,
                stepKey: `tab_${currentTab}`,
                meta: {
                  tab: currentTab,
                  durationMs: Math.max(0, Date.now() - viewTs),
                },
              });
            }
          }

          // Przejdź do następnej zakładki
          try {
            showTab(nextTab);
          } catch (error) {
            console.error(
              `[CalculatorUI] Błąd przejścia do zakładki ${nextTab}:`,
              error
            );
          }
        };

        trackEvent(button, "click", clickHandler);
      });

      // Obsługa przycisku "Oblicz" (btn-finish)
      const finishButton = dom.qs(".btn-finish");
      if (finishButton) {
        finishButton.dataset.motionCta = finishButton.dataset.motionCta || "on";
        finishButton.dataset.ctaLabelDefault =
          finishButton.dataset.ctaLabelDefault ||
          (finishButton.textContent || "").trim();
        finishButton.dataset.ctaLabelLoading =
          finishButton.dataset.ctaLabelLoading || "Obliczam oferte...";
        finishButton.dataset.ctaLabelSuccess =
          finishButton.dataset.ctaLabelSuccess || "Oferta gotowa";

        let resetFinishStateTimer = null;
        const motionApi = motion || window.MotionSystem;

        const setFinishButtonState = (stateName) => {
          finishButton.classList.remove("is-loading", "is-success");

          if (stateName === "loading") {
            finishButton.classList.add("is-loading");
            finishButton.setAttribute("aria-busy", "true");
            finishButton.disabled = true;
            finishButton.textContent = finishButton.dataset.ctaLabelLoading;
            if (
              motionApi &&
              typeof motionApi.animateCtaState === "function"
            ) {
              motionApi.animateCtaState(finishButton, "loading");
            }
            return;
          }

          finishButton.removeAttribute("aria-busy");
          finishButton.disabled = false;

          if (stateName === "success") {
            finishButton.classList.add("is-success");
            finishButton.textContent = finishButton.dataset.ctaLabelSuccess;
            if (
              motionApi &&
              typeof motionApi.animateCtaState === "function"
            ) {
              motionApi.animateCtaState(finishButton, "success");
            }
            return;
          }

          finishButton.textContent = finishButton.dataset.ctaLabelDefault;
        };

        const scheduleFinishStateReset = () => {
          if (resetFinishStateTimer) {
            clearTimeout(resetFinishStateTimer);
          }
          resetFinishStateTimer = view.setTimeout(() => {
            setFinishButtonState("idle");
          }, getMotionDelay(1100));
        };

        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (finishButton.disabled || finishButton.dataset.ctaBusy === "1") {
            return;
          }

          LOG.info("flow", "Calculate clicked");

          const strictBackend =
            window.HEATPUMP_CONFIG &&
            window.HEATPUMP_CONFIG.useBackendCalc === true;
          const mode =
            window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.useBackendCalc === true
              ? "backend"
              : "backend-required";
          if (typeof window.topinstalTrackEvent === "function") {
            window.topinstalTrackEvent("calc_submit", {
              source: "calc",
              tab: 5,
              stepKey: "calculate",
              meta: { mode, strict: !!strictBackend },
            });
          }

          // ✅ FIX Problem #4: Ustaw active root przed wywołaniem API
          // Zapewnia że wszystkie globalne funkcje (showTab, displayResults, showWorkflowCompletion)
          // będą działać na WŁAŚCIWEJ INSTANCJI (tej, w której użytkownik kliknął "Oblicz")
          if (typeof window.__HP_SET_ACTIVE_ROOT__ === "function") {
            window.__HP_SET_ACTIVE_ROOT__(root); // root z ctx
            LOG.info("flow", "Active root set for this instance", {
              instanceId: root.dataset?.hpInstance || 'unknown'
            });
          }

          // ⚠️ FIX P0.2: iOS/mobile - ensure last input value is committed to state before validation
          // Wymusza blur() na aktywnym input, co powoduje commit wartości do formEngine.state na iOS
          try {
            const active = document.activeElement;
            if (active && root && root.contains(active)) {
              active.blur();
            }
          } catch (e) {
            // Ignoruj błędy blur (może nie być focusable)
          }

          // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          // P0.1: WALIDACJA BLOKUJĄCA PRZED "OBLICZ"
          // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          // Waliduj wszystkie zakładki przed obliczeniami (ostatnia zakładka to index 5)
          // ⚠️ FIX: validateTab() NIE przełącza zakładki - używa formEngine.state jako źródła prawdy
          // Nie wywołujemy showTab() podczas walidacji - tylko na końcu jeśli jest błąd
          const lastTabIndex = 5;
          let validationPassed = true;
          let firstInvalidField = null;
          let firstInvalidTabIndex = null;

          // Waliduj wszystkie zakładki od 0 do 5 (bez przełączania UI)
          for (let tabIdx = 0; tabIdx <= lastTabIndex; tabIdx++) {
            if (typeof window.validateTab === "function") {
              const isValid = window.validateTab(tabIdx);
              if (!isValid) {
                validationPassed = false;
                firstInvalidTabIndex = tabIdx;
                // Znajdź pierwsze nieprawidłowe pole w tej zakładce (bez przełączania zakładki)
                const activeRoot = window.__HP_ACTIVE_ROOT__ || root;
                const sections = activeRoot?.querySelectorAll?.('.section') || [];
                if (sections[tabIdx]) {
                  // Szukaj pola z błędem - validateTab() już oznaczyła pola jako invalid
                  const invalidField = sections[tabIdx].querySelector('.field-invalid, [class*="error"], .field-error');
                  if (invalidField && !firstInvalidField) {
                    firstInvalidField = invalidField;
                  }
                }
                break; // Znaleziono pierwszy błąd - przerwij pętlę
              }
            }
          }

          if (!validationPassed) {
            LOG.warn("flow", "Validation failed before calculation", {
              firstInvalidTabIndex,
            });

            const invalidFieldName =
              firstInvalidField?.name ||
              firstInvalidField?.id ||
              "unknown";
            window.__TOPINSTAL_LAST_INVALID_FIELD = invalidFieldName;
            if (typeof window.topinstalTrackEvent === "function") {
              window.topinstalTrackEvent("calc_validation_error", {
                source: "calc",
                tab: firstInvalidTabIndex,
                stepKey: firstInvalidTabIndex != null ? `tab_${firstInvalidTabIndex}` : "calculate",
                meta: {
                  tab: firstInvalidTabIndex,
                  field: invalidFieldName,
                  rule: "required",
                },
              });
            }

            // ⚠️ FIX: Przełącz do zakładki z błędem TYLKO RAZ (na końcu walidacji)
            if (firstInvalidTabIndex !== null && typeof window.showTab === "function") {
              window.showTab(firstInvalidTabIndex);
            }

            if (typeof ErrorHandler !== "undefined") {
              ErrorHandler.showToast(
                "Sprawdź pola oznaczone na czerwono — bez tego nie policzymy wyniku.",
                "error"
              );
            } else {
              if (typeof ErrorHandler !== "undefined") {
                ErrorHandler.showToast("Sprawdź pola oznaczone na czerwono — bez tego nie policzymy wyniku.", "error");
              } else {
                console.error("Sprawdź pola oznaczone na czerwono — bez tego nie policzymy wyniku.");
              }
            }

            // Scroll i focus do pierwszego błędu (po przełączeniu zakładki)
            if (firstInvalidField) {
              // Opóźnij scroll/focus aby zakładka zdążyła się przełączyć
              setTimeout(() => {
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  if (firstInvalidField.focus && typeof firstInvalidField.focus === 'function') {
                    firstInvalidField.focus();
                  }
                }, 200);
              }, 100);
            }
            return;
          }

          if (typeof window.topinstalTrackEvent === "function") {
            const viewTs =
              window.__TOPINSTAL_TAB_VIEW_TS &&
                Number.isFinite(Number(window.__TOPINSTAL_TAB_VIEW_TS[5]))
                ? Number(window.__TOPINSTAL_TAB_VIEW_TS[5])
                : Date.now();
            window.topinstalTrackEvent("calc_tab_complete", {
              source: "calc",
              tab: 5,
              stepKey: "tab_5",
              meta: {
                tab: 5,
                durationMs: Math.max(0, Date.now() - viewTs),
              },
            });
            window.topinstalTrackEvent("calc_reached_end", {
              source: "calc",
              tab: 5,
              stepKey: "tab_5",
              meta: { tab: 5 },
            });
            if (window.__TOPINSTAL_LAST_INVALID_FIELD) {
              window.topinstalTrackEvent("calc_validation_recover", {
                source: "calc",
                tab: 5,
                stepKey: "calculate",
                meta: {
                  tab: 5,
                  field: window.__TOPINSTAL_LAST_INVALID_FIELD,
                },
              });
              window.__TOPINSTAL_LAST_INVALID_FIELD = null;
            }
          }

          // Wywołaj obliczenia
          if (typeof window.callCieplo === "function") {
            if (typeof window.buildJsonData !== "function") {
              LOG.error("flow", "buildJsonData is not available");
              if (typeof ErrorHandler !== "undefined") {
                ErrorHandler.showToast(
                  "Błąd: Funkcja buildJsonData nie została załadowana",
                  "error"
                );
              } else {
                if (typeof ErrorHandler !== "undefined") {
                  ErrorHandler.showToast("Błąd: Funkcja buildJsonData nie została załadowana", "error");
                } else {
                  console.error("Błąd: Funkcja buildJsonData nie została załadowana");
                }
              }
              return;
            }

            let jsonData;
            try {
              // P0.2: Wywołaj buildJsonData w trybie strict
              // ⚠️ FIX: buildJsonData({ strict: true }) może rzucić Error - musi być w try/catch
              jsonData = window.buildJsonData({ strict: true });

              // Jeśli buildJsonData zwróciło obiekt z ok:false, obsłuż błędy
              if (jsonData && typeof jsonData === 'object' && jsonData.ok === false) {
                LOG.error("flow", "buildJsonData validation failed", jsonData.errors);
                if (typeof ErrorHandler !== "undefined") {
                  const errorMsg = jsonData.errors && jsonData.errors.length > 0
                    ? `Błędy walidacji: ${jsonData.errors.join(', ')}`
                    : "Błąd walidacji danych formularza";
                  ErrorHandler.showToast(errorMsg, "error");
                } else {
                  if (typeof ErrorHandler !== "undefined") {
                    const errorMsg = jsonData.errors ? jsonData.errors.join(', ') : "Błąd walidacji danych formularza";
                    ErrorHandler.showToast(errorMsg, "error");
                  } else {
                    console.error(jsonData.errors ? jsonData.errors.join('\n') : "Błąd walidacji danych formularza");
                  }
                }
                return;
              }

              // Sprawdź czy jsonData jest poprawnym obiektem (nie null/undefined)
              if (!jsonData || typeof jsonData !== 'object') {
                throw new Error('buildJsonData zwróciło nieprawidłowy wynik');
              }

              LOG.info("flow", "Calculation started", {
                payloadPreview: jsonData,
              });
              window.lastSentPayload = jsonData;
            } catch (error) {
              // ⚠️ FIX: Obsługa throw z buildJsonData({ strict: true })
              // Zapewnia że użytkownik nie dostanie "uncaught error" i flow się nie posypie
              LOG.error("flow", "buildJsonData error", {
                message: error.message,
                stack: error.stack,
                name: error.name,
              });

              if (typeof ErrorHandler !== "undefined") {
                // ⚠️ UX: User-friendly komunikat (szczegóły w logach debug)
                let userMessage = "Błąd podczas przygotowywania danych";
                if (error.message && error.message.includes('Brakujące')) {
                  userMessage = "Wypełnij wszystkie wymagane pola przed obliczeniami";
                }
                ErrorHandler.showToast(userMessage, "error");

                // Jeśli błąd walidacji - znajdź i pokaż pierwsze nieprawidłowe pole
                if (error.message && error.message.includes('Brakujące')) {
                  // Spróbuj znaleźć pole z błędem i scroll/focus
                  const activeRoot = window.__HP_ACTIVE_ROOT__ || root;
                  const invalidField = activeRoot?.querySelector?.('.field-invalid, [class*="error"]');
                  if (invalidField) {
                    setTimeout(() => {
                      invalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      setTimeout(() => {
                        if (invalidField.focus && typeof invalidField.focus === 'function') {
                          invalidField.focus();
                        }
                      }, 200);
                    }, 100);
                  }
                }
              } else {
                if (typeof ErrorHandler !== "undefined") {
                  ErrorHandler.showToast(error.message || "Błąd podczas przygotowywania danych do wysłania", "error");
                } else {
                  console.error(error.message || "Błąd podczas przygotowywania danych do wysłania");
                }
              }
              return; // Blokuje wywołanie API
            }

            // Resetuj wyniki przed obliczeniami
            if (typeof window.resetResultsSection === "function") {
              window.resetResultsSection();
            }

            // Wywołaj obliczenia
            finishButton.dataset.ctaBusy = "1";
            setFinishButtonState("loading");
            window.__TOPINSTAL_CALC_STARTED_AT = Date.now();
            window
              .callCieplo(jsonData)
              .then((result) => {
                if (result.success) {
                  LOG.info("flow", "Calculation finished", {
                    source: result.source,
                  });
                  setFinishButtonState("success");
                  scheduleFinishStateReset();
                } else if (result.errors) {
                  LOG.warn(
                    "flow",
                    "Calculation validation errors",
                    result.errors
                  );
                  setFinishButtonState("idle");
                } else if (result.networkError) {
                  LOG.error("flow", "Network error during calculation", result);
                  setFinishButtonState("idle");
                }
              })
              .catch((err) => {
                LOG.error("flow", "Final calculation error", err);
                setFinishButtonState("idle");
              })
              .finally(() => {
                finishButton.dataset.ctaBusy = "0";
              });
          } else {
            LOG.error("flow", "callCieplo is not available");
            if (typeof ErrorHandler !== "undefined") {
              ErrorHandler.showToast(
                "Błąd: Funkcja obliczeń nie została załadowana",
                "error"
              );
            } else {
              if (typeof ErrorHandler !== "undefined") {
                ErrorHandler.showToast("Błąd: Funkcja obliczeń nie została załadowana", "error");
              } else {
                console.error("Błąd: Funkcja obliczeń nie została załadowana");
              }
            }
            setFinishButtonState("idle");
          }
        };

        trackEvent(finishButton, "click", clickHandler);
      }

      // Obsługa przycisków "Wstecz" (btn-prev)
      const prevButtons = dom.qsa(".btn-prev");
      prevButtons.forEach((button) => {
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Znajdź aktualną sekcję
          const activeSection = dom.qs(".section.active");
          if (!activeSection) return;

          const currentTab =
            parseInt(activeSection.getAttribute("data-tab")) || 0;
          if (currentTab > 0) {
            try {
              showTab(currentTab - 1);
            } catch (error) {
              console.error(
                "[CalculatorUI] Błąd powrotu do poprzedniej zakładki:",
                error
              );
            }
          }
        };

        trackEvent(button, "click", clickHandler);
      });
    }

    // Inicjalizuj podstawowe UI (step 0 + nawigacja) po załadowaniu DOM
    if (doc.readyState === "loading") {
      trackEvent(doc, "DOMContentLoaded", () => {
        setTimeout(() => {
          initStep0UI();
          initNavigationButtons();
          // Missing custom sliders (previously defined but not wired)
          try {
            initCustomBalconySlider();
          } catch (e) { }
          try {
            initCustomWindowsSlider();
          } catch (e) { }
          try {
            initCustomDoorsSlider();
          } catch (e) { }
        }, 100);
      });
    } else {
      setTimeout(() => {
        initStep0UI();
        initNavigationButtons();
        // Missing custom sliders (previously defined but not wired)
        try {
          initCustomBalconySlider();
        } catch (e) { }
        try {
          initCustomWindowsSlider();
        } catch (e) { }
        try {
          initCustomDoorsSlider();
        } catch (e) { }
      }, 100);
    }

    // Fallback: Elementor/WP can render async – retry custom sliders after load
    trackEvent(view, "load", () => {
      setTimeout(() => {
        try {
          initCustomBalconySlider();
        } catch (e) { }
        try {
          initCustomWindowsSlider();
        } catch (e) { }
        try {
          initCustomDoorsSlider();
        } catch (e) { }
        try {
          initAccordions();
        } catch (e) { }
      }, 250);
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // INICJALIZACJA AKORDEONÓW PO WYŚWIETLENIU WYNIKÓW
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Nasłuchuj na event wyświetlenia wyników
    trackEvent(root, "heatpump:resultsDisplayed", () => {
      setTimeout(() => {
        try {
          initAccordions();
        } catch (e) {
          console.warn("[CalculatorUI] Błąd inicjalizacji akordeonów:", e);
        }
      }, 100);
    });

    // Eksportuj funkcję initAccordions do window.__HP_MODULES__ dla resultsRenderer
    if (window.__HP_MODULES__) {
      window.__HP_MODULES__.calculatorUI = window.__HP_MODULES__.calculatorUI || {};
      window.__HP_MODULES__.calculatorUI.initAccordions = initAccordions;
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
  window.__HP_MODULES__.calculatorUI = { init };
})(window);
