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
  MemorySnapshot,
  SessionKey,
} from "./memory/memory.types";
export { sessionKeyString } from "./memory/memory.types";
export {
  addMemoryEntry,
  getMemoryEntries,
  clearMemory,
} from "./memory/memory-store";
export {
  retrieveMemory,
  buildMemorySnapshot,
  type RetrieveOptions,
} from "./memory/memory-retriever";
export {
  recordMemory,
  recordIntent,
  recordPatch,
  recordExecutionStep,
  recordDecision,
  recordError,
  recordReflectionIteration,
  type MemoryUpdateInput,
} from "./memory/memory-updater";
export {
  buildMemoryContext,
  injectMemoryIntoPrompt,
} from "./context/build-memory-context";
