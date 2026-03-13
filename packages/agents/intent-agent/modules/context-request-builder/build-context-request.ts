import type { TaskPlan, PlannedTask } from "../task-planner/task-planner.types";
import type { EntityExtractionResult, ExtractedEntity } from "../entity-extractor/entity-extractor.types";
import type { ContextRequest } from "./context-request.types";
import { CONTEXT_QUERY_RULES } from "./context-query-rules";
import type { QueryStrategy } from "./context-query-rules";

export function buildContextRequest(
  plan: TaskPlan,
  entities: EntityExtractionResult,
): ContextRequest {
  const entityList = entities.entities ?? [];
  const symbols = new Set<string>();
  const files = new Set<string>();
  const modules = new Set<string>();
  const embeddings = new Set<string>();
  let dependencyLookup = false;

  for (const task of plan.tasks) {
    const strategies = CONTEXT_QUERY_RULES[task.type] ?? [];
    const taskEntities = task.entities ?? entityList.map((e) => e.value);

    for (const strategy of strategies) {
      if (strategy === "dependencyLookup") {
        dependencyLookup = true;
        continue;
      }
      const terms = getQueryTerms(strategy, taskEntities, entityList);
      terms.forEach((t) => {
        if (strategy === "symbolSearch") symbols.add(t);
        else if (strategy === "fileSearch") files.add(t);
        else if (strategy === "moduleSearch") modules.add(t);
        else if (strategy === "embeddingSearch") embeddings.add(t);
      });
    }
  }

  const result: ContextRequest = {};
  if (symbols.size) result.symbolSearch = [...symbols];
  if (files.size) result.fileSearch = [...files];
  if (modules.size) result.moduleSearch = [...modules];
  if (embeddings.size) result.embeddingSearch = [...embeddings];
  if (dependencyLookup) result.dependencyLookup = true;

  return result;
}

function getQueryTerms(
  strategy: QueryStrategy,
  taskEntityValues: string[],
  fullEntities: ExtractedEntity[],
): string[] {
  if (strategy === "symbolSearch") {
    return taskEntityValues.map(toSymbolTerm);
  }
  if (strategy === "fileSearch") {
    return fullEntities
      .filter((e) => e.type === "file")
      .map((e) => e.value);
  }
  if (strategy === "moduleSearch") {
    return fullEntities
      .filter((e) => e.type === "module" || e.type === "service")
      .map((e) => e.value.replace(/\s+(module|service)$/i, ""));
  }
  if (strategy === "embeddingSearch") {
    return taskEntityValues.length ? taskEntityValues : fullEntities.map((e) => e.value);
  }
  return [];
}

function toSymbolTerm(value: string): string {
  const trimmed = value.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  if (!firstWord) return trimmed;
  return firstWord.replace(/\.(ts|tsx|js|py|go|java)$/i, "");
}
