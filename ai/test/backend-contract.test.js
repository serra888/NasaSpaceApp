import assert from "node:assert/strict";
import test from "node:test";
import { ContractError, selectionSchema, validateBackendContext, validateTaskSelection } from "../src/backend-contract.js";
import { backendContext, backendContextV11 } from "./fixtures.js";

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

test("accepts the backend 1.1 request with trends, catalogs, and constraints", () => {
  const context = validateBackendContext(backendContextV11());
  assert.equal(context.contract_version, "1.1");
  assert.equal(context.trend_summary.stress, "increasing");
  assert.equal(context.task_catalog.length, 5);
  assert.equal(context.reason_catalog.length, 7);
});

test("contract 1.1 schema requires a constrained reason code", () => {
  const schema = selectionSchema(validateBackendContext(backendContextV11()));
  const task = schema.properties.tasks.items;
  assert.equal(task.required.includes("reason_code"), true);
  assert.equal(task.properties.reason_code.enum.includes("high_stress"), true);
  assert.equal(task.properties.template_id.enum.includes("medium_demo_task"), false);
});

test("accepts three valid contract 1.1 selections", () => {
  const context = validateBackendContext(backendContextV11());
  const result = validateTaskSelection({
    tasks: [
      { template_id: "earth_gaze_reset", category: "recovery", reason_code: "high_stress" },
      { template_id: "crew_voice_checkin", category: "social", reason_code: "low_connection" },
      { template_id: "single_priority_block", category: "focus", reason_code: "support_focus" }
    ]
  }, context);
  assert.equal(result.tasks[0].reason_code, "high_stress");
  assert.equal(result.tasks.length, 3);
});

test("contract 1.1 rejects an unknown or task-incompatible reason", () => {
  const context = validateBackendContext(backendContextV11());
  for (const reason_code of ["unknown", "low_connection"]) {
    assert.throws(() => validateTaskSelection({
      tasks: [
        { template_id: "earth_gaze_reset", category: "recovery", reason_code },
        { template_id: "crew_voice_checkin", category: "social", reason_code: "support_mood" },
        { template_id: "single_priority_block", category: "focus", reason_code: "support_focus" }
      ]
    }, context), ContractError);
  }
});

test("contract 1.1 rejects generated prose, malformed trends, and private fields", () => {
  const context = validateBackendContext(backendContextV11());
  assert.throws(() => validateTaskSelection({
    tasks: [
      { template_id: "earth_gaze_reset", category: "recovery", reason_code: "high_stress", title: "Generated advice" },
      { template_id: "crew_voice_checkin", category: "social", reason_code: "support_mood" },
      { template_id: "single_priority_block", category: "focus", reason_code: "support_focus" }
    ]
  }, context), ContractError);

  const badTrend = backendContextV11();
  badTrend.trend_summary.stress = "critical";
  assert.throws(() => validateBackendContext(badTrend), ContractError);

  const privateContext = backendContextV11();
  privateContext.check_in.journal = "private note";
  assert.throws(() => validateBackendContext(privateContext), ContractError);
});

test("rejects unsupported contract versions", () => {
  assert.throws(() => validateBackendContext({ ...backendContext(), contract_version: "2.0" }), ContractError);
});
