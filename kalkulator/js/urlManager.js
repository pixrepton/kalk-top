// === FILE: urlManager.js ===
// 🧠 Obsługuje: URL parameters, kopiowanie konfiguracji, sessionStorage/localStorage persistence (pref)

(function () {
  "use strict";

  /**
   * Sanityzuje wartość parametru URL
   */
  function sanitizeURLParam(value, type = "string") {
    if (!value) return "";

    // Podstawowa sanityzacja
    const sanitized = String(value).trim();

    // Usuń potencjalnie niebezpieczne znaki
    const cleanValue = sanitized.replace(/[<>\"'&]/g, "");

    switch (type) {
      case "number":
        const num = parseFloat(cleanValue);
        return isNaN(num) ? "" : num.toString();
      case "integer":
        const int = parseInt(cleanValue);
        return isNaN(int) ? "" : int.toString();
      case "boolean":
        return ["true", "1", "on", "yes"].includes(cleanValue.toLowerCase())
          ? "true"
          : "false";
      default:
        return cleanValue.substring(0, 200); // Limit długości
    }
  }

  /**
   * Waliduje czy parametr jest dozwolony
   */
  function isAllowedParam(key) {
    const allowedParams = [
      "building_type",
      "construction_year",
      "construction_type",
      "location_id",
      "building_shape",
      "regular_method",
      "building_length",
      "building_width",
      "floor_area",
      "floor_area_irregular",
      "floor_perimeter",
      "building_floors",
      "floor_height",
      "building_roof",
      "has_basement",
      "has_balcony",
      "garage_type",
      "wall_size",
      "primary_wall_material",
      "secondary_wall_material",
      "has_secondary_wall_material",
      "has_external_isolation",
      "top_isolation",
      "bottom_isolation",
      "windows_type",
      "number_windows",
      "number_huge_windows",
      "doors_type",
      "number_doors",
      "number_balcony_doors",
      "indoor_temperature",
      "ventilation_type",
      "includeHotWater",
      "hot_water_persons",
      "hot_water_usage",
      // UPROSZCZONY TRYB DLA SINGLE_HOUSE
      "detailed_insulation_mode",
      "walls_insulation_level",
      "roof_insulation_level",
      "floor_insulation_level",
    ];

    return (
      allowedParams.includes(key) || key.includes("building_heated_floors")
    );
  }

  const TopInstalCalculator = {
    // Wypełnia formularz na podstawie parametrów URL z walidacją
    fillFormFromURLParams() {
      try {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.size === 0) {
          return;
        }

        let filledFields = 0;
        const errors = [];

        for (const [key, value] of urlParams) {
          // Sprawdź czy parametr jest dozwolony
          if (!isAllowedParam(key)) {
            errors.push(`Niedozwolony parametr: ${key}`);
            continue;
          }

          const element = hpQs(`[name="${key}"]`);
          if (!element) {
            console.warn(`Nie znaleziono pola: ${key}`);
            continue;
          }

          try {
            // Sanityzuj wartość
            let sanitizedValue;

            if (element.type === "checkbox") {
              sanitizedValue = sanitizeURLParam(value, "boolean");
              element.checked = sanitizedValue === "true";
            } else if (element.type === "radio") {
              sanitizedValue = sanitizeURLParam(value);
              const radioButton = hpQs(
                `[name="${key}"][value="${sanitizedValue}"]`
              );
              if (radioButton) {
                radioButton.checked = true;
              } else {
                errors.push(`Nieprawidłowa wartość radio dla ${key}: ${value}`);
                continue;
              }
            } else if (element.type === "number") {
              sanitizedValue = sanitizeURLParam(value, "number");
              if (sanitizedValue) {
                element.value = sanitizedValue;
              }
            } else {
              sanitizedValue = sanitizeURLParam(value);
              // Skip empty values to prevent undefined/null issues (especially for building_type)
              if (sanitizedValue && sanitizedValue.trim() !== "") {
                element.value = sanitizedValue;
              } else {
                // Skip empty values
                continue;
              }
            }

            // Trigger change event dla dynamic fields
            try {
              element.dispatchEvent(new Event("change", { bubbles: true }));
              filledFields++;
            } catch (eventError) {
              console.warn(`Błąd wyzwolenia eventu dla ${key}:`, eventError);
            }
          } catch (fieldError) {
            errors.push(
              `Błąd przetwarzania pola ${key}: ${fieldError.message}`
            );
          }
        }

        if (errors.length > 0) {
          console.warn("Błędy wypełniania formularza z URL:", errors);
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // SYNCHRONIZACJA Z APPSTATE — URL params nadpisują appState
        // ═══════════════════════════════════════════════════════════════════════════
        if (typeof window.updateAppState === "function" && filledFields > 0) {
          // Zbierz wszystkie wypełnione wartości z DOM
          const formData = {};
          for (const [key, value] of urlParams) {
            if (isAllowedParam(key)) {
              const element = hpQs(`[name="${key}"]`);
              if (element) {
                if (element.type === "checkbox") {
                  formData[key] = element.checked;
                } else if (element.type === "radio") {
                  const checked = hpQs(`[name="${key}"]:checked`);
                  // Skip null values to prevent undefined/null issues
                  if (checked && checked.value) {
                    formData[key] = checked.value;
                  }
                } else {
                  // Skip empty values to prevent undefined/null issues (especially for building_type)
                  if (element.value && element.value.trim() !== "") {
                    formData[key] = element.value;
                  }
                }
              }
            }
          }
          // Zaktualizuj appState (nadpisze istniejące wartości)
          if (Object.keys(formData).length > 0) {
            const currentState = window.getAppState();
            window.updateAppState({
              formData: { ...currentState.formData, ...formData },
            });
          }
        }

        // Trigger rerender dla dynamicznych elementów
        setTimeout(() => {
          if (typeof window.renderHeatedFloors === "function") {
            window.renderHeatedFloors();
          }
        }, 100);
      } catch (error) {
        console.error("❌ Błąd wypełniania formularza z URL:", error);
      }
    },

    // Generuje URL z parametrami formularza z walidacją
    generateURLWithParams() {
      try {
        const form = hpById("heatCalcFormFull");
        if (!form) {
          console.warn("Nie znaleziono formularza - zwracam bieżący URL");
          return window.location.href;
        }

        const formData = new FormData(form);
        const params = new URLSearchParams();
        let addedParams = 0;

        for (const [key, value] of formData) {
          // Sprawdź czy parametr jest dozwolony
          if (!isAllowedParam(key)) {
            console.warn(`Pominięto niedozwolony parametr: ${key}`);
            continue;
          }

          // Sanityzuj i dodaj tylko niepuste wartości
          const sanitizedValue = sanitizeURLParam(value);
          if (sanitizedValue && sanitizedValue.trim() !== "") {
            params.append(key, sanitizedValue);
            addedParams++;
          }
        }

        const finalURL = `${window.location.origin}${
          window.location.pathname
        }?${params.toString()}`;

        return finalURL;
      } catch (error) {
        console.error("❌ Błąd generowania URL:", error);
        return window.location.href;
      }
    },

    // Kopiuje URL konfiguracji do schowka z obsługą błędów
    copyConfigURL() {
      try {
        const url = this.generateURLWithParams();

        if (url === window.location.href) {
          ErrorHandler.showToast(
            "Najpierw wypełnij formularz, aby wygenerować link",
            "warning"
          );
          return;
        }

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard
            .writeText(url)
            .then(() => {
              this.showCopySuccessMessage();
            })
            .catch((error) => {
              console.warn("Clipboard API failed:", error);
              this.fallbackCopyToClipboard(url);
            });
        } else {
          this.fallbackCopyToClipboard(url);
        }
      } catch (error) {
        console.error("❌ Błąd kopiowania URL:", error);
        ErrorHandler.showToast(
          "Wystąpił błąd podczas kopiowania linku",
          "error"
        );
      }
    },

    // Fallback kopiowania dla starszych przeglądarek
    fallbackCopyToClipboard(text) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.cssText =
          "position: fixed; top: -9999px; left: -9999px; opacity: 0;";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (successful) {
          this.showCopySuccessMessage();
        } else {
          this.showCopyFailureMessage(text);
        }
      } catch (err) {
        console.error("Fallback copy failed:", err);
        this.showCopyFailureMessage(text);
      }
    },

    // Wyświetla komunikat sukcesu kopiowania
    showCopySuccessMessage() {
      if (typeof window.showNotification === "function") {
        window.showNotification(
          "✅ Link do konfiguracji został skopiowany!",
          "success"
        );
      } else {
        ErrorHandler.showToast(
          "Link do konfiguracji został skopiowany",
          "success"
        );
      }
    },

    // Wyświetla komunikat błędu kopiowania
    showCopyFailureMessage(url) {
      const message = `❌ Nie udało się skopiować automatycznie.\n\nSkopiuj poniższy link ręcznie:\n${url}`;

      if (confirm(`${message}\n\nKliknij OK aby zobaczyć link w konsoli.`)) {
      }
    },
  };

  /**
   * Obsługa powrotu z konfiguratora z walidacją i error handling
   */
  function handleBackFromConfigurator() {
    try {
      const backData = sessionStorage.getItem("back_to_calc_data");
      if (!backData) {
        return;
      }

      const d = JSON.parse(backData);

      // Bezpieczna funkcja ustawiania pól z walidacją
      const setField = (name, value) => {
        try {
          const el = hpQs(`[name="${name}"]`);
          if (el && value !== undefined && value !== null) {
            const sanitizedValue = sanitizeURLParam(String(value));
            el.value = sanitizedValue;

            // Wywołaj event change
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } catch (error) {
          console.warn(`Błąd ustawiania pola ${name}:`, error);
        }
      };

      // Bezpieczna funkcja ustawiania checkboxów
      const setCheckbox = (name, checked) => {
        try {
          const checkbox = hpQs(`[name="${name}"]`);
          if (checkbox) {
            checkbox.checked = Boolean(checked);
            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } catch (error) {
          console.warn(`Błąd ustawiania checkbox ${name}:`, error);
        }
      };

      // Przywróć podstawowe pola
      setField("construction_year", d.construction_year);
      setField("heating_type", d.installation_type);
      setField("hot_water_persons", d.hot_water_persons);
      setField("hot_water_usage", d.hot_water_usage);
      setField("heated_area", d.heated_area);
      setField("r-max-power", d.max_heating_power);
      setField("r-bi-power", d.bivalent_power);
      setField("r-cwu", d.hot_water_power);

      // Przywróć checkboxy
      setCheckbox("includeHotWater", d.include_hot_water);
      setCheckbox("has_pv", d.solar_panels);
      setCheckbox("has_solar", d.solar_collectors);
      setCheckbox("has_basement", d.has_basement);

      // Przywróć selecty
      const floorsSelect = hpQs('[name="building_floors"]');
      const roofSelect = hpQs('[name="building_roof"]');

      if (floorsSelect && d.building_floors) {
        floorsSelect.value = d.building_floors;
        floorsSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (roofSelect && d.building_roof) {
        roofSelect.value = d.building_roof;
        roofSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Przywróć ogrzewane kondygnacje z opóźnieniem
      setTimeout(() => {
        try {
          if (typeof window.renderHeatedFloors === "function") {
            window.renderHeatedFloors();
          }

          // Po re-renderze kondygnacji, przywróć zaznaczenia
          setTimeout(() => {
            if (Array.isArray(d.building_heated_floors)) {
              d.building_heated_floors.forEach((val) => {
                const cb = hpQs(
                  `input[name="building_heated_floors[]"][value="${val}"]`
                );
                if (cb) {
                  cb.checked = true;
                  cb.dispatchEvent(new Event("change", { bubbles: true }));
                }
              });
            }
          }, 300);
        } catch (floorError) {
          console.error("Błąd przywracania kondygnacji:", floorError);
        }
      }, 100);

      // Przejdź do wyników jeśli wymagane
      if (d.go_to_results) {
        setTimeout(() => {
          try {
            if (typeof window.showTab === "function") {
              window.showTab(5); // Index 5 (zakładki są 0-5)
            }

            if (typeof window.activateTooltips === "function") {
              window.activateTooltips();
            }
          } catch (navigationError) {
            console.error("Błąd nawigacji do wyników:", navigationError);
          }
        }, 500);
      }

      // Usuń dane po udanym przywróceniu
      sessionStorage.removeItem("back_to_calc_data");
    } catch (error) {
      console.error(
        "❌ Błąd podczas przywracania danych z konfiguratora:",
        error
      );

      // Wyczyść uszkodzone dane
      sessionStorage.removeItem("back_to_calc_data");

      // Powiadom użytkownika o błędzie
      if (typeof window.showNotification === "function") {
        window.showNotification(
          "Wystąpił błąd podczas przywracania konfiguracji",
          "error"
        );
      }
    }
  }

  // Global exports
  window.TopInstalCalculator = TopInstalCalculator;
  window.handleBackFromConfigurator = handleBackFromConfigurator;
  window.sanitizeURLParam = sanitizeURLParam;
  window.isAllowedParam = isAllowedParam;
})();
