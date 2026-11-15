import http from "node:http";
import { config } from "./config.js";
import { GeminiClient } from "./gemini-client.js";
import { ContractError, validateBackendContext, validateTaskSelection } from "./backend-contract.js";

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

function hasValidServiceToken(request, serviceToken) {
  if (!serviceToken) return true;
  return request.headers.authorization === `Bearer ${serviceToken}`;
}

function isJsonRequest(request) {
  return request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

export function createServer({ client = geminiClient, serviceToken = config.aiServiceToken } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        providerConfigured: Boolean(config.geminiApiKey),
        fallbackOwner: "backend"
      });
    }

    if (request.method === "POST" && url.pathname === "/generate-missions") {
      if (!hasValidServiceToken(request, serviceToken)) {
        return sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "Invalid service token" } });
      }
      if (!isJsonRequest(request)) {
        return sendJson(response, 415, {
          error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" }
        });
      }
      try {
        const context = validateBackendContext(await readJson(request));
        if (context.alerts.length > 0 || context.health.stale || context.mood.stale || context.health.value === null) {
          return sendJson(response, 422, {
            error: { code: "UNSAFE_OR_INSUFFICIENT_CONTEXT", message: "Backend fallback is required" }
          });
        }
        const selection = validateTaskSelection(await client.selectTasks(context), context);
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
    return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Route not found" } });
  });
}

if (process.env.NODE_ENV !== "test") {
  createServer().listen(config.port, "127.0.0.1", () => {
    console.log(`Orbitone AI service listening on http://127.0.0.1:${config.port}`);
    console.log(config.geminiApiKey ? "Gemini provider configured" : "GEMINI_API_KEY missing; backend fallback will be required");
  });
}
