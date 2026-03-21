import OpenAI from "openai";
import type { FileChange } from "../../pipeline/implementation.types";

const MAX_RETRIES = 2;

interface GeneratedChanges {
  changes: FileChange[];
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Required for implementation agent code generation.",
    );
  }
  return new OpenAI({ apiKey });
}

function parseChangesJSON(raw: string): GeneratedChanges {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed: unknown = JSON.parse(cleaned);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as GeneratedChanges).changes)
  ) {
    throw new Error("Invalid response shape: expected { changes: [...] }");
  }

  const result = parsed as GeneratedChanges;
  for (const change of result.changes) {
    if (typeof change.file !== "string" || typeof change.content !== "string") {
      throw new Error(
        "Invalid change entry: each must have string 'file' and 'content'",
      );
    }
  }

  return result;
}

export async function generateCode(
  prompt: string,
  logs: string[],
): Promise<FileChange[]> {
  const model = process.env.IMPLEMENTATION_MODEL ?? "gpt-4o-mini";
  const client = getOpenAIClient();

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      logs.push(`[Viper] Code generation attempt ${attempt + 1}`);

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
      logs.push(
        `[Viper] Code generation succeeded: ${parsed.changes.length} file(s)`,
      );
      return parsed.changes;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logs.push(`[Viper] Code generation attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error("Code generation failed");
}
