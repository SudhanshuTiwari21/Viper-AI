import type { RankedContextBundle } from "../topk-selector/topk-selector.types.js";
import type { ContextWindow } from "./context-window.types.js";
import { packContext } from "./context-packer.js";

export const DEFAULT_TOKEN_LIMIT = 12_000;
export const CONTEXT_TOKEN_BUDGET = 8_000;

export interface BuildContextWindowOptions {
  tokenBudget?: number;
}

/**
 * Build an LLM-ready context window from a RankedContextBundle.
 * Packs snippets, then functions, then files until token budget is reached.
 */
export function buildContextWindow(
  bundle: RankedContextBundle,
  options?: BuildContextWindowOptions,
): ContextWindow {
  const tokenBudget = options?.tokenBudget ?? CONTEXT_TOKEN_BUDGET;
  return packContext(bundle, tokenBudget);
}
