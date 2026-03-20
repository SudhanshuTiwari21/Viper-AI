/**
 * Runtime loader for @repo/intent-agent to avoid pulling its types into tsc
 * (intent-agent and codebase-analysis-agent have module resolution / circular issues).
 */

const INTENT_AGENT_MODULE = "@repo/intent-agent";

export type IntentPipelineResult = {
  intent: { intentType: string };
  entities: { entities: Array<{ value: string }> };
  tasks: { tasks: Array<{ type: string }> };
  contextRequest: {
    symbolSearch?: string[];
    embeddingSearch?: string[];
    dependencyLookup?: boolean;
  };
  response: { intent: string; summary: string };
  reasoning?: {
    detectedComponents?: string[];
    missingComponents?: string[];
    potentialIssues?: string[];
    recommendedNextStep?: string;
  };
};

export type IntentAgentCacheContext = {
  workspaceKey?: string;
  conversationId?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  contextHash?: string;
};

export async function runIntentPipeline(
  prompt: string,
  options?: { cacheContext?: IntentAgentCacheContext; skipReasoning?: boolean },
): Promise<IntentPipelineResult> {
  const mod = await import(INTENT_AGENT_MODULE) as {
    runIntentPipeline: (
      p: string,
      o?: { cacheContext?: IntentAgentCacheContext; skipReasoning?: boolean },
    ) => Promise<IntentPipelineResult>;
  };
  return mod.runIntentPipeline(prompt, options);
}

export async function runIntentReasoning(
  userPrompt: string,
  intent: unknown,
  entities: unknown,
  tasks: unknown,
  context: unknown,
  options?: { cacheContext?: IntentAgentCacheContext },
): Promise<IntentPipelineResult["reasoning"]> {
  const mod = await import(INTENT_AGENT_MODULE) as {
    runReasoning: (
      u: string,
      i: unknown,
      e: unknown,
      t: unknown,
      c: unknown,
      o?: IntentAgentCacheContext,
    ) => Promise<IntentPipelineResult["reasoning"]>;
  };

  // NOTE: intent-agent's runReasoning signature is:
  // runReasoning(userPrompt, intent, entities, tasks, context, cacheContext?)
  return mod.runReasoning(
    userPrompt,
    intent,
    entities,
    tasks,
    context,
    options?.cacheContext,
  );
}

export type IntentAgentAdapter = {
  searchSymbols: (term: string) => Promise<Array<{ filePath: string; symbolName: string; kind: "function" | "class" }>>;
  searchEmbeddings: (term: string) => Promise<Array<{ text: string; score: number; file?: string; symbol?: string }>>;
  getDependencies: (symbol: string) => Promise<Array<{ from: string; to: string; type?: string }>>;
};

export async function getIntentAgentAdapter(): Promise<IntentAgentAdapter> {
  const mod = await import(INTENT_AGENT_MODULE) as {
    searchSymbols: (term: string) => Promise<unknown[]>;
    searchEmbeddings: (term: string) => Promise<unknown[]>;
    getDependencies: (symbol: string) => Promise<unknown[]>;
  };
  return {
    searchSymbols: mod.searchSymbols as IntentAgentAdapter["searchSymbols"],
    searchEmbeddings: mod.searchEmbeddings as IntentAgentAdapter["searchEmbeddings"],
    getDependencies: mod.getDependencies as IntentAgentAdapter["getDependencies"],
  };
}
