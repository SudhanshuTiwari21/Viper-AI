import type { IntentClassification } from "../intent-classifier/intent-classifier.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import type { TaskPlan } from "../task-planner/task-planner.types";
import type { ContextBundle } from "../context-builder-adapter/context-builder.types";

export function buildReasoningPrompt(
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

  return `User intent:
${intent.intentType}

Detected entities:
${entityLines}

Context:
Files:
${fileLines}

Functions:
${functionLines}

Classes:
${classLines}

Dependencies:
${depLines}

Tasks:
${taskLines}

Question:
What appears to be implemented?
What components may be missing?
What issues may exist?`;
}
