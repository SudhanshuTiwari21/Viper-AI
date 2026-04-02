/**
 * E.23 — Media upload and download routes.
 *
 * POST /media/upload          — JSON body upload (primary, works from curl)
 * POST /media/upload/multipart — multipart/form-data upload (requires @fastify/multipart)
 * GET  /media/:mediaId        — download bytes (workspace_id query param or x-workspace-id header)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  postMediaUploadJson,
  postMediaUploadMultipart,
  getMedia,
  type MediaUploadJsonBody,
} from "../controllers/media.controller.js";
import { z } from "zod";
import { INLINE_IMAGE_MIME_ALLOWLIST } from "../validators/request.schemas.js";

const MediaUploadJsonSchema = z.object({
  workspace_id: z.string().min(1),
  mimeType: z.enum(INLINE_IMAGE_MIME_ALLOWLIST),
  dataBase64: z.string().min(1),
});

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // ------------------------------------------------------------------
  // POST /media/upload — JSON base64 path
  // ------------------------------------------------------------------
  app.post<{ Body: unknown }>("/media/upload", {
    schema: {
      body: {
        type: "object",
        required: ["workspace_id", "mimeType", "dataBase64"],
        properties: {
          workspace_id: { type: "string" },
          mimeType: { type: "string", enum: [...INLINE_IMAGE_MIME_ALLOWLIST] },
          dataBase64: { type: "string" },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const parsed = MediaUploadJsonSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return postMediaUploadJson(
        { ...request, body: parsed.data } as Parameters<typeof postMediaUploadJson>[0],
        reply,
      );
    },
  });

  // ------------------------------------------------------------------
  // POST /media/upload/multipart — multipart/form-data path
  //
  // Requires @fastify/multipart registered on the server instance before
  // these routes are loaded. The controller degrades gracefully if the
  // plugin is absent (returns 501).
  // ------------------------------------------------------------------
  app.post("/media/upload/multipart", {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      return postMediaUploadMultipart(request, reply);
    },
  });

  // ------------------------------------------------------------------
  // GET /media/:mediaId — download raw bytes
  // ------------------------------------------------------------------
  app.get<{ Params: { mediaId: string }; Querystring: { workspace_id?: string } }>(
    "/media/:mediaId",
    {
      schema: {
        params: {
          type: "object",
          required: ["mediaId"],
          properties: { mediaId: { type: "string" } },
        },
        querystring: {
          type: "object",
          properties: { workspace_id: { type: "string" } },
        },
      },
      handler: getMedia,
    },
  );
}
