(function (global) {
  "use strict";

  const PDF_INTENT_KEY = "ti_pdf_download_pending";
  const EMAIL_INTENT_KEY = "ti_email_pdf_pending";
  const PDF_GATE_MESSAGE =
    "Podaj poprawny adres e-mail i numer telefonu (min. 9 cyfr).";

  const MODAL_COPY = {
    pdf_download: {
      title: "Pobierz ofertę PDF",
      subtitle:
        "Podaj e-mail i telefon — od razu wygenerujemy raport techniczny do pobrania.",
      confirmLabel: "Pobierz PDF",
      trackKind: "pdf_download_modal",
    },
    email_pdf: {
      title: "Wyślij PDF na e-mail",
      subtitle:
        "Podaj e-mail i telefon — wyślemy podsumowanie oferty w PDF. Bez spamu.",
      confirmLabel: "Wyślij PDF na e-mail",
      trackKind: "email_pdf_modal",
    },
  };

  let modalBound = false;
  let pendingModalCtx = null;
  let pendingModalMode = "pdf_download";

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
    return { root, dom, state: ctx?.state || null };
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }

  function isValidPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.length >= 9;
  }

  function readModalContactValues(dom) {
    const email = (dom?.byId("pdf-lead-email")?.value || "").trim();
    const phone = (dom?.byId("pdf-lead-phone")?.value || "").trim();
    return { email, phone };
  }

  function readContactValues(dom) {
    const modal = readModalContactValues(dom);
    if (modal.email || modal.phone) {
      return modal;
    }
    const email = (dom?.byId("customer-email")?.value || "").trim();
    const phone = (dom?.byId("customer-phone")?.value || "").trim();
    return { email, phone };
  }

  function isLeadContactValidForPdf(dom) {
    const values = readContactValues(dom);
    return isValidEmail(values.email) && isValidPhone(values.phone);
  }

  function syncMainContactFields(dom, values) {
    const emailInput = dom?.byId("customer-email");
    const phoneInput = dom?.byId("customer-phone");
    if (emailInput && values.email) {
      emailInput.value = values.email;
    }
    if (phoneInput && values.phone) {
      phoneInput.value = values.phone;
    }
  }

  function syncModalFromMainContact(dom) {
    const mainEmail = dom?.byId("customer-email");
    const mainPhone = dom?.byId("customer-phone");
    const modalEmail = dom?.byId("pdf-lead-email");
    const modalPhone = dom?.byId("pdf-lead-phone");
    if (modalEmail && mainEmail && !modalEmail.value.trim()) {
      modalEmail.value = mainEmail.value;
    }
    if (modalPhone && mainPhone && !modalPhone.value.trim()) {
      modalPhone.value = mainPhone.value;
    }
  }

  function setPendingIntent(mode) {
    const key = mode === "email_pdf" ? EMAIL_INTENT_KEY : PDF_INTENT_KEY;
    try {
      if (global.sessionStorage) {
        global.sessionStorage.setItem(key, "1");
      }
    } catch (_) { }
  }

  function consumePendingIntent(mode) {
    const key = mode === "email_pdf" ? EMAIL_INTENT_KEY : PDF_INTENT_KEY;
    try {
      if (!global.sessionStorage) {
        return false;
      }
      const pending = global.sessionStorage.getItem(key) === "1";
      global.sessionStorage.removeItem(key);
      return pending;
    } catch (_) {
      return false;
    }
  }

  function clearPendingIntents() {
    try {
      if (global.sessionStorage) {
        global.sessionStorage.removeItem(PDF_INTENT_KEY);
        global.sessionStorage.removeItem(EMAIL_INTENT_KEY);
      }
    } catch (_) { }
  }

  function setPdfDownloadIntent() {
    setPendingIntent("pdf_download");
  }

  function consumePdfDownloadIntent() {
    return consumePendingIntent("pdf_download");
  }

  function clearPdfDownloadIntent() {
    clearPendingIntents();
  }

  function setInlineError(dom, key, message) {
    const modal = dom?.byId("pdf-lead-modal");
    const form = dom?.byId("pdf-contact-form");
    const container = modal && !modal.classList.contains("hidden") ? modal : form;
    if (!container) return;
    const err = container.querySelector(`[data-error-for="${key}"]`);
    if (!err) return;
    if (!message) {
      err.textContent = "";
      err.innerHTML = "";
      err.style.display = "none";
      return;
    }
    err.classList.add("field-error");
    err.innerHTML = `<i class="ph ph-warning-circle"></i><span></span>`;
    const span = err.querySelector("span");
    if (span) {
      span.textContent = message;
    } else {
      err.textContent = message;
    }
    err.style.display = "flex";
  }

  function clearModalErrors(dom) {
    setInlineError(dom, "pdf-lead-email", "");
    setInlineError(dom, "pdf-lead-phone", "");
  }

  function applyModalCopy(dom, mode) {
    const copy = MODAL_COPY[mode] || MODAL_COPY.pdf_download;
    const modal = dom?.byId("pdf-lead-modal");
    if (modal) {
      modal.setAttribute("data-lead-mode", mode);
    }
    const titleEl = dom?.qs?.('[data-role="pdf-lead-modal-title"]') ||
      modal?.querySelector('[data-role="pdf-lead-modal-title"]');
    const subtitleEl = dom?.qs?.('[data-role="pdf-lead-modal-subtitle"]') ||
      modal?.querySelector('[data-role="pdf-lead-modal-subtitle"]');
    const confirmEl = dom?.qs?.('[data-role="pdf-lead-modal-confirm"]') ||
      modal?.querySelector('[data-role="pdf-lead-modal-confirm"]');
    if (titleEl) titleEl.textContent = copy.title;
    if (subtitleEl) subtitleEl.textContent = copy.subtitle;
    if (confirmEl) confirmEl.textContent = copy.confirmLabel;
  }

  function openLeadContactModal(dom, ctx, mode) {
    const modal = dom?.byId("pdf-lead-modal");
    if (!modal) {
      return false;
    }
    pendingModalMode = mode === "email_pdf" ? "email_pdf" : "pdf_download";
    pendingModalCtx = ctx || null;
    syncModalFromMainContact(dom);
    applyModalCopy(dom, pendingModalMode);
    clearModalErrors(dom);
    modal.classList.remove("hidden");
    modal.style.display = "";
    document.body.classList.add("pdf-lead-modal-open");
    ensurePdfLeadModalBound();
    const emailInput = dom.byId("pdf-lead-email");
    if (emailInput) {
      try {
        emailInput.focus();
      } catch (_) { }
    }
    if (typeof global.topinstalTrackEvent === "function") {
      const copy = MODAL_COPY[pendingModalMode] || MODAL_COPY.pdf_download;
      global.topinstalTrackEvent("lead_open", {
        source: "calc",
        tab: 5,
        stepKey: "summary",
        meta: { kind: copy.trackKind },
      });
    }
    return true;
  }

  function closePdfLeadModal(dom) {
    const modal = dom?.byId("pdf-lead-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.style.display = "none";
    document.body.classList.remove("pdf-lead-modal-open");
    clearModalErrors(dom);
    pendingModalCtx = null;
    pendingModalMode = "pdf_download";
  }

  function validateModalContact(dom) {
    const values = readModalContactValues(dom);
    let ok = true;
    clearModalErrors(dom);
    if (!isValidEmail(values.email)) {
      setInlineError(dom, "pdf-lead-email", "Podaj poprawny adres e-mail.");
      ok = false;
    }
    if (!isValidPhone(values.phone)) {
      setInlineError(dom, "pdf-lead-phone", "Podaj numer telefonu (min. 9 cyfr).");
      ok = false;
    }
    return ok ? values : null;
  }

  async function confirmPdfLeadDownload(dom, ctx) {
    const values = validateModalContact(dom);
    if (!values) {
      return false;
    }
    syncMainContactFields(dom, values);
    closePdfLeadModal(dom);
    clearPdfDownloadIntent();

    if (typeof global.downloadOfferPdf !== "function") {
      return false;
    }
    try {
      await global.downloadOfferPdf({
        root: ctx?.root,
        dom: ctx?.dom || dom,
        state: ctx?.state || null,
      });
      return true;
    } catch (error) {
      console.warn("[PDF] Download after lead modal failed:", error);
      return false;
    }
  }

  async function confirmEmailPdfLead(dom, ctx) {
    const values = validateModalContact(dom);
    if (!values) {
      return false;
    }
    syncMainContactFields(dom, values);
    closePdfLeadModal(dom);
    clearPendingIntents();

    const handler = global.__topinstalHandleLeadModalSubmit;
    if (typeof handler !== "function") {
      console.warn("[PDF] Brak __topinstalHandleLeadModalSubmit — nie można wysłać e-maila.");
      return false;
    }

    try {
      await handler({
        mode: "email_pdf",
        email: values.email,
        phone: values.phone,
        root: ctx?.root,
        dom: ctx?.dom || dom,
        state: ctx?.state || null,
      });
      return true;
    } catch (error) {
      console.warn("[PDF] Email after lead modal failed:", error);
      return false;
    }
  }

  async function confirmLeadModalSubmit(dom) {
    const ctx = pendingModalCtx || normalizeDom({});
    if (pendingModalMode === "email_pdf") {
      return confirmEmailPdfLead(dom, ctx);
    }
    return confirmPdfLeadDownload(dom, ctx);
  }

  function ensurePdfLeadModalBound() {
    if (modalBound) return;
    modalBound = true;

    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest('[data-action="close-pdf-lead-modal"]');
      if (closeBtn) {
        e.preventDefault();
        const { dom } = normalizeDom(pendingModalCtx || {});
        closePdfLeadModal(dom);
        clearPendingIntents();
        return;
      }
      const confirmBtn = e.target.closest('[data-action="confirm-pdf-lead-submit"]');
      if (!confirmBtn) return;
      e.preventDefault();
      const { dom } = normalizeDom(pendingModalCtx || {});
      if (!dom) return;
      confirmLeadModalSubmit(dom);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("pdf-lead-modal");
      if (!modal || modal.classList.contains("hidden")) return;
      const { dom } = normalizeDom({});
      closePdfLeadModal(dom);
      clearPendingIntents();
    });
  }

  function openLeadForIntent(dom, ctx, intent) {
    const normalized = normalizeDom(ctx);
    if (!normalized.dom) {
      return false;
    }
    if (intent === "order_contact") {
      return false;
    }
    const mode = intent === "email_pdf" ? "email_pdf" : "pdf_download";
    if (isLeadContactValidForPdf(normalized.dom) && mode === "email_pdf") {
      return confirmEmailPdfLead(normalized.dom, normalized);
    }
    setPendingIntent(mode);
    ensurePdfLeadModalBound();
    return openLeadContactModal(normalized.dom, normalized, mode);
  }

  function requireLeadForPdfDownload(ctx) {
    if (isPdfLeadGateBypassed()) {
      return true;
    }

    const normalized = normalizeDom(ctx);
    const { dom } = normalized;
    if (!dom) {
      return false;
    }

    if (isLeadContactValidForPdf(dom)) {
      return true;
    }

    setPdfDownloadIntent();
    ensurePdfLeadModalBound();
    openLeadContactModal(dom, normalized, "pdf_download");
    return false;
  }

  async function maybeAutoDownloadPdfAfterLead(ctx) {
    if (!consumePdfDownloadIntent()) {
      return false;
    }

    const normalized = normalizeDom(ctx);
    const { root, dom } = normalized;
    if (!root || !dom) {
      return false;
    }

    if (!isLeadContactValidForPdf(dom)) {
      openLeadContactModal(dom, normalized, "pdf_download");
      return false;
    }

    return confirmPdfLeadDownload(dom, normalized);
  }

  global.__topinstalPdfLeadGate = {
    PDF_INTENT_KEY,
    EMAIL_INTENT_KEY,
    PDF_GATE_MESSAGE,
    isPdfLeadGateBypassed,
    isLeadContactValidForPdf,
    setPdfDownloadIntent,
    consumePdfDownloadIntent,
    clearPdfDownloadIntent,
    requireLeadForPdfDownload,
    maybeAutoDownloadPdfAfterLead,
    openLeadContactModal,
    openPdfLeadModal: (dom, ctx) => openLeadContactModal(dom, ctx, "pdf_download"),
    closePdfLeadModal,
    openLeadForIntent,
  };
})(typeof window !== "undefined" ? window : globalThis);
