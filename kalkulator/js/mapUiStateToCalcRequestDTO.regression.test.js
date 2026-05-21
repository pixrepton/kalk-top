const assert = require("assert");
const path = require("path");

function loadMapper(relativePath) {
  const modulePath = path.join(__dirname, "..", "..", relativePath);
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

const mapperPaths = [
  "kalkulator/js/mapUiStateToCalcRequestDTO.js",
  "frontend/api/mapUiStateToCalcRequestDTO.js",
];

mapperPaths.forEach((mapperPath) => {
  test(`${mapperPath} derives floor_area from building dimensions`, () => {
    const mapUiStateToCalcRequestDTO = loadMapper(mapperPath);
    const dto = mapUiStateToCalcRequestDTO({
      sourcePayload: {
        building_length: 10,
        building_width: 12,
        building_shape: "regular",
        heating_type: "underfloor",
        source_type: "gas",
        include_hot_water: false,
      },
      traceId: "regression-trace",
      source: "regression-test",
    });

    assert.equal(dto.building.floor_area, 120);
    assert.equal(dto.building.building_length, 10);
    assert.equal(dto.building.building_width, 12);
  });

  test(`${mapperPath} preserves explicit area fields`, () => {
    const mapUiStateToCalcRequestDTO = loadMapper(mapperPath);
    const dto = mapUiStateToCalcRequestDTO({
      sourcePayload: {
        floor_area: 95,
        building_length: 10,
        building_width: 12,
        heating_type: "underfloor",
        source_type: "gas",
        include_hot_water: false,
      },
      traceId: "regression-trace",
      source: "regression-test",
    });

    assert.equal(dto.building.floor_area, 95);
  });

  test(`${mapperPath} preserves canonical draftRequest building for configurator refresh`, () => {
    const mapUiStateToCalcRequestDTO = loadMapper(mapperPath);
    const dto = mapUiStateToCalcRequestDTO({
      appState: {
        draftRequest: {
          traceId: "base-trace",
          building: {
            building_length: 10,
            building_width: 12,
            building_shape: "regular",
            building_floors: 2,
            heated_floors: 2,
            floor_area: 120,
            location_id: "PL_STREFA_III",
            heating_type: "underfloor",
            source_type: "air_to_water_hp",
            include_hot_water: true,
          },
          preferences: {
            heating: {
              emitterType: "underfloor",
              sourceType: "air_to_water_hp",
            },
            dhw: {
              enabled: true,
              persons: 4,
              usageProfile: "shower_bath",
            },
            hasBuffer: true,
          },
        },
      },
      sourcePayload: {
        construction_year: 2011,
        include_hot_water: false,
      },
      source: "configurator",
      preserveExistingDraftRequest: true,
    });

    assert.equal(dto.traceId, "base-trace");
    assert.equal(dto.building.building_length, 10);
    assert.equal(dto.building.building_width, 12);
    assert.equal(dto.building.floor_area, 120);
    assert.equal(dto.building.location_id, "PL_STREFA_III");
    assert.equal(dto.preferences.heating.emitterType, "underfloor");
    assert.equal(dto.preferences.dhw.enabled, false);
  });

  test(`${mapperPath} does not merge old draftRequest outside configurator mode`, () => {
    const mapUiStateToCalcRequestDTO = loadMapper(mapperPath);
    const dto = mapUiStateToCalcRequestDTO({
      appState: {
        draftRequest: {
          building: {
            building_length: 10,
            building_width: 12,
          },
        },
      },
      sourcePayload: {
        heating_type: "underfloor",
        source_type: "air_to_water_hp",
        include_hot_water: false,
      },
      source: "calculator",
    });

    assert.equal("building_length" in dto.building, false);
    assert.equal("building_width" in dto.building, false);
  });

  test(`${mapperPath} strips hidden legacy pricing families from configurator options`, () => {
    const mapUiStateToCalcRequestDTO = loadMapper(mapperPath);
    const dto = mapUiStateToCalcRequestDTO({
      appState: {
        draftRequest: {
          building: {
            heating_type: "underfloor",
            source_type: "air_to_water_hp",
            include_hot_water: true,
          },
        },
      },
      sourcePayload: {
        heating_type: "underfloor",
        source_type: "air_to_water_hp",
        include_hot_water: true,
      },
      source: "configurator",
      preserveExistingDraftRequest: true,
      configuratorSelections: {
        pompa: { optionId: "KIT-WC07K3E5" },
        service: { optionId: "service-cloud" },
        magnetic_filter: { optionId: "magnetic_filter_premium" },
        hydro_safety: { optionId: "hydro_safety_extended" },
        flushing: { optionId: "flushing_standard" },
        electrical: { optionId: "electrical_standard" },
      },
    });

    assert.deepEqual(dto.preferences.options, {
      pumpOptionId: "KIT-WC07K3E5",
      serviceOptionId: "service-cloud",
    });
  });
});
