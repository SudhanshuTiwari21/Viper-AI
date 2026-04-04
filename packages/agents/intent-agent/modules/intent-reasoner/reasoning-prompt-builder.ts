import type { IntentClassification, IntentType } from "../intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import type { TaskPlan } from "../task-planner/task-planner.types";
import type { ContextBundle } from "../context-builder-adapter/context-builder.types";

/**
 * Intent-specific focus for the reasoning instruction. User request remains primary;
 * this guides the model on what to emphasize in the analysis.
 */
function getReasoningInstruction(intentType: IntentType): string {
  switch (intentType) {
    case "CODE_FIX":
      return "Focus on identifying bugs, errors, and what needs to be fixed.";
    case "FEATURE_IMPLEMENTATION":
      return "Focus on missing components and implementation steps to fulfill the request.";
    case "REFACTOR":
      return "Focus on improvement opportunities, duplication, and simplification.";
    case "CODE_EXPLANATION":
      return "Focus on explaining existing logic clearly and what the user should understand.";
    case "CODE_SEARCH":
      return "Focus on locating relevant code and where things are implemented.";
    case "DEPENDENCY_ANALYSIS":
      return "Focus on dependency relationships and impact.";
    case "TEST_GENERATION":
      return "Focus on test coverage gaps and what tests to add.";
    case "SECURITY_ANALYSIS":
      return "Focus on security issues and vulnerabilities.";
    case "CODE_GUIDANCE":
      return "Focus on practical next steps, tradeoffs, and priorities grounded in the codebase context.";
    case "FILE_EDIT":
    case "PROJECT_SETUP":
    case "GENERIC":
    default:
      return "Focus on what is in place, what is missing, and what should be done next.";
  }
}

/**
 * Build the reasoning prompt. User request is PRIMARY; intent, entities, tasks, and context
 * guide the LLM and reduce hallucination. The model answers relative to the actual user question.
 */
export function buildReasoningPrompt(
  userPrompt: string,
  intent: IntentClassification,
  entities: EntityExtractionResult,
  tasks: TaskPlan,
  context: ContextBundle,
): string {
  const entityLines =
    entities.entities?.map((e) => `- ${e.value} (${e.type})`).join("\n") ?? "None";
  const fileLines = context.files?.map((f) => `- ${f}`).join("\n") ?? "None";
  const functionLines =
    context.functions?.map((f) => `- ${f}`).join("\n") ?? "None";
  const classLines =
    context.classes?.map((c) => `- ${c}`).join("\n") ?? "None";
  const depLines =
    context.dependencies
      ?.map((d) => `- ${d.from} -> ${d.to}`)
      .join("\n") ?? "None";
  const taskLines =
    tasks.tasks?.map((t) => `- ${t.description}`).join("\n") ?? "None";

  const instruction = getReasoningInstruction(intent.intentType);

  return `You are an expert software engineer analyzing a codebase.

USER REQUEST:
"${userPrompt.trim()}"

NORMALIZED INTENT (as hint):
Intent Type: ${intent.intentType}

ENTITIES:
${entityLines}

TASK PLAN:
${taskLines}

CODEBASE CONTEXT:

Files:
${fileLines}

Functions:
${functionLines}

Classes:
${classLines}

Dependencies:
${depLines}

---

YOUR TASK (${instruction}):

Given the USER REQUEST and the CODEBASE CONTEXT:

1. What is already implemented?
2. What is missing or incomplete?
3. What issues or bugs may exist?
4. What should be done next to satisfy the user's request?

---

Return ONLY valid JSON, no markdown or explanation:

{
  "detectedComponents": [],
  "missingComponents": [],
  "potentialIssues": [],
  "recommendedNextStep": ""
}`;
}
