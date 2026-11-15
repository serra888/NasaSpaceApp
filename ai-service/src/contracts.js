const MOODS = new Set(["calm", "focused", "tired", "stressed", "low"]);
const CATEGORIES = new Set(["hydration", "movement", "focus", "connection", "recovery"]);
const MEDICAL_CLAIM_PATTERNS = [
  /\byou (?:have|suffer from|are diagnosed with)\b/i,
  /\b(?:diagnos(?:e|ed|is)|prescri(?:be|bed|ption)|medication|dosage)\b/i,
  /\b(?:tanı|teşhis|reçete|ilaç dozu)\b/i,
  /\bsende\s+[\p{L}\s-]{1,40}\s+var\b/iu
];

export class ContractError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ContractError";
    this.details = details;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value, field, { min = 1, max = 120 } = {}) {
  if (typeof value !== "string") throw new ContractError(`${field} must be a string`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw new ContractError(`${field} must contain ${min}-${max} characters`);
  }
  return clean;
}

function boundedNumber(value, field, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ContractError(`${field} must be a number from ${min} to ${max}`);
  }
  return value;
}

function stringList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) {
    throw new ContractError(`${field} must be an array with at most 5 items`);
  }
  return value.map((item, index) => boundedString(item, `${field}[${index}]`, { max: 80 }));
}

export function validateAstronautSnapshot(value) {
  if (!isPlainObject(value)) throw new ContractError("Request body must be a JSON object");

  const mood = boundedString(value.mood, "mood", { max: 20 }).toLowerCase();
  if (!MOODS.has(mood)) throw new ContractError(`mood must be one of: ${[...MOODS].join(", ")}`);

  return Object.freeze({
    astronautId: boundedString(value.astronautId, "astronautId", { max: 64 }),
    displayName: boundedString(value.displayName, "displayName", { max: 60 }),
    mood,
    energyLevel: boundedNumber(value.energyLevel, "energyLevel", 1, 5),
    sleepHours: boundedNumber(value.sleepHours, "sleepHours", 0, 24),
    stressLevel: boundedNumber(value.stressLevel, "stressLevel", 1, 5),
    hasDiscomfort: value.hasDiscomfort === true,
    constraints: Object.freeze(stringList(value.constraints, "constraints")),
    preferences: Object.freeze(stringList(value.preferences, "preferences")),
    locale: value.locale === undefined ? "en" : boundedString(value.locale, "locale", { max: 10 })
  });
}

function validateMission(value, index) {
  if (!isPlainObject(value)) throw new ContractError(`missions[${index}] must be an object`);
  const category = boundedString(value.category, `missions[${index}].category`, { max: 20 }).toLowerCase();
  if (!CATEGORIES.has(category)) {
    throw new ContractError(`missions[${index}].category is invalid`);
  }

  const durationMinutes = value.durationMinutes;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 20) {
    throw new ContractError(`missions[${index}].durationMinutes must be an integer from 1 to 20`);
  }

  return Object.freeze({
    id: `mission-${index + 1}`,
    title: boundedString(value.title, `missions[${index}].title`, { max: 50 }),
    description: boundedString(value.description, `missions[${index}].description`, { max: 180 }),
    durationMinutes,
    category
  });
}

export function validateGeneratedContent(value) {
  if (!isPlainObject(value)) throw new ContractError("AI response must be a JSON object");
  if (!Array.isArray(value.missions) || value.missions.length !== 3) {
    throw new ContractError("AI response must contain exactly 3 missions");
  }

  const missions = value.missions.map(validateMission);
  const statusMessage = boundedString(value.statusMessage, "statusMessage", { max: 160 });
  const allText = [...missions.flatMap(({ title, description }) => [title, description]), statusMessage].join(" ");
  if (MEDICAL_CLAIM_PATTERNS.some((pattern) => pattern.test(allText))) {
    throw new ContractError("AI response contains prohibited medical diagnosis or prescription language");
  }

  return Object.freeze({ missions: Object.freeze(missions), statusMessage });
}

export const generatedContentSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    missions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Short action title, maximum 50 characters" },
          description: { type: "string", description: "Safe concrete action, maximum 180 characters" },
          durationMinutes: { type: "integer", minimum: 1, maximum: 20 },
          category: { type: "string", enum: [...CATEGORIES] }
        },
        required: ["title", "description", "durationMinutes", "category"]
      }
    },
    statusMessage: {
      type: "string",
      description: "One supportive, non-medical status message under 160 characters"
    }
  },
  required: ["missions", "statusMessage"]
});
