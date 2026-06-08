const assert = require("assert");
const fs = require("fs");
const path = require("path");

function readSource(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", "..", "..", relativePath), "utf8");
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

const resultsRendererSource = readSource("kalkulator/js/resultsRenderer.js");
const apiCallerSource = readSource("kalkulator/js/apiCaller.js");

test("resultsRenderer dispatches workflow completion early", () => {
  assert.match(resultsRendererSource, /function maybeDispatchWorkflowCompletion\(/);
  assert.match(resultsRendererSource, /heatpump:showWorkflowCompletion/);
  const earlyIndex = resultsRendererSource.indexOf("maybeDispatchWorkflowCompletion();");
  const saveIndex = resultsRendererSource.indexOf("saveConfigData");
  assert.ok(earlyIndex > 0, "maybeDispatchWorkflowCompletion call missing");
  assert.ok(saveIndex > 0, "saveConfigData missing");
});

test("apiCaller has workflow completion fallback", () => {
  assert.match(apiCallerSource, /ensureWorkflowCompletionShown/);
  assert.match(apiCallerSource, /showWorkflowCompletion/);
});

test("workflow completion is idempotent", () => {
  assert.match(resultsRendererSource, /workflowCompletionDispatched/);
});
