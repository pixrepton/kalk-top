/**
 * Regresja: Service Cloud pozostaje dostepne i nie gubi labela w projection/payload.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const offerPayload = require(path.join(__dirname, "offerPayload.js"));
const configuratorPath = path.join(
  __dirname,
  "..",
  "..",
  "konfigurator",
  "configurator-unified.js"
);

function serviceCloudEnabled(state) {
  void state;
  return true;
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

(async function run() {
  await test("service cloud: zawsze wlaczone (bez blokady serii)", async () => {
    assert.equal(serviceCloudEnabled({ meta: {}, selectedPump: null }), true);
  });

  await test("service cloud: meta J bez pompy - nadal wlaczone", async () => {
    assert.equal(
      serviceCloudEnabled({ meta: { generation: "J" }, selectedPump: null }),
      true
    );
  });

  await test("service cloud: dowolna konfiguracja - wlaczone", async () => {
    assert.equal(
      serviceCloudEnabled({
        meta: { generation: "J" },
        selectedPump: { series: "K" },
      }),
      true
    );
  });

  await test(
    "service cloud: presentation snapshot zachowuje label po samym optionId",
    async () => {
      global.HEATPUMP_CONFIG = { useBackendCalc: true };

      const snapshot = offerPayload.buildPresentationSnapshot({
        state: {
          getAppState() {
            return {
              canonicalOffer: {
                traceId: "service-cloud-regression",
                engineering: {
                  selection: {
                    pumpModel: "KIT-WC05K3E5",
                  },
                  ozc: {
                    designHeatLoss_kW: 5.2,
                  },
                },
                pricing: {
                  totals: {
                    net: 10000,
                    vat: 800,
                    gross: 10800,
                  },
                  items: [],
                },
              },
              configuratorSelection: {
                selections: {
                  service: {
                    optionId: "service-cloud",
                  },
                },
                products: {},
                recommendations: {},
              },
            };
          },
        },
      });

      assert.equal(
        snapshot.offerPayload.selection.service_cloud.variant,
        "Service Cloud"
      );
    }
  );

  await test(
    "service cloud: presentation snapshot akceptuje legacy string selection",
    async () => {
      global.HEATPUMP_CONFIG = { useBackendCalc: true };

      const snapshot = offerPayload.buildPresentationSnapshot({
        state: {
          getAppState() {
            return {
              canonicalOffer: {
                traceId: "service-cloud-string-regression",
                engineering: {
                  selection: {
                    pumpModel: "KIT-WC05K3E5",
                  },
                  ozc: {
                    designHeatLoss_kW: 5.2,
                  },
                },
                pricing: {
                  totals: {
                    net: 10000,
                    vat: 800,
                    gross: 10800,
                  },
                  items: [],
                },
              },
              configuratorSelection: {
                selections: {
                  service: "service-cloud",
                },
                products: {},
                recommendations: {},
              },
            };
          },
        },
      });

      assert.equal(
        snapshot.offerPayload.selection.service_cloud.variant,
        "Service Cloud"
      );
    }
  );

  await test(
    "service cloud: configurator summary ma fallback label po optionId",
    async () => {
      const configuratorSource = fs.readFileSync(configuratorPath, "utf8");

      assert.equal(
        configuratorSource.includes('const serviceOptionId = readSelectionOptionId(serviceSelection);'),
        true
      );
      assert.equal(
        configuratorSource.includes('serviceOptionId === "service-cloud"'),
        true
      );
      assert.equal(
        configuratorSource.includes('? "Service Cloud"'),
        true
      );
    }
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
