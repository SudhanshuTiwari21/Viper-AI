export type {
  FailureKind,
  DetectedFailure,
  ExecutionObservation,
  ReflectionResult,
  PlanAdjustment,
  LoopIteration,
  AutonomousLoopResult,
} from "./reflection/reflection.types";
export { MAX_LOOP_ITERATIONS } from "./reflection/reflection.types";
export { detectFailures } from "./reflection/detect-failure";
export { analyzeResult } from "./reflection/analyze-result";
export { buildReflectionPrompt } from "./reflection/build-reflection-prompt";
export {
  ReflectionLLMOutputSchema,
  extractJsonFromLLMResponse,
  parseReflectionLLMOutput,
  llmOutputToPlanAdjustments,
  type ReflectionLLMOutput,
  type ParseReflectionResult,
} from "./reflection/reflection-llm";
export { refinePlan } from "./loop/refine-plan";
export {
  runAutonomousLoop,
  type AutonomousLoopOptions,
} from "./loop/autonomous-loop";
