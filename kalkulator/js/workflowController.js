(function (window) {
  "use strict";

  function init(ctx) {
    const { root, dom, state } = ctx;
    const doc = root.ownerDocument;
    const view = doc.defaultView || window;
    const docEl = doc.documentElement;
    const motion = state?.motion || null;
    const getAppState = state?.getAppState;
    const updateAppState = state?.updateAppState;
    const setUiFlags = state?.setUiFlags;

    let initialized = false;
    let scrollHandler = null;
    let resizeHandler = null;
    let typewriterTimeout = null;
    let observer = null;
    let configuratorModulePromise = null;
    let latestWorkflowResult = null;

    const steps = [
      { progress: 12, label: "Start / Wprowadzenie" },
      { progress: 24, label: "Krok 2 / Wymiary" },
      { progress: 42, label: "Krok 3 / Konstrukcja" },
      { progress: 58, label: "Krok 4 / Okna & Drzwi" },
      { progress: 75, label: "Krok 5 / Izolacje" },
      { progress: 91, label: "Krok 6 / Finalizacja" },
      { progress: 100, label: "Wyniki" },
    ];

    const progressBarContainer = dom.byId("progress-bar-container");
    const progressBar = dom.byId("global-progress-bar");
    const progressFill = dom.byId("top-progress-fill");
    const progressPercentage = dom.byId("progress-percentage");
    const progressLabel = dom.byId("progress-label");
    const progressInfo = dom.byId("global-progress-info");
    const progressPlaceholder = dom.byId("progress-placeholder");
    const form = dom.byId("heatCalcFormFull");
    const header = dom.qs(".top-preview-header");

    let triggerOffset = 0;
    let stickyDisabled = false;
    let typewriterActive = false;
    let typewriterCompleted = false;

    const isMobile = () => view.matchMedia("(max-width: 767px)").matches;
    const isReducedMotionPreferred = () => {
      if (motion && typeof motion.reduceMotion === "boolean") {
        return motion.reduceMotion;
      }
      if (typeof view.matchMedia === "function") {
        try {
          return view.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch (_) { }
      }
      return false;
    };
    const getMotionDelay = (duration) =>
      isReducedMotionPreferred() ? 0 : duration;

    function getConfiguratorModule() {
      const moduleApi = window.__HP_MODULES__?.configurator || null;
      return moduleApi && typeof moduleApi.init === "function"
        ? moduleApi
        : null;
    }

    function resolveConfiguratorScriptUrl() {
      const fromConfig = window.HEATPUMP_CONFIG?.konfiguratorUrl;
      if (typeof fromConfig === "string" && fromConfig.trim() !== "") {
        return `${fromConfig.replace(/\/+$/, "")}/configurator-unified.js`;
      }

      const fromBase = window.HEATPUMP_CONFIG?.baseUrl;
      if (typeof fromBase === "string" && fromBase.trim() !== "") {
        return `${fromBase.replace(/\/+$/, "")}/konfigurator/configurator-unified.js`;
      }

      const existingScript = Array.from(doc.scripts || []).find((scriptEl) => {
        const src = typeof scriptEl?.src === "string" ? scriptEl.src : "";
        return /\/konfigurator\/configurator-unified\.js(?:\?|$)/.test(src);
      });

      return existingScript?.src || null;
    }

    function waitForConfiguratorModule(timeoutMs = 4000) {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = view.setInterval(() => {
          const moduleApi = getConfiguratorModule();
          if (moduleApi) {
            view.clearInterval(timer);
            resolve(moduleApi);
            return;
          }

          if (Date.now() - startedAt >= timeoutMs) {
            view.clearInterval(timer);
            reject(new Error("CONFIGURATOR_MODULE_TIMEOUT"));
          }
        }, 100);
      });
    }

    function loadConfiguratorScriptOnce(scriptUrl) {
      return new Promise((resolve, reject) => {
        if (!scriptUrl) {
          reject(new Error("CONFIGURATOR_SCRIPT_URL_MISSING"));
          return;
        }

        let scriptEl = null;

        const cleanup = () => {
          if (!scriptEl) return;
          scriptEl.removeEventListener("load", onLoad);
          scriptEl.removeEventListener("error", onError);
        };

        const onLoad = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error("CONFIGURATOR_SCRIPT_LOAD_FAILED"));
        };

        scriptEl = doc.createElement("script");
        scriptEl.src =
          scriptUrl +
          (scriptUrl.indexOf("?") >= 0 ? "&" : "?") +
          `hp-configurator-retry=${Date.now()}`;
        scriptEl.async = true;
        scriptEl.dataset.hpConfiguratorDynamic = "true";
        scriptEl.addEventListener(
          "load",
          () => {
            scriptEl.dataset.hpLoaded = "true";
            onLoad();
          },
          { once: true }
        );
        scriptEl.addEventListener("error", onError, { once: true });
        (doc.body || doc.head || doc.documentElement).appendChild(scriptEl);
      });
    }

    async function ensureConfiguratorModuleAvailable() {
      const existingModule = getConfiguratorModule();
      if (existingModule) {
        return existingModule;
      }

      if (configuratorModulePromise) {
        return configuratorModulePromise;
      }

      configuratorModulePromise = (async () => {
        try {
          return await waitForConfiguratorModule(1200);
        } catch (_) {
          const scriptUrl = resolveConfiguratorScriptUrl();
          await loadConfiguratorScriptOnce(scriptUrl);
          return await waitForConfiguratorModule(4000);
        }
      })();

      try {
        return await configuratorModulePromise;
      } finally {
        configuratorModulePromise = null;
      }
    }
    function getWorkflowInstanceId() {
      return (
        state?.instanceId ||
        root?.getAttribute?.("data-hp-instance") ||
        "default"
      );
    }

    function getWorkflowInputIdentity(input) {
      if (!input || typeof input !== "object") {
        return null;
      }

      return (
        input?.offer_dto?.traceId ||
        input?.offer_dto?.trace_id ||
        input?.traceId ||
        input?.trace_id ||
        input?.id ||
        null
      );
    }

    function matchesWorkflowInputIdentity(candidate) {
      if (!candidate || typeof candidate !== "object") {
        return false;
      }

      const currentIdentity = getWorkflowInputIdentity(latestWorkflowResult);
      const candidateIdentity = getWorkflowInputIdentity(candidate);
      if (!currentIdentity || !candidateIdentity) {
        return true;
      }

      return currentIdentity === candidateIdentity;
    }

    function readConfiguratorConfigDataFromAppState() {
      const appState =
        typeof getAppState === "function" ? getAppState() : null;
      const configData = appState?.config_data;
      if (!matchesWorkflowInputIdentity(configData)) {
        return null;
      }

      return configData;
    }

    function readConfiguratorConfigDataFromStorage() {
      const storage =
        view.sessionStorage ||
        (typeof sessionStorage !== "undefined" ? sessionStorage : null);
      if (!storage) {
        return null;
      }

      const instanceId = getWorkflowInstanceId();
      const configDataKeys = [`config_data::${String(instanceId)}`, "config_data"];
      for (let i = 0; i < configDataKeys.length; i += 1) {
        const raw = storage.getItem(configDataKeys[i]);
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          if (matchesWorkflowInputIdentity(parsed)) {
            return parsed;
          }
        } catch (error) {
          console.warn(
            "âš ď¸Ź [WORKFLOW] Failed to parse configurator config_data",
            error
          );
        }
      }

      return null;
    }

    function resolveBestConfiguratorInput() {
      const appStateConfigData = readConfiguratorConfigDataFromAppState();
      if (appStateConfigData) {
        return {
          input: appStateConfigData,
          source: "appState.config_data",
        };
      }

      const storageConfigData = readConfiguratorConfigDataFromStorage();
      if (storageConfigData) {
        return {
          input: storageConfigData,
          source: "sessionStorage.config_data",
        };
      }

      return {
        input: null,
        source: null,
      };
    }

    async function waitForBestConfiguratorInput(
      timeoutMs = 1500,
      intervalMs = 100
    ) {
      const immediate = resolveBestConfiguratorInput();
      if (immediate.input) {
        return immediate;
      }

      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => {
          view.setTimeout(resolve, intervalMs);
        });

        const next = resolveBestConfiguratorInput();
        if (next.input) {
          return next;
        }
      }

      return resolveBestConfiguratorInput();
    }

    function getConfiguratorRuntimeApi() {
      const stateApi = state?.configurator;
      if (stateApi && typeof stateApi.loadFromCanonicalState === "function") {
        return stateApi;
      }

      const moduleApi = window.__HP_MODULES__?.configurator || null;
      const fallbackApi =
        typeof moduleApi?.getLastRuntimeApi === "function"
          ? moduleApi.getLastRuntimeApi()
          : moduleApi?.__lastRuntimeApi || null;

      if (fallbackApi && typeof fallbackApi.loadFromCanonicalState === "function") {
        if (state && !state.configurator) {
          state.configurator = fallbackApi;
        }
        return fallbackApi;
      }

      return stateApi || fallbackApi || null;
    }

    async function waitForConfiguratorApi(timeoutMs = 1500, intervalMs = 100) {
      const immediateApi = getConfiguratorRuntimeApi();
      if (immediateApi && typeof immediateApi.loadFromCanonicalState === "function") {
        return immediateApi;
      }

      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => {
          view.setTimeout(resolve, intervalMs);
        });

        const nextApi = getConfiguratorRuntimeApi();
        if (nextApi && typeof nextApi.loadFromCanonicalState === "function") {
          return nextApi;
        }
      }

      return getConfiguratorRuntimeApi();
    }

    async function initConfiguratorFromBestAvailableInput() {
      const { input: configuratorInput, source } =
        await waitForBestConfiguratorInput();
      if (!configuratorInput) {
        console.warn("âš ď¸Ź [WORKFLOW] No canonical configurator state available");
        return false;
      }

      const configuratorApi = await waitForConfiguratorApi();
      if (!configuratorApi || typeof configuratorApi.loadFromCanonicalState !== "function") {
        console.warn("âš ď¸Ź [WORKFLOW] state.configurator.loadFromCanonicalState is not available");
        return false;
      }

      configuratorApi.loadFromCanonicalState(configuratorInput);
      console.log(
        `âś… [WORKFLOW] Configurator hydrated from ${source || "unknown"}`
      );
      return true;
    }

    function setWorkflowCtaState(button, stateName) {
      if (!button) return;
      button.dataset.motionCta = button.dataset.motionCta || "on";
      button.classList.remove("is-loading", "is-success");

      if (stateName === "loading") {
        button.classList.add("is-loading");
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        if (motion && typeof motion.animateCtaState === "function") {
          motion.animateCtaState(button, "loading");
        }
        return;
      }

      button.disabled = false;
      button.removeAttribute("aria-busy");
      if (stateName === "success") {
        button.classList.add("is-success");
        if (motion && typeof motion.animateCtaState === "function") {
          motion.animateCtaState(button, "success");
        }
      }
    }

    function updateProgress(tabIndex) {
      if (tabIndex < 0 || tabIndex >= steps.length) return;
      const step = steps[tabIndex];

      if (progressFill) {
        const progressValue = step.progress / 100;
        progressFill.dataset.progress = String(step.progress);
        if (motion && typeof motion.animateProgress === "function") {
          motion.animateProgress(progressFill, progressValue);
        } else {
          progressFill.style.width = `${Math.round(progressValue * 100)}%`;
        }
      }

      if (progressPercentage) {
        progressPercentage.textContent = `${step.progress}%`;
        progressPercentage.style.display = tabIndex === 0 ? "none" : "";
      }

      // Zawsze używaj oryginalnej treści z desktop (bez lowercase dla mobile)
      if (progressLabel) {
        progressLabel.textContent = step.label;
      }

      if (tabIndex === 6) {
        stickyDisabled = true;
        if (!isMobile() && progressBarContainer) {
          progressBarContainer.classList.remove("sticky");
          if (progressPlaceholder) {
            progressPlaceholder.style.display = "none";
          }
        }

        const appState =
          typeof getAppState === "function" ? getAppState() : null;
        const animationAlreadyShown =
          appState?.uiFlags?.completionAnimationShown === true ||
          appState?.completionAnimationShown === true;

        if (
          !typewriterActive &&
          !typewriterCompleted &&
          !animationAlreadyShown
        ) {
          startCompletion();
        } else if (animationAlreadyShown) {
          typewriterCompleted = true;
        }
      } else if (tabIndex === 0) {
        if (typewriterActive) {
          typewriterActive = false;
          const completionContainer = dom.qs(".workflow-completion");
          if (completionContainer) {
            completionContainer.style.display = "none";
          }
          if (typewriterTimeout) {
            clearTimeout(typewriterTimeout);
            typewriterTimeout = null;
          }
        }
        stickyDisabled = false;
      } else {
        stickyDisabled = false;
      }
    }

    function getWorkflowSummaryHeaderMarkup() {
      return `
        <div class="workflow-summary-entry" data-role="workflow-summary-entry">
          <section class="results-summary-header glass-box" data-role="results-summary-header" data-context="workflow-completion" aria-label="Podsumowanie doboru">
            <div class="results-summary-header__grid">
              <div class="results-summary-header__metric">
                <div class="results-summary-header__label">Zapotrzebowanie budynku</div>
                <div class="results-summary-header__value">
                  <strong data-role="results-demand-kw">—</strong> kW
                </div>
              </div>
              <div class="results-summary-header__metric">
                <div class="results-summary-header__label">Rekomendacja</div>
                <div class="results-summary-header__value" data-role="results-recommendation-model">W trakcie doboru</div>
              </div>
              <div class="results-summary-header__metric">
                <div class="results-summary-header__label">Wycena orientacyjna</div>
                <div class="results-summary-header__value" data-role="results-price-range">Do wyceny po konfiguracji</div>
              </div>
            </div>
            <div class="results-summary-header__actions">
              <button type="button" class="results-summary-header__cta" data-action="start-config">
                Przejdź do konfiguracji maszynowni (10 kroków)
              </button>
            </div>
            <p class="results-summary-header__note">
              Certyfikowany algorytm obliczeniowy TOP-INSTAL (zgodny z normami PN-B 02025 i PN-EN 832). Wygenerowany profil energetyczny stanowi techniczną podstawę doboru urządzeń. Finalny dobór potwierdzamy po telefonicznej weryfikacji warunków montażu w kotłowni.
            </p>
          </section>
        </div>
      `;
    }

    function handleResize() {
      const activeTab = dom.qs(".section.active");
      if (activeTab) {
        const tabIndex = parseInt(activeTab.getAttribute("data-tab")) || 0;
        updateProgress(tabIndex);
      }
      if (isMobile() && progressBarContainer) {
        progressBarContainer.classList.remove("sticky");
        progressBarContainer.classList.remove("hidden");
        if (progressPlaceholder) {
          progressPlaceholder.style.display = "none";
          progressPlaceholder.classList.remove("active");
        }
      }
    }

    function updateTriggerOffset() {
      if (isMobile()) return;
      if (progressBarContainer) {
        const progressBarRect = progressBarContainer.getBoundingClientRect();
        const scrollTop = view.pageYOffset || docEl.scrollTop;
        const progressBarTop = progressBarRect.top + scrollTop;
        let headerHeight = 80;
        if (header) {
          const headerRect = header.getBoundingClientRect();
          headerHeight = headerRect.height || header.offsetHeight || 80;
        }
        headerHeight += 15;
        triggerOffset = progressBarTop - headerHeight;
        if (isMobile()) {
          triggerOffset = Math.max(0, triggerOffset - 10);
        }
        docEl.style.setProperty("--header-height", `${headerHeight}px`);
      } else if (form) {
        const formRect = form.getBoundingClientRect();
        const scrollTop = view.pageYOffset || docEl.scrollTop;
        triggerOffset = Math.max(0, formRect.top + scrollTop - 60);
      }
    }

    function setupStickyProgress() {
      if (isMobile()) return;
      let ticking = false;

      const handleScroll = () => {
        if (ticking) return;
        view.requestAnimationFrame(() => {
          if (stickyDisabled) {
            if (
              progressBarContainer &&
              progressBarContainer.classList.contains("sticky")
            ) {
              progressBarContainer.classList.remove("sticky");
              if (progressPlaceholder) {
                progressPlaceholder.style.display = "none";
                progressPlaceholder.classList.remove("active");
              }
            }
            ticking = false;
            return;
          }

          const scrollTop = view.pageYOffset || docEl.scrollTop || view.scrollY;
          if (progressBarContainer) {
            const shouldBeSticky = scrollTop > triggerOffset;
            if (
              shouldBeSticky &&
              !progressBarContainer.classList.contains("sticky")
            ) {
              progressBarContainer.classList.add("sticky");
              if (progressPlaceholder) {
                progressPlaceholder.style.display = "block";
                progressPlaceholder.classList.add("active");
              }
            } else if (
              !shouldBeSticky &&
              progressBarContainer.classList.contains("sticky")
            ) {
              progressBarContainer.classList.remove("sticky");
              if (progressPlaceholder) {
                progressPlaceholder.style.display = "none";
                progressPlaceholder.classList.remove("active");
              }
            }
          }

          ticking = false;
        });
        ticking = true;
      };

      scrollHandler = handleScroll;
      resizeHandler = () => {
        updateTriggerOffset();
        handleResize();
      };

      view.addEventListener("scroll", scrollHandler);
      view.addEventListener("resize", resizeHandler);
    }

    function watchTabs() {
      const initial = dom.qs(".section.active");
      if (initial) {
        const idx = parseInt(initial.getAttribute("data-tab")) || 0;
        updateProgress(idx);
      }

      observer = new MutationObserver(() => {
        const active = dom.qs(".section.active");
        if (!active) return;
        const idx = parseInt(active.getAttribute("data-tab")) || 0;
        updateProgress(idx);
      });

      observer.observe(root, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    function startCompletion(result) {
      latestWorkflowResult = result || null;
      console.log("🎬 [WORKFLOW] startCompletion() called");
      console.log("📊 [WORKFLOW] Result:", result);

      typewriterActive = true;
      typewriterCompleted = true;

      if (typeof setUiFlags === "function") {
        setUiFlags({
          completionAnimationShown: true,
        });
      } else if (typeof updateAppState === "function") {
        updateAppState({
          completionAnimationShown: true,
          uiFlags: {
            completionAnimationShown: true,
          },
        });
      }

      // WORKFLOW COMPLETION (screen 0) w normalnym layoucie:
      // - NIE zasłaniamy hero
      // - zostawiamy progress bar (100%)
      // - ukrywamy tylko formularz i wyniki w tle
      console.log(
        "🔄 [WORKFLOW] Hiding form sections (keeping hero + progress)..."
      );

      // Ukryj wszystkie sekcje formularza
      const allSections = dom.qsa(".section[data-tab]");
      allSections.forEach((section) => {
        section.classList.remove("active");
        section.style.display = "none";
      });

      // Progress bar ma być widoczny i ustawiony na 100%
      if (progressBarContainer) {
        progressBarContainer.style.display = "";
        progressBarContainer.classList.remove("hidden");
      }
      if (progressFill) {
        progressFill.dataset.progress = "100";
        if (motion && typeof motion.animateProgress === "function") {
          motion.animateProgress(progressFill, 1);
        } else {
          progressFill.style.width = "100%";
        }
      }
      if (progressPercentage) {
        progressPercentage.textContent = "100%";
        progressPercentage.style.display = "";
      }
      if (progressLabel) {
        progressLabel.textContent = "Wyniki";
      }

      // Ukryj results container (będzie pokazany po kliknięciu CTA)
      const resultsContainer = dom.qs(".hp-results");
      if (resultsContainer) {
        resultsContainer.style.display = "none";
      }

      console.log("✅ [WORKFLOW] Form hidden, progress kept");

      // Stwórz lub znajdź workflow completion container
      let completionContainer = dom.qs(".workflow-completion");
      if (!completionContainer) {
        console.log("🔧 [WORKFLOW] Creating workflow completion container...");
        completionContainer = root.ownerDocument.createElement("div");
        completionContainer.className = "workflow-completion";
        // Wstaw pod progress barem (pod placeholderem) i nad formularzem
        const anchor = progressPlaceholder || progressBarContainer || root;
        if (anchor && anchor.parentNode) {
          anchor.parentNode.insertBefore(
            completionContainer,
            anchor.nextSibling
          );
        } else {
          root.appendChild(completionContainer);
        }
        console.log("✅ [WORKFLOW] Container created");
      }

      // Pokaż workflow completion (normal flow, stylowane przez CSS)
      completionContainer.style.display = "block";
      // Ukryj hero na etapie Gratulacje i dalej w konfiguratorze
      try {
        root.classList.add("hp-hero-hidden");
      } catch (_) { }
      completionContainer.style.position = "";
      completionContainer.style.top = "";
      completionContainer.style.left = "";
      completionContainer.style.width = "";
      completionContainer.style.height = "";
      completionContainer.style.zIndex = "";
      completionContainer.style.background = "";
      completionContainer.style.alignItems = "";
      completionContainer.style.justifyContent = "";

      // Upewnij się, że użytkownik widzi ekran 0 (nie na stopce po zwinięciu treści)
      try {
        const scrollTarget = progressBarContainer || completionContainer;
        if (scrollTarget && typeof scrollTarget.scrollIntoView === "function") {
          scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
          // skoryguj o wysokość nagłówka (jeśli ustawiona)
          setTimeout(() => {
            const headerHeight =
              parseFloat(
                getComputedStyle(docEl).getPropertyValue("--header-height")
              ) ||
              (header ? header.offsetHeight : 0) ||
              0;
            if (headerHeight) {
              view.scrollTo({
                top: Math.max(
                  0,
                  (view.pageYOffset || docEl.scrollTop) - headerHeight - 12
                ),
                behavior: "smooth",
              });
            }
          }, 50);
        }
      } catch (e) {
        /* ignore */
      }

      console.log("✅ [WORKFLOW] Workflow completion shown (in flow)");

      // Ukryj konfigurator (będzie pokazany po kliknięciu CTA)
      const configView = dom.byId("configurator-view");
      const switcher = dom.qs('[data-role="results-switcher"]');

      if (configView) {
        configView.classList.remove("visible");
        configView.classList.add("hidden");
        configView.style.display = "none";
      }
      if (switcher) {
        switcher.style.display = "none";
      }

      const messages = [
        "Gratulacje! Zakończyłeś obliczenia związane z OZC Twojego budynku.",
        "Twoja pompa została dopasowana pod budynek. Teraz możesz dostosować maszynownię i osprzęt.",
      ];

      completionContainer.innerHTML =
        '<div class="typewriter-container"></div>';
      const typewriterContainer = completionContainer.querySelector(
        ".typewriter-container"
      );

      const typeMessage = (message, container, duration) =>
        new Promise((resolve) => {
          const textElement = root.ownerDocument.createElement("div");
          textElement.className = "typewriter-text typing";
          container.appendChild(textElement);

          const chars = message.split("");
          const charDelay = duration / chars.length;
          let currentIndex = 0;

          const typeChar = () => {
            if (currentIndex < chars.length) {
              textElement.textContent += chars[currentIndex];
              currentIndex++;
              setTimeout(typeChar, charDelay);
            } else {
              textElement.classList.remove("typing");
              setTimeout(resolve, 600);
            }
          };

          typeChar();
        });

      (async function run() {
        for (let i = 0; i < messages.length; i++) {
          await typeMessage(
            messages[i],
            typewriterContainer,
            i === 0 ? 1500 : 1200
          );
        }

        completionContainer.insertAdjacentHTML(
          "beforeend",
          getWorkflowSummaryHeaderMarkup()
        );
        root.dispatchEvent(
          new CustomEvent("heatpump:refreshResultsSummaryHeaders", {
            detail: { result },
            bubbles: false,
          })
        );

        setTimeout(() => {
          const summaryEntry = completionContainer.querySelector(
            '[data-role="workflow-summary-entry"]'
          );
          if (summaryEntry) summaryEntry.classList.add("visible");
        }, 400);
      })();
    }

    async function startConfigurator(event) {
      if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      console.log(
        "🚀 [WORKFLOW] startConfigurator() called - showing configurator"
      );
      try {
        console.debug(
          "[HP_DIAG] startConfigurator called for root",
          root.getAttribute("data-hp-instance")
        );
      } catch (e) { }

      // Usuń workflow completion z DOM (uniknięcie pustego wrappera po CTA)
      const completionContainer = dom.qs(".workflow-completion");
      if (completionContainer) {
        console.log("🔄 [WORKFLOW] Removing workflow completion container...");
        try {
          completionContainer.remove();
        } catch (_) {
          completionContainer.style.display = "none";
          completionContainer.classList.add("hidden");
        }
        console.log("✅ [WORKFLOW] Workflow completion removed");
      }

      // Ukryj progress bar (na stałe - nie potrzebny w konfiguratorze)
      if (progressBarContainer) {
        progressBarContainer.style.display = "none";
        progressBarContainer.classList.add("hidden");
        if (progressPlaceholder) {
          progressPlaceholder.style.display = "none";
          progressPlaceholder.classList.remove("active");
        }
      }

      // Pokaż results container (z konfiguratorem)
      console.log("🔄 [WORKFLOW] Showing results container...");
      const resultsContainer = dom.qs(".hp-results");
      if (resultsContainer) {
        // IMPORTANT: .hidden uses display:none !important (main.css),
        // so we must remove the class to make results visible.
        resultsContainer.classList.remove("hidden");
        resultsContainer.style.display = "block";
        console.log("✅ [WORKFLOW] Results container shown");
      }

      // Pokaż results wrapper
      const resultsWrapper = dom.qs(".results-wrapper.section");
      if (resultsWrapper) {
        resultsWrapper.classList.add("active");
        resultsWrapper.style.display = "block";
      }

      // Pokaż konfigurator
      console.log("🔄 [WORKFLOW] Showing configurator view...");
      const configView = dom.byId("configurator-view");
      const switcher = dom.qs('[data-role="results-switcher"]');

      if (configView) {
        configView.classList.remove("hidden");
        configView.classList.add("visible");
        configView.style.display = "block";
        console.log("✅ [WORKFLOW] Configurator view shown");
      } else {
        console.error("❌ [WORKFLOW] Configurator view not found!");
      }

      if (switcher) {
        // Keep switcher visible on configurator view
        switcher.style.display = "flex";
      }

      // Ukryj hero w konfiguratorze (na wypadek wejścia bez ekranu Gratulacje)
      try {
        root.classList.add("hp-hero-hidden");
      } catch (_) { }
      // Safety: mark root as configurator view so global CSS can keep configurator hidden unless explicitly opened
      try {
        root.setAttribute("data-view", "configurator");
      } catch (e) {
        /* ignore */
      }

      // Initialize configurator module lazily when entering configurator view
      console.log("🔧 [WORKFLOW] Initializing configurator module...");
      try {
        const configuratorModule = await ensureConfiguratorModuleAvailable();
        if (configuratorModule && typeof configuratorModule.init === "function") {
          configuratorModule.init({ root, dom, state });
          await initConfiguratorFromBestAvailableInput();
          console.log("✅ [WORKFLOW] Configurator module initialized");
        } else {
          console.warn("⚠️ [WORKFLOW] Configurator module not available");
        }
      } catch (err) {
        console.error("❌ [WORKFLOW] Init configurator failed:", err);
      }

      // Scroll do konfiguratora
      console.log("🔄 [WORKFLOW] Scrolling to configurator...");
      setTimeout(() => {
        const resultsSection = dom.qs('.section[data-tab="6"]');
        const scrollTarget = configView || resultsSection;
        if (scrollTarget) {
          const headerHeight = header ? header.offsetHeight : 60;
          const buffer = 20;
          const targetY = scrollTarget.offsetTop - headerHeight - buffer;
          view.scrollTo({ top: targetY, behavior: "smooth" });
          console.log("✅ [WORKFLOW] Scrolled to configurator");
        }
      }, 100);
    }

    function bindCta() {
      // ⚠️ FIX P0.2: Guard przeciwko duplikacji listenerów (kliknięcia nie mogą odpalać 2×)
      if (root.dataset.ctaListenerBound === "true") {
        return () => { }; // Już zbindowane - zwróć pusty disposer
      }

      const handler = (event) => {
        const actionTarget = event.target?.closest?.("[data-action]");
        const action = actionTarget?.dataset?.action;
        if (action === "start-config") {
          if (!actionTarget || actionTarget.dataset.ctaBusy === "1") {
            return;
          }
          actionTarget.dataset.ctaBusy = "1";
          setWorkflowCtaState(actionTarget, "loading");
          view.setTimeout(() => {
            setWorkflowCtaState(actionTarget, "success");
            startConfigurator(event);
            view.setTimeout(() => {
              setWorkflowCtaState(actionTarget, "idle");
              actionTarget.dataset.ctaBusy = "0";
            }, getMotionDelay(1000));
          }, getMotionDelay(140));
        }
      };
      root.addEventListener("click", handler);
      try {
        root.dataset.ctaListenerBound = "true"; // Oznacz jako zbindowane
        root.dataset.startConfigListener = "true"; // Zachowaj dla kompatybilności
      } catch (e) { }

      return () => {
        root.removeEventListener("click", handler);
        try {
          delete root.dataset.ctaListenerBound;
          delete root.dataset.startConfigListener;
        } catch (e) { }
      };
    }

    // Event listener dla showWorkflowCompletion (wywołane z apiCaller)
    function bindShowWorkflowCompletion() {
      const handler = (event) => {
        console.log(
          "🎬 [WORKFLOW] Event 'heatpump:showWorkflowCompletion' received"
        );
        const result = event.detail?.result;
        if (result) {
          startCompletion(result);
        } else {
          console.warn("⚠️ [WORKFLOW] No result in event detail");
        }
      };
      root.addEventListener("heatpump:showWorkflowCompletion", handler);
      return () =>
        root.removeEventListener("heatpump:showWorkflowCompletion", handler);
    }

    function reset() {
      typewriterActive = false;
      typewriterCompleted = false;
      stickyDisabled = false;
      latestWorkflowResult = null;

      if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
        typewriterTimeout = null;
      }

      const completionContainer = dom.qs(".workflow-completion");
      if (completionContainer) {
        completionContainer.style.display = "none";
      }

      if (progressBarContainer) {
        progressBarContainer.style.display = "";
        progressBarContainer.classList.remove("hidden");
      }
      if (progressPlaceholder) {
        progressPlaceholder.style.display = "none";
        progressPlaceholder.classList.remove("active");
      }

      // Remove configurator view marker when resetting workflow
      try {
        root.removeAttribute("data-view");
      } catch (e) {
        /* ignore */
      }
    }

    if (initialized) return () => { };
    initialized = true;

    if (!progressBar || !form) {
      return () => { };
    }

    updateTriggerOffset();
    setupStickyProgress();
    watchTabs();

    const disposeCta = bindCta();
    const disposeShowWorkflow = bindShowWorkflowCompletion();

    if (state) {
      state.workflowController = { reset };
    }

    return function disposer() {
      if (scrollHandler) view.removeEventListener("scroll", scrollHandler);
      if (resizeHandler) view.removeEventListener("resize", resizeHandler);
      if (observer) observer.disconnect();
      if (disposeCta) disposeCta();
      if (disposeShowWorkflow) disposeShowWorkflow();
      reset();
      if (
        state &&
        state.workflowController &&
        state.workflowController.reset === reset
      ) {
        delete state.workflowController;
      }
    };
  }

  // Eksportuj funkcję showWorkflowCompletion dla apiCaller
  window.showWorkflowCompletion = function (result) {
    console.log("🎬 [WORKFLOW-GLOBAL] showWorkflowCompletion() called");
    console.log("📊 [WORKFLOW-GLOBAL] Result:", result);

    // Multi-root: preferuj aktywny root
    const activeRoot =
      window.__HP_ACTIVE_ROOT__ ||
      document.querySelector(".heatpump-calculator");
    if (!activeRoot) {
      console.error("❌ [WORKFLOW-GLOBAL] No active root found!");
      return;
    }

    // Wywołaj startCompletion bezpośrednio przez re-init modułu
    // (to jest workaround, bo startCompletion jest w closure)
    const event = new CustomEvent("heatpump:showWorkflowCompletion", {
      detail: { result },
      bubbles: true,
    });
    activeRoot.dispatchEvent(event);
    console.log("✅ [WORKFLOW-GLOBAL] Event dispatched");
  };

  window.__HP_MODULES__ = window.__HP_MODULES__ || {};
  window.__HP_MODULES__.workflowController = { init };
})(window);
