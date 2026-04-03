import { checkPrivacy, type PrivacyConfig } from "@repo/workspace-tools";
import type {
  EvalCase,
  CaseResult,
  PrivacyGlobInput,
  PrivacyGlobExpect,
} from "../types.js";

export async function runPrivacyGlobCase(
  c: EvalCase<PrivacyGlobInput, PrivacyGlobExpect>,
): Promise<CaseResult> {
  const start = Date.now();
  try {
    const config: PrivacyConfig | null =
      c.input.configDenyGlobs != null || c.input.configAllowGlobs != null
        ? {
            denyGlobs: c.input.configDenyGlobs ?? [],
            allowGlobs: c.input.configAllowGlobs ?? [],
            redactPatterns: [],
          }
        : null;

    const result = checkPrivacy(c.input.relativePath, config);

    const allowedMatch = result.allowed === c.expect.allowed;
    const prefixMatch =
      c.expect.blockedByPrefix == null ||
      (result.blockedBy?.startsWith(c.expect.blockedByPrefix) ?? false);

    if (!allowedMatch || !prefixMatch) {
      return {
        id: c.id,
        description: c.description,
        status: "fail",
        durationMs: Date.now() - start,
        error: `expected allowed=${c.expect.allowed} (${c.expect.blockedByPrefix ?? "any"}) got allowed=${result.allowed} blockedBy=${result.blockedBy ?? "none"}`,
        actual: { allowed: result.allowed, blockedBy: result.blockedBy },
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
