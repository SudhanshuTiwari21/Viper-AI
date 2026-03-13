import type { IntentClassification } from "../intent-classifier/intent-classifier.types";
import type {
  PlannedTask,
  TaskPlan,
  TaskType,
} from "./task-planner.types";
import type { EntityExtractionResult } from "../entity-extractor/entity-extractor.types";
import type { ExtractedEntity } from "../entity-extractor/entity-extractor.types";
import { TASK_RULES } from "./task-rules";

export function planTasks(
  intent: IntentClassification,
  entities: EntityExtractionResult,
): TaskPlan {
  const taskTypes = TASK_RULES[intent.intentType] ?? [];
  const allEntities = entities.entities ?? [];

  const plannedTasks: PlannedTask[] = taskTypes.map((taskType) =>
    buildTask(taskType, intent.intentType, allEntities),
  );

  return {
    intent: intent.intentType,
    tasks: plannedTasks,
  };
}

function buildTask(
  type: TaskType,
  intent: IntentClassification["intentType"],
  entities: ExtractedEntity[],
): PlannedTask {
  const primaryEntity = entities[0];

  switch (type) {
    case "LOCATE_CODE": {
      if (primaryEntity) {
        const description = `Locate implementation of ${primaryEntity.value}`;
        return {
          type,
          description,
          entities: [primaryEntity.value],
        };
      }
      return {
        type,
        description: "Locate the relevant code for this request",
      };
    }
    case "ANALYZE_FLOW": {
      const flowTarget = getFlowTarget(entities);
      const description = flowTarget
        ? `Analyze ${flowTarget} flow`
        : "Analyze the relevant code flow";
      return {
        type,
        description,
      };
    }
    case "IDENTIFY_ISSUE":
      return {
        type,
        description: "Identify the root cause of the issue or bug",
      };
    case "GENERATE_PATCH":
      return {
        type,
        description: "Prepare the necessary code modifications or patch",
      };
    case "EXPLAIN_CODE": {
      if (primaryEntity) {
        return {
          type,
          description: `Explain the behavior and purpose of ${primaryEntity.value}`,
          entities: [primaryEntity.value],
        };
      }
      return {
        type,
        description: "Explain the relevant code to the user",
      };
    }
    case "SEARCH_REFERENCES": {
      if (primaryEntity) {
        return {
          type,
          description: `Search references for ${primaryEntity.value}`,
          entities: [primaryEntity.value],
        };
      }
      return {
        type,
        description: "Search references related to the request",
      };
    }
    default:
      return {
        type,
        description: `Perform task: ${type} for intent ${intent}`,
      };
  }
}

function getFlowTarget(entities: ExtractedEntity[]): string | null {
  const moduleOrService = entities.find(
    (e) => e.type === "module" || e.type === "service",
  );
  if (moduleOrService) {
    return moduleOrService.value.replace(/\s+(module|service)$/i, "");
  }
  const apiEntity = entities.find((e) => e.type === "api");
  if (apiEntity) {
    return apiEntity.value;
  }
  return null;
}

