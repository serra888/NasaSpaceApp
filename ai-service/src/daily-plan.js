import { createFallbackContent } from "./fallback.js";
import { validateAstronautSnapshot, validateGeneratedContent } from "./contracts.js";

export const SAFETY_NOTICE = "Wellness guidance only; not medical advice or a diagnosis. Contact the mission medical team for health concerns.";

export async function generateDailyPlan(rawSnapshot, { geminiClient, now = () => new Date() }) {
  const snapshot = validateAstronautSnapshot(rawSnapshot);
  let content;
  let source;

  try {
    content = validateGeneratedContent(await geminiClient.generate(snapshot));
    source = "gemini";
  } catch {
    content = validateGeneratedContent(createFallbackContent(snapshot));
    source = "fallback";
  }

  return Object.freeze({
    ...content,
    source,
    generatedAt: now().toISOString(),
    safetyNotice: SAFETY_NOTICE
  });
}
