const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const processorPath = path.join(__dirname, "formDataProcessor.js");

function createElement(name, value = "", type = "hidden") {
  return {
    name,
    id: name,
    type,
    value,
    checked: false,
    parentElement: null,
    classList: {
      contains() {
        return false;
      },
    },
  };
}

function createForm(fieldValues) {
  const fieldsByName = new Map();

  Object.entries(fieldValues).forEach(([name, value]) => {
    const el = createElement(name, value);
    fieldsByName.set(name, [el]);
  });

  const form = {
    querySelector(selector) {
      const checkedMatch = selector.match(/^\[name="(.+)"\]:checked$/);
      if (checkedMatch) {
        const candidates = fieldsByName.get(checkedMatch[1]) || [];
        return candidates.find(field => field.checked) || null;
      }

      const nameMatch = selector.match(/^\[name="(.+)"\]$/);
      if (nameMatch) {
        const candidates = fieldsByName.get(nameMatch[1]) || [];
        return candidates[0] || null;
      }

      return null;
    },
    querySelectorAll(selector) {
      const checkedMatch = selector.match(/^\[name="(.+)"\]:checked$/);
      if (checkedMatch) {
        const candidates = fieldsByName.get(checkedMatch[1]) || [];
        return candidates.filter(field => field.checked);
      }

      if (selector === "input, select, textarea") {
        return Array.from(fieldsByName.values()).flat();
      }

      return [];
    },
  };

  for (const fields of fieldsByName.values()) {
    fields.forEach(field => {
      field.parentElement = form;
    });
  }

  return form;
}

function loadBuildJsonData(fieldValues) {
  const form = createForm(fieldValues);

  global.window = global;
  global.document = {
    body: {},
    querySelector() {
      return null;
    },
  };
  global.hpById = function hpById(id) {
    if (id === "heatCalcFormFull" || id === "top-instal-calc") {
      return form;
    }
    return null;
  };
  global.hpQs = function hpQs(selector) {
    if (selector === "form[data-calc='top-instal']" || selector === "#top-instal-calc") {
      return form;
    }
    return null;
  };
  global.window.getComputedStyle = function getComputedStyle() {
    return {
      display: "block",
      visibility: "visible",
    };
  };
  global.console = console;

  delete global.buildJsonData;
  vm.runInThisContext(fs.readFileSync(processorPath, "utf8"), {
    filename: processorPath,
  });

  return global.buildJsonData;
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

test("payload builder does not invent missing user answers", () => {
  const buildJsonData = loadBuildJsonData({
    building_type: "single_house",
    construction_year: "2010",
    construction_type: "traditional",
    building_shape: "regular",
    regular_method: "dimensions",
    building_length: "10",
    building_width: "8",
    wall_size: "24",
    number_windows: "8",
    number_huge_windows: "0",
    windows_type: "new_double_glass",
    indoor_temperature: "21",
    building_floors: "2",
  });

  const data = buildJsonData();

  assert.equal(data.location_id, undefined);
  assert.equal(data.latitude, undefined);
  assert.equal(data.longitude, undefined);
  assert.equal(data.floor_area, 80);
  assert.equal(data.floor_height, undefined);
  assert.equal(data.building_roof, undefined);
  assert.equal(data.has_basement, null);
  assert.equal(data.has_balcony, null);
  assert.equal(data.number_balcony_doors, undefined);
  assert.equal(data.ventilation_type, undefined);
  assert.equal(data.heating_type, undefined);
  assert.equal(data.source_type, undefined);
  assert.equal(data.include_hot_water, null);
  assert.equal(data.hot_water_persons, undefined);
  assert.equal(data.hot_water_usage, undefined);
});
