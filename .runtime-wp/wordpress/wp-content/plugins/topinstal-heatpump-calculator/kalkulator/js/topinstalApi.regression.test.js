const assert = require("assert");
const path = require("path");

function loadModule(relativePath) {
  const modulePath = path.join(__dirname, "..", "..", relativePath);
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function loadApi(relativePath) {
  return loadModule(relativePath).calculateOffer;
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const apiPaths = [
  "kalkulator/js/topinstalApi.js",
  "frontend/api/topinstalApi.js",
];

(async function run() {
  for (const apiPath of apiPaths) {
    await test(`${apiPath} sends wp_rest nonce for logged-in REST requests`, async () => {
      const calculateOffer = loadApi(apiPath);
      const calls = [];

      global.HEATPUMP_CONFIG = {
        nonce: "calc-nonce",
        restNonce: "rest-nonce",
        restCookieAuthEnabled: true,
        calculateOfferEndpoint: "https://example.test/wp-json/topinstal/v1/calculate-offer",
        calculateOfferTimeoutMs: 50,
      };
      global.fetch = async function fetchStub(url, init) {
        calls.push({ url, init });
        return {
          ok: true,
          text: async () => JSON.stringify({ ok: true }),
        };
      };

      await calculateOffer({ building: {} });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].init.headers["X-Topinstal-Nonce"], "calc-nonce");
      assert.equal(calls[0].init.headers["X-WP-Nonce"], "rest-nonce");
    });

    await test(`${apiPath} keeps public requests on custom nonce only`, async () => {
      const calculateOffer = loadApi(apiPath);
      const calls = [];

      global.HEATPUMP_CONFIG = {
        nonce: "calc-nonce",
        restNonce: "rest-nonce",
        restCookieAuthEnabled: false,
        calculateOfferEndpoint: "https://example.test/wp-json/topinstal/v1/calculate-offer",
        calculateOfferTimeoutMs: 50,
      };
      global.fetch = async function fetchStub(url, init) {
        calls.push({ url, init });
        return {
          ok: true,
          text: async () => JSON.stringify({ ok: true }),
        };
      };

      await calculateOffer({ building: {} });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].init.headers["X-Topinstal-Nonce"], "calc-nonce");
      assert.equal("X-WP-Nonce" in calls[0].init.headers, false);
    });

    await test(`${apiPath} offer document error exposes message, errorCode, traceId`, async () => {
      const mod = loadModule(apiPath);
      const generateOfferDocument = mod.generateOfferDocument;
      const extractOfferDocumentErrorFields = mod.extractOfferDocumentErrorFields;
      assert.equal(typeof extractOfferDocumentErrorFields, "function");

      const fields = extractOfferDocumentErrorFields({
        message: "Błąd generatora",
        errorCode: "GEN_TIMEOUT",
        traceId: "tr-1",
        details: { reason: "timeout" },
      });
      assert.equal(fields.message, "Błąd generatora");
      assert.equal(fields.errorCode, "GEN_TIMEOUT");
      assert.equal(fields.traceId, "tr-1");
      assert.equal(fields.details.reason, "timeout");

      global.HEATPUMP_CONFIG = {
        nonce: "n",
        ajaxUrl: "https://example.test/wp-admin/admin-ajax.php",
        offerDocumentTimeoutMs: 80,
      };
      global.fetch = async function fetchStub() {
        return {
          ok: false,
          status: 502,
          text: async () =>
            JSON.stringify({
              success: false,
              data: {
                message: "PDF upstream down",
                errorCode: "E_UPSTREAM",
                traceId: "trace-abc",
                details: {
                  reason: "http_error",
                  upstreamErrorCode: "AGENT_KEY_INVALID",
                },
              },
            }),
        };
      };

      try {
        await generateOfferDocument({ offerDto: { traceId: "x" } });
        assert.fail("expected throw");
      } catch (e) {
        assert.ok(String(e.message).includes("PDF upstream down"), e.message);
        assert.ok(String(e.message).includes("E_UPSTREAM"), e.message);
        assert.ok(String(e.message).includes("trace-abc"), e.message);
        assert.equal(e.errorCode, "E_UPSTREAM");
        assert.equal(e.traceId, "trace-abc");
        assert.equal(e.details.reason, "http_error");
        assert.equal(e.details.upstreamErrorCode, "AGENT_KEY_INVALID");
      }
    });

    await test(`${apiPath} forwards additive machineRoomSnapshot context to offer document endpoint`, async () => {
      const mod = loadModule(apiPath);
      const generateOfferDocument = mod.generateOfferDocument;
      const calls = [];

      global.HEATPUMP_CONFIG = {
        nonce: "n",
        ajaxUrl: "https://example.test/wp-admin/admin-ajax.php",
        offerDocumentTimeoutMs: 80,
      };
      global.fetch = async function fetchStub(url, init) {
        calls.push({ url, init });
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              success: true,
              data: {
                document: {
                  downloadUrl: "https://example.test/doc.pdf",
                  filename: "doc.pdf",
                },
              },
            }),
        };
      };

      await generateOfferDocument({
        offerDto: { traceId: "trace-1" },
        context: {
          source: "kalk-top",
          machineRoomSnapshot: {
            total_brutto_pln: 29052,
            summary_rows: [
              { label: "Pompa ciepla", value: "Panasonic Aquarea 3kW" },
            ],
          },
        },
      });

      assert.equal(calls.length, 1);
      const params = new URLSearchParams(calls[0].init.body);
      const payload = JSON.parse(params.get("payload"));
      assert.equal(payload.context.source, "kalk-top");
      assert.equal(payload.context.machineRoomSnapshot.total_brutto_pln, 29052);
      assert.equal(
        payload.context.machineRoomSnapshot.summary_rows[0].value,
        "Panasonic Aquarea 3kW"
      );
    });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
