/**
 * Formats the output of a tool call into a string suitable for the assistant
 * conversation (the `tool` role message content).
 *
 * Keeps results concise — large file reads are already capped by the
 * workspace-tools layer (50 KB), and we further trim here if the result
 * exceeds a safety threshold so one bloated file doesn't blow the context.
 */
const MAX_TOOL_RESULT_CHARS = 24_000; // ~6K tokens

export function formatToolResult(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  const trimmed = result.slice(0, MAX_TOOL_RESULT_CHARS);
  return `${trimmed}\n\n[... output truncated at ${MAX_TOOL_RESULT_CHARS} characters]`;
}
