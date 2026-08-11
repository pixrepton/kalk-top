(function (window) {
  "use strict";

  /**
   * Choice insights + help-box progressive disclosure (presentation only).
   * Insights are fixed product-knowledge copy keyed by known field/value pairs.
   */
  const INSIGHTS = {
    heating_type: {
      underfloor:
        "Niska temperatura zasilania sprzyja wysokiej sprawności pompy ciepła.",
      radiators:
        "Wyższa temperatura zasilania może obniżyć sezonową sprawność pompy.",
      mixed:
        "Układ mieszany wymaga kompromisu temperatury zasilania między strefami.",
    },
    ventilation_type: {
      natural:
        "Wentylacja grawitacyjna zwiększa straty powietrza w modelu budynku.",
      mechanical:
        "Model uwzględni straty wentylacyjne bez odzysku ciepła.",
      mechanical_recovery:
        "Model uwzględni ograniczone straty wentylacyjne dzięki odzyskowi ciepła.",
    },
    building_shape: {
      regular:
        "Prosta bryła ogranicza powierzchnię przegród zewnętrznych względem objętości.",
      irregular:
        "Większa powierzchnia przegród może zwiększyć straty ciepła.",
    },
  };

  function ensureInsightEl(anchor) {
    if (!anchor || !anchor.parentElement) return null;
    let el = anchor.parentElement.querySelector(":scope > .choice-insight");
    if (!el) {
      el = document.createElement("p");
      el.className = "choice-insight";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      anchor.parentElement.appendChild(el);
    }
    return el;
  }

  function resolveInsight(field, value) {
    const map = INSIGHTS[field];
    if (!map) return "";
    return map[String(value)] || "";
  }

  function showInsightForField(root, field, value) {
    const cards = root.querySelector(
      `.option-cards:has([data-field="${field}"]), .option-cards`
    );
    // Prefer the option-cards group that contains this field
    const group =
      root.querySelector(`.option-cards [data-field="${field}"]`)?.closest(
        ".option-cards"
      ) || null;
    const anchor = group || cards;
    const text = resolveInsight(field, value);
    if (!anchor || !text) return;
    const el = ensureInsightEl(anchor);
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
  }

  function enhanceHelpBoxes(root) {
    const boxes = Array.from(root.querySelectorAll(".help-box"));
    boxes.forEach((box) => {
      if (box.dataset.helpEnhanced === "1") return;
      box.dataset.helpEnhanced = "1";

      // Broken assets are an automatic visual FAIL — hide and mark.
      box.querySelectorAll("img").forEach((img) => {
        const markBroken = () => {
          img.setAttribute("data-broken", "1");
          img.hidden = true;
          img.style.display = "none";
        };
        img.addEventListener("error", markBroken);
        if (img.complete && img.naturalWidth === 0) markBroken();
      });

      const heading = box.querySelector("h4");
      if (heading && !heading.textContent.trim()) return;

      // Collect body paragraphs (skip h4)
      const bodyNodes = Array.from(box.children).filter(
        (node) => node !== heading && node.tagName !== "BUTTON"
      );
      if (bodyNodes.length === 0) return;

      let body = box.querySelector(".help-box__body");
      if (!body) {
        body = document.createElement("div");
        body.className = "help-box__body";
        bodyNodes.forEach((node) => body.appendChild(node));
        box.appendChild(body);
      }

      const paras = Array.from(body.querySelectorAll("p"));
      if (paras.length > 2 && !body.querySelector(".help-box__more")) {
        const more = document.createElement("div");
        more.className = "help-box__more";
        paras.slice(2).forEach((p) => more.appendChild(p));
        body.appendChild(more);
      }

      if (!box.querySelector(".help-box__toggle") && body.querySelector(".help-box__more")) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "help-box__toggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Więcej szczegółów";
        toggle.addEventListener("click", () => {
          const open = box.classList.toggle("is-expanded");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
          toggle.textContent = open ? "Mniej szczegółów" : "Więcej szczegółów";
        });
        box.appendChild(toggle);
      }

      // Mobile: convert to details/summary shell without losing content
      const mq = window.matchMedia("(max-width: 767px)");
      const applyMobileShell = () => {
        if (!mq.matches) {
          box.classList.remove("help-box--collapsed");
          return;
        }
        box.classList.add("help-box--collapsed");
        if (!heading) return;
        heading.setAttribute("tabindex", "0");
        heading.setAttribute("role", "button");
        heading.setAttribute("aria-expanded", box.classList.contains("is-open") ? "true" : "false");
        if (heading.dataset.helpBound !== "1") {
          heading.dataset.helpBound = "1";
          const toggleOpen = () => {
            const open = box.classList.toggle("is-open");
            heading.setAttribute("aria-expanded", open ? "true" : "false");
          };
          heading.addEventListener("click", toggleOpen);
          heading.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              toggleOpen();
            }
          });
        }
      };
      applyMobileShell();
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", applyMobileShell);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(applyMobileShell);
      }
    });
  }

  function init(ctx) {
    const root = ctx?.root || document;
    enhanceHelpBoxes(root);

    root.addEventListener("click", (event) => {
      const card = event.target?.closest?.(".option-card[data-field][data-value]");
      if (!card || !root.contains(card)) return;
      const field = card.getAttribute("data-field");
      const value = card.getAttribute("data-value");
      showInsightForField(root, field, value);
    });

    // Radio building_shape (not always option-card)
    root.addEventListener("change", (event) => {
      const t = event.target;
      if (!t || !t.name) return;
      if (t.name === "building_shape" && t.checked) {
        const group = t.closest(".form-field-item, .form-field, .form-card") || t.parentElement;
        const text = resolveInsight("building_shape", t.value);
        if (!text || !group) return;
        let el = group.querySelector(".choice-insight");
        if (!el) {
          el = document.createElement("p");
          el.className = "choice-insight";
          el.setAttribute("role", "status");
          group.appendChild(el);
        }
        el.textContent = text;
      }
    });

    // Mobile accordion for profile panel
    root.querySelectorAll(".ti-ui-summary-panel h3").forEach((heading) => {
      if (heading.dataset.profileBound === "1") return;
      heading.dataset.profileBound = "1";
      heading.addEventListener("click", () => {
        if (!window.matchMedia("(max-width: 767px)").matches) return;
        heading.closest(".ti-ui-summary-panel")?.classList.toggle("is-open");
      });
    });

    return { enhanceHelpBoxes, showInsightForField };
  }

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.choiceInsights = { init };
})(typeof window !== "undefined" ? window : globalThis);
