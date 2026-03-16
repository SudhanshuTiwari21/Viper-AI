export interface ToolRoutingDecision {
  runContextEngine: boolean;
  runRanking: boolean;
  runImplementationAgent: boolean;
  directLLMResponse: boolean;
}

/** Minimal intent shape for routing (avoids pulling in intent-agent types). */
export interface IntentForRouting {
  intentType: string;
}

/** Minimal entities shape. */
export interface EntitiesForRouting {
  entities: Array<{ value: string }>;
}

/** Minimal tasks shape. */
export interface TasksForRouting {
  tasks: Array<{ type: string }>;
}
