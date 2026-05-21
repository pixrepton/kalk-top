(function (window) {
  'use strict';

  const formEngine = window.formEngine || (window.formEngine = {});

  function getFieldElements(fieldName) {
    const stored = formEngine.state.getFieldElements(fieldName);
    if (!stored) return [];
    if (stored instanceof NodeList || Array.isArray(stored)) {
      return Array.from(stored);
    }
    return [stored];
  }

  function getPrimaryElement(fieldName) {
    const elements = getFieldElements(fieldName);
    return elements.length ? elements[0] : null;
  }

  function resolveDisplayTarget(element, config) {
    if (!element) return null;

    // Jeśli config ma displayTargetSelector === null, nie szukaj kontenera
    if (config && config.displayTargetSelector === null) {
      return element;
    }

    if (config && config.displayTargetSelector) {
      const target = element.closest(config.displayTargetSelector);
      if (target) return target;
    }
    const fieldItem = element.closest('.form-field-item');
    if (fieldItem) return fieldItem;
    return element;
  }

  function updateFieldVisibility(fieldName, visible) {
    const config = formEngine.rules.fields[fieldName] || {};
    const element = getPrimaryElement(fieldName);
    if (!element) {
      return;
    }
    const target = resolveDisplayTarget(element, config);
    if (!target) {
      return;
    }

    // Sprawdź czy pole ma wymuszoną widoczność przez !important
    const computedStyle = window.getComputedStyle(target);
    const wasHidden = target.classList.contains('hidden') || computedStyle.display === 'none';
    const hasImportantDisplay = target.style.display && target.style.display.includes('!important');
    const isForcedVisible =
      hasImportantDisplay ||
      (computedStyle.display === 'block' &&
        target.style.cssText.includes('display: block !important'));

    // Jeśli pole ma visibleWhen: true, zawsze pokazuj
    const hasVisibleWhenTrue = config.visibleWhen && typeof config.visibleWhen === 'function';
    let shouldBeVisible = visible;
    if (hasVisibleWhenTrue) {
      try {
        const state = formEngine.state.getAllValues();
        const visibleResult = config.visibleWhen(state);
        if (visibleResult === true) {
          shouldBeVisible = true;
        }
      } catch (e) {
        console.warn(`[render] Błąd sprawdzania visibleWhen dla ${fieldName}:`, e);
      }
    }


    if (shouldBeVisible || isForcedVisible) {
      // Symetryczny reset layoutu (na wypadek wcześniejszego "zapadnięcia" przez inline style)
      target.style.removeProperty('height');
      target.style.removeProperty('max-height');
      target.style.removeProperty('overflow');
      target.style.removeProperty('width');
      target.style.removeProperty('max-width');
      target.style.removeProperty('min-width');

      target.style.display = 'block';
      target.classList.remove('hidden');
      if (wasHidden && window.MotionSystem && typeof window.MotionSystem.animateReveal === 'function') {
        window.MotionSystem.animateReveal(target);
      }
    } else {
      // Nie ukrywaj jeśli ma wymuszoną widoczność
      if (!isForcedVisible) {
        target.style.display = 'none';
        target.classList.add('hidden');
      }
    }
  }

  function updateContainerVisibility(containerName, visible) {
    const config = formEngine.rules.containers[containerName];
    if (!config) {
      // Ciche pominięcie - niektóre kontenery mogą nie istnieć (np. stare sekcje)
      return;
    }
    const container = hpQs(config.selector);
    if (!container) {
      // Ciche pominięcie - kontener może nie istnieć (np. simplifiedInsulationMode, detailedInsulationMode)
      return;
    }

    const wasHidden = container.classList.contains('hidden') || container.style.display === 'none';
    if (visible) {
      // Usuń hidden class i ustaw display (ważne: najpierw usuń klasę, potem ustaw display)
      if (container) {
        // Symetryczny reset stylów layoutu (na wypadek wcześniejszego "zapadnięcia" kontenera)
        container.style.removeProperty('height');
        container.style.removeProperty('max-height');
        container.style.removeProperty('overflow');
        container.style.removeProperty('width');
        container.style.removeProperty('max-width');
        container.style.removeProperty('min-width');

        // Usuń klasę hidden PRZED ustawieniem display
        container.classList.remove('hidden');
        // Ustaw display z !important aby nadpisać klasę .hidden (która ma display: none !important)
        // Używamy setProperty z 'important' flag
        const displayValue = config.displayType || 'block';
        container.style.setProperty('display', displayValue, 'important');

        // Dodatkowa weryfikacja - jeśli nadal ma klasę hidden, usuń ją ponownie
        // i wymuś display jeszcze raz (dla przypadków gdy CSS ma wyższą specyficzność)
        if (container.classList.contains('hidden')) {
          container.classList.remove('hidden');
          container.style.setProperty('display', displayValue, 'important');
        }

        // Ostateczna weryfikacja - sprawdź computed style
        const computedDisplay = window.getComputedStyle(container).display;
        if (computedDisplay === 'none') {
          // Jeśli nadal jest none, wymuś jeszcze raz
          container.style.setProperty('display', displayValue, 'important');
          container.classList.remove('hidden');
        }
        if (wasHidden && window.MotionSystem && typeof window.MotionSystem.animateReveal === 'function') {
          window.MotionSystem.animateReveal(container);
        }
      }
    } else {
      // Dodaj hidden class i ustaw display: none
      if (container) {
        container.classList.add('hidden');
        container.style.display = 'none';
      }
    }
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

  function clearBlockedFieldState(fieldName, enabled, elements) {
    if (enabled) return;

    if (fieldName === 'building_roof') {
      const roofInput = elements[0];
      if (!roofInput || !roofInput.value) return;

      roofInput.value = '';
      dispatchFieldEvent(roofInput, 'input');
      dispatchFieldEvent(roofInput, 'change');
      hpQsa(`.option-card[data-field="${fieldName}"]`).forEach((card) => {
        card.classList.remove('option-card--selected');
      });
      return;
    }

    if (fieldName === 'floor_height') {
      const floorHeightInput = elements[0];
      if (!floorHeightInput || !floorHeightInput.value) return;

      floorHeightInput.value = '';
      dispatchFieldEvent(floorHeightInput, 'input');
      dispatchFieldEvent(floorHeightInput, 'change');
      hpQsa(`.option-card[data-field="${fieldName}"]`).forEach((card) => {
        card.classList.remove('option-card--selected');
      });
      return;
    }

    if (fieldName === 'attic_access' || fieldName === 'garage_type') {
      let changed = false;
      elements.forEach((element) => {
        if (element && element.checked) {
          element.checked = false;
          dispatchFieldEvent(element, 'input');
          dispatchFieldEvent(element, 'change');
          changed = true;
        }
      });

      if (changed) {
        hpQsa(`.option-card[data-field="${fieldName}"]`).forEach((card) => {
          card.classList.remove('option-card--selected');
        });
        hpQsa(`.yes-no-card[data-field="${fieldName}"]`).forEach((card) => {
          card.classList.remove('yes-no-card--selected');
        });
      }
    }
  }

  function updateFieldEnabled(fieldName, enabled) {
    const elements = getFieldElements(fieldName);
    clearBlockedFieldState(fieldName, enabled, elements);

    // Nie ustawiamy już disabled - tylko klasy CSS dla wizualnej kontroli
    elements.forEach(el => {
      if (!el) return;
      if (enabled) {
        el.classList.remove('field-disabled');
      } else {
        el.classList.add('field-disabled');
      }
    });

    // Zablokuj cały kontener pola (żeby uniemożliwić klikanie etykiet, kart, itp.)
    const primary = getPrimaryElement(fieldName);
    if (primary && primary.closest) {
      const container =
        primary.closest('.form-field-item') ||
        primary.closest('.form-field__radio-group') ||
        primary.closest('.option-cards') ||
        primary.closest('.form-field');

      if (container) {
        if (enabled) {
          container.classList.remove('field-disabled');
        } else {
          container.classList.add('field-disabled');
        }
      }
    }

    // Dla pól z kartami Tak/Nie - blokuj również karty
    const yesNoCards = hpQsa(`.yes-no-card[data-field="${fieldName}"]`);
    yesNoCards.forEach(card => {
      if (enabled) {
        card.classList.remove('yes-no-card--disabled');
      } else {
        card.classList.add('yes-no-card--disabled');
      }
    });

    // Dla pól z option cards - blokuj również same karty
    const optionCards = hpQsa(`.option-card[data-field="${fieldName}"]`);
    optionCards.forEach(card => {
      if (enabled) {
        card.classList.remove('option-card--disabled');
      } else {
        card.classList.add('option-card--disabled');
      }
    });
  }

  function updateFieldRequired(fieldName, required) {
    const elements = getFieldElements(fieldName);
    elements.forEach(el => {
      if (!el) return;
      if (required) {
        el.setAttribute('required', 'required');
      } else {
        el.removeAttribute('required');
      }
    });
  }

  function updateNextButton(sectionId, isEnabled) {
    const sectionRule = formEngine.rules.sections.find(sec => sec.id === sectionId);
    if (!sectionRule || !sectionRule.nextButton) return;
    const button = hpQs(sectionRule.nextButton);
    if (!button) return;
    // Nie blokujemy kliknięcia na twardo. Użytkownik ma dostać Error Summary po kliknięciu.
    button.classList.toggle('progressive-disabled', !isEnabled);
    button.dataset.sectionValid = isEnabled ? 'true' : 'false';
    button.removeAttribute('aria-disabled');
    if (button.disabled) {
      button.disabled = false;
      button.removeAttribute('disabled');
    }
  }

  function updateLabelOutput(selector, text) {
    if (!selector) return;
    const element = hpQs(selector);
    if (!element || text === undefined || text === null) return;
    element.textContent = text;
  }

  // Batch updates dla render (optymalizacja wydajności)
  let pendingVisibilityUpdates = new Map();
  let pendingEnabledUpdates = new Map();
  let renderTimeout = null;

  function scheduleVisibilityUpdate(fieldName, visible) {
    pendingVisibilityUpdates.set(fieldName, visible);
    scheduleRender();
  }

  function scheduleEnabledUpdate(fieldName, enabled) {
    pendingEnabledUpdates.set(fieldName, enabled);
    scheduleRender();
  }

  function scheduleRender() {
    if (renderTimeout) {
      return; // Już zaplanowane
    }

    renderTimeout = window.requestAnimationFrame(() => {
      // Batch update wszystkich pól naraz
      pendingVisibilityUpdates.forEach((visible, fieldName) => {
        updateFieldVisibility(fieldName, visible);
      });
      pendingVisibilityUpdates.clear();

      pendingEnabledUpdates.forEach((enabled, fieldName) => {
        updateFieldEnabled(fieldName, enabled);
      });
      pendingEnabledUpdates.clear();

      renderTimeout = null;
    });
  }

  formEngine.render = {
    fieldVisibility(map) {
      // Użyj batch updates dla optymalizacji wydajności
      Object.entries(map).forEach(([fieldName, visible]) => {
        scheduleVisibilityUpdate(fieldName, visible);
      });
    },
    containerVisibility(map) {
      // Kontenery są renderowane bezpośrednio (rzadziej używane)
      Object.entries(map).forEach(([name, visible]) => updateContainerVisibility(name, visible));
    },
    fieldEnabled(map) {
      // Użyj batch updates dla optymalizacji wydajności
      Object.entries(map).forEach(([fieldName, enabled]) => {
        scheduleEnabledUpdate(fieldName, enabled);
      });
    },
    fieldRequired(map) {
      // Required jest renderowane bezpośrednio (rzadziej używane)
      Object.entries(map).forEach(([fieldName, required]) =>
        updateFieldRequired(fieldName, required)
      );
    },
    labels(map) {
      // Labels są renderowane bezpośrednio (rzadziej używane)
      Object.values(map).forEach(({ selector, text }) => updateLabelOutput(selector, text));
    },
    sectionButton(sectionId, enabled) {
      // Section buttons są renderowane bezpośrednio (rzadziej używane)
      updateNextButton(sectionId, enabled);
    },
  };
})(window);
