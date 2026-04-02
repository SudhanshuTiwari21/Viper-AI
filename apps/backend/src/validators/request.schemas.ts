import { z } from "zod";

/** C.11 chat / interaction mode (tool policy enforcement is C.12 — schema only here). */
export const ChatModeSchema = z.enum(["ask", "plan", "debug", "agent"]);
export type ChatMode = z.infer<typeof ChatModeSchema>;

/** D.19: model tier selector (`auto` = D.17 router + D.18 failover; `premium`/`fast` = registry defaults). */
export const ModelTierSelectionSchema = z.enum(["auto", "premium", "fast"]);
export type ModelTierSelection = z.infer<typeof ModelTierSelectionSchema>;

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
    /** Omitted → `agent` (backward compatible with pre–C.11 clients). Trimmed + lowercased before enum check. */
    mode: z.preprocess((raw) => {
      if (raw === undefined || raw === null || raw === "") return "agent";
      return String(raw).trim().toLowerCase();
    }, ChatModeSchema),
    /**
     * D.19/D.20: omitted → `undefined` (server may load persisted preference). Explicit `auto` stays `auto`.
     * Trimmed + lowercased before enum check.
     */
    modelTier: z.preprocess((raw) => {
      if (raw === undefined || raw === null || raw === "") return undefined;
      return String(raw).trim().toLowerCase();
    }, ModelTierSelectionSchema.optional()),
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

/** D.21: quality feedback for an assistant message. */
export const VALID_FEEDBACK_TAGS = [
  "incorrect",
  "too_slow",
  "great",
  "off_topic",
  "incomplete",
] as const;

export const ChatFeedbackSchema = z.object({
  request_id: z.string().min(1),
  message_id: z.string().min(1).optional(),
  rating: z.enum(["up", "down"]),
  tags: z
    .array(z.enum(VALID_FEEDBACK_TAGS))
    .max(5)
    .optional()
    .default([]),
  comment: z.string().max(1000).optional(),
  workspace_id: z.string().min(1),
});

/** D.21: GET /feedback/stats query params. */
export const FeedbackStatsQuerySchema = z.object({
  workspace_id: z.string().min(1),
  since: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type ContextDebugRequest = z.infer<typeof ContextDebugSchema>;
export type PatchApplyRequest = z.infer<typeof PatchApplySchema>;
export type PatchRollbackRequest = z.infer<typeof PatchRollbackSchema>;
export type ChatFeedbackRequest = z.infer<typeof ChatFeedbackSchema>;
export type FeedbackStatsQuery = z.infer<typeof FeedbackStatsQuerySchema>;
