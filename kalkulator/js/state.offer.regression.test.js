const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const stateSource = fs.readFileSync(path.join(__dirname, "state.js"), "utf8");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createSandbox() {
  const events = [];
  const storage = new Map();

  const sandbox = {
    console,
    Map,
    Set,
    Date,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    Boolean,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isFinite,
    setTimeout: () => 1,
    clearTimeout: () => {},
    sessionStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    topinstalTrackEvent: (name, payload) => events.push({ name, payload }),
  };

  sandbox.window = sandbox;
  sandbox.formEngine = {};

  vm.runInNewContext(stateSource, sandbox, {
    filename: "state.js",
  });

  const ctx = {
    state: {},
    root: {
      getAttribute: () => "default",
    },
  };

  sandbox.__initState(ctx);

  return {
    sandbox,
    ctx,
    events,
  };
}

test("canonicalOffer becomes primary state truth and syncs legacy alias", () => {
  const { ctx, events } = createSandbox();
  const offer = { traceId: "canonical-trace", pricing: { totals: { gross: 12345 } } };

  ctx.state.setCanonicalOffer(offer);
  const appState = ctx.state.getAppState();

  assert.strictEqual(appState.canonicalOffer, offer);
  assert.strictEqual(appState.offer, offer);
  assert.strictEqual(ctx.state.getCanonicalOffer(appState), offer);
  assert.equal(
    events.some((event) => event.name === "canonical_offer_updated"),
    true
  );
});

test("setOffer remains a transitional alias that still writes canonicalOffer", () => {
  const { ctx } = createSandbox();
  const offer = { traceId: "legacy-alias-trace" };

  ctx.state.setOffer(offer);
  const appState = ctx.state.getAppState();

  assert.strictEqual(appState.canonicalOffer, offer);
  assert.strictEqual(appState.offer, offer);
  assert.strictEqual(ctx.state.getCanonicalOffer(appState), offer);
});

test("offer alias remains the only accepted transitional adapter when canonicalOffer is missing", () => {
  const { ctx, events } = createSandbox();

  ctx.state.updateAppState({
    canonicalOffer: null,
    offer: { traceId: "offer-alias-trace" },
  });

  const resolved = ctx.state.resolveCanonicalOfferState(ctx.state.getAppState(), {
    seam: "projection-test",
  });

  assert.equal(resolved.source, "offer");
  assert.equal(resolved.usedLegacyAdapter, true);
  assert.equal(resolved.offer.traceId, "offer-alias-trace");
  assert.equal(
    events.some((event) => event.name === "legacy_offer_state_adapter_used"),
    true
  );
});

test("canonical_offer_missing telemetry fires when no offer-like state exists", () => {
  const { ctx, events } = createSandbox();

  ctx.state.updateAppState({
    canonicalOffer: null,
    offer: null,
  });

  const resolved = ctx.state.resolveCanonicalOfferState(ctx.state.getAppState(), {
    seam: "missing-offer-test",
  });

  assert.strictEqual(resolved.offer, null);
  assert.equal(resolved.source, "missing");
  assert.equal(
    events.some((event) => event.name === "canonical_offer_missing"),
    true
  );
});
