import assert from "node:assert/strict";
import test from "node:test";
import { GeminiClient } from "../src/gemini-client.js";
import { validateBackendContext } from "../src/backend-contract.js";
import { backendContext } from "./backend-contract.test.js";

test("keeps the API key in a backend header and requests structured JSON", async () => {
  let observed;
  const client = new GeminiClient({
    apiKey: "server-secret",
    model: "gemini-test-model",
    fetchImpl: async (url, options) => {
      observed = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"missions":[],"statusMessage":"test"}' }] } }]
        })
      };
    }
  });

  await client.generate({ astronautId: "astro-1" });
  assert.equal(observed.url.includes("server-secret"), false);
  assert.equal(observed.options.headers["x-goog-api-key"], "server-secret");
  assert.equal(observed.body.generationConfig.responseMimeType, "application/json");
  assert.equal(observed.body.generationConfig.responseJsonSchema.properties.missions.minItems, 3);
  assert.ok(observed.body.systemInstruction);
});

test("backend selector sends only a constrained template schema", async () => {
  let observed;
  const client = new GeminiClient({
    apiKey: "server-secret",
    model: "gemini-test-model",
    fetchImpl: async (url, options) => {
      observed = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"tasks":[]}' }] } }]
        })
      };
    }
  });
  await client.selectTasks(validateBackendContext(backendContext()));
  const ids = observed.generationConfig.responseJsonSchema.properties.tasks.items.properties.template_id.enum;
  assert.equal(ids.includes("medical_review"), false);
  assert.equal(observed.generationConfig.responseJsonSchema.properties.tasks.minItems, 3);
  assert.equal(observed.generationConfig.responseJsonSchema.properties.tasks.maxItems, 3);
});
