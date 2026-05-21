/**
 * OfferDTO contract (v1, migration baseline).
 * @see docs/ecosystem/schemas/offer-dto.v1.json
 *
 * @typedef {Object} OfferDTO
 * @property {string} schemaVersion
 * @property {string} traceId
 * @property {Object} engineering
 * @property {Object} [engineering.ozc]
 * @property {Object|null} [engineering.ozc.audit]
 * @property {Object|null} [engineering.ozc.extended]
 * @property {Object|null} [engineering.buffer]
 * @property {string|null} [engineering.buffer.severity]
 * @property {Object|null} [engineering.buffer.explanation]
 * @property {Object|null} [engineering.cwu]
 * @property {number|null} [engineering.cwu.hotWaterPower_kW]
 * @property {number|null} [engineering.cwu.recommendedCapacityL]
 * @property {Object|null} [engineering.cwu.pricingHint]
 * @property {Object} pricing
 * @property {string|null} [pricing.source]
 * @property {string|null} [pricing.catalogVersion]
 * @property {Array<Object>} [warnings]
 * @property {Array<Object>} [assumptions]
 * @property {Object} [engineMeta]
 * @property {string} [engineMeta.ozcConstantsSource]
 * @property {boolean} [engineMeta.fallbackUsed]
 * @property {Array<string>} [engineMeta.fallbackReasons]
 * @property {string|null} [engineMeta.masterDataVersion]
 */
