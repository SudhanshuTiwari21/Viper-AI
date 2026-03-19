import type {
  ToolRoutingDecision,
  IntentForRouting,
  EntitiesForRouting,
  TasksForRouting,
} from "./tool-router.types.js";

/**
 * Pure, deterministic tool router. Decides which pipelines run for a given intent/entities/tasks.
 * Must complete in < 1 ms; no async.
 */
export function routeTools(
  intent: IntentForRouting,
  entities: EntitiesForRouting,
  _tasks: TasksForRouting,
): ToolRoutingDecision {
  const type = intent.intentType;
  const hasEntities = entities.entities.length > 0;

  switch (type) {
    case "CODE_SEARCH":
      return {
        runContextEngine: true,
        runRanking: true,
        runImplementationAgent: false,
        directLLMResponse: false,
      };
    case "CODE_FIX":
      return {
        runContextEngine: true,
        runRanking: true,
        runImplementationAgent: true,
        directLLMResponse: false,
      };
    case "REFACTOR":
      return {
        runContextEngine: true,
        runRanking: true,
        runImplementationAgent: true,
        directLLMResponse: false,
      };
    case "FEATURE_IMPLEMENTATION":
      return {
        runContextEngine: true,
        runRanking: true,
        runImplementationAgent: true,
        directLLMResponse: false,
      };
    case "CODE_EXPLANATION":
      if (hasEntities) {
        return {
          runContextEngine: true,
          runRanking: true,
          runImplementationAgent: false,
          directLLMResponse: false,
        };
      }
      return {
        runContextEngine: false,
        runRanking: false,
        runImplementationAgent: false,
        directLLMResponse: true,
      };
    case "DEPENDENCY_ANALYSIS":
    case "TEST_GENERATION":
    case "SECURITY_ANALYSIS":
    case "FILE_EDIT":
      return {
        runContextEngine: true,
        runRanking: true,
        runImplementationAgent: false,
        directLLMResponse: false,
      };
    case "PROJECT_SETUP":
      return {
        runContextEngine: true,
        runRanking: true,
        runImplementationAgent: false,
        directLLMResponse: false,
      };
    case "GENERIC":
      return {
        runContextEngine: false,
        runRanking: false,
        runImplementationAgent: false,
        directLLMResponse: true,
      };
    default:
      return {
        runContextEngine: false,
        runRanking: false,
        runImplementationAgent: false,
        directLLMResponse: true,
      };
  }
}
