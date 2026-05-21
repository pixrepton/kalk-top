#!/usr/bin/env node
/**
 * Generator wszystkich możliwych payloadów CalcRequestDTO dla domu jednorodzinnego.
 * Źródło: kalkulator/js/formDataProcessor.js, kalkulator/calculator.php
 *
 * Uruchom: node scripts/generate-dom-payloads.js
 * Wynik: docs/fixtures/dom-jednorodzinny-wszystkie-payloady.json
 */

const fs = require('fs');
const path = require('path');

const LOCATIONS = {
  PL_GDANSK: { lat: 54.352, lon: 18.6466 },
  PL_KUJAWSKOPOMORSKIE_BYDGOSZCZ: { lat: 53.1235, lon: 18.0084 },
  PL_DOLNOSLASKIE_WROCLAW: { lat: 51.1079, lon: 17.0385 },
  PL_STREFA_IV: { lat: 49.6216, lon: 20.697 },
  PL_ZAKOPANE: { lat: 49.2992, lon: 19.9496 },
  PL_STREFA_I: { lat: 54.352, lon: 18.6466 },
  PL_STREFA_II: { lat: 52.2297, lon: 21.0122 },
  PL_STREFA_III: { lat: 50.0647, lon: 19.945 },
  PL_STREFA_V: { lat: 49.2992, lon: 19.9496 },
};

function basePayload(overrides = {}) {
  return {
    schemaVersion: '1.0',
    traceId: 'dom-generated',
    lead: {
      name: null,
      contact: { email: null, phone: null, postalCode: null, preferredContactTime: null },
      consents: {},
      intent: null,
    },
    building: {
      building_type: 'single_house',
      construction_year: 2011,
      construction_type: 'traditional',
      location_id: 'PL_STREFA_III',
      latitude: 50.0647,
      longitude: 19.945,
      building_floors: 2,
      building_heated_floors: [1, 2],
      wall_size: 44,
      primary_wall_material: 84,
      external_wall_isolation: { material: 88, size: 18 },
      top_isolation: { material: 68, size: 25 },
      bottom_isolation: { material: 88, size: 15 },
      number_doors: 1,
      number_balcony_doors: 1,
      number_windows: 12,
      number_huge_windows: 0,
      doors_type: 'new_pvc',
      windows_type: 'new_double_glass',
      indoor_temperature: 21,
      ventilation_type: 'mechanical_recovery',
      heating_type: 'underfloor',
      source_type: 'air_to_water_hp',
      include_hot_water: true,
      hot_water_persons: 4,
      hot_water_usage: 'shower_bath',
      floor_height: 2.6,
      building_roof: 'oblique',
      has_basement: true,
      has_balcony: true,
      ...overrides.building,
    },
    preferences: {
      heating: {
        emitterType: 'underfloor',
        sourceType: 'air_to_water_hp',
        indoorTemperatureC: 21,
        ventilationType: 'mechanical_recovery',
      },
      dhw: { enabled: true, persons: 4, usageProfile: 'shower_bath' },
      hasBuffer: true,
      options: {},
    },
    context: { source: 'configurator', pluginVersion: null, uiVersion: null },
    ...overrides,
  };
}

function setLocation(payload, locId) {
  const coords = LOCATIONS[locId] || LOCATIONS.PL_STREFA_III;
  payload.building.location_id = locId;
  payload.building.latitude = coords.lat;
  payload.building.longitude = coords.lon;
}

function setPreferencesFromBuilding(payload) {
  const b = payload.building;
  payload.preferences.heating.emitterType = b.heating_type;
  payload.preferences.heating.sourceType = b.source_type;
  payload.preferences.heating.indoorTemperatureC = b.indoor_temperature;
  payload.preferences.heating.ventilationType = b.ventilation_type;
  payload.preferences.dhw.enabled = !!b.include_hot_water;
  payload.preferences.dhw.persons = b.include_hot_water ? b.hot_water_persons : null;
  payload.preferences.dhw.usageProfile = b.include_hot_water ? b.hot_water_usage : null;
}

