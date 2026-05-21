(function(window) {
  'use strict';

  const formEngine = window.formEngine || (window.formEngine = {});

  function computeFieldVisibility(state, rules) {
    // Walidacja danych wejściowych
    if (!rules || typeof rules !== 'object') {
      console.warn('visibility: rules is not an object', rules);
      return {};
    }
    if (!rules.fields || typeof rules.fields !== 'object') {
      console.warn('visibility: rules.fields is not an object', rules);
      return {};
    }

    const result = {};
    Object.entries(rules.fields).forEach(([name, config]) => {
      let visible = true;
      if (typeof config.visibleWhen === 'function') {
        try {
          visible = !!config.visibleWhen(state);
        } catch (error) {
          console.warn('visibility: error evaluating rule for', name, error);
        }
      }
      result[name] = visible;
    });
    return result;
  }

  function computeContainerVisibility(state, rules) {
    // Walidacja danych wejściowych
    if (!rules || typeof rules !== 'object') {
      console.warn('visibility: rules is not an object', rules);
      return {};
    }
    if (!rules.containers || typeof rules.containers !== 'object') {
      console.warn('visibility: rules.containers is not an object', rules);
      return {};
    }

    const result = {};
    Object.entries(rules.containers).forEach(([name, config]) => {
      let visible = true;
      if (typeof config.visibleWhen === 'function') {
        try {
          visible = !!config.visibleWhen(state);
        } catch (error) {
          console.warn('visibility: error evaluating container rule for', name, error);
        }
      }
      result[name] = visible;
    });
    return result;
  }

  formEngine.visibility = {
    fields(state) {
      const rules = formEngine.ensureRules ? formEngine.ensureRules() : formEngine.rules;
      if (!rules) return {};
      return computeFieldVisibility(state, rules);
    },
    containers(state) {
      const rules = formEngine.ensureRules ? formEngine.ensureRules() : formEngine.rules;
      if (!rules) return {};
      return computeContainerVisibility(state, rules);
    }
  };
})(window);