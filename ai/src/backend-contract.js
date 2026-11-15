export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractError";
  }
}

const ALLOWED_CATEGORIES = new Set([
  "rest", "breathing", "reflection", "social", "mobility", "medical_review",
  "recovery", "focus", "hydration"
]);
const TREND_VALUES = new Set(["increasing", "stable", "decreasing", "insufficient_data"]);
const ALLOWED_INTENSITIES = new Set(["low", "medium"]);

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

function stringArray(value, field, { min = 0, distinct = false } = {}) {
  if (!Array.isArray(value) || value.length < min || value.some((item) => typeof item !== "string")) {
    throw new ContractError(`${field} must be a string array${min ? ` with at least ${min} item(s)` : ""}`);
  }
  if (distinct && new Set(value).size !== value.length) {
    throw new ContractError(`${field} must contain distinct values`);
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
  exactKeys(value, ["value", "used_fields", "missing_fields", "calculated_at", "observed_at", "stale", "is_demo"], field);
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
  exactKeys(value, ["id", "astronaut_id", "measured_at", "heart_rate", "spo2", "sleep_hours", "steps", "body_temperature_c", "source"], "latest_measurement");
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

function baseContext(body) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.mission_date)) throw new ContractError("mission_date must use YYYY-MM-DD format");
  if (!Array.isArray(body.alerts) || body.alerts.some((item) => typeof item !== "string")) {
    throw new ContractError("alerts must be a string array");
  }
  return {
    astronaut_id: string(body.astronaut_id, "astronaut_id", 80),
    mission_date: body.mission_date,
    health: score(body.health, "health"),
    mood: score(body.mood, "mood"),
    latest_measurement: measurement(body.latest_measurement),
    check_in: checkIn(body.check_in),
    alerts: Object.freeze([...body.alerts])
  };
}

function constraintsV10(value) {
  const constraints = object(value, "constraints");
  exactKeys(constraints, ["task_count", "distinct_templates", "no_diagnosis"], "constraints");
  if (constraints.task_count !== 3 || constraints.distinct_templates !== true || constraints.no_diagnosis !== true) {
    throw new ContractError("constraints must require 3 distinct, non-diagnostic tasks");
  }
  return Object.freeze({ ...constraints });
}

function constraintsV11(value) {
  const constraints = object(value, "constraints");
  exactKeys(constraints, ["task_count", "distinct_templates", "no_diagnosis", "max_duration_minutes", "allowed_intensities"], "constraints");
  if (constraints.task_count !== 3 || constraints.distinct_templates !== true || constraints.no_diagnosis !== true ||
      constraints.max_duration_minutes !== 10 || !Array.isArray(constraints.allowed_intensities) ||
      constraints.allowed_intensities.length !== 1 || constraints.allowed_intensities[0] !== "low") {
    throw new ContractError("contract 1.1 constraints must require 3 distinct low-intensity tasks up to 10 minutes");
  }
  return Object.freeze({ ...constraints, allowed_intensities: Object.freeze([...constraints.allowed_intensities]) });
}

function taskCatalogV10(value) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 20) {
    throw new ContractError("task_catalog must contain 3-20 templates for contract 1.0");
  }
  const seen = new Set();
  return value.map((raw, index) => {
    const item = object(raw, `task_catalog[${index}]`);
    exactKeys(item, ["template_id", "category", "title"], `task_catalog[${index}]`);
    const templateId = string(item.template_id, `task_catalog[${index}].template_id`, 80);
    const category = string(item.category, `task_catalog[${index}].category`, 40);
    if (!ALLOWED_CATEGORIES.has(category)) throw new ContractError(`task_catalog[${index}].category is invalid`);
    if (seen.has(templateId)) throw new ContractError("task_catalog template IDs must be distinct");
    seen.add(templateId);
    return Object.freeze({ template_id: templateId, category, title: string(item.title, `task_catalog[${index}].title`) });
  });
}

function reasonCatalogV11(value) {
  if (!Array.isArray(value) || value.length === 0) throw new ContractError("reason_catalog must contain at least one reason");
  const seen = new Set();
  const items = value.map((raw, index) => {
    const item = object(raw, `reason_catalog[${index}]`);
    exactKeys(item, ["reason_code", "description"], `reason_catalog[${index}]`);
    const reasonCode = string(item.reason_code, `reason_catalog[${index}].reason_code`, 80);
    if (seen.has(reasonCode)) throw new ContractError("reason_catalog reason codes must be distinct");
    seen.add(reasonCode);
    return Object.freeze({ reason_code: reasonCode, description: string(item.description, `reason_catalog[${index}].description`, 400) });
  });
  return { items, codes: seen };
}

function trendSummaryV11(value) {
  const trend = object(value, "trend_summary");
  exactKeys(trend, ["window_days", "sleep", "mood", "stress", "energy", "connection"], "trend_summary");
  if (!Number.isInteger(trend.window_days) || trend.window_days < 2 || trend.window_days > 7) {
    throw new ContractError("trend_summary.window_days must be an integer from 2 to 7");
  }
  for (const field of ["sleep", "mood", "stress", "energy", "connection"]) {
    if (!TREND_VALUES.has(trend[field])) throw new ContractError(`trend_summary.${field} is invalid`);
  }
  return Object.freeze({ ...trend });
}