function cartesianProduct(arrays) {
  return arrays.reduce(
    (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
    [[]]
  );
}

function main() {
  const payloads = [];
  let idx = 0;

  // 1. GEOMETRIA: regular+dimensions, regular+area, irregular
  const geometryVariants = [
    {
      name: 'regular+dimensions',
      building: {
        building_shape: 'regular',
        building_length: 12,
        building_width: 10,
      },
    },
    {
      name: 'regular+area',
      building: {
        building_shape: 'regular',
        floor_area: 120,
      },
    },
    {
      name: 'irregular',
      building: {
        building_shape: 'irregular',
        floor_area: 85,
        floor_perimeter: 42,
      },
    },
  ];

  // 2. CWU: tak/nie + gdy tak: hot_water_usage
  const cwuVariants = [
    { include_hot_water: false },
    { include_hot_water: true, hot_water_persons: 2, hot_water_usage: 'shower' },
    { include_hot_water: true, hot_water_persons: 4, hot_water_usage: 'shower_bath' },
    { include_hot_water: true, hot_water_persons: 6, hot_water_usage: 'bath' },
  ];

  // 3. construction_type
  const constructionVariants = [
    {
      construction_type: 'traditional',
      building: { primary_wall_material: 84 },
      isCanadian: false,
    },
    {
      construction_type: 'canadian',
      building: {
        wall_size: 30,
        internal_wall_isolation: { material: 68, size: 20 },
      },
      isCanadian: true,
    },
  ];

  // 4. heating_type
  const heatingVariants = ['underfloor', 'radiators', 'mixed'];

  // 5. ventilation_type (form ma 3: natural, mechanical, mechanical_recovery)
  const ventilationVariants = ['natural', 'mechanical', 'mechanical_recovery'];

  // 6. source_type
  const sourceVariants = ['air_to_water_hp', 'gas', 'oil', 'biomass', 'district_heating'];

  // 7. building_roof
  const roofVariants = ['flat', 'oblique', 'steep'];

  // 8. floor_height
  const floorHeightVariants = [2.3, 2.6, 3.1, 4.1];

  // 9. has_basement, has_balcony
  const basementVariants = [true, false];
  const balconyVariants = [true, false];

  // 10. garage_type (none -> nie dodajemy pola)
  const garageVariants = [
    undefined,
    'single_unheated',
    'single_heated',
    'double_unheated',
    'double_heated',
  ];

  // 11. doors_type
  const doorsVariants = ['old_wooden', 'old_metal', 'new_wooden', 'new_metal', 'new_pvc'];

  // 12. windows_type
  const windowsVariants = [
    '2021_triple_glass',
    '2021_double_glass',
    'new_triple_glass',
    'new_double_glass',
    'semi_new_double_glass',
    'old_double_glass',
    'old_single_glass',
  ];

  // 13. construction_year
  const yearVariants = [2025, 2021, 2011, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1939, 1914];

  // 14. location_id
  const locationIds = Object.keys(LOCATIONS);

  // Generuj: geometry × cwu × construction × heating × ventilation × source × roof
  // To daje 3×4×2×3×3×5×3 = 3240 - za dużo. Zamiast tego: systematyczne pokrycie każdej wartości.

  // Strategia: dla każdej kategorii generuj N payloadów gdzie tylko ta kategoria się zmienia
  const categories = [
    {
      name: 'geometry',
      variants: geometryVariants.map((g) => ({
        building: { ...g.building },
        _tag: g.name,
      })),
    },
    {
      name: 'cwu',
      variants: cwuVariants.map((c) => ({
        building: { ...c },
        _tag: c.include_hot_water
          ? `cwu-${c.hot_water_persons}-${c.hot_water_usage}`
          : 'cwu-no',
      })),
    },
    {
      name: 'construction',
      variants: constructionVariants.map((c) => {
        const b = { construction_type: c.construction_type, ...c.building };
        if (c.isCanadian) delete b.primary_wall_material;
        return { building: b, _tag: c.construction_type };
      }),
    },
    {
      name: 'heating',
      variants: heatingVariants.map((h) => ({
        building: { heating_type: h },
        _tag: h,
      })),
    },
    {
      name: 'ventilation',
      variants: ventilationVariants.map((v) => ({
        building: { ventilation_type: v },
        _tag: v,
      })),
    },
    {
      name: 'source',
      variants: sourceVariants.map((s) => ({
        building: { source_type: s },
        _tag: s,
      })),
    },
    {
      name: 'roof',
      variants: roofVariants.map((r) => ({
        building: { building_roof: r },
        _tag: r,
      })),
    },
    {
      name: 'floor_height',
      variants: floorHeightVariants.map((f) => ({
        building: { floor_height: f },
        _tag: String(f),
      })),
    },
    {
      name: 'basement_balcony',
      variants: [
        { building: { has_basement: true, has_balcony: true, number_balcony_doors: 1 }, _tag: 'basement-yes_balcony-yes' },
        { building: { has_basement: true, has_balcony: false, number_balcony_doors: 0 }, _tag: 'basement-yes_balcony-no' },
        { building: { has_basement: false, has_balcony: true, number_balcony_doors: 1 }, _tag: 'basement-no_balcony-yes' },
        { building: { has_basement: false, has_balcony: false, number_balcony_doors: 0 }, _tag: 'basement-no_balcony-no' },
      ],
    },
    {
      name: 'garage',
      variants: garageVariants.map((g) => ({
        building: g != null ? { garage_type: g } : {},
        _tag: g ?? 'none',
      })),
    },
    {
      name: 'doors',
      variants: doorsVariants.map((d) => ({
        building: { doors_type: d },
        _tag: d,
      })),
    },
    {
      name: 'windows',
      variants: windowsVariants.map((w) => ({
        building: { windows_type: w },
        _tag: w,
      })),
    },
    {
      name: 'construction_year',
      variants: yearVariants.map((y) => ({
        building: { construction_year: y },
        _tag: String(y),
      })),
    },
    {
      name: 'location',
      variants: locationIds.map((loc) => ({
        locationId: loc,
        _tag: loc,
      })),
    },
  ];

  for (const cat of categories) {
    for (const v of cat.variants) {
      const p = basePayload({});
      if (v.building) {
        Object.assign(p.building, v.building);
      }
      if (v.locationId) {
        setLocation(p, v.locationId);
      }
      setPreferencesFromBuilding(p);
      p.traceId = `dom-${++idx}-${cat.name}-${v._tag}`.replace(/[^a-zA-Z0-9_-]/g, '-');
      p._nazwa = `${cat.name}=${v._tag}`;
      payloads.push(p);
    }
  }

  // Pełny iloczyn kartezjański: geometry × cwu × construction × heating × ventilation × source
  const fullCombos = cartesianProduct([
    geometryVariants,
    cwuVariants,
    constructionVariants,
    heatingVariants,
    ventilationVariants,
    sourceVariants,
  ]);

  for (const [geom, cwu, constr, heat, vent, src] of fullCombos) {
    const p = basePayload({});
    Object.assign(p.building, geom.building);
    Object.assign(p.building, cwu);
    Object.assign(p.building, constr.building || {});
    p.building.construction_type = constr.construction_type;
    p.building.heating_type = heat;
    p.building.ventilation_type = vent;
    p.building.source_type = src;
    if (constr.isCanadian) {
      delete p.building.primary_wall_material;
    }
    setPreferencesFromBuilding(p);
    p.traceId = `dom-full-${++idx}`;
    p._nazwa = `full: ${geom.name}|${cwu.include_hot_water ? cwu.hot_water_usage : 'no-cwu'}|${constr.construction_type}|${heat}|${vent}|${src}`;
    payloads.push(p);
  }

  const out = {
    _opis: 'Wszystkie możliwe warianty payloadów CalcRequestDTO dla domu jednorodzinnego (single_house).',
    _zrodlo: 'scripts/generate-dom-payloads.js (generator)',
    _endpoint: 'POST /wp-json/topinstal/v1/calculate-offer',
    _liczba_payloadow: payloads.length,
    _enumy: {
      building_shape: ['regular', 'irregular'],
      regular_method: ['dimensions', 'area'],
      include_hot_water: [true, false],
      hot_water_usage: ['shower', 'shower_bath', 'bath'],
      construction_type: ['traditional', 'canadian'],
      heating_type: ['underfloor', 'radiators', 'mixed'],
      ventilation_type: ['natural', 'mechanical', 'mechanical_recovery'],
      source_type: ['air_to_water_hp', 'gas', 'oil', 'biomass', 'district_heating'],
      building_roof: ['flat', 'oblique', 'steep'],
      floor_height: [2.3, 2.6, 3.1, 4.1],
      doors_type: ['old_wooden', 'old_metal', 'new_wooden', 'new_metal', 'new_pvc'],
      windows_type: ['2021_triple_glass', '2021_double_glass', 'new_triple_glass', 'new_double_glass', 'semi_new_double_glass', 'old_double_glass', 'old_single_glass'],
      garage_type: ['single_unheated', 'single_heated', 'double_unheated', 'double_heated'],
      construction_year: yearVariants,
      location_id: locationIds,
    },
    payloads,
  };

  const outPath = path.join(__dirname, '..', 'docs', 'fixtures', 'dom-jednorodzinny-wszystkie-payloady.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wygenerowano ${payloads.length} payloadów -> ${outPath}`);
}

main();
