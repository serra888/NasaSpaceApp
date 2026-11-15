import assert from "node:assert/strict";
import test from "node:test";
import { GeminiClient } from "../src/gemini-client.js";
import { validateBackendContext } from "../src/backend-contract.js";
import { backendContext } from "./fixtures.js";

test("backend selector keeps the key server-side and sends only a constrained schema", async () => {
  let observed;
  const client = new GeminiClient({
    apiKey: "server-secret",
    model: "gemini-test-model",
    fetchImpl: async (url, options) => {
      observed = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"tasks":[]}' }] } }]
        })
      };
    }
  });
  await client.selectTasks(validateBackendContext(backendContext()));
  const ids = observed.body.generationConfig.responseJsonSchema.properties.tasks.items.properties.template_id.enum;
  assert.equal(observed.url.includes("server-secret"), false);
  assert.equal(observed.options.headers["x-goog-api-key"], "server-secret");
  assert.equal(observed.options.redirect, "error");
  assert.equal(observed.body.generationConfig.thinkingConfig.thinkingLevel, "minimal");
  assert.equal(ids.includes("medical_review"), false);
  assert.equal(observed.body.generationConfig.responseJsonSchema.properties.tasks.minItems, 3);
  assert.equal(observed.body.generationConfig.responseJsonSchema.properties.tasks.maxItems, 3);
});
