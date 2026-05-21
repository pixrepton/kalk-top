const assert = require("assert");
const path = require("path");

const checkboxState = {
  walls_insulation_detailed_mode: { checked: false },
  roof_insulation_detailed_mode: { checked: false },
  floor_insulation_detailed_mode: { checked: false },
};

global.window = global;
global.formEngine = {};
global.hpById = function hpById(id) {
  return checkboxState[id] || null;
};
global.hpQs = function hpQs() {
  return null;
};
require(path.join(__dirname, "rules.js"));

const rules = global.formEngine.rules;
const fieldRules = rules.fields;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("building roof waits for building floors after balcony gate", () => {
  assert.equal(
    fieldRules.has_basement.visibleWhen({
      building_shape: "regular",
      regular_method: "dimensions",
      building_length: "",
      building_width: "",
    }),
    true
  );

  assert.equal(
    fieldRules.has_balcony.visibleWhen({
      has_basement: "",
    }),
    true
  );

  assert.equal(
    fieldRules.building_floors.visibleWhen({
      has_balcony: "",
    }),
    true
  );

  assert.equal(
    fieldRules.building_floors.enabledWhen({
      has_balcony: "yes",
      number_balcony_doors: "",
    }),
    false
  );

  assert.equal(
    fieldRules.building_floors.enabledWhen({
      has_balcony: "yes",
      number_balcony_doors: "1",
    }),
    true
  );

  assert.equal(
    fieldRules.building_roof.visibleWhen({
      has_balcony: "yes",
      number_balcony_doors: "1",
      building_floors: "",
    }),
    true
  );

  assert.equal(
    fieldRules.building_roof.enabledWhen({
      has_balcony: "yes",
      number_balcony_doors: "1",
      building_floors: "",
    }),
    false
  );

  assert.equal(
    fieldRules.building_roof.enabledWhen({
      has_balcony: "yes",
      number_balcony_doors: "1",
      building_floors: "2",
    }),
    true
  );
});

test("dimensions gate uses values without confirm button", () => {
  assert.equal(
    fieldRules.has_basement.enabledWhen({
      building_shape: "regular",
      regular_method: "dimensions",
      building_length: "10",
      building_width: "",
    }),
    false
  );

  assert.equal(
    fieldRules.has_basement.enabledWhen({
      building_shape: "regular",
      regular_method: "dimensions",
      building_length: "10",
      building_width: "5",
    }),
    true
  );
});

test("building dimensions fields show only for regular + dimensions", () => {
  assert.equal(
    fieldRules.building_length.visibleWhen({
      building_shape: "regular",
      regular_method: "dimensions",
    }),
    true
  );

  assert.equal(
    fieldRules.building_width.visibleWhen({
      building_shape: "regular",
      regular_method: "dimensions",
    }),
    true
  );

  assert.equal(
    fieldRules.building_length.visibleWhen({
      building_shape: "regular",
      regular_method: "area",
    }),
    false
  );

  assert.equal(
    fieldRules.building_width.visibleWhen({
      building_shape: "irregular",
      regular_method: "dimensions",
    }),
    false
  );
});

test("floor area belongs only to regular + area flow", () => {
  assert.equal(
    fieldRules.floor_area.visibleWhen({
      building_shape: "regular",
      regular_method: "area",
    }),
    true
  );

  assert.equal(
    fieldRules.floor_area.visibleWhen({
      building_shape: "regular",
      regular_method: "dimensions",
    }),
    false
  );

  assert.equal(
    fieldRules.floor_area.visibleWhen({
      building_shape: "irregular",
      regular_method: "area",
    }),
    false
  );
});

test("windows flow advances from slider value without confirm button", () => {
  assert.equal(
    fieldRules.number_huge_windows.enabledWhen({
      windows_type: "new_double_glass",
      number_windows: "14",
    }),
    true
  );
});

test("irregular shape requires both area and perimeter", () => {
  assert.equal(
    fieldRules.floor_area_irregular.requiredWhen({
      building_shape: "irregular",
      floor_perimeter: "120",
    }),
    true
  );

  assert.equal(
    fieldRules.floor_perimeter.requiredWhen({
      building_shape: "irregular",
      floor_area_irregular: "85",
    }),
    true
  );
});

test("doors are hidden and not required in step 3", () => {
  assert.equal(fieldRules.doors_type.visibleWhen({}), false);
  assert.equal(fieldRules.doors_type.requiredWhen({}), false);
  assert.equal(fieldRules.number_doors.visibleWhen({}), false);
  assert.equal(fieldRules.number_doors.requiredWhen({}), false);
});
