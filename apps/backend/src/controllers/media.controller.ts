/**
 * E.23 — Media upload and download controllers.
 *
 * Upload path: POST /media/upload
 *   Primary:   JSON body { workspace_id, mimeType, dataBase64 } — works with curl, easy to test.
 *   Secondary: multipart/form-data with fields `workspace_id` + file field `file`
 *              (requires @fastify/multipart registered on the server; see server.ts).
 *
 * Download path: GET /media/:mediaId?workspace_id=<id>
 *   Returns raw bytes + correct Content-Type, or 404/410.
 *
 * Trust model: same local-trust / same-origin as /chat/feedback — workspace_id is client-supplied.
 * Auth integration (Step Group F) will tighten this.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { saveMedia, resolveMediaBuffer, getMediaMeta, MediaValidationError } from "../lib/media-store.js";
import { workflowLog } from "../services/assistant.service.js";
import { INLINE_IMAGE_MAX_BYTES, INLINE_IMAGE_MIME_ALLOWLIST } from "../validators/request.schemas.js";

// ---------------------------------------------------------------------------
// Upload: JSON path
// ---------------------------------------------------------------------------

export interface MediaUploadJsonBody {
  workspace_id: string;
  mimeType: string;
  dataBase64: string;
}

export async function postMediaUploadJson(
  request: FastifyRequest<{ Body: MediaUploadJsonBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspace_id, mimeType, dataBase64 } = request.body;

  let data: Buffer;
  try {
    data = Buffer.from(dataBase64, "base64");
  } catch {
    await reply.status(400).send({ error: "dataBase64 is not valid base64" });
    return;
  }

  await _handleUpload(request, reply, { workspace_id, mimeType, data });
}

// ---------------------------------------------------------------------------
// Upload: multipart path (requires @fastify/multipart on server)
// ---------------------------------------------------------------------------

export async function postMediaUploadMultipart(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // @fastify/multipart adds `request.file()` at runtime; if the plugin is not registered
  // the method will be undefined — guard defensively.
  const fileGetter = (request as unknown as { file?: () => Promise<unknown> }).file;
  if (typeof fileGetter !== "function") {
    await reply.status(501).send({ error: "Multipart upload not configured on this server" });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const part = (await (request as any).file()) as {
    mimetype: string;
    toBuffer: () => Promise<Buffer>;
    fields: Record<string, { value: string } | undefined>;
  } | null;

  if (!part) {
    await reply.status(400).send({ error: "No file part found in multipart request" });
    return;
  }

  const wsField = part.fields["workspace_id"];
  const workspace_id = wsField?.value?.trim();
  if (!workspace_id) {
    await reply.status(400).send({ error: "workspace_id is required in multipart fields" });
    return;
  }

  const mimeType = part.mimetype;
  const data = await part.toBuffer();

  await _handleUpload(request, reply, { workspace_id, mimeType, data });
}

// ---------------------------------------------------------------------------
// Shared upload logic
// ---------------------------------------------------------------------------

async function _handleUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  params: { workspace_id: string; mimeType: string; data: Buffer },
): Promise<void> {
  const { workspace_id, mimeType, data } = params;

  if (!workspace_id?.trim()) {
    await reply.status(400).send({ error: "workspace_id is required" });
    return;
  }

  const allowed: readonly string[] = INLINE_IMAGE_MIME_ALLOWLIST;
  if (!allowed.includes(mimeType)) {
    await reply.status(400).send({
      error: `mimeType "${mimeType}" is not allowed; accepted: ${INLINE_IMAGE_MIME_ALLOWLIST.join(", ")}`,
    });
    return;
  }

  if (data.length > INLINE_IMAGE_MAX_BYTES) {
    await reply.status(413).send({
      error: `File size ${data.length} bytes exceeds limit of ${INLINE_IMAGE_MAX_BYTES} bytes (~6 MiB)`,
    });
    return;
  }

  try {
    const media = await saveMedia({ workspaceId: workspace_id, mimeType, data });

    const logIdentity = {
      request_id: randomUUID(),
      workspace_id,
      conversation_id: null,
    };
    workflowLog("multimodal:media:uploaded", logIdentity, {
      media_id: media.mediaId,
      mime_type: media.mimeType,
      byte_size: media.byteSize,
    });

    await reply.status(200).send({
      mediaId: media.mediaId,
      mimeType: media.mimeType,
      byteSize: media.byteSize,
      sha256: media.sha256,
    });
  } catch (err) {
    if (err instanceof MediaValidationError) {
      await reply.status(400).send({ error: err.message });
      return;
    }
    request.log.error({ err }, "Media upload failed");
    await reply.status(500).send({ error: "Upload failed" });
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function getMedia(
  request: FastifyRequest<{ Params: { mediaId: string }; Querystring: { workspace_id?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { mediaId } = request.params;
  // Accept workspace_id from query param or header (flexible for E.25 desktop)
  const workspace_id =
    (request.query.workspace_id?.trim()) ||
    (request.headers["x-workspace-id"] as string | undefined)?.trim();

  if (!workspace_id) {
    await reply.status(400).send({ error: "workspace_id is required (query param or x-workspace-id header)" });
    return;
  }

  try {
    const meta = await getMediaMeta(workspace_id, mediaId);
    if (!meta) {
      await reply.status(404).send({ error: "Media not found" });
      return;
    }

    // TTL check — return 410 Gone if expired
    if (meta.expiresAt && meta.expiresAt < new Date()) {
      await reply.status(410).send({ error: "Media has expired" });
      return;
    }

    const buf = await resolveMediaBuffer(workspace_id, mediaId);
    if (!buf) {
      // bytes missing but metadata exists (storage inconsistency)
      await reply.status(404).send({ error: "Media bytes not found" });
      return;
    }

    const logIdentity = {
      request_id: randomUUID(),
      workspace_id,
      conversation_id: null,
    };
    workflowLog("multimodal:media:resolved", logIdentity, {
      media_id: mediaId,
      mime_type: meta.mimeType,
      byte_size: meta.byteSize,
    });

    await reply
      .header("Content-Type", meta.mimeType)
      .header("Content-Length", String(buf.length))
      .header("Cache-Control", "private, max-age=3600")
      .send(buf);
  } catch (err) {
    request.log.error({ err, mediaId }, "Media download failed");
    await reply.status(500).send({ error: "Download failed" });
  }
}
