import type { FastifyReply, FastifyRequest } from "fastify";
import {
  applyPreviewedPatch,
  undoImplementation,
  verifyPatchApplyOrThrow,
} from "@repo/implementation-agent";
import { verifyWorkspaceExists } from "../services/workspace.service.js";
import type {
  PatchApplyRequest,
  PatchRollbackRequest,
} from "../validators/request.schemas.js";

export async function postPatchApply(
  request: FastifyRequest<{ Body: PatchApplyRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { workspacePath, patch, previewId, patchHash } = request.body;

    const exists = await verifyWorkspaceExists(workspacePath);
    if (!exists) {
      await reply.status(400).send({ error: "Workspace path does not exist" });
      return;
    }

    try {
      verifyPatchApplyOrThrow(patch, previewId, patchHash, workspacePath);
    } catch (err) {
      await reply.status(409).send({
        error: err instanceof Error ? err.message : "Patch preview verification failed",
      });
      return;
    }

    const result = applyPreviewedPatch(patch, workspacePath);

    await reply.send({
      success: result.success,
      rollbackId: result.rollbackId,
      logs: result.logs,
    });
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Patch apply failed",
    });
  }
}

export async function postPatchReject(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.send({ success: true });
}

export async function postPatchRollback(
  request: FastifyRequest<{ Body: PatchRollbackRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { workspacePath, rollbackId } = request.body;

    const exists = await verifyWorkspaceExists(workspacePath);
    if (!exists) {
      await reply.status(400).send({ error: "Workspace path does not exist" });
      return;
    }

    const result = undoImplementation(workspacePath, rollbackId);

    await reply.send({
      success: result.success,
      logs: result.logs,
    });
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Patch rollback failed",
    });
  }
}
