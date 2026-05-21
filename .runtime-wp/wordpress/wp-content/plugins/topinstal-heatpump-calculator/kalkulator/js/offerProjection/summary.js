(function (global) {
  "use strict";

  const namespace =
    global.__HP_OFFER_PROJECTION__ || (global.__HP_OFFER_PROJECTION__ = {});
  const core =
    namespace.core ||
    (typeof require === "function" ? require("./core.js") : null);

  function buildSummaryViewModel(input) {
    const context = core.buildOfferProjectionContext(input);
    const offerDto = core.requireOfferDto(context, "summary");

    if (!offerDto) {
      return {
        offerDto: null,
        traceId: null,
        heatLoadKw: null,
        heatLoadLabel: "—",
        pumpModel: "—",
        totalGross: null,
        totalGrossLabel: "—",
        vatRate: null,
        vatNoteVisible: false,
        validUntilLabel: "—",
        breakdown: {
          items: [],
          totals: { net: 0, vat: 0, gross: 0 },
          vat_rate: 0.08,
        },
      };
    }

    core.markProjectionUsed(context, "summary_projection_used", "summary");

    const breakdown = core.buildPricingBreakdown(context);
    const vatRate = core.selectVatRate(context);

    return {
      offerDto,
      traceId: core.selectTraceId(context),
      heatLoadKw: core.selectHeatLoadKw(context),
      heatLoadLabel: core.formatDemandKw(core.selectHeatLoadKw(context)),
      pumpModel: core.selectPumpModel(context) || "W trakcie doboru",
      totalGross: core.selectTotalGross(context),
      totalGrossLabel: core.formatCurrencyPln(
        core.selectTotalGross(context),
        context.uiContext.locale
      ),
      vatRate,
      vatNoteVisible: vatRate === 0.08,
      validUntilLabel: "—",
      breakdown,
    };
  }

  const api = {
    buildSummaryViewModel,
  };

  namespace.summary = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
