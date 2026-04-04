import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  postPatchApply,
  postPatchReject,
  postPatchRollback,
} from "../controllers/patch.controller.js";
import {
  PatchApplySchema,
  PatchRollbackSchema,
} from "../validators/request.schemas.js";

export async function patchRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>("/patch/apply", {
    handler: async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      const parsed = PatchApplySchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return postPatchApply(
        { ...request, body: parsed.data } as Parameters<typeof postPatchApply>[0],
        reply,
      );
    },
  });

  app.post("/patch/reject", {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      return postPatchReject(request, reply);
    },
  });

  app.post<{ Body: unknown }>("/patch/rollback", {
    handler: async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      const parsed = PatchRollbackSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return postPatchRollback(
        { ...request, body: parsed.data } as Parameters<typeof postPatchRollback>[0],
        reply,
      );
    },
  });
}
