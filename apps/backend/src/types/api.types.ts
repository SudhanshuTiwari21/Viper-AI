export interface HealthResponse {
  status: "ok";
}

export interface AnalysisRunResponse {
  status: "analysis_started";
}

export interface ChatIntentResponse {
  intent: string;
  summary: string;
}

export interface ChatResponse {
  intent: ChatIntentResponse;
  context: {
    files: string[];
    functions: string[];
    snippets: string[];
    estimatedTokens: number;
  };
}

export interface ContextDebugResponse {
  intent: Record<string, unknown>;
  rawContext: Record<string, unknown>;
  candidates: unknown[];
  ranked: unknown[];
  contextWindow: Record<string, unknown>;
}
