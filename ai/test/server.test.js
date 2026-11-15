import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createServer } from "../src/server.js";
import { backendContextV11 } from "./fixtures.js";

async function requestWithClient(client) {
  const server = createServer({ client, serviceToken: "test-token" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    return await fetch(`http://127.0.0.1:${port}/generate-missions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token"
      },
      body: JSON.stringify(backendContextV11())
    });
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("serves a valid contract 1.1 selection end to end", async () => {
  const response = await requestWithClient({
    selectTasks: async () => ({
      tasks: [
        { template_id: "earth_gaze_reset", category: "recovery", reason_code: "high_stress" },
        { template_id: "crew_voice_checkin", category: "social", reason_code: "support_mood" },
        { template_id: "single_priority_block", category: "focus", reason_code: "support_focus" }
      ]
    })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.tasks.length, 3);
  assert.equal(body.tasks[0].reason_code, "high_stress");
});

test("returns INVALID_CONTRACT for a task-incompatible reason", async () => {
  const response = await requestWithClient({
    selectTasks: async () => ({
      tasks: [
        { template_id: "earth_gaze_reset", category: "recovery", reason_code: "low_connection" },
        { template_id: "crew_voice_checkin", category: "social", reason_code: "support_mood" },
        { template_id: "single_priority_block", category: "focus", reason_code: "support_focus" }
      ]
    })
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, "INVALID_CONTRACT");
});
