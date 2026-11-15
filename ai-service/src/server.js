import http from "node:http";
import { config } from "./config.js";
import { ContractError } from "./contracts.js";
import { generateDailyPlan } from "./daily-plan.js";
import { GeminiClient } from "./gemini-client.js";
import { validateBackendContext, validateTaskSelection } from "./backend-contract.js";

const geminiClient = new GeminiClient({
  apiKey: config.geminiApiKey,
  model: config.geminiModel,
  timeoutMs: config.geminiTimeoutMs
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 32_768) throw new ContractError("Request body is too large");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new ContractError("Request body must be valid JSON");
  }
}

function hasValidServiceToken(request) {
  if (!config.aiServiceToken) return true;
  return request.headers.authorization === `Bearer ${config.aiServiceToken}`;
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { status: "ok", aiMode: config.geminiApiKey ? "gemini-with-fallback" : "fallback-only" });
    }

    if (request.method === "POST" && url.pathname === "/generate-missions") {
      if (!hasValidServiceToken(request)) {
        return sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "Invalid service token" } });
      }
      try {
        const context = validateBackendContext(await readJson(request));
        if (context.alerts.length > 0 || context.health.stale || context.mood.stale || context.health.value === null) {
          return sendJson(response, 422, {
            error: { code: "UNSAFE_OR_INSUFFICIENT_CONTEXT", message: "Backend fallback is required" }
          });
        }
        const selection = validateTaskSelection(await geminiClient.selectTasks(context), context);
        return sendJson(response, 200, selection);
      } catch (error) {
        if (error instanceof ContractError) {
          return sendJson(response, 400, { error: { code: "INVALID_CONTRACT", message: error.message } });
        }
        console.error("Gemini selection unavailable", error instanceof Error ? error.message : "unknown error");
        return sendJson(response, 503, {
          error: { code: "AI_UNAVAILABLE", message: "Backend should use its deterministic fallback" }
        });
      }
    }

    const isPlanRoute = url.pathname === "/api/ai/daily-missions";
    const isStatusRoute = url.pathname === "/api/ai/status-message";
    if (request.method !== "POST" || (!isPlanRoute && !isStatusRoute)) {
      return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Route not found" } });
    }

    try {
      const plan = await generateDailyPlan(await readJson(request), { geminiClient });
      if (isStatusRoute) {
        return sendJson(response, 200, {
          statusMessage: plan.statusMessage,
          source: plan.source,
          generatedAt: plan.generatedAt,
          safetyNotice: plan.safetyNotice
        });
      }
      return sendJson(response, 200, plan);
    } catch (error) {
      if (error instanceof ContractError) {
        return sendJson(response, 400, { error: { code: "INVALID_INPUT", message: error.message } });
      }
      console.error("Unexpected AI service error", error instanceof Error ? error.message : "unknown error");
      return sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "Unable to generate a daily plan" } });
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  createServer().listen(config.port, "127.0.0.1", () => {
    console.log(`Orbitone AI service listening on http://127.0.0.1:${config.port}`);
    console.log(config.geminiApiKey ? "Gemini enabled with deterministic fallback" : "GEMINI_API_KEY missing; fallback-only mode enabled");
  });
}
