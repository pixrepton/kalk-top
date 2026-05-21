/**
 * Email Sender Module - Heat Pump Calculator Email System
 * TOP-INSTAL Email Integration with PDF Attachment
 *
 * Endpoint wysyłki: wyłącznie HEATPUMP_CONFIG.emailProxyUrl (wstrzykiwane z WordPress).
 * Opcjonalny skrypt proxy (np. email-proxy.php) to kwestia deploymentu w katalogu głównym
 * witryny lub adresu podanego przez filtr topinstal_email_proxy_url — nie jest bundlowany w wtyczce.
 */

(function () {
  'use strict';

  // Przechowywanie stanu wysyłek emaili
  let emailSendingInProgress = false;

  function emitEmailProjectionEvent(eventName, meta = {}) {
    const details = meta && typeof meta === 'object' ? meta : {};
    try {
      if (typeof window.topinstalTrackEvent === 'function') {
        window.topinstalTrackEvent(eventName, {
          source: 'calc',
          tab: 5,
          stepKey: 'email',
          meta: details,
        });
      }
    } catch (_) {}
    try {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[emailSender] ${eventName}`, details);
      }
    } catch (_) {}
  }

  function getEmailPayload(bundle) {
    return bundle && bundle.emailPayload && typeof bundle.emailPayload === 'object'
      ? bundle.emailPayload
      : null;
  }

  function getDocumentPayload(bundle) {
    return bundle && bundle.documentPayload && typeof bundle.documentPayload === 'object'
      ? bundle.documentPayload
      : null;
  }

  function getOfferDto(bundle) {
    const emailPayload = getEmailPayload(bundle);
    if (emailPayload && emailPayload.offerDto && typeof emailPayload.offerDto === 'object') {
      return emailPayload.offerDto;
    }
    const documentPayload = getDocumentPayload(bundle);
    if (documentPayload && documentPayload.offer_dto && typeof documentPayload.offer_dto === 'object') {
      return documentPayload.offer_dto;
    }
    return null;
  }

  function requireOfferDtoForEmail(bundle, target = 'email') {
    const offerDto = getOfferDto(bundle);
    if (offerDto) {
      return offerDto;
    }

    emitEmailProjectionEvent('offer_projection_missing_offer_dto', {
      target,
      channel: 'email',
    });
    emitEmailProjectionEvent('email_blocked_no_offer_dto', {
      target,
      channel: 'email',
    });

    return null;
  }

  /**
   * Sends offer email with PDF attachment
   * @param {Object} bundle - Projection bundle with emailPayload and documentPayload
   * @param {string} emailAddress - Recipient email address
   * @returns {Promise} Email sending promise
   */
  async function sendOfferByEmail(bundle, emailAddress) {
    // Zapobiegaj wielokrotnym wysyłkom
    if (emailSendingInProgress) {
      console.warn('Email już jest wysyłany, proszę czekać...');
      return;
    }

    try {
      emailSendingInProgress = true;

      // Walidacja danych wejściowych
      if (!bundle || typeof bundle !== 'object') {
        throw new Error('Brak pakietu danych email/document projection');
      }

      if (!emailAddress) {
        throw new Error('Podaj adres email');
      }

      if (!isValidEmail(emailAddress)) {
        throw new Error('Podaj prawidłowy adres email (np. nazwa@firma.pl)');
      }

      const emailPayload = getEmailPayload(bundle);
      const documentPayload = getDocumentPayload(bundle);
      const offerDto = requireOfferDtoForEmail(bundle, 'email');
      if (!offerDto) {
        throw new Error('Wysyłka email wymaga kanonicznego offer_dto z backendu.');
      }
      if (!emailPayload || !documentPayload) {
        throw new Error('Wysylka email wymaga emailPayload i documentPayload.');
      }
      if (documentPayload.projection_blocked_reason === 'missing_offer_dto') {
        emitEmailProjectionEvent('email_blocked_no_offer_dto', {
          target: 'email',
          channel: 'email',
          reason: 'document_projection_missing_offer_dto',
        });
        throw new Error('Załącznik email wymaga dokumentu z kanonicznym offer_dto.');
      }

      // Show loading indicator with timeout protection
      showEmailLoadingState();

      // Timeout dla całego procesu (30 sekund)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Przekroczono czas oczekiwania (30s)')), 30000);
      });

      // Główny proces wysyłki
      const sendProcess = async () => {
        // Generate PDF data first
        const pdfData = await generatePDFForEmail(documentPayload);

        // Prepare email data
        const emailData = {
          to: emailAddress.trim(),
          subject:
            (typeof emailPayload.subject === 'string' && emailPayload.subject.trim() !== ''
              ? emailPayload.subject
              : `Oferta pompy ciepła TOP-INSTAL - ${new Date().toLocaleDateString('pl-PL')}`),
          message:
            typeof emailPayload.messageHtml === 'string' ? emailPayload.messageHtml : '',
          pdfData: pdfData,
          clientData:
            emailPayload.clientData && typeof emailPayload.clientData === 'object'
              ? emailPayload.clientData
              : {},
          traceId: emailPayload.traceId || documentPayload?.offer_dto?.traceId || null,
        };

        // Send email via HTTP endpoint configured in WordPress (see heatpump-calculator.php HEATPUMP_CONFIG).
        const cfg = window.HEATPUMP_CONFIG || {};
        const emailProxyUrl = cfg.emailProxyUrl ? String(cfg.emailProxyUrl).trim() : '';

        if (!emailProxyUrl) {
          throw new Error(
            'Brak konfiguracji emailProxyUrl (HEATPUMP_CONFIG). Ustaw endpoint wysyłki w konfiguracji wtyczki WordPress (lub filtr topinstal_email_proxy_url).'
          );
        }

        const normalizedSiteUrl = cfg.siteUrl ? String(cfg.siteUrl).replace(/\/+$/, '') : '';
        const normalizedEmailProxyUrl = String(emailProxyUrl).replace(/\/+$/, '');
        const isDefaultSiteEmailProxy =
          normalizedSiteUrl !== '' &&
          normalizedEmailProxyUrl.toLowerCase() === `${normalizedSiteUrl}/email-proxy.php`.toLowerCase();
        if (cfg.emailProxyAvailable === false && isDefaultSiteEmailProxy) {
          throw new Error(
            'Skrypt proxy pod adresem emailProxyUrl nie jest dostępny na serwerze (brak pliku w katalogu głównym WordPress). Ustaw inny URL w HEATPUMP_CONFIG.emailProxyUrl lub wdróż proxy zgodnie z dokumentacją hostingu.'
          );
        }

        // Dodaj nonce jeśli dostępny (WordPress security)
        const headers = {
          'Content-Type': 'application/json',
        };

        if (window.HEATPUMP_CONFIG && window.HEATPUMP_CONFIG.nonce) {
          headers['X-WP-Nonce'] = window.HEATPUMP_CONFIG.nonce;
        }

        const response = await fetch(emailProxyUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(emailData),
        });

        if (!response.ok) {
          throw new Error(`Błąd serwera: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          showEmailSuccessMessage(emailAddress);

          // Wyczyść pole email po sukcesie
          const emailInput = hpQs('input[type="email"]');
          if (emailInput) {
            emailInput.value = '';
          }

          return result;
        } else {
          throw new Error(result.error || 'Nieznany błąd serwera email');
        }
      };

      // Uruchom z timeoutem
      const result = await Promise.race([sendProcess(), timeoutPromise]);
      return result;
    } catch (error) {
      console.error('❌ Błąd wysyłki email:', error);

      // Kategoryzacja błędów dla lepszego UX
      let userMessage = error.message;

      if (error.message.includes('fetch')) {
        userMessage = 'Brak połączenia z serwerem. Sprawdź połączenie internetowe.';
      } else if (error.message.includes('timeout') || error.message.includes('Przekroczono czas')) {
        userMessage = 'Wysyłka trwa za długo. Spróbuj ponownie za chwilę.';
      } else if (error.message.includes('500')) {
        userMessage = 'Tymczasowy błąd serwera. Spróbuj ponownie za kilka minut.';
      }

      showEmailErrorMessage(userMessage);
      throw error;
    } finally {
      hideEmailLoadingState();
      emailSendingInProgress = false;
    }
  }

  /**
   * Creates email message content
   * @param {Object} configData - Configuration data
   * @returns {string} HTML email content
   */
  function createEmailMessage(configData, offerDto) {
    const currentDate = new Date().toLocaleDateString('pl-PL');
    const pumpModel = offerDto?.engineering?.selection?.pumpModel || 'Nie określono';
    const heatLoadKw =
      (typeof offerDto?.engineering?.ozc?.designHeatLoss_kW === 'number'
        ? offerDto.engineering.ozc.designHeatLoss_kW
        : null);
    const totalGross =
      typeof offerDto?.pricing?.totals?.gross === 'number'
        ? offerDto.pricing.totals.gross
        : null;

    const fmtPln = (n) => {
      if (typeof n !== 'number' || !isFinite(n)) return null;
      try {
        return n.toLocaleString('pl-PL') + ' zł';
      } catch (e) {
        return String(Math.round(n)) + ' zł';
      }
    };

    return `
        <div style="font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a202c;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a574; padding-bottom: 20px;">
                <h1 style="color: #d4a574; font-size: 28px; margin: 0;">TOP-INSTAL</h1>
                <h2 style="color: #4b5563; font-size: 18px; margin: 10px 0;">Dziękujemy za skorzystanie z kalkulatora!</h2>
            </div>

            <div style="margin-bottom: 25px;">
                <p style="font-size: 16px; line-height: 1.6;">Szanowni Państwo,</p>

                <p style="font-size: 14px; line-height: 1.6;">
                    Dziękujemy za skorzystanie z kalkulatora pomp ciepła TOP-INSTAL.
                    W załączniku znajdą Państwo szczegółową ofertę dopasowaną do Państwa budynku.
                </p>

                <div style="background: #faf9f9; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #d4a574;">
                    <h3 style="color: #d4a574; margin-top: 0;">Podsumowanie Państwa konfiguracji:</h3>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li><strong>Powierzchnia:</strong> ${
                          offerDto?.engineering?.ozc?.heatedArea_m2 || configData.heated_area || 'Nie podano'
                        } m²</li>
                        <li><strong>Typ budynku:</strong> ${getBuildingTypeText(configData, offerDto)}</li>
                        <li><strong>System ogrzewania:</strong> ${getHeatingTypeText(
                          configData,
                          offerDto
                        )}</li>
                        <li><strong>Rekomendowana pompa:</strong> ${pumpModel}</li>
                        ${
                          heatLoadKw != null
                            ? `<li><strong>Moc budynku (OZC):</strong> ${String(
                                Math.round(heatLoadKw * 100) / 100
                              )} kW</li>`
                            : ''
                        }
                        ${
                          totalGross != null
                            ? `<li><strong>Cena brutto:</strong> ${fmtPln(totalGross)}</li>`
                            : ''
                        }
                    </ul>
                </div>

                <p style="font-size: 14px; line-height: 1.6;">
                    Nasza oferta jest przygotowana na podstawie wprowadzonych przez Państwa danych.
                    Dla uzyskania dokładnej wyceny, zapraszamy do kontaktu z naszymi specjalistami.
                </p>
            </div>

            <div style="background: #d4a574; color: white; padding: 20px; border-radius: 4px; text-align: center; margin: 30px 0;">
                <h3 style="margin: 0 0 10px 0;">Skontaktuj się z nami</h3>
                <p style="margin: 5px 0;">📞 Tel: +48 123 456 789</p>
                <p style="margin: 5px 0;">📧 Email: biuro@top-instal.pl</p>
                <p style="margin: 5px 0;">🌐 www.top-instal.pl</p>
            </div>

            <div style="text-align: center; color: #4b5563; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
                <p>Z poważaniem,<br><strong>Zespół TOP-INSTAL</strong></p>
                <p style="margin-top: 15px;">Email wygenerowany automatycznie - ${currentDate}</p>
            </div>
        </div>`;
  }

  /**
   * Creates PDF content specifically for email (simplified version)
   * @param {Object} configData - Configuration data
   * @returns {string} HTML content for PDF
   */
  function createPDFContentForEmail(documentPayload) {
    if (
      documentPayload &&
      documentPayload.offer_dto &&
      typeof window.createPDFContent === 'function'
    ) {
      return window.createPDFContent(documentPayload);
    }

    throw new Error('Brak kanonicznego generatora PDF dla email. Załącznik wymaga offer_dto i createPDFContent().');
  }

  // Helper functions
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function getOfferDto(data) {
    const emailPayload = data && data.emailPayload && typeof data.emailPayload === 'object'
      ? data.emailPayload
      : null;
    if (emailPayload && emailPayload.offerDto && typeof emailPayload.offerDto === 'object') {
      return emailPayload.offerDto;
    }
    if (data && data.offer_dto && typeof data.offer_dto === 'object') {
      return data.offer_dto;
    }
    const documentPayload =
      data && data.documentPayload && typeof data.documentPayload === 'object'
        ? data.documentPayload
        : null;
    if (documentPayload && documentPayload.offer_dto && typeof documentPayload.offer_dto === 'object') {
      return documentPayload.offer_dto;
    }
    return null;
  }

  function getBuildingTypeText(data, offerDto = getOfferDto(data)) {
    if (typeof data?.building_type_label === 'string' && data.building_type_label.trim() !== '') {
      return data.building_type_label.trim();
    }
    const backendBuildingType =
      offerDto?.context?.buildingType ||
      offerDto?.engineering?.ozc?.buildingType ||
      null;
    if (backendBuildingType === 'house' || backendBuildingType === 'single_house') {
      return 'Dom jednorodzinny';
    }
    if (backendBuildingType === 'apartment') {
      return 'Mieszkanie';
    }
    if (data.buildingType === 'house') return 'Dom jednorodzinny';
    if (data.buildingType === 'apartment') return 'Mieszkanie';
    return 'Nie określono';
  }

  function getHeatingTypeText(data, offerDto = getOfferDto(data)) {
    if (typeof data?.heating_type_label === 'string' && data.heating_type_label.trim() !== '') {
      return data.heating_type_label.trim();
    }
    const backendType = offerDto?.engineering?.selection?.type || null;
    if (backendType === 'radiators') return 'Grzejniki';
    if (backendType === 'surface' || backendType === 'underfloor') {
      return 'Ogrzewanie podłogowe';
    }
    if (backendType === 'mixed') return 'Mieszane';
    if (data.heatingType === 'radiators') return 'Grzejniki';
    if (data.heatingType === 'floor') return 'Ogrzewanie podłogowe';
    return 'Mieszane';
  }

  // UI Helper functions
  function showEmailLoadingState() {
    const button = hpQs('.email-send-button');
    if (button) {
      button.disabled = true;
      button.innerHTML = '📧 Wysyłam...';
      button.style.opacity = '0.7';
    }
  }

  function hideEmailLoadingState() {
    const button = hpQs('.email-send-button');
    if (button) {
      button.disabled = false;
      button.innerHTML = '📧 Wyślij PDF';
      button.style.opacity = '1';
    }
  }

  function showEmailSuccessMessage(email) {
    const message = `✅ Oferta została wysłana na adres: ${email}`;
    showNotification(message, 'success');
  }

  function showEmailErrorMessage(error) {
    const message = `❌ Błąd wysyłki: ${error}`;
    showNotification(message, 'error');
  }

  function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `email-notification ${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
            color: ${type === 'success' ? '#155724' : '#721c24'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] : '';
        if (!base64) {
          reject(new Error('Generator zwrócił pusty plik PDF.'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Nie udało się odczytać PDF z generatora.'));
      reader.readAsDataURL(blob);
    });
  }

  async function fetchGeneratorPdfBase64(downloadUrl) {
    if (!downloadUrl) {
      throw new Error('Brak adresu pobierania PDF z generatora.');
    }

    const response = await fetch(downloadUrl, {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`Pobranie PDF z generatora nie powiodło się (${response.status}).`);
    }

    const pdfBlob = await response.blob();
    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error('Generator zwrócił pusty plik PDF.');
    }

    return blobToBase64(pdfBlob);
  }

  function cloneMachineRoomSnapshot(snapshot = {}) {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    return {
      ...snapshot,
      items: Array.isArray(snapshot.items)
        ? snapshot.items.map((item) => ({ ...item }))
        : [],
      summary_rows: Array.isArray(snapshot.summary_rows)
        ? snapshot.summary_rows.map((row) => ({ ...row }))
        : [],
      selections:
        snapshot.selections && typeof snapshot.selections === "object"
          ? { ...snapshot.selections }
          : {},
      products:
        snapshot.products && typeof snapshot.products === "object"
          ? { ...snapshot.products }
          : {},
      selected_components:
        snapshot.selected_components && typeof snapshot.selected_components === "object"
          ? { ...snapshot.selected_components }
          : {},
      recommendations:
        snapshot.recommendations && typeof snapshot.recommendations === "object"
          ? { ...snapshot.recommendations }
          : {},
    };
  }

  function buildOfferDocumentContext(documentPayload = {}) {
    return {
      source: "kalk-top",
      channel: "email_attachment",
      documentMode: "offer",
      generatedAt: new Date().toISOString(),
      traceId: documentPayload?.traceId || documentPayload?.offer_dto?.traceId || null,
      machineRoomSnapshot: cloneMachineRoomSnapshot(documentPayload?.machine_room),
    };
  }

  /**
   * PDF dla załącznika email: kanoniczna ścieżka przez topinstalApi.generateOfferDocument (backend),
   * następnie pobranie binariów i zakodowanie base64 dla email-proxy.
   */
  async function generatePDFForEmail(documentPayload) {
    if (!documentPayload || typeof documentPayload !== 'object') {
      throw new Error('Brak documentPayload do PDF.');
    }

    const offerDto =
      documentPayload.offer_dto && typeof documentPayload.offer_dto === 'object'
        ? documentPayload.offer_dto
        : null;
    if (!offerDto) {
      throw new Error('Brak offer_dto dla załącznika email.');
    }

    if (
      !window.topinstalApi ||
      typeof window.topinstalApi.generateOfferDocument !== 'function'
    ) {
      throw new Error('Brak API generatora oferty.');
    }

    const generated = await window.topinstalApi.generateOfferDocument({
      mode: 'from-offer-dto',
      documentType: 'offer_document',
      outputFormat: 'pdf',
      traceId: documentPayload.traceId || offerDto.traceId || null,
      offerDto,
      context: buildOfferDocumentContext(documentPayload),
    }, {
      timeoutMs:
        Number(window?.HEATPUMP_CONFIG?.offerDocumentTimeoutMs) > 0
          ? Number(window.HEATPUMP_CONFIG.offerDocumentTimeoutMs)
          : 150000,
    });
    const downloadUrl = generated?.document?.downloadUrl || '';

    return fetchGeneratorPdfBase64(downloadUrl);
  }

  // Export to global scope for compatibility
  window.sendOfferByEmail = sendOfferByEmail;

})();
