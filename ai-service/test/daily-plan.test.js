import assert from "node:assert/strict";
import test from "node:test";
import { ContractError, validateAstronautSnapshot } from "../src/contracts.js";
import { generateDailyPlan } from "../src/daily-plan.js";

const snapshot = {
  astronautId: "astro-7",
  displayName: "Alex",
  mood: "focused",
  energyLevel: 4,
  sleepHours: 7.5,
  stressLevel: 2,
  hasDiscomfort: false,
  constraints: ["Avoid loud activities"],
  preferences: ["Short focus exercises"],
  locale: "en"
};

const validGenerated = {
  missions: [
    { title: "Water pause", description: "Follow your normal hydration plan.", durationMinutes: 3, category: "hydration" },
    { title: "Gentle reset", description: "Complete an approved comfortable stretch.", durationMinutes: 5, category: "movement" },
    { title: "Pick one goal", description: "Choose one small task for the next work block.", durationMinutes: 4, category: "focus" }
  ],
  statusMessage: "A short, steady plan is ready for today."
};

test("accepts Gemini output only when it contains exactly three valid missions", async () => {
  const plan = await generateDailyPlan(snapshot, {
    geminiClient: { generate: async () => validGenerated },
    now: () => new Date("2026-10-04T09:00:00.000Z")
  });
  assert.equal(plan.source, "gemini");
  assert.equal(plan.missions.length, 3);
  assert.deepEqual(plan.missions.map((item) => item.id), ["mission-1", "mission-2", "mission-3"]);
});

test("uses a deterministic fallback when Gemini is offline", async () => {
  const options = {
    geminiClient: { generate: async () => { throw new Error("offline"); } },
    now: () => new Date("2026-10-04T09:00:00.000Z")
  };
  const first = await generateDailyPlan(snapshot, options);
  const second = await generateDailyPlan(snapshot, options);
  assert.equal(first.source, "fallback");
  assert.equal(first.missions.length, 3);
  assert.deepEqual(first, second);
});

test("falls back when Gemini returns malformed contract data", async () => {
  const plan = await generateDailyPlan(snapshot, {
    geminiClient: { generate: async () => ({ missions: validGenerated.missions.slice(0, 2), statusMessage: "Incomplete" }) }
  });
  assert.equal(plan.source, "fallback");
  assert.equal(plan.missions.length, 3);
});

test("rejects diagnosis language from Gemini and uses the safe fallback", async () => {
  const unsafe = structuredClone(validGenerated);
  unsafe.missions[0].description = "You have dehydration and should take medication.";
  const plan = await generateDailyPlan(snapshot, {
    geminiClient: { generate: async () => unsafe }
  });
  assert.equal(plan.source, "fallback");
  assert.equal(plan.missions[0].description.includes("dehydration"), false);
});

test("low-energy or discomfort fallback avoids movement missions", async () => {
  const plan = await generateDailyPlan({ ...snapshot, energyLevel: 1, hasDiscomfort: true }, {
    geminiClient: { generate: async () => { throw new Error("quota exceeded"); } }
  });
  assert.deepEqual(plan.missions.map((item) => item.category), ["hydration", "recovery", "connection"]);
});

test("rejects invalid mock health input before calling Gemini", async () => {
  assert.throws(
    () => validateAstronautSnapshot({ ...snapshot, energyLevel: 9 }),
    ContractError
  );
});
