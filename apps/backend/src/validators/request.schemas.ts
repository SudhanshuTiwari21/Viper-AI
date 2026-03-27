import { z } from "zod";

/** B.11 chat / interaction mode (tool policy enforcement is step 12 — schema only here). */
export const ChatModeSchema = z.enum(["ask", "plan", "debug", "agent"]);
export type ChatMode = z.infer<typeof ChatModeSchema>;

/** Strip empty history rows so clients don’t 400 after failed streams leave content: "". */
function sanitizeChatMessages(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.messages)) return data;
  const cleaned = o.messages
    .flatMap((entry): { role: "user" | "assistant"; content: string }[] => {
      if (entry === null || typeof entry !== "object") return [];
      const role = (entry as { role?: unknown }).role;
      const content = (entry as { content?: unknown }).content;
      if (role !== "user" && role !== "assistant") return [];
      if (typeof content !== "string") return [];
      const c = content.trim();
      if (!c) return [];
      return [{ role, content: c }];
    })
    .slice(-10);
  return {
    ...o,
    messages: cleaned.length > 0 ? cleaned : undefined,
  };
}

export const ChatRequestSchema = z.preprocess(
  sanitizeChatMessages,
  z.object({
    prompt: z.string().min(1),
    workspacePath: z.string().min(1),
    conversationId: z.string().min(1).optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1),
        }),
      )
      .max(10)
      .optional(),
    /** Omitted → `agent` (backward compatible with pre–B.11 clients). Trimmed + lowercased before enum check. */
    mode: z.preprocess((raw) => {
      if (raw === undefined || raw === null || raw === "") return "agent";
      return String(raw).trim().toLowerCase();
    }, ChatModeSchema),
  }),
);

export const AnalysisRequestSchema = z.object({
  workspacePath: z.string().min(1),
});

export const ContextDebugSchema = z.object({
  prompt: z.string().min(1),
});

export const PatchApplySchema = z.object({
  workspacePath: z.string().min(1),
  /** Echo from patch:preview — server verifies against stored sha256(patch). */
  previewId: z.string().min(1),
  patchHash: z.string().length(64).regex(/^[0-9a-f]+$/),
  patch: z.object({
    changes: z.array(z.object({
      file: z.string(),
      content: z.string(),
    })),
    operations: z.array(z.object({
      file: z.string(),
      type: z.enum(["insert", "replace", "delete"]),
      startLine: z.number(),
      endLine: z.number().optional(),
      content: z.string().optional(),
      expectedOldText: z.string().optional(),
    })),
  }),
});

export const PatchRollbackSchema = z.object({
  workspacePath: z.string().min(1),
  rollbackId: z.string().min(1),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type ContextDebugRequest = z.infer<typeof ContextDebugSchema>;
export type PatchApplyRequest = z.infer<typeof PatchApplySchema>;
export type PatchRollbackRequest = z.infer<typeof PatchRollbackSchema>;
