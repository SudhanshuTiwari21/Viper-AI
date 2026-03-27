import type OpenAI from "openai";

export interface AgenticToolDefinition {
  definition: OpenAI.ChatCompletionTool;
  execute: (args: Record<string, unknown>) => Promise<string>;
  /** If true, executing this tool will pause the loop for user approval. */
  pausesLoop?: boolean;
}

export interface AgenticLoopOptions {
  client: OpenAI;
  model: string;
  systemPrompt: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  tools: AgenticToolDefinition[];
  /** Workspace root path — needed for capturing file snapshots for inline diffs. */
  workspacePath?: string;
  /** Called for every text token delta streamed from the LLM. */
  onToken?: (delta: string) => void;
  /** Called when the LLM invokes a tool (before execution). */
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  /** Called after a tool finishes executing. */
  onToolResult?: (name: string, summary: string, durationMs: number) => void;
  /** Called if a tool execution throws. */
  onToolError?: (name: string, error: string) => void;
  /** Called when the loop pauses for user approval after an edit tool. */
  onPause?: (summary: string, editedFiles: string[], fileSnapshots: FileSnapshot[]) => void;
  /** Max tool-call rounds before forcing a text response (default 15). */
  maxIterations?: number;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
  temperature?: number;
  /**
   * C.12 defense-in-depth: if provided, any tool call whose name is **not** in
   * this set is blocked at execution time (returns a policy message to the LLM
   * instead of running `tool.execute`). Primary filtering should happen by
   * omitting tool definitions; this is the runtime safety net.
   */
  allowedToolNames?: ReadonlySet<string>;
}

export interface AgenticLoopResult {
  /** The final streamed text response from the LLM. */
  content: string;
  /** Total tool calls executed during this loop. */
  toolCallCount: number;
  /** Total LLM round-trips (each may have multiple parallel tool calls). */
  iterations: number;
  /** Whether the loop was cut short by maxIterations. */
  truncated: boolean;
  /**
   * If the loop paused for user approval (edit tool triggered),
   * this contains the full conversation state needed to resume.
   */
  paused?: AgenticLoopPausedState;
}

/**
 * Serializable state that allows resuming the agentic loop
 * after user confirms (or declines) an edit step.
 */
export interface FileSnapshot {
  filePath: string;
  beforeContent: string;
  afterContent: string;
}

export interface AgenticLoopPausedState {
  /** Full message history including tool calls and results up to the pause point. */
  messages: OpenAI.ChatCompletionMessageParam[];
  /** Summary of the edit that was applied. */
  editSummary: string;
  /** Files that were modified in this step. */
  editedFiles: string[];
  /** Before/after content snapshots for inline diff display. */
  fileSnapshots: FileSnapshot[];
  /** How many tool calls had been made before pausing. */
  toolCallCount: number;
  /** Which iteration the loop was on when it paused. */
  iteration: number;
}
