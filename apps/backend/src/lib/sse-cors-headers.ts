import type { FastifyRequest } from "fastify";

/**
 * Hijacked/raw SSE responses bypass @fastify/cors — browsers still require these on the actual response.
 * Mirrors `origin: true` from server.ts: reflect `Origin` when present, else `*`.
 */
export function sseCorsHeaders(request: FastifyRequest): Record<string, string> {
  const raw = request.headers?.origin;
  const origin = Array.isArray(raw) ? raw[0] : raw;
  if (typeof origin === "string" && origin.length > 0) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    };
  }
  return { "Access-Control-Allow-Origin": "*" };
}
