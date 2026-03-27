import type OpenAI from "openai";
import type { AgenticLoopOptions, AgenticLoopResult, FileSnapshot } from "./agentic-loop.types.js";
import { formatToolResult } from "../prompt/format-tool-result.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_MAX_ITERATIONS = 15;

const EDIT_TOOL_NAMES = new Set(["edit_file", "create_file"]);

async function safeReadFile(workspacePath: string, relPath: string): Promise<string> {
  try {
    return await readFile(resolve(workspacePath, relPath), "utf-8");
  } catch {
    return "";
  }
}

/**
 * Core ReAct loop using OpenAI's native `tools` / function-calling API.
 *
 * Flow per iteration:
 *   1. Call the model with the current messages + tool definitions (streaming).
 *   2. Collect the streamed response:
 *      - If it contains tool_calls → execute each tool, append results.
 *        - If any tool has `pausesLoop: true` → pause and return state for resumption.
 *        - Otherwise → loop back for the next iteration.
 *      - If it contains text content → stream tokens to the caller, return.
 *   3. After maxIterations, force a text-only response (tool_choice: "none").
 */
export async function runAgenticLoop(
  opts: AgenticLoopOptions,
): Promise<AgenticLoopResult> {
  const maxIter = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const messages: OpenAI.ChatCompletionMessageParam[] = [...opts.messages];
  const toolMap = new Map(
    opts.tools.map((t) => [t.definition.function.name, t]),
  );
  const toolDefs = opts.tools.map((t) => t.definition);

  let totalToolCalls = 0;
  let iterations = 0;
  let finalContent = "";
  let truncated = false;

  for (let i = 0; i < maxIter + 1; i++) {
    iterations = i + 1;
    if (opts.signal?.aborted) break;

    const isLastChance = i === maxIter;
    const stream = await opts.client.chat.completions.create({
      model: opts.model,
      messages,
      tools: isLastChance ? undefined : toolDefs.length > 0 ? toolDefs : undefined,
      tool_choice: isLastChance ? undefined : "auto",
      stream: true,
      temperature: opts.temperature ?? 0.2,
    });

    let textContent = "";
    const toolCalls: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();

    for await (const chunk of stream) {
      if (opts.signal?.aborted) break;
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;

      if (delta.content) {
        textContent += delta.content;
        opts.onToken?.(delta.content);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          let entry = toolCalls.get(idx);
          if (!entry) {
            entry = { id: tc.id ?? "", name: "", arguments: "" };
            toolCalls.set(idx, entry);
          }
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name += tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }
    }

    if (toolCalls.size === 0) {
      finalContent = textContent;
      break;
    }

    const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: textContent || null,
      tool_calls: [...toolCalls.values()].map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
    messages.push(assistantMsg);

    let shouldPause = false;
    const editedFiles: string[] = [];
    const fileSnapshots: FileSnapshot[] = [];
    let editSummary = "";

    for (const tc of toolCalls.values()) {
      totalToolCalls++;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.arguments || "{}");
      } catch {
        args = {};
      }

      opts.onToolStart?.(tc.name, args);
      const startMs = Date.now();

      const isEditTool = EDIT_TOOL_NAMES.has(tc.name);
      const filePath = String(args.path ?? args.file ?? "");
      let beforeContent = "";
      if (isEditTool && filePath && opts.workspacePath) {
        beforeContent = await safeReadFile(opts.workspacePath, filePath);
      }

      let resultText: string;
      try {
        const tool = toolMap.get(tc.name);
        if (!tool) {
          resultText = `Unknown tool: ${tc.name}`;
        } else {
          resultText = await tool.execute(args);

          if (tool.pausesLoop || isEditTool) {
            shouldPause = true;
            if (filePath && !editedFiles.includes(filePath)) {
              editedFiles.push(filePath);
            }
            editSummary = resultText.split("\n")[0] ?? `Edited ${filePath}`;

            if (filePath && opts.workspacePath) {
              const afterContent = await safeReadFile(opts.workspacePath, filePath);
              fileSnapshots.push({ filePath, beforeContent, afterContent });
            }
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        resultText = `Tool error: ${errMsg}`;
        opts.onToolError?.(tc.name, errMsg);
      }

      const durationMs = Date.now() - startMs;
      const trimmedResult = formatToolResult(resultText);
      const summaryLine = trimmedResult.split("\n")[0]?.slice(0, 120) ?? tc.name;
      opts.onToolResult?.(tc.name, summaryLine, durationMs);

      messages.push({
        role: "tool" as const,
        tool_call_id: tc.id,
        content: trimmedResult,
      });
    }

    if (shouldPause) {
      opts.onPause?.(editSummary, editedFiles, fileSnapshots);

      return {
        content: textContent,
        toolCallCount: totalToolCalls,
        iterations,
        truncated: false,
        paused: {
          messages: [...messages],
          editSummary,
          editedFiles,
          fileSnapshots,
          toolCallCount: totalToolCalls,
          iteration: i,
        },
      };
    }

    if (i === maxIter - 1) {
      truncated = true;
    }
  }

  return {
    content: finalContent,
    toolCallCount: totalToolCalls,
    iterations,
    truncated,
  };
}
