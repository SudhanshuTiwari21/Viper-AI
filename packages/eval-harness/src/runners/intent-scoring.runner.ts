import { scoreIntents } from "@repo/intent-agent";
import type {
  EvalCase,
  CaseResult,
  IntentScoringInput,
  IntentScoringExpect,
} from "../types.js";

export async function runIntentScoringCase(
  c: EvalCase<IntentScoringInput, IntentScoringExpect>,
): Promise<CaseResult> {
  const start = Date.now();
  try {
    const result = scoreIntents(c.input.tokens);

    const typeMatch = result.intentType === c.expect.intentType;
    const confMatch =
      c.expect.minConfidence == null ||
      result.confidence >= c.expect.minConfidence;

    if (!typeMatch || !confMatch) {
      return {
        id: c.id,
        description: c.description,
        status: "fail",
        durationMs: Date.now() - start,
        error: `expected intentType=${c.expect.intentType} minConf=${c.expect.minConfidence ?? 0} got intentType=${result.intentType} confidence=${result.confidence.toFixed(3)}`,
        actual: { intentType: result.intentType, confidence: result.confidence },
      };
    }

    return {
      id: c.id,
      description: c.description,
      status: "pass",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      id: c.id,
      description: c.description,
      status: "error",
      durationMs: Date.now() - start,
      error: String(err),
    };
  }
}
