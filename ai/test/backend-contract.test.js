import assert from "node:assert/strict";
import test from "node:test";
import { ContractError, selectionSchema, validateBackendContext, validateTaskSelection } from "../src/backend-contract.js";
import { backendContext } from "./fixtures.js";

test("accepts the exact backend 1.0 request contract", () => {
  const context = validateBackendContext(backendContext());
  assert.equal(context.contract_version, "1.0");
  assert.equal(context.task_catalog.length, 5);
});

test("structured schema excludes backend-reserved medical review", () => {
  const schema = selectionSchema(validateBackendContext(backendContext()));
  assert.equal(schema.properties.tasks.items.properties.template_id.enum.includes("medical_review"), false);
});

test("accepts exactly three distinct approved templates", () => {
  const context = validateBackendContext(backendContext());
  const result = validateTaskSelection({
    tasks: [
      { template_id: "quiet_rest", category: "rest" },
      { template_id: "breathing_pause", category: "breathing" },
      { template_id: "crew_connection", category: "social" }
    ]
  }, context);
  assert.equal(result.tasks.length, 3);
});

test("rejects duplicates, mismatched categories, and medical review", () => {
  const context = validateBackendContext(backendContext());
  const invalidSelections = [
    [
      { template_id: "quiet_rest", category: "rest" },
      { template_id: "quiet_rest", category: "rest" },
      { template_id: "crew_connection", category: "social" }
    ],
    [
      { template_id: "quiet_rest", category: "social" },
      { template_id: "breathing_pause", category: "breathing" },
      { template_id: "crew_connection", category: "social" }
    ],
    [
      { template_id: "medical_review", category: "medical_review" },
      { template_id: "breathing_pause", category: "breathing" },
      { template_id: "crew_connection", category: "social" }
    ]
  ];
  for (const tasks of invalidSelections) {
    assert.throws(() => validateTaskSelection({ tasks }, context), ContractError);
  }
});

test("rejects unexpected or privacy-sensitive request fields", () => {
  assert.throws(
    () => validateBackendContext({ ...backendContext(), symptoms: "private note" }),
    ContractError
  );
  const contextWithPrivateMeasurement = backendContext();
  contextWithPrivateMeasurement.latest_measurement.symptoms = "private note";
  assert.throws(() => validateBackendContext(contextWithPrivateMeasurement), ContractError);
});

test("requires every Score field defined by contract 1.0", () => {
  const context = backendContext();
  delete context.health.observed_at;
  assert.throws(() => validateBackendContext(context), ContractError);
});
