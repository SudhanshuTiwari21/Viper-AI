import { z } from "zod";
import { isPremiumSelectableModelId } from "@repo/model-registry";

/** C.11 chat / interaction mode (tool policy enforcement is C.12 — schema only here). */
export const ChatModeSchema = z.enum(["ask", "plan", "debug", "agent"]);
export type ChatMode = z.infer<typeof ChatModeSchema>;

// ---------------------------------------------------------------------------
// E.22 — Image attachment model
// ---------------------------------------------------------------------------

/** Allowed MIME types for inline_base64 attachments. */
export const INLINE_IMAGE_MIME_ALLOWLIST = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Max decoded bytes per single inline image (6 MiB). */
export const INLINE_IMAGE_MAX_BYTES = 6 * 1024 * 1024;

/** Max total decoded bytes across all inline images in one request (12 MiB). */
export const INLINE_IMAGES_MAX_TOTAL_BYTES = 12 * 1024 * 1024;

/** Max number of attachments per request. */
export const ATTACHMENT_MAX_COUNT = 8;

/**
 * Canonical source type for production — opaque mediaId resolved by E.23.
 * No size limits (the bytes live outside this request).
 */
const MediaRefSourceSchema = z.object({
  type: z.literal("media_ref"),
  mediaId: z.string().min(1),
});

/**
 * Dev / test inline source — base64-encoded image bytes sent directly.
 * Strict per-image and total-request limits enforced in Zod.
 *
 * Base64 encoding overhead: decoded ≈ chars × (3/4).
 * Max chars = ceil(INLINE_IMAGE_MAX_BYTES × 4/3).
 */
const INLINE_IMAGE_MAX_B64_CHARS = Math.ceil(INLINE_IMAGE_MAX_BYTES * (4 / 3));

const InlineBase64SourceSchema = z.object({
  type: z.literal("inline_base64"),
  mimeType: z.enum(INLINE_IMAGE_MIME_ALLOWLIST),
  data: z
    .string()
    .min(1)
    .refine(
      (s) => s.length <= INLINE_IMAGE_MAX_B64_CHARS,
      {
        message: `Inline image base64 exceeds per-image limit (~${INLINE_IMAGE_MAX_BYTES / (1024 * 1024)} MiB decoded)`,
      },
    ),
});

const ImageSourceSchema = z.discriminatedUnion("type", [
  MediaRefSourceSchema,
  InlineBase64SourceSchema,
]);

/**
 * E.22: single image attachment.
 * `kind` discriminates the attachment type; only `"image"` for now.
 */
export const ImageAttachmentSchema = z.object({
  kind: z.literal("image"),
  source: ImageSourceSchema,
});

/**
 * Top-level attachment discriminated union.
 * Add new kinds (e.g. `"file"`) here as future steps are implemented.
 */
export const AttachmentSchema = z.discriminatedUnion("kind", [ImageAttachmentSchema]);

/** Validated array of attachments with per-item and total size enforcement. */
const AttachmentsSchema = z
  .array(AttachmentSchema)
  .max(ATTACHMENT_MAX_COUNT, { message: `Max ${ATTACHMENT_MAX_COUNT} attachments per request` })
  .refine(
    (arr) => {
      let totalB64Chars = 0;
      for (const a of arr) {
        if (a.kind === "image" && a.source.type === "inline_base64") {
          totalB64Chars += a.source.data.length;
        }
      }
      return totalB64Chars * 0.75 <= INLINE_IMAGES_MAX_TOTAL_BYTES;
    },
    {
      message: `Total inline image data exceeds ${INLINE_IMAGES_MAX_TOTAL_BYTES / (1024 * 1024)} MiB`,
    },
  )
  .optional();

export type Attachment = z.infer<typeof AttachmentSchema>;
export type ImageAttachment = z.infer<typeof ImageAttachmentSchema>;

/**
 * D.19: model tier selector (`auto` = D.17 router + D.18 failover; `premium` = user-picked premium model).
 * Legacy clients may send `fast` — normalized to `auto`.
 */
export const ModelTierSelectionSchema = z.preprocess(
  (v) => (v === "fast" ? "auto" : v),
  z.enum(["auto", "premium"]),
);
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
    /** When `modelTier` is `premium`, optional registry allowlist id (e.g. `gpt-4o`). */
    premiumModelId: z.preprocess((raw) => {
      if (raw === undefined || raw === null || raw === "") return undefined;
      const s = String(raw).trim();
      return s.length > 0 ? s : undefined;
    }, z.string().min(1).optional()),
    /**
     * E.22: optional image attachments for the current user turn.
     * Canonical shape: `{ kind: "image", source: { type: "media_ref", mediaId } }` (production).
     * Dev-only: `{ kind: "image", source: { type: "inline_base64", mimeType, data } }`.
     * Omitting this field preserves full backward compatibility with pre-E.22 clients.
     */
    attachments: AttachmentsSchema,
  })
    .superRefine((data, ctx) => {
      if (data.premiumModelId !== undefined && !isPremiumSelectableModelId(data.premiumModelId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unknown premiumModelId",
          path: ["premiumModelId"],
        });
      }
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
