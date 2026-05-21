(function (global) {
  "use strict";

  const PDF_INTENT_KEY = "ti_pdf_download_pending";
  const PDF_GATE_MESSAGE =
    "Aby pobrać pełny raport techniczny PDF, wprowadź swój adres e-mail i numer telefonu.";

  function getConfig() {
    return global.HEATPUMP_CONFIG || {};
  }

  function isPdfLeadGateBypassed() {
    const cfg = getConfig();
    if (cfg.skipPdfLeadGate === true) {
      return true;
    }
    try {
      if (global.__HP_DEBUG__ === true) {
        return true;
      }
      if (global.location && /(?:\?|&)hp_debug=1\b/.test(global.location.search || "")) {
        return true;
      }
    } catch (_) { }
    return false;
  }

  function normalizeDom(ctx) {
    const root = ctx?.root || global.__HP_ACTIVE_ROOT__ || null;
    const dom =
      ctx?.dom ||
      (root && typeof global.createScopedDom === "function"
        ? global.createScopedDom(root)
        : null);
    return { root, dom };
  }

  function readContactValues(dom) {
    const email = (dom?.byId("customer-email")?.value || "").trim();
    const phone = (dom?.byId("customer-phone")?.value || "").trim();
    return { email, phone };
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }

  function isValidPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.length >= 9;
  }

  function isLeadContactValidForPdf(dom) {
    const values = readContactValues(dom);
    return isValidEmail(values.email) && isValidPhone(values.phone);
  }

  function setPdfDownloadIntent() {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(PDF_INTENT_KEY, "1");
      }
    } catch (_) { }
  }

  function consumePdfDownloadIntent() {
    try {
      if (!global.sessionStorage) {
        return false;
      }
      const pending = global.sessionStorage.getItem(PDF_INTENT_KEY) === "1";
      global.sessionStorage.removeItem(PDF_INTENT_KEY);
      return pending;
    } catch (_) {
      return false;
    }
  }

  function clearPdfDownloadIntent() {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.removeItem(PDF_INTENT_KEY);
      }
    } catch (_) { }
  }

  function setInlineError(dom, key, message) {
    const form = dom?.byId("pdf-contact-form");
    if (!form) return;
    const err = form.querySelector(`[data-error-for="${key}"]`);
    if (!err) return;
    if (!message) {
      err.innerHTML = "";
      err.style.display = "none";
      return;
    }
    err.classList.add("field-error");
    err.innerHTML = `<i class="ph ph-warning-circle"></i><span>${message}</span>`;
    err.style.display = "flex";
  }

  function openPdfContactForm(dom) {
    const form = dom?.byId("pdf-contact-form");
    if (!form) {
      return;
    }
    form.classList.remove("hidden");
    form.style.display = "block";
    form.setAttribute("data-intent", "pdf_download");
    try {
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (_) { }
    if (typeof global.topinstalTrackEvent === "function") {
      global.topinstalTrackEvent("lead_open", {
        source: "calc",
        tab: 5,
        stepKey: "lead_form",
        meta: { kind: "pdf_download" },
      });
    }
  }

  function showGateMessage(dom) {
    if (global.ErrorHandler && typeof global.ErrorHandler.showToast === "function") {
      global.ErrorHandler.showToast(PDF_GATE_MESSAGE, "warning", 4500);
    }
    setInlineError(dom, "customer-email", PDF_GATE_MESSAGE);
    setInlineError(dom, "customer-phone", PDF_GATE_MESSAGE);
  }

  function focusFirstInvalidContact(dom) {
    const values = readContactValues(dom);
    if (!isValidEmail(values.email)) {
      const emailInput = dom?.byId("customer-email");
      if (emailInput) {
        emailInput.focus();
        if (typeof emailInput.reportValidity === "function") {
          emailInput.reportValidity();
        }
      }
      return emailInput || null;
    }
    if (!isValidPhone(values.phone)) {
      const phoneInput = dom?.byId("customer-phone");
      if (phoneInput) {
        phoneInput.focus();
        if (typeof phoneInput.reportValidity === "function") {
          phoneInput.reportValidity();
        }
      }
      return phoneInput || null;
    }
    return null;
  }

  function requireLeadForPdfDownload(ctx) {
    if (isPdfLeadGateBypassed()) {
      return true;
    }

    const { dom } = normalizeDom(ctx);
    if (!dom) {
      return false;
    }

    if (isLeadContactValidForPdf(dom)) {
      return true;
    }

    setPdfDownloadIntent();
    openPdfContactForm(dom);
    showGateMessage(dom);
    focusFirstInvalidContact(dom);
    return false;
  }

  async function maybeAutoDownloadPdfAfterLead(ctx) {
    if (!consumePdfDownloadIntent()) {
      return false;
    }

    const { root, dom } = normalizeDom(ctx);
    if (!root || !dom) {
      return false;
    }

    if (typeof global.downloadOfferPdf !== "function") {
      return false;
    }

    try {
      await global.downloadOfferPdf({ root, dom, state: ctx?.state || null });
      return true;
    } catch (error) {
      console.warn("[PDF] Auto-download after lead failed:", error);
      return false;
    }
  }

  global.__topinstalPdfLeadGate = {
    PDF_INTENT_KEY,
    PDF_GATE_MESSAGE,
    isPdfLeadGateBypassed,
    isLeadContactValidForPdf,
    setPdfDownloadIntent,
    consumePdfDownloadIntent,
    clearPdfDownloadIntent,
    requireLeadForPdfDownload,
    maybeAutoDownloadPdfAfterLead,
  };
})(typeof window !== "undefined" ? window : globalThis);
