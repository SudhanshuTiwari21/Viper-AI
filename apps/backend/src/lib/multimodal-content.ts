/**
 * E.24 — Multimodal content builder.
 *
 * Converts a (prompt, attachments, workspaceId) tuple into an array of
 * OpenAI ChatCompletionContentPart items for the `content` field of a user
 * message.  The first part is always the text prompt; subsequent parts are
 * one `image_url` entry per image attachment in stable input order.
 *
 * Resolution paths:
 *   inline_base64 — already validated by Zod (mimeType allowlist + magic-bytes
 *       at schema time).  Construct data URL directly.
 *   media_ref     — resolve via resolveMediaBuffer(workspaceId, mediaId) → data URL.
 *
 * Errors (all throw MultimodalResolutionError):
 *   statusCode 400 — missing media, workspace mismatch, or expired TTL.
 *   statusCode 502 — bytes unavailable despite valid metadata (storage inconsistency).
 *
 * Called from runDirectLLM, runDirectLLMStream, runAgenticStreamPath in
 * assistant.service.ts when attachments?.length > 0.  Pure text requests
 * should not call this function — callers must keep using plain strings.
 */

import type OpenAI from "openai";
import type { Attachment, ImageAttachment } from "../validators/request.schemas.js";
import { resolveMediaBuffer, getMediaMeta } from "./media-store.js";

// Narrower alias for the two part kinds we emit (text + image_url).
export type ContentPart =
  | OpenAI.Chat.ChatCompletionContentPartText
  | OpenAI.Chat.ChatCompletionContentPartImage;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class MultimodalResolutionError extends Error {
  /** HTTP status that should propagate to the client. */
  readonly statusCode: 400 | 502;

  constructor(message: string, statusCode: 400 | 502 = 400) {
    super(message);
    this.name = "MultimodalResolutionError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the content-parts array for a multimodal user message.
 *
 * Always starts with `{ type: "text", text: prompt }` then appends one
 * `image_url` part per attachment in the order provided.
 */
export async function buildMultimodalUserContent(
  prompt: string,
  attachments: Attachment[],
  workspaceId: string,
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [{ type: "text", text: prompt }];

  for (const a of attachments) {
    if (a.kind === "image") {
      const url = await resolveImageDataUrl(a, workspaceId);
      parts.push({
        type: "image_url",
        image_url: { url, detail: "auto" },
      });
    }
    // Unknown kinds are skipped silently; the schema already constrains to
    // "image" for E.22–E.24 — this branch protects future extensions.
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function resolveImageDataUrl(
  attachment: ImageAttachment,
  workspaceId: string,
): Promise<string> {
  const { source } = attachment;

  if (source.type === "inline_base64") {
    // data already validated by Zod (mimeType allowlist + magic-bytes at upload).
    return `data:${source.mimeType};base64,${source.data}`;
  }

  // media_ref: look up metadata first (for mimeType + expiry), then load bytes.
  const meta = await getMediaMeta(workspaceId, source.mediaId);
  if (!meta) {
    throw new MultimodalResolutionError(
      `Media not found or workspace mismatch (mediaId: ${source.mediaId})`,
      400,
    );
  }

  if (meta.expiresAt && meta.expiresAt < new Date()) {
    throw new MultimodalResolutionError(
      `Media has expired (mediaId: ${source.mediaId})`,
      400,
    );
  }

  const buf = await resolveMediaBuffer(workspaceId, source.mediaId);
  if (!buf) {
    throw new MultimodalResolutionError(
      `Media bytes unavailable — storage may be inconsistent (mediaId: ${source.mediaId})`,
      502,
    );
  }

  return `data:${meta.mimeType};base64,${buf.toString("base64")}`;
}
