import type { ImplementationInput } from "../../pipeline/implementation.types";

export function buildImplementationPrompt(input: ImplementationInput): string {
  const stepsText = input.plan.steps
    .map((s, i) => `${i + 1}. [${s.type}] ${s.description}`)
    .join("\n");

  const filesText =
    input.contextWindow.files.length > 0
      ? input.contextWindow.files.join("\n")
      : "(none)";

  const functionsText =
    input.contextWindow.functions.length > 0
      ? input.contextWindow.functions.join("\n")
      : "(none)";

  const snippetsText =
    input.contextWindow.snippets.length > 0
      ? input.contextWindow.snippets.join("\n---\n")
      : "(none)";

  return `You are an expert software engineer. You produce precise, minimal code changes.

USER REQUEST:
${input.prompt}

EXECUTION PLAN:
${stepsText}

RELEVANT FILES:
${filesText}

RELEVANT FUNCTIONS:
${functionsText}

CODE CONTEXT:
${snippetsText}

TASK:
Generate the exact code changes required to fulfill the user request.
Only modify files that need changing. Produce full updated file content for each changed file.

Return ONLY valid JSON (no markdown fences, no commentary) in this exact shape:

{
  "changes": [
    {
      "file": "path/to/file.ts",
      "content": "full updated file content"
    }
  ]
}`;
}
