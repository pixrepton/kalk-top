// === FILE: tabNavigation.js ===
// 🧠 Obsługuje: System nawigacji między zakładkami kalkulatora z walidacją

(function () {
  'use strict';

  const tabStateByRoot = new WeakMap();

  // Cache dla wyników walidacji
  const validationCache = new Map();
  let lastStateHash = null;
  let suppressFieldErrorScroll = false;

  function getStateHash(state) {
    // Prosty hash stanu (używamy JSON.stringify dla prostoty)
    // W przyszłości można użyć bardziej wydajnego hash (np. JSON.stringify + hash)
    return JSON.stringify(state);
  }

  function clearValidationCache() {
    validationCache.clear();
    lastStateHash = null;
  }

  const requiredFieldMessages = {
    building_type: 'Wybierz rodzaj budynku.',
    construction_year: 'Wybierz rok budowy.',
    location_id: 'Wybierz lokalizacje lub najblizsze duze miasto.',
    building_shape: 'Wybierz ksztalt budynku.',
    regular_method: 'Wybierz metode pomiaru.',
    floor_area: 'Podaj powierzchnie kondygnacji.',
    building_floors: 'Wybierz liczbe kondygnacji.',
    construction_type: 'Wybierz typ konstrukcji scian.',
    primary_wall_material: 'Wybierz material sciany.',
    wall_size: 'Podaj grubosc sciany.',
    windows_type: 'Wybierz typ okien.',
    doors_type: 'Wybierz typ drzwi.',
    number_windows: 'Podaj liczbe okien.',
    number_huge_windows: 'Podaj liczbe duzych okien.',
    walls_insulation_level: 'Wybierz poziom izolacji scian.',
    roof_insulation_level: 'Wybierz poziom izolacji dachu.',
    floor_insulation_level: 'Wybierz poziom izolacji podlogi.',
    source_type: 'Wybierz glowne zrodlo ogrzewania.',
    ventilation_type: 'Wybierz typ wentylacji.',
    heating_type: 'Wybierz rodzaj instalacji grzewczej.',
    include_hot_water: 'Okresl, czy uwzglednic ciepla wode.',
  };

  function requiredMessageForField(fieldName) {
    if (!fieldName) return 'To pole jest wymagane.';
    return requiredFieldMessages[fieldName] || 'To pole jest wymagane.';
  }

  function emitFrictionEvent(eventName, params = {}) {
    if (!eventName) return;
    try {
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: eventName, ...params });
      }
    } catch (_) {}
  }

  function sanitizeFieldEventKey(fieldKey) {
    return String(fieldKey || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toFieldSelector(fieldName) {
    const escapedName = String(fieldName || '').replace(/"/g, '\\"');
    const selectors = [];
    if (escapedName) {
      selectors.push(`[name="${escapedName}"]`);
    }
    if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(fieldName || '')) {
      selectors.push(`#${fieldName}`);
    }
    return selectors.join(', ');
  }

  function findFieldElement(section, fieldName) {
    if (!fieldName) return null;
    const selector = toFieldSelector(fieldName);
    if (!selector) return null;
    const root = getActiveRoot();
    return (
      root?.querySelector?.(selector) ||
      section?.querySelector?.(selector) ||
      null
    );
  }

  function humanizeFieldKey(fieldKey) {
    return String(fieldKey || 'To pole')
      .replace(/\[\]/g, '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/[_-]+/g, ' ')
      .trim();
  }

  function resolveFieldLabel(fieldEl, fallbackKey) {
    if (!fieldEl) return humanizeFieldKey(fallbackKey);
    const id = fieldEl.id;
    const form = fieldEl.form || getActiveRoot();
    if (id && form?.querySelector) {
      const explicitLabel = form.querySelector(`label[for="${id}"]`);
      if (explicitLabel && explicitLabel.textContent) {
        return explicitLabel.textContent.trim();
      }
    }

    const wrapper = fieldEl.closest('.form-field-item, .form-field, .form-field__radio-group');
    if (wrapper) {
      const labelEl = wrapper.querySelector('label');
      if (labelEl && labelEl.textContent) {
        return labelEl.textContent.trim();
      }
    }

    return humanizeFieldKey(fallbackKey || fieldEl.name || fieldEl.id);
  }

  function getErrorSummary(section) {
    return section?.querySelector?.('.ux-error-summary') || null;
  }

  function clearErrorSummary(section) {
    const summary = getErrorSummary(section);
    if (summary) summary.remove();
  }

  function navigateToField(tabIndex, fieldName) {
    const root = getActiveRoot();
    const state = ensureRootState(root);
    const sections = getSectionsForRoot(root, state);
    const section = sections && sections[tabIndex] ? sections[tabIndex] : null;
    const fieldEl = findFieldElement(section, fieldName);
    let focusTarget = fieldEl;

    if (fieldName === 'building_type') {
      focusTarget = section?.querySelector?.('.building-type-card') || focusTarget;
    }

    if (!focusTarget) {
      focusTarget =
        section?.querySelector?.(`.option-card[data-field="${fieldName}"]`) ||
        section?.querySelector?.(`.yes-no-card[data-field="${fieldName}"]`) ||
        null;
    }

    if (focusTarget && focusTarget.type === 'hidden') {
      focusTarget =
        section?.querySelector?.(`.option-card[data-field="${fieldName}"]`) ||
        section?.querySelector?.(`.yes-no-card[data-field="${fieldName}"]`) ||
        section?.querySelector?.('.building-type-card') ||
        focusTarget;
    }

    const scrollTarget =
      focusTarget?.closest?.('.form-field-item, .form-field, .option-cards') ||
      focusTarget ||
      fieldEl;

    if (!scrollTarget) return;

    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const motion = window.MotionSystem;
    setTimeout(() => {
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
      }
      if (motion && typeof motion.animateFieldHighlight === 'function') {
        motion.animateFieldHighlight(scrollTarget);
      } else {
        scrollTarget.classList.add('ux-field-highlight');
        setTimeout(() => {
          scrollTarget.classList.remove('ux-field-highlight');
        }, 220);
      }
      emitFrictionEvent(`error_field_focus_${sanitizeFieldEventKey(fieldName)}`, {
        field: fieldName,
      });
    }, 160);
  }

  function renderErrorSummary(section, tabIndex, errors, options = {}) {
    if (!section || !Array.isArray(errors) || errors.length === 0) {
      clearErrorSummary(section);
      return;
    }

    const deduped = [];
    const seen = new Set();
    errors.forEach(err => {
      const fieldName = err?.fieldName || err?.fieldId;
      if (!fieldName || seen.has(fieldName)) return;
      seen.add(fieldName);
      deduped.push({
        fieldName,
        label: err?.label || humanizeFieldKey(fieldName),
        message: err?.message || 'To pole jest wymagane.',
      });
    });

    if (!deduped.length) {
      clearErrorSummary(section);
      return;
    }

    let summary = getErrorSummary(section);
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'ux-error-summary glass-box';
      summary.setAttribute('tabindex', '-1');
      summary.setAttribute('role', 'alert');

      const stepHeader = section.querySelector('.ux-step-header');
      if (stepHeader && stepHeader.parentNode === section) {
        stepHeader.insertAdjacentElement('afterend', summary);
      } else {
        section.insertBefore(summary, section.firstChild);
      }
    }

    const items = deduped
      .map(
        item =>
          `<li><button type="button" class="ux-error-summary__link" data-field="${escapeHtml(
            item.fieldName
          )}">${escapeHtml(item.label)}: ${escapeHtml(item.message)}</button></li>`
      )
      .join('');

    summary.innerHTML = `
      <p class="ux-error-summary__title">Popraw pola, aby przejść dalej:</p>
      <ul class="ux-error-summary__list">${items}</ul>
    `;

    summary.querySelectorAll('.ux-error-summary__link').forEach(button => {
      button.addEventListener('click', () => {
        const fieldName = button.getAttribute('data-field') || '';
        navigateToField(tabIndex, fieldName);
      });
    });

    emitFrictionEvent('error_summary_shown', {
      tab_index: tabIndex,
      error_count: deduped.length,
    });

    if (options.focusSummary !== false && section.classList.contains('active')) {
      summary.focus({ preventScroll: false });
    }
  }

  function getSectionFieldsForValidation(tabIndex, state, rules) {
    const sectionRule = rules.sections && rules.sections[tabIndex];
    let sectionFields =
      rules.sectionFields && sectionRule ? [...(rules.sectionFields[sectionRule.id] || [])] : [];

    if (!sectionFields.length) return sectionFields;

    const isTruthyDetailedMode = value =>
      value === true || value === 'yes' || value === 'true';
    const isSingleHouse = state.building_type === 'single_house';
    const wallsDetailed =
      isTruthyDetailedMode(state.walls_insulation_detailed_mode) ||
      isTruthyDetailedMode(state.detailed_insulation_mode);
    const roofDetailed = isTruthyDetailedMode(state.roof_insulation_detailed_mode);
    const floorDetailed = isTruthyDetailedMode(state.floor_insulation_detailed_mode);
    const isSimplifiedSingleHouse =
      isSingleHouse && !wallsDetailed && !roofDetailed && !floorDetailed;

    if (isSimplifiedSingleHouse) {
      if (tabIndex === 3) {
        sectionFields = sectionFields.filter(
          name => name !== 'doors_type' && name !== 'number_doors'
        );
      }
      if (tabIndex === 4) {
        sectionFields = [
          'walls_insulation_level',
          'roof_insulation_level',
          'floor_insulation_level',
        ];
      }
    } else if (tabIndex === 4) {
      sectionFields = sectionFields.filter(
        name =>
          !(
            (name === 'walls_insulation_level' && wallsDetailed) ||
            (name === 'roof_insulation_level' && roofDetailed) ||
            (name === 'floor_insulation_level' && floorDetailed) ||
            (name === 'has_external_isolation' && isSingleHouse && !wallsDetailed) ||
            (name === 'external_wall_isolation[material]' && isSingleHouse && !wallsDetailed) ||
            (name === 'external_wall_isolation[size]' && isSingleHouse && !wallsDetailed) ||
            (name === 'top_isolation' && isSingleHouse && !roofDetailed) ||
            (name === 'top_isolation[material]' && isSingleHouse && !roofDetailed) ||
            (name === 'top_isolation[size]' && isSingleHouse && !roofDetailed) ||
            (name === 'bottom_isolation' && isSingleHouse && !floorDetailed) ||
            (name === 'bottom_isolation[material]' && isSingleHouse && !floorDetailed) ||
            (name === 'bottom_isolation[size]' && isSingleHouse && !floorDetailed)
          )
      );
    }

    return sectionFields;
  }

  function buildErrorItem(section, fieldName, message = null) {
    const fieldEl = findFieldElement(section, fieldName);
    return {
      fieldName,
      label: resolveFieldLabel(fieldEl, fieldName),
      message: message || requiredMessageForField(fieldName),
    };
  }

  function collectInvalidFieldErrors(section) {
    if (!section) return [];
    const invalidFields = Array.from(section.querySelectorAll('.field-invalid'));
    const items = invalidFields.map(fieldEl => {
      const fieldName = fieldEl.name || fieldEl.id || '';
      const inlineError = fieldEl.parentElement?.querySelector?.('.field-error span');
      return {
        fieldName,
        label: resolveFieldLabel(fieldEl, fieldName),
        message:
          (inlineError && inlineError.textContent
            ? inlineError.textContent.trim()
            : getDefaultErrorMessage(fieldEl)) || requiredMessageForField(fieldName),
      };
    });
    return items.filter(item => item.fieldName);
  }

  function getActiveRoot() {
    return (
      window.__HP_ACTIVE_ROOT__ ||
      document.querySelector('.heatpump-calculator') ||
      document
    );
  }

  function ensureRootState(root) {
    const key = root || document;
    let state = tabStateByRoot.get(key);
    if (!state) {
      state = { currentTab: 0, sections: [] };
      tabStateByRoot.set(key, state);
    }
    return state;
  }

  function getSectionsForRoot(root, state) {
    if (state.sections && state.sections.length) {
      return state.sections;
    }
    const scope = root && root.querySelectorAll ? root : document;
    const container =
      scope.querySelector('#top-instal-calc') ||
      scope.querySelector('#wycena-calculator-app') ||
      scope;
    state.sections = Array.from(container.querySelectorAll('.section'));
    return state.sections;
  }

  /**
   * Wyświetla określoną zakładkę kalkulatora
   */
  function showTab(index) {
    try {
      // Walidacja danych wejściowych
      if (typeof index !== 'number' || isNaN(index) || index < 0) {
        console.warn('[tabNavigation] Invalid index:', index);
        return;
      }

      const root = getActiveRoot();
      const rootState = ensureRootState(root);
      const sectionsArray = getSectionsForRoot(root, rootState);
      window.sections = sectionsArray;

      if (index >= sectionsArray.length) {
        console.warn(`[tabNavigation] Index ${index} out of range (max: ${sectionsArray.length - 1})`);
        return;
      }

      // Sprawdź czy już jesteśmy w tym kroku
      const alreadyInThisTab = rootState.currentTab === index;
      const prevIndex =
        typeof rootState.currentTab === 'number' ? rootState.currentTab : null;
      const prevSection = prevIndex !== null ? sectionsArray[prevIndex] : null;

      // Symetryczny reset stylów layoutu sekcji (żeby nie zostawały inline "zapadnięcia" do 0px)
      const resetSectionInlineLayout = section => {
        if (!section || !section.style) return;
        section.style.removeProperty('display');
        section.style.removeProperty('height');
        section.style.removeProperty('max-height');
        section.style.removeProperty('overflow');
        section.style.removeProperty('width');
        section.style.removeProperty('max-width');
        section.style.removeProperty('min-width');
        section.style.removeProperty('position');
        section.style.removeProperty('top');
        section.style.removeProperty('left');
        section.style.removeProperty('right');
        section.style.removeProperty('opacity');
        section.style.removeProperty('transform');
      };

      // Pokaż wybraną sekcję
      const activeSection = sectionsArray[index];
      if (!activeSection) {
        console.error(`[tabNavigation] ❌ Nie znaleziono sekcji o indeksie ${index}`);
        return;
      }
      const motion = window.MotionSystem;
      const shouldAnimate =
        !alreadyInThisTab &&
        prevSection &&
        prevSection !== activeSection &&
        motion &&
        typeof motion.animateStep === 'function';

      // Ukryj wszystkie sekcje poza aktualną (i poprzednią jeśli animujemy)
      sectionsArray.forEach(section => {
        if (section && section.classList) {
          if (!shouldAnimate || section !== prevSection) {
            section.classList.remove('active');
          }
          resetSectionInlineLayout(section);
        }
      });

      activeSection.classList.add('active');
      resetSectionInlineLayout(activeSection);
      activeSection.style.display = 'block';

      // AI Analysis animation (tylko dla tabów 1-4, nie dla 0 i 5)
      if (!alreadyInThisTab && index >= 1 && index <= 4 && typeof window.simulateAIAnalysis === 'function') {
        const aiSteps = [
          { text: 'Analizuję dane budynku...', delay: 300 },
          { text: 'Obliczam parametry techniczne...', delay: 300 },
          { text: 'Przygotowuję rekomendacje...', delay: 300 }
        ];
        window.simulateAIAnalysis(index, aiSteps, () => {
          // Callback po zakończeniu animacji - kontynuuj normalną animację
        });
      }

      if (shouldAnimate) {
        // Zachowaj poprzednią sekcję na czas animacji
        prevSection.classList.add('active');
        prevSection.style.display = 'block';

        const form = hpById('heatCalcFormFull');
        if (form) form.classList.add('ui-stepper');

        const prevTop = prevSection.offsetTop;
        prevSection.style.position = 'absolute';
        prevSection.style.top = `${prevTop}px`;
        prevSection.style.left = '0';
        prevSection.style.right = '0';
        prevSection.style.width = '100%';

        const direction = prevIndex !== null && index > prevIndex ? 1 : -1;
        motion.animateStep(prevSection, activeSection, direction).then(() => {
          prevSection.classList.remove('active');
          prevSection.style.display = 'none';
          prevSection.style.removeProperty('position');
          prevSection.style.removeProperty('top');
          prevSection.style.removeProperty('left');
          prevSection.style.removeProperty('right');
          prevSection.style.removeProperty('width');
          prevSection.style.removeProperty('opacity');
          prevSection.style.removeProperty('transform');
          activeSection.style.removeProperty('opacity');
          activeSection.style.removeProperty('transform');
        });
      }

      // Fallback: gdyby CSS nie zadziałał (np. brak .section.active), wymuś display
      if (window.getComputedStyle(activeSection).display === 'none') {
        activeSection.style.display = 'block';
      }

      // 🔽 Scroll TYLKO jeśli zmieniamy zakładkę (zapobiega scrollowaniu przy przełączaniu widoków w tej samej zakładce)
      if (!alreadyInThisTab) {
        // Specjalne scrollowanie dla kroku 6 (wyniki) - scroll do samej góry sekcji
        if (index === 6) {
          // Znajdź header i oblicz jego wysokość (header usunięty - używamy 0)
          const header = hpQs('.top-preview-header');
          const headerHeight = header ? header.offsetHeight : 0;

          // Scroll do góry sekcji wyników, tak aby progress bar był tuż pod headerem
          // Dodatkowe 80px offsetu dla idealnego wyrównania
          const targetY = activeSection.offsetTop - headerHeight - 75;

          window.scrollTo({
            top: targetY,
            behavior: 'smooth',
          });

        } else {
          // Standardowe scrollowanie dla kroków 0-5
          const progressBar = activeSection.querySelector('.progress-bar-premium');
          const scrollTarget = progressBar || activeSection;
          const offsetY = scrollTarget.getBoundingClientRect().top + window.scrollY - 20;
          window.scrollTo({ top: offsetY, behavior: 'smooth' });
        }
      }
    } catch (error) {
      console.error('Błąd podczas przełączania zakładki:', error);
      // Fallback - spróbuj znaleźć sekcje ponownie
      const fallbackRoot = getActiveRoot();
      const fallbackState = ensureRootState(fallbackRoot);
      fallbackState.sections = getSectionsForRoot(fallbackRoot, fallbackState);
      window.sections = fallbackState.sections;
      if (window.sections.length > index && index >= 0) {
        window.sections[index].style.display = 'block';
      }
    }

    // Aktualizuj indeks aktywnej instancji
    const activeRoot = getActiveRoot();
    const activeState = ensureRootState(activeRoot);
    activeState.currentTab = index;
    window.currentTab = index;

    try {
      const currentSection =
        activeRoot?.querySelector?.(`.section.active[data-tab="${index}"]`) ||
        activeRoot?.querySelector?.(".section.active") ||
        null;
      const tabName =
        currentSection?.querySelector?.("h2, h3, .section-title")?.textContent?.trim?.() ||
        `tab_${index}`;
      if (typeof window.topinstalTrackEvent === "function") {
        window.topinstalTrackEvent("calc_tab_view", {
          source: "calc",
          tab: index,
          stepKey: `tab_${index}`,
          meta: { tab: index, tabName },
        });
      }
      window.__TOPINSTAL_TAB_VIEW_TS = window.__TOPINSTAL_TAB_VIEW_TS || {};
      window.__TOPINSTAL_TAB_VIEW_TS[index] = Date.now();
      if (activeRoot && typeof activeRoot.dispatchEvent === "function") {
        activeRoot.dispatchEvent(
          new CustomEvent("topinstal:tabChanged", {
            detail: { tab: index, tabName },
            bubbles: true,
          })
        );
      }
    } catch (_) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // APP STATE PERSISTENCE — zapisz currentTab
    // ═══════════════════════════════════════════════════════════════════════════
    if (typeof window.updateAppState === 'function') {
      window.updateAppState({ currentTab: index });
    }

    // Aktualizuj pasek postępu
    updateProgressBar(index);

    // Aktualizuj progresywne odblokowywanie dla aktywnej zakładki
    if (
      typeof window.progressiveDisclosure !== 'undefined' &&
      window.progressiveDisclosure.updateTab
    ) {
      setTimeout(() => {
        window.progressiveDisclosure.updateTab(index);
        window.progressiveDisclosure.updateButton(index);
      }, 200);
    }

    // Odśwież formEngine po zmianie zakładki, aby bindować nowe pola
    if (
      typeof window.formEngine !== 'undefined' &&
      typeof window.formEngine.rebindAll === 'function'
    ) {
      setTimeout(() => {
        window.formEngine.rebindAll();
      }, 250);
    }
  }

  /**
   console.log(
   * Aktualizuje pasek postępu
   */
  function updateProgressBar(activeIndex) {
    // Używaj WorkflowController jeśli dostępny (globalny progress bar)
    if (
      typeof window.WorkflowController !== 'undefined' &&
      window.WorkflowController.updateProgress
    ) {
      window.WorkflowController.updateProgress(activeIndex);
      return;
    }

    // Fallback - szukaj różnych wariantów paska postępu (stary system)
    const progressContainers = [
      hpQs('.progress-bar-premium'),
      hpQs('.progress-bar'),
      hpQs('.progress-steps'),
    ];

    const progressContainer = progressContainers.find(container => container !== null);

    if (progressContainer) {
      // Aktualizuj CSS custom property dla premium progress bar
      progressContainer.style.setProperty('--step', activeIndex + 1);

      // Znajdź kroki
      const progressSteps = progressContainer.querySelectorAll('.step');

      progressSteps.forEach((step, index) => {
        step.classList.remove('active', 'completed');

        if (index < activeIndex) {
          step.classList.add('completed');
        } else if (index === activeIndex) {
          step.classList.add('active');
        }
      });

        console.log(
        `📊 Pasek postępu zaktualizowany: krok ${activeIndex + 1}/${progressSteps.length}`
      );
    }
  }

  /**
   * Czyści błędy walidacji w sekcji
   */
  function clearValidationErrors(section) {
    if (section) {
      clearErrorSummary(section);
    }

    // Użyj ErrorHandler jeśli dostępny
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.clearAllErrors();
      return;
    }

    // Fallback - stary system
    if (!section) {
      const form =
        hpById('heatCalcFormFull') ||
        hpById('top-instal-calc') ||
        hpQs("form[data-calc='top-instal']");
      if (!form) return;
      section = form;
    }

    const fields = section.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
      field.classList.remove('field-error');
      field.style.border = '';
      field.style.backgroundColor = '';
    });

    const errorMessages = section.querySelectorAll('.error-message');
    errorMessages.forEach(msg => msg.remove());
  }

  /**
   * Waliduje całą zakładkę przed przejściem dalej.
   *
   * ⚠️ WAŻNE: Walidacja działa przez formEngine.state.getAllValues() (STAN, nie DOM),
   * więc działa poprawnie nawet na nieaktywnych zakładkach (display: none).
   * Nie wymaga przełączania UI - można walidować wszystkie zakładki (0-5) bez showTab().
   *
   * NOTE: validateTab works off state (formEngine.state), not DOM. It checks only required+visible fields.
   *
   * Logika wymaganych pól pochodzi z formEngine (sectionFields/requiredCache),
   * a ta funkcja odpowiada tylko za pokazanie błędów wizualnie.
   */
  function validateTab(tabIndex, options = {}) {
    // Konwertuj sekcje dla aktywnego root
    const root = getActiveRoot();
    const rootState = ensureRootState(root);
    const sectionsArray = getSectionsForRoot(root, rootState);
    const shouldFocusSummary = options.focusSummary !== false;

    if (!sectionsArray || sectionsArray.length === 0 || !sectionsArray[tabIndex]) {
      return true; // Brak sekcji = pozwól przejść
    }

    const section = sectionsArray[tabIndex];
    clearValidationErrors(section);
    suppressFieldErrorScroll = true;
    let validationErrors = [];

    // Sprawdź cache przed walidacją
    if (window.formEngine && window.formEngine.state) {
      const state = window.formEngine.state.getAllValues();
      const stateHash = getStateHash(state);
      // Dodaj instanceId do cacheKey dla bezpieczeństwa multi-instance
      const instanceId = window.formEngine.__activeInstanceId || 'default';
      const cacheKey = `${instanceId}:${tabIndex}:${stateHash}`;

      // Wyczyść cache przy zmianie stanu (tylko dla tego instance)
      if (stateHash !== lastStateHash) {
        // Wyczyść tylko wpisy dla tego instance
        const keysToDelete = [];
        validationCache.forEach((value, key) => {
          if (key.startsWith(`${instanceId}:`)) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => validationCache.delete(key));
        lastStateHash = stateHash;
      }

      // Sprawdź cache
      if (validationCache.has(cacheKey)) {
        const cachedResult = validationCache.get(cacheKey);
        // Jeśli wynik z cache jest false, oznacza pola jako invalid (dla wizualnego feedback)
        if (!cachedResult && window.formEngine && window.formEngine.rules) {
          const fe = window.formEngine;
          const rules = fe.rules;
          const sectionFields = getSectionFieldsForValidation(tabIndex, state, rules);

          // Oznacz pola jako invalid (dla wizualnego feedback)
          sectionFields.forEach(name => {
            const isValid = (window.formEngine && typeof window.formEngine.fieldIsSatisfied === 'function')
              ? window.formEngine.fieldIsSatisfied(name, state)
              : true;
            if (!isValid) {
              const fieldEl = findFieldElement(section, name);
              if (fieldEl) {
                markFieldAsInvalid(fieldEl, requiredMessageForField(name));
              }
              validationErrors.push(
                buildErrorItem(section, name, requiredMessageForField(name))
              );
            }
          });

          if (validationErrors.length === 0) {
            validationErrors = collectInvalidFieldErrors(section);
          }
          renderErrorSummary(section, tabIndex, validationErrors, {
            focusSummary: shouldFocusSummary,
          });
        }
        if (cachedResult) {
          clearErrorSummary(section);
        }
        suppressFieldErrorScroll = false;
        return cachedResult;
      }
    }

    let isValid = true;

    // Jeśli dostępny jest formEngine z regułami sekcji, użyj go jako źródła prawdy
    // NOTE: validateTab works off state (formEngine.state), not DOM. It checks only required+visible fields.
    if (window.formEngine && window.formEngine.rules && window.formEngine.state) {
      try {
        const fe = window.formEngine;
        const rules = fe.rules;
        const state = fe.state.getAllValues();
        const sectionFields = getSectionFieldsForValidation(tabIndex, state, rules);

        // ⚠️ FIX P0.1: Użyj enablement.required() i visibility.fields() do filtrowania tylko wymaganych i widocznych pól
        // required/visibility maps (defensive - jeśli API nie istnieje, fallback do starej logiki)
        const requiredMap = fe?.enablement?.required ? fe.enablement.required(state) : null;
        const visibilityMap = fe?.visibility?.fields ? fe.visibility.fields(state) : null;

        // ⚠️ FIX P0.1: Waliduj tylko pola, które są BOTH required AND visible

        // Prosta funkcja sprawdzająca, czy pole jest „spełnione” (kopiujemy ją z engine.js)
        // Użyj formEngine.fieldIsSatisfied() zamiast duplikacji
        const isValidField = (name) => {
          if (window.formEngine && typeof window.formEngine.fieldIsSatisfied === 'function') {
            return window.formEngine.fieldIsSatisfied(name, state);
          }
          // Fallback do lokalnej logiki (tylko jeśli formEngine nie dostępny)
          if (requiredMap && requiredMap[name] !== true) return true;
          if (visibilityMap && visibilityMap[name] === false) return true;
          const value = state[name];
          if (Array.isArray(value)) return value.length > 0;
          const str = value !== undefined && value !== null ? String(value).trim() : "";
          return str !== "" && str !== "undefined" && str !== "null";
        };

        // Zbierz pola, które są wymagane, widoczne, ale nie spełnione
        const missingFields = sectionFields.filter((name) => !isValidField(name));

        if (missingFields.length > 0) {
          isValid = false;

          // ⚠️ FIX: Podświetlanie pól w DOM (nawet jeśli sekcja nie jest aktywna)
          // Walidacja działa przez formEngine.state (niezależnie od widoczności DOM),
          // ale oznaczenie wizualne wymaga querySelector - jeśli sekcja nie jest aktywna,
          // może nie znaleźć pola, ale to nie wpływa na wynik walidacji (isValid już = false)
          missingFields.forEach(name => {
            const fieldEl = findFieldElement(section, name);
            if (fieldEl) {
              markFieldAsInvalid(fieldEl, requiredMessageForField(name));
            }
            validationErrors.push(
              buildErrorItem(section, name, requiredMessageForField(name))
            );
          });
        }
      } catch (e) {
        console.warn('[tabNavigation] Błąd walidacji z użyciem formEngine:', e);
      }
    }

    // Dodatkowo zachowaj starą logikę dla Yes/No i specyficznych sekcji,
    // ale tylko jako uzupełnienie (nie modyfikujemy już isValid na true, jeśli wcześniej było false).
    if (isValid) {
      isValid = validateSpecificFields(section) && validateConditionalFields(section);
    }

    if (!isValid) {
      const fallbackErrors = collectInvalidFieldErrors(section);
      renderErrorSummary(section, tabIndex, validationErrors.concat(fallbackErrors), {
        focusSummary: shouldFocusSummary,
      });
    } else {
      clearErrorSummary(section);
    }

    // Zapisz wynik w cache
    if (window.formEngine && window.formEngine.state) {
      const state = window.formEngine.state.getAllValues();
      const stateHash = getStateHash(state);
      // Dodaj instanceId do cacheKey dla bezpieczeństwa multi-instance
      const instanceId = window.formEngine.__activeInstanceId || 'default';
      const cacheKey = `${instanceId}:${tabIndex}:${stateHash}`;
      validationCache.set(cacheKey, isValid);
      lastStateHash = stateHash;
    }

    suppressFieldErrorScroll = false;
    return isValid;
  }

  /**
   * Waliduje pojedyncze pole
   */
  function validateField(field) {
    if (!field) return true;

    let isValid = true;
    let errorMessage = '';

    // Sprawdź czy pole jest widoczne
    if (field.offsetParent === null || field.style.display === 'none') {
      return true; // Pomiń ukryte pola
    }

    // Walidacja pustych pól
    if (field.hasAttribute('required') || field.hasAttribute('data-required')) {
      if (field.type === 'checkbox') {
        if (!field.checked) {
          isValid = false;
          errorMessage = 'To pole jest wymagane';
        }
      } else if (!field.value || field.value.trim() === '') {
        isValid = false;
        errorMessage = 'To pole jest wymagane';
      }
    }

    // Walidacja specjalna dla różnych typów pól
    if (field.value && field.value.trim() !== '') {
      switch (field.type) {
        case 'number':
          const numValue = parseFloat(field.value);
          if (isNaN(numValue)) {
            isValid = false;
            errorMessage = 'Wprowadź prawidłową liczbę';
          } else if (field.min && numValue < parseFloat(field.min)) {
            isValid = false;
            errorMessage = `Minimalna wartość: ${field.min}`;
          } else if (field.max && numValue > parseFloat(field.max)) {
            isValid = false;
            errorMessage = `Maksymalna wartość: ${field.max}`;
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(field.value)) {
            isValid = false;
            errorMessage = 'Wprowadź prawidłowy adres email';
          }
          break;
      }
    }

    if (!isValid) {
      markFieldAsInvalid(field, errorMessage);
    }

    return isValid;
  }

  /**
   * Walidacje specjalne dla poszczególnych sekcji
   */
  function validateSpecificFields(section) {
    if (!section) return true;

    let isValid = true;

    // Walidacja dla sekcji 1: Kształt budynku
    const buildingShape = section.querySelector('#building_shape');
    if (buildingShape && buildingShape.offsetParent !== null) {
      const shape = buildingShape.value;

      if (shape === 'regular') {
        // Sprawdź metody regularnego kształtu
        const regularMethod = section.querySelector('#regular_method');
        if (regularMethod && regularMethod.offsetParent !== null && !regularMethod.value) {
          markFieldAsInvalid(regularMethod, 'Wybierz metodę pomiaru');
          isValid = false;
        }

        if (regularMethod && regularMethod.value === 'dimensions') {
          const length = section.querySelector('#building_length');
          const width = section.querySelector('#building_width');
          if (length && !length.value) {
            markFieldAsInvalid(length, 'Podaj długość budynku');
            isValid = false;
          }
          if (width && !width.value) {
            markFieldAsInvalid(width, 'Podaj szerokość budynku');
            isValid = false;
          }
        } else if (regularMethod && regularMethod.value === 'floor_area') {
          const floorArea = section.querySelector('#floor_area');
          if (floorArea && !floorArea.value) {
            markFieldAsInvalid(floorArea, 'Podaj powierzchnię kondygnacji');
            isValid = false;
          }
        }
      } else if (shape === 'irregular') {
        const floorAreaIrregular = section.querySelector('#floor_area_irregular');
        const floorPerimeter = section.querySelector('#floor_perimeter');
        if (floorAreaIrregular && !floorAreaIrregular.value) {
          markFieldAsInvalid(floorAreaIrregular, 'Podaj powierzchnię kondygnacji');
          isValid = false;
        }
        if (floorPerimeter && !floorPerimeter.value) {
          markFieldAsInvalid(floorPerimeter, 'Podaj obwód zewnętrzny');
          isValid = false;
        }
      }
    }

    // Walidacja dla sekcji 4: Izolacja ścian (pola przeniesione z sekcji 2)
    // Sprawdź czy jest w trybie uproszczonym dla single_house
    const buildingType =
      window.formEngine && window.formEngine.state
        ? window.formEngine.state.getValue('building_type')
        : null;
    const detailedMode =
      window.formEngine && window.formEngine.state
        ? window.formEngine.state.getValue('detailed_insulation_mode')
        : null;
    const isSimplifiedSingleHouse =
      buildingType === 'single_house' &&
      detailedMode !== true &&
      detailedMode !== 'yes' &&
      detailedMode !== 'true';

    // Dla single_house w trybie uproszczonym: pomiń walidację szczegółowych pól izolacji
    if (!isSimplifiedSingleHouse) {
      // Pola izolacji ścian są teraz w sekcji 4, więc szukamy w całym dokumencie lub w sekcji 4
      const section4 = hpQs('.section[data-tab="4"]');
      const searchScope = section4 || document; // Użyj sekcji 4 jeśli istnieje, w przeciwnym razie całego dokumentu
      const hasExternalIsolation = searchScope.querySelector('#has_external_isolation');
      if (hasExternalIsolation && hasExternalIsolation.value === 'yes') {
        const extMaterial = searchScope.querySelector('#external_wall_isolation_material');
        const extSize = searchScope.querySelector('#external_wall_isolation_size');
        if (extMaterial && extMaterial.offsetParent !== null && !extMaterial.value) {
          markFieldAsInvalid(extMaterial, 'Wybierz materiał izolacji zewnętrznej');
          isValid = false;
        }
        if (extSize && extSize.offsetParent !== null && !extSize.value) {
          markFieldAsInvalid(extSize, 'Podaj grubość izolacji zewnętrznej');
          isValid = false;
        }
      }
    }

    // Walidacja dla sekcji 5: Podgrzewanie wody
    const includeHotWater = section.querySelector('#include_hot_water');
    if (includeHotWater && includeHotWater.value === 'yes') {
      const hotWaterPersons = section.querySelector('#hot_water_persons');
      const hotWaterUsage = section.querySelector('#hot_water_usage');
      if (hotWaterPersons && hotWaterPersons.offsetParent !== null && !hotWaterPersons.value) {
        markFieldAsInvalid(hotWaterPersons, 'Podaj liczbę osób');
        isValid = false;
      }
      if (hotWaterUsage && hotWaterUsage.offsetParent !== null && !hotWaterUsage.value) {
        markFieldAsInvalid(hotWaterUsage, 'Podaj zużycie wody');
        isValid = false;
      }
    }

    return isValid;
  }

  /**
   * Walidacja pól warunkowo wymaganych
   */
  function validateConditionalFields(section) {
    if (!section) return true;

    let isValid = true;

    // Sprawdź wszystkie pola z atrybutem data-condition
    const conditionalFields = section.querySelectorAll('[data-condition]');

    conditionalFields.forEach(field => {
      // Sprawdź czy pole jest widoczne
      if (field.offsetParent === null || field.style.display === 'none') {
        return; // Pomiń ukryte pola
      }

      // Sprawdź czy pole jest wymagane (przez formEngine)
      if (field.hasAttribute('required') || field.getAttribute('data-required') === 'true') {
        let isEmpty = false;

        if (field.type === 'checkbox' || field.type === 'radio') {
          const checkedField = section.querySelector(`[name="${field.name}"]:checked`);
          isEmpty = !checkedField;
        } else {
          isEmpty = !field.value || field.value.trim() === '';
        }

        if (isEmpty) {
          markFieldAsInvalid(field, 'To pole jest wymagane');
          isValid = false;
        }
      }
    });

    return isValid;
  }

  /**
   * Oznacza pole jako nieprawidłowe
   */
  function markFieldAsInvalid(field, customMessage = null, options = {}) {
    if (!field) return;

    // Pobierz komunikat błędu
    const errorMessage = customMessage || getDefaultErrorMessage(field);

    // Użyj ErrorHandler jeśli dostępny
    if (typeof ErrorHandler !== 'undefined' && errorMessage) {
      ErrorHandler.showFieldError(field, errorMessage, '', {
        ...options,
        skipScroll: options.skipScroll || suppressFieldErrorScroll,
      });
    } else {
      // Fallback - stary system
      field.classList.remove('field-error');
      const existingError = field.parentNode.querySelector('.error-message');
      if (existingError) existingError.remove();

      field.classList.add('field-error');

      if (errorMessage) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = errorMessage;
        errorElement.style.color = '#dc3545';
        errorElement.style.fontSize = '14px';
        errorElement.style.marginTop = '5px';
        field.parentNode.insertBefore(errorElement, field.nextSibling);
      }

      // Scroll do pierwszego błędu
      if (field.parentNode.querySelector('.field-error') === field) {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

  }

  /**
   * Zwraca domyślny komunikat błędu dla pola
   */
  function getDefaultErrorMessage(field) {
    if (field.hasAttribute('required') || field.hasAttribute('data-required')) {
      return 'To pole jest wymagane';
    }

    switch (field.type) {
      case 'number':
        return 'Wprowadź prawidłową liczbę';
      case 'email':
        return 'Wprowadź prawidłowy adres email';
      default:
        return 'Wartość w tym polu jest nieprawidłowa';
    }
  }

  /**
   * Funkcje nawigacji
   */
  function nextStep() {
    const root = getActiveRoot();
    const rootState = ensureRootState(root);
    let idx = rootState.currentTab || 0;
    if (validateTab(idx)) {
      showTab(idx + 1);
    }
  }

  function prevStep() {
    const root = getActiveRoot();
    const rootState = ensureRootState(root);
    let idx = rootState.currentTab || 0;
    showTab(idx - 1);
  }

  function focusValidationSummary(tabIndex) {
    const root = getActiveRoot();
    const rootState = ensureRootState(root);
    const sectionsArray = getSectionsForRoot(root, rootState);
    const section = sectionsArray && sectionsArray[tabIndex] ? sectionsArray[tabIndex] : null;
    if (!section) return;

    const summary = getErrorSummary(section);
    if (summary) {
      summary.focus({ preventScroll: false });
      return;
    }

    const firstInvalid = section.querySelector('.field-invalid');
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        if (typeof firstInvalid.focus === 'function') {
          firstInvalid.focus({ preventScroll: true });
        }
      }, 120);
    }
  }

  // Zostawiamy addRequiredAttributes tylko dla kompatybilności z istniejącym kodem,
  // ale nie opieramy na nim logiki sekcji (tę kontroluje formEngine).
  function addRequiredAttributes() {}

  // Global exports
  window.showTab = showTab;
  window.validateTab = validateTab;
  window.validateField = validateField;
  window.validateSpecificFields = validateSpecificFields;
  window.validateConditionalFields = validateConditionalFields;
  window.markFieldAsInvalid = markFieldAsInvalid;
  window.clearValidationErrors = clearValidationErrors;
  window.focusValidationSummary = focusValidationSummary;
  window.getDefaultErrorMessage = getDefaultErrorMessage;
  window.nextStep = nextStep;
  window.prevStep = prevStep;
  window.addRequiredAttributes = addRequiredAttributes;
})();
