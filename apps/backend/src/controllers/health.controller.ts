import type { FastifyReply, FastifyRequest } from "fastify";

export async function getHealth(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.send({ status: "ok" });
}
