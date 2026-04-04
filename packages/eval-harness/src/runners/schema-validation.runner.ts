import { z } from "zod";
import type {
  EvalCase,
  CaseResult,
  SchemaValidationInput,
  SchemaValidationExpect,
} from "../types.js";

// ---------------------------------------------------------------------------
// Inline Zod schemas (mirrors of production — serves as behavioral spec).
// If the production schemas change, update here + add eval case.
// ---------------------------------------------------------------------------

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  // C.11: chat interaction mode
  ChatMode: z.enum(["ask", "plan", "debug", "agent"]),
  // D.19: model tier selector
  ModelTier: z.enum(["auto", "premium", "fast"]),
};

export async function runSchemaValidationCase(
  c: EvalCase<SchemaValidationInput, SchemaValidationExpect>,
): Promise<CaseResult> {
  const start = Date.now();
  try {
    const schema = SCHEMAS[c.input.schema];
    if (!schema) {
      return {
        id: c.id,
        description: c.description,
        status: "error",
        durationMs: Date.now() - start,
        error: `Unknown schema name: ${c.input.schema}`,
      };
    }

    const parsed = schema.safeParse(c.input.value);
    const isValid = parsed.success;

    if (isValid !== c.expect.valid) {
      return {
        id: c.id,
        description: c.description,
        status: "fail",
        durationMs: Date.now() - start,
        error: `expected valid=${c.expect.valid} but safeParse returned success=${isValid}` +
          (!parsed.success ? ` issues=${parsed.error.issues.map((i) => i.message).join(", ")}` : ""),
        actual: { valid: isValid },
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
