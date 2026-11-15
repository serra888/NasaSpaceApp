export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractError";
  }
}

const ALLOWED_CATEGORIES = new Set([
  "rest",
  "breathing",
  "reflection",
  "social",
  "mobility",
  "medical_review"
]);

function object(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ContractError(`${field} must be an object`);
  }
  return value;
}

function exactKeys(value, keys, field) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ContractError(`${field} contains missing or unexpected fields`);
  }
}

function string(value, field, max = 240) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new ContractError(`${field} must be a non-empty string up to ${max} characters`);
  }
  return value.trim();
}

function stringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ContractError(`${field} must be a string array`);
  }
  return value;
}

function dateTime(value, field, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ContractError(`${field} must be ${nullable ? "null or " : ""}an ISO date-time string`);
  }
  return value;
}

function nullableNumber(value, field, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new ContractError(`${field} must be null or a valid ${integer ? "integer" : "number"}`);
  }
  return value;
}

function score(value, field) {
  object(value, field);
  exactKeys(
    value,
    ["value", "used_fields", "missing_fields", "calculated_at", "observed_at", "stale", "is_demo"],
    field
  );
  if (value.value !== null && (!Number.isInteger(value.value) || value.value < 0 || value.value > 100)) {
    throw new ContractError(`${field}.value must be null or an integer from 0 to 100`);
  }
  stringArray(value.used_fields, `${field}.used_fields`);
  stringArray(value.missing_fields, `${field}.missing_fields`);
  dateTime(value.calculated_at, `${field}.calculated_at`);
  dateTime(value.observed_at, `${field}.observed_at`, true);
  if (typeof value.stale !== "boolean" || typeof value.is_demo !== "boolean") {
    throw new ContractError(`${field} must include boolean stale and is_demo fields`);
  }
  return value;
}

function measurement(value) {
  if (value === null) return null;
  object(value, "latest_measurement");
  exactKeys(
    value,
    [
      "id",
      "astronaut_id",
      "measured_at",
      "heart_rate",
      "spo2",
      "sleep_hours",
      "steps",
      "body_temperature_c",
      "source"
    ],
    "latest_measurement"
  );
  string(value.id, "latest_measurement.id", 80);
  string(value.astronaut_id, "latest_measurement.astronaut_id", 80);
  dateTime(value.measured_at, "latest_measurement.measured_at");
  nullableNumber(value.heart_rate, "latest_measurement.heart_rate", { min: 0, max: 300 });
  nullableNumber(value.spo2, "latest_measurement.spo2", { min: 0, max: 100 });
  nullableNumber(value.sleep_hours, "latest_measurement.sleep_hours", { min: 0, max: 24 });
  nullableNumber(value.steps, "latest_measurement.steps", { min: 0, integer: true });
  nullableNumber(value.body_temperature_c, "latest_measurement.body_temperature_c", { min: 0, max: 60 });
  string(value.source, "latest_measurement.source", 80);
  return value;
}

function checkIn(value) {
  if (value === null) return null;
  object(value, "check_in");
  exactKeys(value, ["mood", "stress", "energy", "loneliness"], "check_in");
  for (const field of ["mood", "stress", "energy", "loneliness"]) {
    if (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > 5) {
      throw new ContractError(`check_in.${field} must be an integer from 1 to 5`);
    }
  }
  return value;
}

function taskCatalog(value) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 20) {
    throw new ContractError("task_catalog must contain 3-20 templates");
  }
  const seen = new Set();
  return value.map((raw, index) => {
    const item = object(raw, `task_catalog[${index}]`);
    exactKeys(item, ["template_id", "category", "title"], `task_catalog[${index}]`);
    const templateId = string(item.template_id, `task_catalog[${index}].template_id`, 80);
    const category = string(item.category, `task_catalog[${index}].category`, 40);
    if (!ALLOWED_CATEGORIES.has(category)) {
      throw new ContractError(`task_catalog[${index}].category is invalid`);
    }
    if (seen.has(templateId)) throw new ContractError("task_catalog template IDs must be distinct");
    seen.add(templateId);
    return Object.freeze({
      template_id: templateId,
      category,
      title: string(item.title, `task_catalog[${index}].title`)
    });
  });
}

export function validateBackendContext(value) {
  const body = object(value, "request body");
  exactKeys(
    body,
    [
      "contract_version",
      "astronaut_id",
      "mission_date",
      "health",
      "mood",
      "latest_measurement",
      "check_in",
      "alerts",
      "task_catalog",
      "constraints"
    ],
    "request body"
  );
  if (body.contract_version !== "1.0") throw new ContractError("contract_version must be 1.0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.mission_date)) {
    throw new ContractError("mission_date must use YYYY-MM-DD format");
  }
  if (!Array.isArray(body.alerts) || body.alerts.some((item) => typeof item !== "string")) {
    throw new ContractError("alerts must be a string array");
  }
  const constraints = object(body.constraints, "constraints");
  exactKeys(constraints, ["task_count", "distinct_templates", "no_diagnosis"], "constraints");
  if (constraints.task_count !== 3 || constraints.distinct_templates !== true || constraints.no_diagnosis !== true) {
    throw new ContractError("constraints must require 3 distinct, non-diagnostic tasks");
  }

  return Object.freeze({
    contract_version: "1.0",
    astronaut_id: string(body.astronaut_id, "astronaut_id", 80),
    mission_date: body.mission_date,
    health: score(body.health, "health"),
    mood: score(body.mood, "mood"),
    latest_measurement: measurement(body.latest_measurement),
    check_in: checkIn(body.check_in),
    alerts: Object.freeze([...body.alerts]),
    task_catalog: Object.freeze(taskCatalog(body.task_catalog)),
    constraints: Object.freeze({ ...constraints })
  });
}

export function selectionSchema(context) {
  const allowed = context.task_catalog.filter((item) => item.template_id !== "medical_review");
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      tasks: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            template_id: { type: "string", enum: allowed.map((item) => item.template_id) },
            category: { type: "string", enum: [...new Set(allowed.map((item) => item.category))] }
          },
          required: ["template_id", "category"]
        }
      }
    },
    required: ["tasks"]
  };
}

export function validateTaskSelection(value, context) {
  const body = object(value, "AI response");
  exactKeys(body, ["tasks"], "AI response");
  if (!Array.isArray(body.tasks) || body.tasks.length !== 3) {
    throw new ContractError("AI response must contain exactly 3 tasks");
  }
  const catalog = new Map(context.task_catalog.map((item) => [item.template_id, item]));
  const seen = new Set();
  const tasks = body.tasks.map((raw, index) => {
    const item = object(raw, `tasks[${index}]`);
    exactKeys(item, ["template_id", "category"], `tasks[${index}]`);
    const templateId = string(item.template_id, `tasks[${index}].template_id`, 80);
    const category = string(item.category, `tasks[${index}].category`, 40);
    const approved = catalog.get(templateId);
    if (!approved || approved.category !== category || templateId === "medical_review") {
      throw new ContractError(`tasks[${index}] is not an approved selectable template`);
    }
    if (seen.has(templateId)) throw new ContractError("AI task templates must be distinct");
    seen.add(templateId);
    return Object.freeze({ template_id: templateId, category });
  });
  return Object.freeze({ tasks: Object.freeze(tasks) });
}
