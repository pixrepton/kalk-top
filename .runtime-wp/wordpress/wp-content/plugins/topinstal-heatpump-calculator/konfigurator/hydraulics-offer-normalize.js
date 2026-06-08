/**
 * Canonical mapping: OfferDTO engineering.buffer → configurator hydraulics UI.
 * Loaded before configurator-unified.js; exposed as window.TopinstalHydraulicsOfferNormalize.
 */
(function (root) {
  "use strict";

  function toFiniteNumber(value, fallback) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function pickPositiveBufferLiters(...values) {
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (value === null || value === undefined || value === "") continue;
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
    return null;
  }

  const BUFFER_REQUIRED_CODES = new Set([
    "FLOW_RISK_UNDERFLOOR_ACTUATORS",
    "MIXED_CIRCUITS_SEPARATION",
    "BIVALENT_SOLID_FUEL",
    "BIVALENT_FIREPLACE_WATER_JACKET",
    "ANTI_CYCLING_STORAGE_REQUIRED",
    "INSUFFICIENT_SYSTEM_VOLUME",
    "MANUFACTURER_3PH_K_200L",
  ]);

  function normalizeHydraulicsRecommendationFromOffer(bufferResult) {
    if (!bufferResult || typeof bufferResult !== "object") {
      return {
        recommendation: "NONE",
        buffer_liters: null,
        setupType: "NONE",
        reason_codes: [],
        severity: "INFO",
        dominantReason: "BUFFER_PAYLOAD_EMPTY",
      };
    }

    const recommendationPayload =
      bufferResult.recommendation && typeof bufferResult.recommendation === "object"
        ? bufferResult.recommendation
        : {};
    const sizingPayload =
      bufferResult.sizing && typeof bufferResult.sizing === "object"
        ? bufferResult.sizing
        : {};

    const rawSetup = String(
      recommendationPayload.setupType || bufferResult.setupType || ""
    )
      .trim()
      .toUpperCase();
    const rawRecommendation = String(
      recommendationPayload.recommendation ||
      (typeof bufferResult.recommendation === "string"
        ? bufferResult.recommendation
        : "")
    )
      .trim()
      .toUpperCase();

    const sizingMax = pickPositiveBufferLiters(
      sizingPayload?.antiCycling?.liters,
      sizingPayload?.bivalent?.liters,
      sizingPayload?.hydraulic?.liters
    );

    let liters = pickPositiveBufferLiters(
      bufferResult.liters,
      bufferResult.buffer_liters,
      bufferResult.roundedTo,
      bufferResult.computedLiters,
      bufferResult.marketCapacityLiters,
      recommendationPayload.buffer_liters,
      recommendationPayload.roundedTo,
      recommendationPayload.marketCapacityLiters,
      sizingPayload?.calculatedCapacity_liters,
      sizingMax
    );

    let recommendation = "NONE";
    let setupType = "NONE";

    if (
      rawRecommendation.indexOf("ROWNO") !== -1 ||
      rawSetup === "PARALLEL_CLUTCH" ||
      rawSetup.indexOf("PARALLEL") !== -1
    ) {
      recommendation = "BUFOR_RÓWNOLEGLE";
      setupType = "PARALLEL_CLUTCH";
    } else if (
      rawRecommendation.indexOf("SZEREG") !== -1 ||
      rawSetup === "SERIES_BYPASS" ||
      rawSetup.indexOf("SERIES") !== -1
    ) {
      recommendation = "BUFOR_SZEREGOWO";
      setupType = "SERIES_BYPASS";
    }

    const reasonCodes = Array.isArray(recommendationPayload.reason_codes)
      ? recommendationPayload.reason_codes.map((code) => String(code))
      : Array.isArray(bufferResult.reasonCodes)
        ? bufferResult.reasonCodes.map((code) => String(code))
        : [];

    const axes =
      recommendationPayload.axes && typeof recommendationPayload.axes === "object"
        ? {
          flow_protection: recommendationPayload.axes.flow_protection || null,
          hydraulic_separation:
            recommendationPayload.axes.hydraulic_separation || null,
          energy_storage: recommendationPayload.axes.energy_storage || null,
        }
        : {
          flow_protection: null,
          hydraulic_separation: null,
          energy_storage: null,
        };

    const dominant =
      typeof recommendationPayload.dominant === "string" &&
        recommendationPayload.dominant.trim() !== ""
        ? recommendationPayload.dominant.trim()
        : null;

    const sizingComponents =
      sizingPayload &&
        (sizingPayload.antiCycling || sizingPayload.bivalent || sizingPayload.hydraulic)
        ? {
          antiCycling: sizingPayload.antiCycling || null,
          bivalent: sizingPayload.bivalent || null,
          hydraulic: sizingPayload.hydraulic || null,
          systemVolume: sizingPayload.systemVolume || null,
        }
        : undefined;

    const requiredSystemVolume = toFiniteNumber(
      sizingPayload?.systemVolume?.required_liters,
      null
    );
    const estimatedSystemVolume = toFiniteNumber(
      sizingPayload?.systemVolume?.estimated_liters,
      null
    );
    const systemVolumeSufficient =
      typeof sizingPayload?.systemVolume?.sufficient === "boolean"
        ? sizingPayload.systemVolume.sufficient
        : typeof bufferResult.systemVolumeSufficient === "boolean"
          ? bufferResult.systemVolumeSufficient
          : null;

    const bufferRequiredByAxis =
      axes.flow_protection === "REQUIRED" ||
      axes.hydraulic_separation === "REQUIRED" ||
      axes.energy_storage === "MANDATORY";

    const bufferRequiredByCode = reasonCodes.some((code) =>
      BUFFER_REQUIRED_CODES.has(String(code || "").toUpperCase())
    );

    const backendRequiresBuffer =
      setupType !== "NONE" ||
      bufferRequiredByAxis ||
      bufferRequiredByCode ||
      bufferResult.hydraulicSeparationRequired === true;

    if (backendRequiresBuffer) {
      if (setupType === "NONE") {
        recommendation =
          axes.hydraulic_separation === "REQUIRED" ||
            axes.energy_storage === "MANDATORY"
            ? "BUFOR_RÓWNOLEGLE"
            : "BUFOR_SZEREGOWO";
        setupType =
          recommendation === "BUFOR_RÓWNOLEGLE" ? "PARALLEL_CLUTCH" : "SERIES_BYPASS";
      }
      if (!liters) {
        liters = pickPositiveBufferLiters(
          bufferResult.manufacturerPolicyMinimumLiters,
          recommendationPayload.manufacturerPolicyMinimumLiters,
          sizingMax
        );
      }
    } else {
      recommendation = "NONE";
      setupType = "NONE";
      liters = null;
    }

    const dominantReason =
      reasonCodes.length > 0
        ? String(reasonCodes[0])
        : recommendation === "NONE"
          ? "BUFFER_NOT_REQUIRED"
          : "BUFFER_BACKEND_RECOMMENDED";

    const severity =
      recommendation === "NONE"
        ? "INFO"
        : axes.energy_storage === "OPTIONAL"
          ? "RECOMMENDED"
          : "MANDATORY";

    return {
      recommendation,
      buffer_liters: liters,
      setupType,
      marketCapacityLiters: pickPositiveBufferLiters(
        bufferResult.marketCapacityLiters,
        recommendationPayload.marketCapacityLiters
      ),
      manufacturerPolicyMinimumLiters: pickPositiveBufferLiters(
        bufferResult.manufacturerPolicyMinimumLiters,
        recommendationPayload.manufacturerPolicyMinimumLiters
      ),
      manufacturerPolicyApplied: !!(
        bufferResult.manufacturerPolicyApplied ||
        recommendationPayload.manufacturerPolicyApplied
      ),
      reason_codes: reasonCodes,
      severity,
      type:
        recommendationPayload.type ||
        (recommendation === "NONE"
          ? "none"
          : recommendation === "BUFOR_SZEREGOWO"
            ? "storage"
            : "both"),
      axes,
      dominant,
      dominantReason,
      sizingComponents,
      computedLiters: toFiniteNumber(sizingPayload?.calculatedCapacity_liters, null),
      roundedTo: liters,
      requiredSystemVolume,
      estimatedSystemVolume,
      systemVolumeSufficient,
      warnings: Array.isArray(bufferResult.warnings) ? bufferResult.warnings : [],
      assumptions: Array.isArray(bufferResult.assumptions)
        ? bufferResult.assumptions
        : [],
      explanation: {
        short: dominantReason || "Backend recommendation",
        long: dominantReason || "Backend recommendation",
      },
    };
  }

  function resolveBufferUiPresentation(hr) {
    if (!hr || hr.pending || hr.recommendation == null) {
      return null;
    }

    let setupType = String(hr.setupType || "NONE").toUpperCase();
    let recommendation = hr.recommendation;
    let liters = pickPositiveBufferLiters(
      hr.buffer_liters,
      hr.roundedTo,
      hr.computedLiters,
      hr.marketCapacityLiters,
      hr.manufacturerPolicyMinimumLiters
    );

    if (
      (recommendation === "NONE" || !recommendation) &&
      setupType !== "NONE" &&
      setupType !== "PENDING" &&
      setupType !== "INPUT_REQUIRED"
    ) {
      recommendation =
        setupType === "PARALLEL_CLUTCH" ? "BUFOR_RÓWNOLEGLE" : "BUFOR_SZEREGOWO";
    }

    if (recommendation === "NONE" || setupType === "NONE") {
      return { recommendation: "NONE", setupType: "NONE", liters: null };
    }

    if (!liters) {
      liters = pickPositiveBufferLiters(
        hr.manufacturerPolicyMinimumLiters,
        hr.marketCapacityLiters
      );
    }

    return { recommendation, setupType, liters: liters || null };
  }

  const api = {
    pickPositiveBufferLiters,
    normalizeHydraulicsRecommendationFromOffer,
    resolveBufferUiPresentation,
    BUFFER_REQUIRED_CODES,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.TopinstalHydraulicsOfferNormalize = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
