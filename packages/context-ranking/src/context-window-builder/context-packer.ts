import type { RankedContextBundle, RankedSnippet } from "../topk-selector/topk-selector.types.js";
import type { ContextWindow } from "./context-window.types.js";
import { estimateTokens } from "./token-estimator.js";

/**
 * Format a snippet for LLM consumption.
 */
export function formatSnippet(snippet: RankedSnippet): string {
  return `File: ${snippet.file}\n\n${snippet.content}`;
}

/**
 * Pack bundle into context window respecting token budget.
 * Priority: snippets → functions → files.
 */
export function packContext(
  bundle: RankedContextBundle,
  tokenBudget: number,
): ContextWindow {
  const files: string[] = [];
  const functions: string[] = [];
  const snippets: string[] = [];
  let usedTokens = 0;
  let truncated = false;

  for (const snip of bundle.snippets) {
    const formatted = formatSnippet(snip);
    const tokens = estimateTokens(formatted);
    if (usedTokens + tokens <= tokenBudget) {
      snippets.push(formatted);
      usedTokens += tokens;
    } else {
      truncated = true;
      break;
    }
  }

  for (const fn of bundle.functions) {
    const tokens = estimateTokens(fn);
    if (usedTokens + tokens <= tokenBudget) {
      functions.push(fn);
      usedTokens += tokens;
    } else {
      truncated = true;
      break;
    }
  }

  for (const file of bundle.files) {
    const tokens = estimateTokens(file);
    if (usedTokens + tokens <= tokenBudget) {
      files.push(file);
      usedTokens += tokens;
    } else {
      truncated = true;
      break;
    }
  }

  if (truncated && typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log("[Viper] Context truncated due to token budget");
  }

  return {
    files,
    functions,
    snippets,
    estimatedTokens: usedTokens,
  };
}
