import fs from "node:fs";
import path from "node:path";

function loadLocalEnv(file = path.resolve(".env")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[2] === "") continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

loadLocalEnv();

function integerEnv(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

export const config = Object.freeze({
  port: integerEnv("PORT", 3001, 1, 65535),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite",
  geminiTimeoutMs: integerEnv("GEMINI_TIMEOUT_MS", 8000, 1000, 30000),
  aiServiceToken: process.env.AI_SERVICE_TOKEN?.trim() ?? ""
});
