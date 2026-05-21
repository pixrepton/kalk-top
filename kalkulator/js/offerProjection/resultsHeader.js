(function (global) {
  "use strict";

  const namespace =
    global.__HP_OFFER_PROJECTION__ || (global.__HP_OFFER_PROJECTION__ = {});
  const core =
    namespace.core ||
    (typeof require === "function" ? require("./core.js") : null);

  function buildResultsHeaderViewModel(input) {
    const context = core.buildOfferProjectionContext(input);
    const offerDto = core.requireOfferDto(context, "results_header");

    if (!offerDto) {
      return {
        offerDto: null,
        traceId: null,
        demandKw: "—",
        recommendedModel: "W trakcie doboru",
        priceLabel: "Do wyceny po konfiguracji",
      };
    }

    core.markProjectionUsed(
      context,
      "results_header_projection_used",
      "results_header"
    );

    return {
      offerDto,
      traceId: core.selectTraceId(context),
      demandKw: core.formatDemandKw(core.selectHeatLoadKw(context)),
      recommendedModel: core.selectPumpModel(context) || "W trakcie doboru",
      priceLabel: core.formatCurrencyPln(
        core.selectTotalGross(context),
        context.uiContext.locale
      ),
    };
  }

  const api = {
    buildResultsHeaderViewModel,
  };

  namespace.resultsHeader = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
