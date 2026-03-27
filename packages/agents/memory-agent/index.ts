export type {
  MemoryEntry,
  MemoryEntryType,
  MemoryMetadata,
  IntentMeta,
  PatchMeta,
  ExecutionStepMeta,
  ErrorMeta,
  DecisionMeta,
  ReflectionLoopMeta,
  ToolResultMeta,
  AnalysisMeta,
  TurnSummaryMeta,
  MemorySnapshot,
  SessionKey,
} from "./memory/memory.types";
export { sessionKeyString } from "./memory/memory.types";
export {
  addMemoryEntry,
  getMemoryEntries,
  getMemoryEntriesAsync,
  clearMemory,
  registerDbAdapter,
  searchMemoryByQuery,
} from "./memory/memory-store";
export {
  retrieveMemory,
  retrieveMemoryAsync,
  retrieveRelevantMemory,
  buildMemorySnapshot,
  type RetrieveOptions,
  type SmartRetrieveOptions,
} from "./memory/memory-retriever";
export {
  recordMemory,
  recordIntent,
  recordPatch,
  recordExecutionStep,
  recordDecision,
  recordError,
  recordReflectionIteration,
  recordToolResult,
  recordAnalysis,
  recordTurnSummary,
  type MemoryUpdateInput,
  type ToolCallRecord,
} from "./memory/memory-updater";
export {
  buildMemoryContext,
  buildRichMemoryContext,
  injectMemoryIntoPrompt,
} from "./context/build-memory-context";
