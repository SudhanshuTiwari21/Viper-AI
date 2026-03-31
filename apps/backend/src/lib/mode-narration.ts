import type { ChatMode } from "../validators/request.schemas.js";

/**
 * C.14 — Mode-aware narration contract.
 *
 * Returns a prompt addendum that instructs the LLM to format its final
 * response according to the active ChatMode. These are appended after the
 * base system prompt (both direct-LLM and agentic paths).
 */

const ASK_ADDENDUM = [
  "",
  "MODE: ASK (read-only — no code changes, no shell commands).",
  "Give a direct, concise answer. Use plain text with optional bullets.",
  "Structure your final response EXACTLY with these sections (use plain-text headings on their own line, followed by content):",
  "",
  "Answer",
  "(your answer here)",
  "",
  "Assumptions",
  "(list any assumptions, or omit this section if none)",
  "",
  "If you want, I can ...",
  "(optional: suggest follow-up actions the user could request in agent mode)",
  "",
  "Do NOT use markdown formatting. Do NOT attempt file edits or shell commands.",
].join("\n");

const PLAN_ADDENDUM = [
  "",
  "MODE: PLAN (read-only — no code changes, no shell commands).",
  "Produce a structured implementation plan. Do NOT execute changes or run commands.",
  "Structure your final response EXACTLY with these sections (use plain-text headings on their own line, followed by content):",
  "",
  "Plan",
  "(numbered steps with file paths and descriptions)",
  "",
  "Risks / tradeoffs",
  "(potential issues, alternative approaches, or trade-offs)",
  "",
  "Next actions",
  "(concrete next steps the user can take, e.g. 'Switch to Agent mode and ask me to implement step 1')",
  "",
  "Do NOT use markdown formatting. Do NOT attempt file edits or shell commands.",
].join("\n");

const DEBUG_ADDENDUM = [
  "",
  "MODE: DEBUG (read-only + diagnostics — you may run shell commands for evidence, but NO file edits).",
  "Investigate the issue systematically. Use run_command to gather evidence (logs, test output, type-check results).",
  "Structure your final response EXACTLY with these sections (use plain-text headings on their own line, followed by content):",
  "",
  "Observations",
  "(facts from logs, commands, file contents — cite evidence)",
  "",
  "Hypotheses",
  "(ranked list of likely causes)",
  "",
  "Experiments",
  "(commands to run or checks to perform to confirm/reject hypotheses)",
  "",
  "Recommendation",
  "(what to fix and how — the user can switch to Agent mode to apply)",
  "",
  "Do NOT use markdown formatting. Do NOT attempt file edits.",
].join("\n");

const AGENT_ADDENDUM = [
  "",
  "MODE: AGENT (full access — you may read, edit, create files and run commands).",
  "After completing the task, structure your final response with these sections (use plain-text headings on their own line, followed by content):",
  "",
  "Summary",
  "(brief description of what you did)",
  "",
  "What changed",
  "(list files modified/created, or 'No changes' if none)",
  "",
  "Test plan",
  "(commands you ran or suggest running to verify the changes)",
  "",
  "Do NOT use markdown formatting.",
].join("\n");

const MODE_ADDENDA: Record<ChatMode, string> = {
  ask: ASK_ADDENDUM,
  plan: PLAN_ADDENDUM,
  debug: DEBUG_ADDENDUM,
  agent: AGENT_ADDENDUM,
};

export function getModePromptAddendum(mode: ChatMode): string {
  return MODE_ADDENDA[mode] ?? "";
}

/**
 * Required plain-text section headings per mode.
 * Used by the post-processor to verify contract compliance.
 */
const REQUIRED_HEADINGS: Record<ChatMode, readonly string[]> = {
  ask: ["Answer"],
  plan: ["Plan", "Risks / tradeoffs", "Next actions"],
  debug: ["Observations", "Hypotheses", "Recommendation"],
  agent: ["Summary"],
};

export function getRequiredHeadings(mode: ChatMode): readonly string[] {
  return REQUIRED_HEADINGS[mode] ?? [];
}

/**
 * Lightweight post-processor: if the LLM response is missing required
 * section headings for the mode, append stub headings so the output contract
 * is always satisfied.  Only fires for non-empty responses.
 */
export function enforceOutputContract(content: string, mode: ChatMode): string {
  if (!content.trim()) return content;
  const headings = getRequiredHeadings(mode);
  if (headings.length === 0) return content;

  const missing: string[] = [];
  for (const h of headings) {
    const pattern = new RegExp(`^${escapeRegExp(h)}\\s*$`, "m");
    if (!pattern.test(content)) {
      missing.push(h);
    }
  }
  if (missing.length === 0) return content;

  let result = content.trimEnd();
  for (const h of missing) {
    result += `\n\n${h}\n(no additional information)`;
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
