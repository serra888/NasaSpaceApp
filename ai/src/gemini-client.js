import { selectionSchema } from "./backend-contract.js";

const BACKEND_SYSTEM_INSTRUCTION = `You are the constrained task selector for the Orbitone demo.
Select exactly three distinct entries from the supplied task_catalog.
Return only each selected template_id and its matching category. Never write new task text.
Never select medical_review; the backend reserves it for flagged readings.
Use only the current snapshot. Do not infer trends, diagnose, prescribe treatment or medication, interpret symptoms, or provide medical or exercise advice.
Prefer rest for short sleep or low energy, reflection for low mood, social connection for high loneliness, and a breathing pause for high stress.
Do not include markdown or extra fields.`;

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
          systemInstruction: { parts: [{ text: BACKEND_SYSTEM_INSTRUCTION }] },
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
