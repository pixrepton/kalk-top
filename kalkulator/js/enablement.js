(function(window) {
  'use strict';

  const formEngine = window.formEngine || (window.formEngine = {});

  function computeEnabled(state, rules) {
    // Walidacja danych wejściowych
    if (!rules || typeof rules !== 'object') {
      console.warn('enablement: rules is not an object', rules);
      return {};
    }
    if (!rules.fields || typeof rules.fields !== 'object') {
      console.warn('enablement: rules.fields is not an object', rules);
      return {};
    }

    const result = {};
    Object.entries(rules.fields).forEach(([name, config]) => {
      let enabled = true;
      if (typeof config.enabledWhen === 'function') {
        try {
          enabled = !!config.enabledWhen(state);
        } catch (error) {
          console.warn('enablement: error evaluating rule for', name, error);
        }
      }
      result[name] = enabled;
    });
    return result;
  }

  function computeRequired(state, rules) {
    const result = {};
    Object.entries(rules.fields).forEach(([name, config]) => {
      let required = false;
      if (typeof config.requiredWhen === 'function') {
        try {
          required = !!config.requiredWhen(state);
        } catch (error) {
          console.warn('required: error evaluating rule for', name, error);
        }
      } else if (config.required) {
        required = true;
      }
      result[name] = required;
    });
    return result;
  }

  formEngine.enablement = {
    fields(state) {
      const rules = formEngine.ensureRules ? formEngine.ensureRules() : formEngine.rules;
      if (!rules) return {};
      return computeEnabled(state, rules);
    },
    required(state) {
      const rules = formEngine.ensureRules ? formEngine.ensureRules() : formEngine.rules;
      if (!rules) return {};
      return computeRequired(state, rules);
    }
  };
})(window);