(function (window) {
  "use strict";

  const MotionSystem = {
    initialized: false,
    reduceMotion: false,
    reduceMedia: null,
    observer: null, // MutationObserver reference for cleanup
    reduceMediaHandler: null, // Media query listener reference for cleanup
    focusBinding: null, // Form focus handlers for cleanup
    actionButtonBindings: [], // Action button handlers for cleanup

    init() {
      if (this.initialized) return;
      this.reduceMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reduceMotion = this.reduceMedia.matches;

      // Store handler reference for cleanup
      this.reduceMediaHandler = (e) => {
        this.reduceMotion = e.matches;
      };

      if (this.reduceMedia.addEventListener) {
        this.reduceMedia.addEventListener("change", this.reduceMediaHandler);
      } else if (this.reduceMedia.addListener) {
        this.reduceMedia.addListener(this.reduceMediaHandler);
      }

      this.setupSteps();
      this.setupProgressBar();
      this.setupFormMicroInteractions(document);

      // Setup observers and options (called after DOM is ready)
      // This will be called from initMotion after DOM is ready
      if (document.readyState === "loading") {
        // Wait for DOM - will be handled by bootApp
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            this.observeOptionMutations();
            this.setupOptions(document);
            this.setupFormMicroInteractions(document);
          },
          { once: true }
        );
      } else {
        // DOM already loaded - use requestIdleCallback for better performance
        if (window.requestIdleCallback) {
          requestIdleCallback(
            () => {
              this.observeOptionMutations();
              this.setupOptions(document);
              this.setupFormMicroInteractions(document);
            },
            { timeout: 1000 }
          );
        } else {
          setTimeout(() => {
            this.observeOptionMutations();
            this.setupOptions(document);
            this.setupFormMicroInteractions(document);
          }, 100);
        }
      }

      this.initialized = true;
    },

    dispose() {
      // Cleanup: remove event listeners
      if (this.reduceMedia && this.reduceMediaHandler) {
        if (this.reduceMedia.removeEventListener) {
          this.reduceMedia.removeEventListener(
            "change",
            this.reduceMediaHandler
          );
        } else if (this.reduceMedia.removeListener) {
          this.reduceMedia.removeListener(this.reduceMediaHandler);
        }
        this.reduceMediaHandler = null;
      }

      // Disconnect MutationObserver
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.focusBinding) {
        const { form, onFocusIn, onFocusOut } = this.focusBinding;
        form.removeEventListener("focusin", onFocusIn, true);
        form.removeEventListener("focusout", onFocusOut, true);
        this.focusBinding = null;
      }

      if (Array.isArray(this.actionButtonBindings)) {
        this.actionButtonBindings.forEach((binding) => {
          const { el, onEnter, onLeave, onDown, onUp } = binding;
          if (!el || !el.removeEventListener) return;
          el.removeEventListener("pointerenter", onEnter);
          el.removeEventListener("pointerleave", onLeave);
          el.removeEventListener("pointerdown", onDown);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onUp);
          el.removeEventListener("blur", onLeave);
          el.removeEventListener("keydown", onDown);
          el.removeEventListener("keyup", onUp);
        });
      }
      this.actionButtonBindings = [];

      this.initialized = false;
    },

    getVar(el, name, fallback) {
      const scope = el || document.documentElement;
      const raw = window.getComputedStyle(scope).getPropertyValue(name).trim();
      if (!raw) return fallback;
      if (raw.endsWith("ms")) return parseFloat(raw);
      if (raw.endsWith("s")) return parseFloat(raw) * 1000;
      const numeric = parseFloat(raw);
      return Number.isNaN(numeric) ? fallback : numeric;
    },

    getEasing(el, name, fallback) {
      const scope = el || document.documentElement;
      const raw = window.getComputedStyle(scope).getPropertyValue(name).trim();
      return raw || fallback;
    },

    isMotionDisabled(el, feature) {
      const featureKey = feature ? String(feature).toLowerCase() : "";
      const globalSelector =
        '[data-motion="off"], .motion-disabled, [data-motion-disabled="true"]';
      if (el && el.closest && el.closest(globalSelector)) {
        return true;
      }
      if (!featureKey || !el || !el.closest) {
        return false;
      }
      const featureSelector = `[data-motion-${featureKey}="off"], .motion-disabled--${featureKey}`;
      return !!el.closest(featureSelector);
    },

    cancelAnimations(el) {
      if (!el || !el.getAnimations) return;
      el.getAnimations().forEach((anim) => anim.cancel());
    },

    animate(el, keyframes, options = {}) {
      if (!el || !el.animate) return null;
      const opts =
        options && typeof options === "object" ? { ...options } : {};
      const feature = opts.feature ? String(opts.feature) : "";
      if (this.isMotionDisabled(el, feature)) return null;

      const willChange = Object.prototype.hasOwnProperty.call(
        opts,
        "willChange"
      )
        ? opts.willChange
        : "transform, opacity";
      delete opts.feature;
      delete opts.willChange;

      const duration = this.reduceMotion
        ? 0
        : typeof opts.duration === "number"
          ? opts.duration
          : 0;
      opts.duration = duration;

      this.cancelAnimations(el);
      if (willChange) {
        el.style.willChange = willChange;
      }
      const anim = el.animate(keyframes, opts);
      if (anim) {
        const reset = () => {
          if (willChange) {
            el.style.willChange = "auto";
          }
        };
        anim.onfinish = reset;
        anim.oncancel = reset;
      }
      return anim;
    },

    animatePress(el, isDown) {
      const duration = this.getVar(
        el,
        isDown ? "--m-press" : "--m-release",
        isDown ? 80 : 120
      );
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      const from = isDown ? "scale(1)" : "scale(0.98)";
      const to = isDown ? "scale(0.98)" : "scale(1)";
      return this.animate(el, [{ transform: from }, { transform: to }], {
        duration,
        easing,
        fill: "both",
        feature: "cta",
      });
    },

    animateSelect(el) {
      if (!el) return;
      const check = el.querySelector(".ui-option__check");
      if (!check) return;
      const duration = this.getVar(el, "--m-snap", 160);
      const easing = this.getEasing(
        el,
        "--e-snap",
        "cubic-bezier(0.2, 0.9, 0.2, 1)"
      );
      this.animate(
        check,
        [
          { opacity: 0, transform: "translateY(-50%) scale(0.92)" },
          { opacity: 1, transform: "translateY(-50%) scale(1)" },
        ],
        { duration, easing, fill: "both", feature: "details" }
      );
    },

    animateScanline(el) {
      if (!el || el.classList.contains("has-scanline")) return;
      const scan = el.querySelector(".ui-option__scan");
      if (!scan) return;
      const duration = this.getVar(el, "--m-scan", 280);
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      this.cancelAnimations(scan);
      scan.style.opacity = "0";
      scan.style.transform = "translate(-100%, -50%)";
      const anim = this.animate(
        scan,
        [
          { opacity: 0, transform: "translate(-100%, -50%)" },
          { opacity: 0.55, transform: "translate(0%, -50%)" },
        ],
        { duration, easing, fill: "both", feature: "details" }
      );
      if (anim) {
        anim.onfinish = () => {
          scan.style.opacity = "0.2";
          scan.style.transform = "translate(0%, -50%)";
          el.classList.add("has-scanline");
        };
      } else {
        el.classList.add("has-scanline");
      }
    },

    animateStep(outEl, inEl, direction = 1) {
      if (!outEl || !inEl) return Promise.resolve();
      const duration = this.getVar(inEl, "--m-step", 200);
      const easing = this.getEasing(
        inEl,
        "--e-step",
        "cubic-bezier(0.2, 0, 0, 1)"
      );

      const outAnim = this.animate(
        outEl,
        [{ opacity: 1 }, { opacity: 0 }],
        { duration, easing, fill: "both", feature: "step" }
      );

      const inAnim = this.animate(
        inEl,
        [{ opacity: 0 }, { opacity: 1 }],
        { duration, easing, fill: "both", feature: "step" }
      );

      return Promise.all(
        [outAnim, inAnim]
          .filter(Boolean)
          .map((anim) => anim.finished.catch(() => null))
      );
    },

    animateReveal(el) {
      if (!el) return;
      const duration = this.getVar(el, "--m-reveal", 180);
      const easing = this.getEasing(
        el,
        "--e-reveal",
        "cubic-bezier(0.2, 0, 0, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both", feature: "details" }
      );
    },

    animateCrossfade(el) {
      if (!el) return;
      const duration = this.reduceMotion ? 0 : 160;
      const easing = this.getEasing(
        el,
        "--e-soft",
        "cubic-bezier(0.2, 0, 0, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both", feature: "details" }
      );
    },

    animateAttach(el) {
      if (!el) return;
      const duration = this.reduceMotion ? 0 : 160;
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateX(10px)" },
          { opacity: 1, transform: "translateX(0px)" },
        ],
        { duration, easing, fill: "both", feature: "details" }
      );
      el.classList.add("is-attaching");
      window.setTimeout(() => el.classList.remove("is-attaching"), 300);
    },

    animatePrice(el) {
      if (!el) return;
      const duration = this.reduceMotion ? 0 : 180;
      const easing = this.getEasing(
        el,
        "--e-soft",
        "cubic-bezier(0.2, 0, 0, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both", feature: "results" }
      );
    },

    animateProgress(fillEl, progressValue) {
      if (!fillEl) return;
      const duration = this.getVar(fillEl, "--m-progress", 300);
      const easing = this.getEasing(
        fillEl,
        "--e-standard",
        "cubic-bezier(0.2, 0, 0, 1)"
      );
      const target = Math.max(0, Math.min(1, progressValue));
      const currentWidth = Number.parseFloat(String(fillEl.style.width || "").replace("%", "")) || 0;
      const targetWidth = target * 100;
      this.animate(
        fillEl,
        [{ width: `${currentWidth}%` }, { width: `${targetWidth}%` }],
        {
          duration,
          easing,
          fill: "both",
          feature: "step",
          willChange: "width",
        }
      );
      fillEl.style.width = `${targetWidth}%`;
    },

    normalizeDetailsItems(items) {
      if (!Array.isArray(items)) return [];
      return items
        .map((item) => {
          if (!item) return null;
          if (item instanceof Element) {
            return { el: item, display: "" };
          }
          if (item.el instanceof Element) {
            return {
              el: item.el,
              display: typeof item.display === "string" ? item.display : "",
            };
          }
          return null;
        })
        .filter(Boolean);
    },

    applyDetailsDisplay(items, expanded) {
      items.forEach((item) => {
        if (!item || !item.el) return;
        if (expanded) {
          item.el.style.display = item.display || "";
        } else {
          item.el.style.display = "none";
        }
      });
    },

    animateDetailsToggle(section, items, expanded = true) {
      const normalized = this.normalizeDetailsItems(items);
      if (!normalized.length) return Promise.resolve();
      if (this.reduceMotion || this.isMotionDisabled(section || normalized[0].el, "details")) {
        this.applyDetailsDisplay(normalized, expanded);
        return Promise.resolve();
      }

      const refEl = section || normalized[0].el;
      const duration = this.getVar(refEl, "--m-details", 180);
      const easing = this.getEasing(
        refEl,
        "--e-standard",
        "cubic-bezier(0.2, 0, 0, 1)"
      );

      if (expanded) {
        this.applyDetailsDisplay(normalized, true);
      }

      const keyframes = expanded
        ? [
            { opacity: 0, transform: "translateY(-4px)" },
            { opacity: 1, transform: "translateY(0px)" },
          ]
        : [
            { opacity: 1, transform: "translateY(0px)" },
            { opacity: 0, transform: "translateY(-4px)" },
          ];

      const animations = normalized
        .map((item) =>
          this.animate(item.el, keyframes, {
            duration,
            easing,
            fill: "both",
            feature: "details",
          })
        )
        .filter(Boolean);

      const finalize = () => {
        if (!expanded) {
          this.applyDetailsDisplay(normalized, false);
        }
        normalized.forEach((item) => {
          item.el.style.removeProperty("opacity");
          item.el.style.removeProperty("transform");
        });
      };

      if (!animations.length) {
        finalize();
        return Promise.resolve();
      }

      return Promise.all(
        animations.map((anim) => anim.finished.catch(() => null))
      ).then(finalize, finalize);
    },

    setupSteps() {
      const form = hpById("heatCalcFormFull");
      if (form) {
        form.classList.add("ui-stepper");
        form
          .querySelectorAll(".section")
          .forEach((section) => section.classList.add("ui-step"));
      }
    },

    setupProgressBar() {
      const fill = hpById("top-progress-fill");
      if (fill && !fill.style.width) {
        fill.style.width = "12%";
      }
    },

    isFormControl(el) {
      return (
        !!el &&
        typeof el.matches === "function" &&
        el.matches("input:not([type='hidden']), select, textarea")
      );
    },

    isElementDisabled(el) {
      return (
        !el ||
        el.disabled === true ||
        el.getAttribute("aria-disabled") === "true" ||
        this.isDisabled(el)
      );
    },

    animateFieldFocus(field, isFocused) {
      if (!this.isFormControl(field)) return;
      const duration = this.getVar(field, "--m-form-focus", 180);
      const easing = this.getEasing(
        field,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      const focusGlow = "0 0 0 3px rgba(212, 165, 116, 0.24)";
      const baseGlow = "0 0 0 0 rgba(212, 165, 116, 0)";
      const from = isFocused
        ? { transform: "translateY(0px)", boxShadow: baseGlow }
        : { transform: "translateY(-1px)", boxShadow: focusGlow };
      const to = isFocused
        ? { transform: "translateY(-1px)", boxShadow: focusGlow }
        : { transform: "translateY(0px)", boxShadow: baseGlow };

      this.animate(field, [from, to], {
        duration,
        easing,
        fill: "both",
      });
    },

    animateValidationNudge(field) {
      if (!field) return;
      field.classList.add("field-error-highlight");
      if (!this.reduceMotion) {
        try {
          field.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (_) {}
      }
      window.setTimeout(() => {
        field.classList.remove("field-error-highlight");
      }, 600);
    },

    animateErrorSummary(summary) {
      if (!summary) return;
      const duration = this.getVar(summary, "--m-reveal", 220);
      const easing = this.getEasing(
        summary,
        "--e-standard",
        "cubic-bezier(0.2, 0.8, 0.2, 1)"
      );
      this.animate(
        summary,
        [
          { opacity: 0, transform: "translateY(-6px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both", feature: "error" }
      );
    },

    animateFieldHighlight(field) {
      if (!field) return;
      if (this.isMotionDisabled(field, "error")) return;
      field.classList.add("field-error-highlight");
      if (!this.reduceMotion) {
        try {
          field.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (_) {}
      }
      window.setTimeout(() => {
        field.classList.remove("field-error-highlight");
      }, 600);
    },

    animateAutosaveStatus(el) {
      if (!el || this.isMotionDisabled(el, "autosave")) return;
      const duration = this.getVar(el, "--m-autosave", 160);
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0, 0, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(4px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        {
          duration,
          easing,
          fill: "both",
          feature: "autosave",
        }
      );
    },

    animateResultsHeader(el) {
      if (!el || this.isMotionDisabled(el, "results")) return;
      const duration = this.getVar(el, "--m-results", 200);
      const easing = this.getEasing(
        el,
        "--e-reveal",
        "cubic-bezier(0.2, 0, 0, 1)"
      );
      this.animate(
        el,
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both", feature: "results" }
      );
    },

    animateCtaState(el, state = "loading") {
      if (!el || this.isMotionDisabled(el, "cta")) return;
      const duration = this.getVar(el, "--m-cta", 160);
      const easing = this.getEasing(
        el,
        "--e-standard",
        "cubic-bezier(0.2, 0, 0, 1)"
      );
      if (state === "success") {
        this.animate(
          el,
          [
            { opacity: 0.96, transform: "translateY(0px)" },
            { opacity: 1, transform: "translateY(0px)" },
          ],
          { duration, easing, fill: "both", feature: "cta" }
        );
        return;
      }
      this.animate(
        el,
        [
          { opacity: 1, transform: "translateY(0px)" },
          { opacity: 0.92, transform: "translateY(0px)" },
          { opacity: 1, transform: "translateY(0px)" },
        ],
        { duration, easing, fill: "both", feature: "cta" }
      );
    },

    enhanceActionButton(el) {
      if (!el || el.dataset.motionActionBound === "1") return;
      el.dataset.motionActionBound = "1";

      const onEnter = () => {
        if (this.isElementDisabled(el)) return;
        this.animate(
          el,
          [{ transform: "translateY(0px)" }, { transform: "translateY(-1px)" }],
          {
            duration: this.getVar(el, "--m-release", 140),
            easing: this.getEasing(
              el,
              "--e-standard",
              "cubic-bezier(0.2, 0.8, 0.2, 1)"
            ),
            fill: "both",
          }
        );
      };

      const onLeave = () => {
        this.animate(
          el,
          [{ transform: "translateY(-1px)" }, { transform: "translateY(0px)" }],
          {
            duration: this.getVar(el, "--m-release", 140),
            easing: this.getEasing(
              el,
              "--e-standard",
              "cubic-bezier(0.2, 0.8, 0.2, 1)"
            ),
            fill: "both",
          }
        );
      };

      const onDown = (event) => {
        if (this.isElementDisabled(el)) return;
        if (event && event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
          return;
        }
        this.animatePress(el, true);
      };

      const onUp = (event) => {
        if (event && event.type === "keyup" && event.key !== "Enter" && event.key !== " ") {
          return;
        }
        this.animatePress(el, false);
      };

      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      el.addEventListener("blur", onLeave);
      el.addEventListener("keydown", onDown);
      el.addEventListener("keyup", onUp);

      this.actionButtonBindings.push({ el, onEnter, onLeave, onDown, onUp });
    },

    setupActionButtons(root) {
      const scope = root || document;
      if (!scope || !scope.querySelectorAll) return;
      const buttons = scope.querySelectorAll(
        "button.btn-next, button.btn-prev, button.btn-finish, button.workflow-cta-button, button.results-summary-header__cta"
      );
      buttons.forEach((button) => this.enhanceActionButton(button));
    },

    setupFormMicroInteractions(root) {
      const scope = root || document;
      const form =
        (scope && scope.querySelector && scope.querySelector("#heatCalcFormFull")) ||
        hpById("heatCalcFormFull");

      this.setupActionButtons(scope);
      if (scope && scope.querySelectorAll) {
        scope.querySelectorAll('input[type="number"]').forEach((input) => {
          if (!input.getAttribute("inputmode")) {
            input.setAttribute("inputmode", "numeric");
          }
        });
      }

      if (!form || this.focusBinding) return;

      const onFocusIn = (event) => {
        const target = event.target;
        if (!this.isFormControl(target) || this.isElementDisabled(target)) return;
        this.animateFieldFocus(target, true);
      };

      const onFocusOut = (event) => {
        const target = event.target;
        if (!this.isFormControl(target)) return;
        this.animateFieldFocus(target, false);
      };

      form.addEventListener("focusin", onFocusIn, true);
      form.addEventListener("focusout", onFocusOut, true);
      this.focusBinding = { form, onFocusIn, onFocusOut };
    },

    isSelected(el) {
      return (
        el.classList.contains("option-card--selected") ||
        el.classList.contains("selected") ||
        el.classList.contains("yes-no-card--selected")
      );
    },

    isDisabled(el) {
      return (
        el.classList.contains("option-card--disabled") ||
        el.classList.contains("yes-no-card--disabled") ||
        el.classList.contains("disabled")
      );
    },

    ensureOptionDecorations(el) {
      const isProductCard = el.classList.contains("product-card");
      if (!isProductCard && !el.querySelector(".ui-option__check")) {
        const check = document.createElement("span");
        check.className = "ui-option__check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = "\u2713";
        el.appendChild(check);
      }
      if (!el.querySelector(".ui-option__scan")) {
        const scan = document.createElement("span");
        scan.className = "ui-option__scan";
        scan.setAttribute("aria-hidden", "true");
        el.appendChild(scan);
      }
    },

    syncOptionAria(el) {
      if (!el) return;
      const group = el.closest('[role="radiogroup"]');
      if (group) {
        this.syncGroupAria(group);
      } else {
        el.setAttribute("aria-pressed", this.isSelected(el) ? "true" : "false");
      }
    },

    syncGroupAria(group) {
      if (!group) return;
      const options = group.querySelectorAll(".ui-option");
      options.forEach((option) => {
        const selected = this.isSelected(option);
        option.setAttribute("role", "radio");
        option.setAttribute("aria-checked", selected ? "true" : "false");
      });
    },

    enhanceOption(el) {
      if (!el) return;
      if (!el.classList.contains("ui-option")) {
        el.classList.add("ui-option");
      }
      if (el.dataset.motionBound === "1") return;
      el.dataset.motionBound = "1";
      if (el.tagName === "BUTTON" && !el.type) {
        el.type = "button";
      }
      this.ensureOptionDecorations(el);
      el.classList.toggle("is-selected", this.isSelected(el));
      el.classList.toggle("is-disabled", this.isDisabled(el));
      this.syncOptionAria(el);

      const pressDown = () => {
        if (this.isDisabled(el)) return;
        el.classList.add("is-pressing");
        this.animatePress(el, true);
      };
      const pressUp = () => {
        el.classList.remove("is-pressing");
        this.animatePress(el, false);
      };

      el.addEventListener("pointerdown", pressDown);
      el.addEventListener("pointerup", pressUp);
      el.addEventListener("pointercancel", pressUp);
      el.addEventListener("pointerleave", pressUp);
    },

    setupOptions(root) {
      const scope = root || document;
      const options = scope.querySelectorAll(
        "button.option-card, button.yes-no-card, button.product-card"
      );
      options.forEach((el) => this.enhanceOption(el));

      scope
        .querySelectorAll(
          ".option-cards, .options-grid, .cwu-cards, .yes-no-cards"
        )
        .forEach((group) => {
          if (!group.hasAttribute("role")) {
            group.setAttribute("role", "radiogroup");
          }
          this.syncGroupAria(group);
        });
    },

    observeOptionMutations() {
      // OPTIMIZATION: Połączone obserwatory + debounce dla lepszej wydajności
      let mutationTimeout = null;
      const pendingMutations = new Set();
      const pendingInvalidFields = new Set();
      const pendingErrorSummaries = new Set();
      const pendingActionButtons = new Set();

      const observer = new MutationObserver((mutations) => {
        // Debounce: zbierz wszystkie mutacje i przetwórz razem
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class" &&
            mutation.target
          ) {
            const el = mutation.target;
            if (el.classList && el.classList.contains("ui-option")) {
              pendingMutations.add(el);
            }
            if (el.matches && el.matches("input, select, textarea")) {
              pendingInvalidFields.add(el);
            }
            if (el.classList && el.classList.contains("ux-error-summary")) {
              pendingErrorSummaries.add(el);
            }
          } else if (mutation.type === "childList") {
            // Obsługa nowych elementów
            mutation.addedNodes.forEach((node) => {
              if (!(node instanceof Element)) return;
              if (
                node.matches &&
                node.matches(
                  "button.option-card, button.yes-no-card, button.product-card"
                )
              ) {
                pendingMutations.add(node);
              } else if (node.querySelectorAll) {
                const newOptions = node.querySelectorAll(
                  "button.option-card, button.yes-no-card, button.product-card"
                );
                newOptions.forEach((opt) => pendingMutations.add(opt));
              }

              if (
                node.matches &&
                node.matches(
                  "button.btn-next, button.btn-prev, button.btn-finish, button.workflow-cta-button, button.results-summary-header__cta"
                )
              ) {
                pendingActionButtons.add(node);
              } else if (node.querySelectorAll) {
                const newButtons = node.querySelectorAll(
                  "button.btn-next, button.btn-prev, button.btn-finish, button.workflow-cta-button, button.results-summary-header__cta"
                );
                newButtons.forEach((button) => pendingActionButtons.add(button));
              }

              if (node.classList && node.classList.contains("ux-error-summary")) {
                pendingErrorSummaries.add(node);
              } else if (node.querySelectorAll) {
                const summaries = node.querySelectorAll(".ux-error-summary");
                summaries.forEach((summary) => pendingErrorSummaries.add(summary));
              }

              if (node.matches && node.matches("input, select, textarea")) {
                pendingInvalidFields.add(node);
              } else if (node.querySelectorAll) {
                const fields = node.querySelectorAll("input, select, textarea");
                fields.forEach((field) => pendingInvalidFields.add(field));
              }
            });
          }
        });

        // Debounce: przetwórz mutacje w jednej ramce animacji
        if (mutationTimeout) cancelAnimationFrame(mutationTimeout);
        mutationTimeout = requestAnimationFrame(() => {
          pendingMutations.forEach((el) => {
            if (!el.isConnected) {
              pendingMutations.delete(el);
              return;
            }

            // Obsługa zmian klas (stary kod)
            if (el.classList && el.classList.contains("ui-option")) {
              const wasSelected = this.isSelected(el);
              el.classList.toggle("is-selected", wasSelected);
              el.classList.toggle("is-disabled", this.isDisabled(el));
              this.syncOptionAria(el);
            }

            // Obsługa nowych elementów
            if (
              el.matches &&
              el.matches(
                "button.option-card, button.yes-no-card, button.product-card"
              )
            ) {
              if (!el.classList.contains("ui-option")) {
                this.enhanceOption(el);
              }
            }
          });

          pendingActionButtons.forEach((button) => {
            if (!button.isConnected) return;
            this.enhanceActionButton(button);
          });

          // Obsługa animacji tylko dla zmian selected
          pendingMutations.forEach((el) => {
            if (!el.classList || !el.classList.contains("ui-option")) return;
            const isSelectedNow = this.isSelected(el);
            const wasSelected = el.dataset._wasSelected === "true";

            if (isSelectedNow && !wasSelected) {
              this.animateSelect(el);
              this.animateScanline(el);
              const content = el.querySelector(
                ".product-content, .specs-list, .option-content"
              );
              if (content) {
                this.animateCrossfade(content);
              }
            } else if (!isSelectedNow && wasSelected) {
              el.classList.remove("has-scanline");
              const scan = el.querySelector(".ui-option__scan");
              if (scan) {
                scan.style.opacity = "0";
              }
            }

            el.dataset._wasSelected = isSelectedNow ? "true" : "false";
          });

          pendingInvalidFields.forEach((field) => {
            if (!field.isConnected) return;
            const isInvalidNow =
              field.classList && field.classList.contains("field-invalid");
            const wasInvalid = field.dataset._wasInvalid === "true";
            if (isInvalidNow && !wasInvalid) {
              this.animateValidationNudge(field);
            }
            field.dataset._wasInvalid = isInvalidNow ? "true" : "false";
          });

          pendingErrorSummaries.forEach((summary) => {
            if (!summary.isConnected) return;
            if (summary.dataset.motionErrorAnimated === "1") return;
            summary.dataset.motionErrorAnimated = "1";
            this.animateErrorSummary(summary);
          });

          pendingMutations.clear();
          pendingInvalidFields.clear();
          pendingErrorSummaries.clear();
          pendingActionButtons.clear();
        });
      });

      const targets = [];
      const calcRoot = hpById("heatCalcFormFull");
      const configRoot = hpById("configurator-app");
      if (calcRoot) targets.push(calcRoot);
      if (configRoot) targets.push(configRoot);
      if (!targets.length) targets.push(document.body);

      // Store observer reference for cleanup
      this.observer = observer;

      // OPTIMIZATION: Jeden observer zamiast dwóch
      targets.forEach((target) =>
        observer.observe(target, {
          subtree: true,
          attributes: true,
          attributeFilter: ["class"],
          childList: true, // Dodane: obsługa nowych elementów
        })
      );
    },

  };

  /**
   * Symuluje animację AI podczas przejść między zakładkami
   *
   * @param {number} tabIndex - Indeks aktualnej zakładki
   * @param {Array} steps - Tablica kroków animacji [{ text: string, delay: number }]
   * @param {Function} callback - Funkcja wywoływana po zakończeniu animacji
   */
  function simulateAIAnalysis(tabIndex, steps, callback) {
    console.log(
      `[MotionSystem] 🤖 Rozpoczęcie analizy AI dla zakładki ${tabIndex}`
    );

    let currentStep = 0;
    const progressElement = document.createElement("div");
    progressElement.className = "ai-analysis-overlay";
    progressElement.innerHTML = `
      <div class="ai-analysis-content">
        <div class="ai-spinner"></div>
        <h3 style="font-size: 12px;">TOP-AI ANALIZUJE DANE</h3>
        <p id="ai-step-text">${steps[0]?.text || "Przygotowuję analizę..."}</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `;

    // Dodaj style CSS jeśli nie istnieją
    if (!document.querySelector("#ai-analysis-styles")) {
      const style = document.createElement("style");
      style.id = "ai-analysis-styles";
      style.textContent = `
        .ai-analysis-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          /* UJEDNOLICONE: Używamy koloru tła aplikacji (#faf9f9) zamiast czarnego tła */
          background: rgba(250, 249, 249, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(5px);
        }
        .ai-analysis-content {
          background: white;
          /* UJEDNOLICONE: border-radius z CSS (--radius-md: 4px zamiast 16px) */
          border-radius: 4px;
          padding: 40px;
          text-align: center;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .ai-spinner {
          width: 60px;
          height: 60px;
          /* UJEDNOLICONE: Używamy złotego koloru (#d4a574) zamiast zielonego */
          border: 4px solid rgba(212, 165, 116, 0.2);
          border-top: 4px solid #d4a574;
          border-radius: 50%;
          animation: spin 2s linear infinite;
          margin: 0 auto 20px;
        }
        .progress-bar {
          width: 100%;
          height: 8px;
          /* UJEDNOLICONE: Używamy złotego koloru (#d4a574) zamiast zielonego */
          background: rgba(212, 165, 116, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 20px;
        }
        .progress-fill {
          height: 100%;
          /* UJEDNOLICONE: Używamy złotego gradientu (#d4a574, #b8976a) zamiast zielonego */
          background: linear-gradient(90deg, #d4a574, #b8976a);
          border-radius: 4px;
          transition: width 0.5s ease-in-out;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(progressElement);

    function nextStep() {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        const stepText = document.getElementById("ai-step-text");
        const progressFill = progressElement.querySelector(".progress-fill");

        if (stepText) stepText.textContent = step.text;
        if (progressFill) {
          const progress = ((currentStep + 1) / steps.length) * 100;
          progressFill.style.width = `${progress}%`;
        }

        currentStep++;
        // Skrócony czas: 33% oryginalnego (3x szybsze)
        setTimeout(nextStep, Math.round((step.delay || 1000) / 3));
      } else {
        // Skrócony czas zakończenia: 33% oryginalnego
        setTimeout(() => {
          progressElement.remove();
          if (callback) callback();
        }, Math.round(500 / 3));
      }
    }

    nextStep();
  }

  // Eksportuj funkcję
  window.simulateAIAnalysis = simulateAIAnalysis;

  window.MotionSystem = MotionSystem;

  // Export init function for bootApp (no auto-init)
  // Auto-init removed - must be called from bootApp

  // Export init function
  if (typeof window !== "undefined") {
    window.__initMotion = function initMotion(ctx) {
      MotionSystem.init();
      return function disposeMotion() {
        if (
          MotionSystem.dispose &&
          typeof MotionSystem.dispose === "function"
        ) {
          MotionSystem.dispose();
        }
      };
    };
  }
})(window);
