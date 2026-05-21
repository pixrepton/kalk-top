(function (global) {
  "use strict";

  const namespace =
    global.__HP_OFFER_PROJECTION__ || (global.__HP_OFFER_PROJECTION__ = {});
  const core =
    namespace.core ||
    (typeof require === "function" ? require("./core.js") : null);

  function formatDateLabel() {
    try {
      return new Date().toLocaleDateString("pl-PL");
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function buildEmailMessageHtml(context) {
    const area = core.selectHeatedAreaM2(context);
    const buildingType = core.resolveBuildingTypeFromContext(context) || "Nie okreslono";
    const heatingType = core.resolveHeatingTypeLabel(context) || "Nie okreslono";
    const pumpModel = core.selectPumpModel(context) || "Nie okreslono";
    const heatLoadKw = core.selectHeatLoadKw(context);
    const totalGross = core.selectTotalGross(context);
    const currentDate = formatDateLabel();

    return `
      <div style="font-family: 'Titillium Web', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a202c;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a574; padding-bottom: 20px;">
          <h1 style="color: #d4a574; font-size: 28px; margin: 0;">TOP-INSTAL</h1>
          <h2 style="color: #4b5563; font-size: 18px; margin: 10px 0;">Dziekujemy za skorzystanie z kalkulatora!</h2>
        </div>

        <div style="margin-bottom: 25px;">
          <p style="font-size: 16px; line-height: 1.6;">Szanowni Panstwo,</p>
          <p style="font-size: 14px; line-height: 1.6;">
            Dziekujemy za skorzystanie z kalkulatora pomp ciepla TOP-INSTAL.
            W zalaczniku znajda Panstwo szczegolowa oferte dopasowana do Panstwa budynku.
          </p>

          <div style="background: #faf9f9; padding: 20px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #d4a574;">
            <h3 style="color: #d4a574; margin-top: 0;">Podsumowanie Panstwa konfiguracji:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li><strong>Powierzchnia:</strong> ${
                area != null ? `${String(Math.round(area * 10) / 10)} m2` : "Nie podano"
              }</li>
              <li><strong>Typ budynku:</strong> ${core.escapeHtml(buildingType)}</li>
              <li><strong>System ogrzewania:</strong> ${core.escapeHtml(heatingType)}</li>
              <li><strong>Rekomendowana pompa:</strong> ${core.escapeHtml(pumpModel)}</li>
              ${
                heatLoadKw != null
                  ? `<li><strong>Moc budynku (OZC):</strong> ${core.escapeHtml(
                      core.formatDemandKw(heatLoadKw)
                    )} kW</li>`
                  : ""
              }
              ${
                totalGross != null
                  ? `<li><strong>Cena brutto:</strong> ${core.escapeHtml(
                      core.formatCurrencyPln(totalGross, context.uiContext.locale)
                    )}</li>`
                  : ""
              }
            </ul>
          </div>

          <p style="font-size: 14px; line-height: 1.6;">
            Oferta jest przygotowana na podstawie wprowadzonych danych.
            Dla finalnego potwierdzenia handlowego zapraszamy do kontaktu z naszym zespolam.
          </p>
        </div>

        <div style="background: #d4a574; color: white; padding: 20px; border-radius: 4px; text-align: center; margin: 30px 0;">
          <h3 style="margin: 0 0 10px 0;">Skontaktuj sie z nami</h3>
          <p style="margin: 5px 0;">Tel: +48 123 456 789</p>
          <p style="margin: 5px 0;">Email: biuro@top-instal.pl</p>
          <p style="margin: 5px 0;">www.top-instal.pl</p>
        </div>

        <div style="text-align: center; color: #4b5563; font-size: 12px; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          <p>Z powazaniem,<br><strong>Zespol TOP-INSTAL</strong></p>
          <p style="margin-top: 15px;">Email wygenerowany automatycznie - ${core.escapeHtml(
            currentDate
          )}</p>
        </div>
      </div>`;
  }

  function buildEmailPayload(input) {
    const context = core.buildOfferProjectionContext(input);
    const offerDto = core.requireOfferDto(context, "email");

    if (!offerDto) {
      return {
        offerDto: null,
        traceId: null,
        subject: null,
        messageHtml: null,
        clientData: null,
        projection_blocked_reason: "missing_offer_dto",
      };
    }

    core.markProjectionUsed(context, "email_projection_used", "email");

    const subjectDate = formatDateLabel();
    return {
      offerDto,
      traceId: core.selectTraceId(context),
      projection_blocked_reason: null,
      subject: `Oferta pompy ciepla TOP-INSTAL - ${subjectDate}`,
      messageHtml: buildEmailMessageHtml(context),
      clientData: {
        buildingArea: core.selectHeatedAreaM2(context) || "Nie podano",
        buildingType: core.resolveBuildingTypeFromContext(context) || "Nie okreslono",
        heatingType: core.resolveHeatingTypeLabel(context) || "Nie okreslono",
        recommendedPump: core.selectPumpModel(context) || "Nie okreslono",
        priceGrossPln: core.selectTotalGross(context),
      },
    };
  }

  const api = {
    buildEmailPayload,
  };

  namespace.email = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
