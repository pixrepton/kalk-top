const assert = require("assert");
const path = require("path");

function loadMapper() {
  const modulePath = path.join(
    __dirname,
    "..",
    "mapUiStateToCalcRequestDTO.js"
  );
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath).mapUiStateToCalcRequestDTO;
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const mapUiStateToCalcRequestDTO = loadMapper();

const productionShapePayload = {
  building_length: 10,
  building_width: 11,
  building_shape: "regular",
  building_floors: "2",
  heating_type: "underfloor",
  source_type: "air_to_water_hp",
  include_hot_water: "yes",
  hot_water_persons: 4,
  hot_water_usage: "shower_bath",
  location_id: "PL_III",
  construction_year: "2015",
  building_type: "single_house",
};

test("mapUiState roundtrip preserves required building fields", () => {
  const dto = mapUiStateToCalcRequestDTO({
    sourcePayload: productionShapePayload,
    traceId: "integration-roundtrip",
    source: "integration-test",
  });

  assert.ok(dto.building, "building required");
  assert.equal(dto.building.building_length, 10);
  assert.equal(dto.building.building_width, 11);
  assert.ok(dto.building.floor_area >= 100, "floor_area derived from dimensions");
  assert.equal(dto.building.heating_type, "underfloor");
  assert.ok(
    dto.building.source_type === "air-water" || dto.building.source_type === "air_to_water_hp",
    "source_type mapped for HP"
  );
  assert.equal(dto.traceId, "integration-roundtrip");
  assert.ok(
    dto.building.location_id === "PL_STREFA_III" || dto.building.climate_zone === "PL_STREFA_III"
  );
});

test("mapUiState includes preferences for CWU", () => {
  const dto = mapUiStateToCalcRequestDTO({
    sourcePayload: productionShapePayload,
    traceId: "integration-cwu",
    source: "integration-test",
  });

  assert.ok(dto.preferences?.dhw?.enabled === true || dto.building?.include_hot_water === "yes");
});