function taskCatalogV11(value, reasonCodes) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 30) {
    throw new ContractError("task_catalog must contain 3-30 templates for contract 1.1");
  }
  const seen = new Set();
  return value.map((raw, index) => {
    const item = object(raw, `task_catalog[${index}]`);
    exactKeys(item, ["template_id", "category", "title", "duration_minutes", "intensity", "reason_codes"], `task_catalog[${index}]`);
    const templateId = string(item.template_id, `task_catalog[${index}].template_id`, 80);
    const category = string(item.category, `task_catalog[${index}].category`, 40);
    const intensity = string(item.intensity, `task_catalog[${index}].intensity`, 20);
    const reasons = stringArray(item.reason_codes, `task_catalog[${index}].reason_codes`, { min: 1, distinct: true });
    if (!ALLOWED_CATEGORIES.has(category)) throw new ContractError(`task_catalog[${index}].category is invalid`);
    if (!ALLOWED_INTENSITIES.has(intensity)) throw new ContractError(`task_catalog[${index}].intensity is invalid`);
    if (!Number.isInteger(item.duration_minutes) || item.duration_minutes < 1 || item.duration_minutes > 20) {
      throw new ContractError(`task_catalog[${index}].duration_minutes must be an integer from 1 to 20`);
    }
    if (reasons.some((reason) => !reasonCodes.has(reason))) throw new ContractError(`task_catalog[${index}].reason_codes contains an unknown reason`);
    if (seen.has(templateId)) throw new ContractError("task_catalog template IDs must be distinct");
    seen.add(templateId);
    return Object.freeze({
      template_id: templateId,
      category,
      title: string(item.title, `task_catalog[${index}].title`),
      duration_minutes: item.duration_minutes,
      intensity,
      reason_codes: Object.freeze([...reasons])
    });
  });
}

function validateV10(body) {
  exactKeys(body, ["contract_version", "astronaut_id", "mission_date", "health", "mood", "latest_measurement", "check_in", "alerts", "task_catalog", "constraints"], "request body");
  return Object.freeze({
    contract_version: "1.0",
    ...baseContext(body),
    task_catalog: Object.freeze(taskCatalogV10(body.task_catalog)),
    constraints: constraintsV10(body.constraints)
  });
}

function validateV11(body) {
  exactKeys(body, ["contract_version", "astronaut_id", "mission_date", "health", "mood", "latest_measurement", "check_in", "trend_summary", "alerts", "task_catalog", "reason_catalog", "constraints"], "request body");
  const constraints = constraintsV11(body.constraints);
  const reasons = reasonCatalogV11(body.reason_catalog);
  const taskCatalog = taskCatalogV11(body.task_catalog, reasons.codes);
  const selectable = taskCatalog.filter((item) => item.template_id !== "medical_review" && constraints.allowed_intensities.includes(item.intensity) && item.duration_minutes <= constraints.max_duration_minutes);
  if (selectable.length < constraints.task_count) throw new ContractError("task_catalog does not contain three selectable contract 1.1 tasks");
  return Object.freeze({
    contract_version: "1.1",
    ...baseContext(body),
    trend_summary: trendSummaryV11(body.trend_summary),
    task_catalog: Object.freeze(taskCatalog),
    reason_catalog: Object.freeze(reasons.items),
    constraints
  });
}

export function validateBackendContext(value) {
  const body = object(value, "request body");
  if (body.contract_version === "1.0") return validateV10(body);
  if (body.contract_version === "1.1") return validateV11(body);
  throw new ContractError("contract_version must be 1.0 or 1.1");
}

function selectableCatalog(context) {
  return context.task_catalog.filter((item) => {
    if (item.template_id === "medical_review") return false;
    if (context.contract_version === "1.0") return true;
    return context.constraints.allowed_intensities.includes(item.intensity) && item.duration_minutes <= context.constraints.max_duration_minutes;
  });
}

export function selectionSchema(context) {
  const allowed = selectableCatalog(context);
  const properties = {
    template_id: { type: "string", enum: allowed.map((item) => item.template_id) },
    category: { type: "string", enum: [...new Set(allowed.map((item) => item.category))] }
  };
  const required = ["template_id", "category"];
  if (context.contract_version === "1.1") {
    properties.reason_code = { type: "string", enum: [...new Set(allowed.flatMap((item) => item.reason_codes))] };
    required.push("reason_code");
  }
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      tasks: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "object", additionalProperties: false, properties, required }
      }
    },
    required: ["tasks"]
  };
}

export function validateTaskSelection(value, context) {
  const body = object(value, "AI response");
  exactKeys(body, ["tasks"], "AI response");
  if (!Array.isArray(body.tasks) || body.tasks.length !== 3) throw new ContractError("AI response must contain exactly 3 tasks");
  const catalog = new Map(selectableCatalog(context).map((item) => [item.template_id, item]));
  const knownReasons = new Set((context.reason_catalog ?? []).map((item) => item.reason_code));
  const seen = new Set();
  const tasks = body.tasks.map((raw, index) => {
    const item = object(raw, `tasks[${index}]`);
    const keys = context.contract_version === "1.1" ? ["template_id", "category", "reason_code"] : ["template_id", "category"];
    exactKeys(item, keys, `tasks[${index}]`);
    const templateId = string(item.template_id, `tasks[${index}].template_id`, 80);
    const category = string(item.category, `tasks[${index}].category`, 40);
    const approved = catalog.get(templateId);
    if (!approved || approved.category !== category) throw new ContractError(`tasks[${index}] is not an approved selectable template`);
    if (seen.has(templateId)) throw new ContractError("AI task templates must be distinct");
    seen.add(templateId);
    if (context.contract_version === "1.1") {
      const reasonCode = string(item.reason_code, `tasks[${index}].reason_code`, 80);
      if (!knownReasons.has(reasonCode) || !approved.reason_codes.includes(reasonCode)) {
        throw new ContractError(`tasks[${index}].reason_code is not approved for the selected template`);
      }
      return Object.freeze({ template_id: templateId, category, reason_code: reasonCode });
    }
    return Object.freeze({ template_id: templateId, category });
  });
  return Object.freeze({ tasks: Object.freeze(tasks) });
}
