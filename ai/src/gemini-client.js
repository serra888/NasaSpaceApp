import { selectionSchema } from "./backend-contract.js";

const BASE_SYSTEM_INSTRUCTION = `You are the constrained task selector for the Orbitone demo.
Select exactly three distinct entries from the supplied task_catalog.
Never select medical_review; the backend reserves it for flagged readings.
Never diagnose, prescribe treatment or medication, interpret symptoms, or provide medical or exercise advice.
Never write new task text or include markdown or extra fields.`;

const V10_INSTRUCTION = `${BASE_SYSTEM_INSTRUCTION}
Return only each selected template_id and its matching category.
Use only the current snapshot and do not infer trends.
Prefer rest for short sleep or low energy, reflection for low mood, social connection for high loneliness, and a breathing pause for high stress.`;

const V11_INSTRUCTION = `${BASE_SYSTEM_INSTRUCTION}
Return only each selected template_id, its matching category, and one reason_code allowed by that task.
Use the backend-provided current snapshot and trend_summary to make a contextual selection.
Treat insufficient_data as unknown; never invent a trend or reason.
Every reason_code must exist in reason_catalog and in the selected task's reason_codes.
Prefer a varied set of useful tasks and follow the supplied duration and intensity constraints.
Do not rewrite titles or reason descriptions.`;

function systemInstruction(context) {
  return context.contract_version === "1.1" ? V11_INSTRUCTION : V10_INSTRUCTION;
}

export class GeminiClient {
  constructor({ apiKey, model, timeoutMs = 8000, fetchImpl = fetch }) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async selectTasks(context) {
    if (!this.apiKey) throw new Error("Gemini API key is not configured");
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction(context) }] },
          contents: [{
            role: "user",
            parts: [{ text: `Select today's approved templates from this backend context:\n${JSON.stringify(context)}` }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 240,
            thinkingConfig: { thinkingLevel: "minimal" },
            responseMimeType: "application/json",
            responseJsonSchema: selectionSchema(context)
          }
        })
      }
    );
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") throw new Error("Gemini returned no text content");
    return JSON.parse(text);
  }
}
