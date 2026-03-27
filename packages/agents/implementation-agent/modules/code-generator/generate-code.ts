import OpenAI from "openai";
import type {
  GeneratedPatchPayload,
  PatchOperation,
  FileChange,
  StreamCallback,
} from "../../pipeline/implementation.types";

const MAX_RETRIES = 2;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Required for implementation agent code generation.",
    );
  }
  return new OpenAI({ apiKey });
}

function isValidChange(change: FileChange): boolean {
  return typeof change.file === "string" && typeof change.content === "string";
}

function isValidOperation(op: PatchOperation): boolean {
  const validType =
    op.type === "insert" || op.type === "replace" || op.type === "delete";
  if (!validType) {
    return false;
  }
  if (typeof op.file !== "string" || typeof op.startLine !== "number") {
    return false;
  }
  if ((op.type === "replace" || op.type === "delete") && typeof op.endLine !== "number") {
    return false;
  }
  if ((op.type === "replace" || op.type === "insert") && typeof op.content !== "string") {
    return false;
  }
  return true;
}

function parseChangesJSON(raw: string): GeneratedPatchPayload {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed: unknown = JSON.parse(cleaned);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid response shape: expected object payload");
  }

  const result = parsed as GeneratedPatchPayload;
  const hasChanges = Array.isArray(result.changes);
  const hasOperations = Array.isArray(result.operations);

  if (!hasChanges && !hasOperations) {
    throw new Error("Invalid response shape: expected { changes } or { operations }");
  }

  if (hasChanges) {
    for (const change of result.changes!) {
      if (!isValidChange(change)) {
        throw new Error(
          "Invalid change entry: each must have string 'file' and 'content'",
        );
      }
    }
  }

  if (hasOperations) {
    for (const op of result.operations!) {
      if (!isValidOperation(op)) {
        throw new Error("Invalid operation entry in surgical patch payload");
      }
    }
  }

  return result;
}

export async function generateCode(
  prompt: string,
  logs: string[],
  onEvent?: StreamCallback,
  options?: { streamTokens?: boolean },
): Promise<GeneratedPatchPayload> {
  const streamTokens = options?.streamTokens !== false;
  const model = process.env.IMPLEMENTATION_MODEL ?? "gpt-4o-mini";
  const client = getOpenAIClient();

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      logs.push(`[Viper] Code generation attempt ${attempt + 1}`);

      if (onEvent) {
        const stream = await client.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a code generation assistant. Return ONLY valid JSON, no markdown fences or extra text.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          stream: true,
        });

        let raw = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            raw += delta;
            if (streamTokens) {
              onEvent({ type: "token", data: { content: delta } });
            }
          }
        }

        if (!raw.trim()) {
          throw new Error("Empty response from LLM");
        }

        const parsed = parseChangesJSON(raw.trim());
        const changeCount = parsed.changes?.length ?? 0;
        const opCount = parsed.operations?.length ?? 0;
        logs.push(
          `[Viper] Code generation succeeded: ${changeCount} change(s), ${opCount} operation(s)`,
        );
        return parsed;
      }

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a code generation assistant. Return ONLY valid JSON, no markdown fences or extra text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        throw new Error("Empty response from LLM");
      }

      const parsed = parseChangesJSON(raw);
      const changeCount = parsed.changes?.length ?? 0;
      const opCount = parsed.operations?.length ?? 0;
      logs.push(
        `[Viper] Code generation succeeded: ${changeCount} change(s), ${opCount} operation(s)`,
      );
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logs.push(`[Viper] Code generation attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("Code generation failed");
}
