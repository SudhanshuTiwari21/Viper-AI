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
Prefer SURGICAL line-range operations (minimal diffs). Use full-file changes only when necessary.

Return ONLY valid JSON (no markdown fences, no commentary) in one of these shapes:

{
  "operations": [
    {
      "file": "path/to/file.ts",
      "type": "replace",
      "startLine": 10,
      "endLine": 14,
      "content": "replacement lines",
      "expectedOldText": "old exact lines"
    }
  ]
}

or

{
  "changes": [
    {
      "file": "path/to/file.ts",
      "content": "full updated file content"
    }
  ]
}`;
}
