import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { debugRoutes } from "./debug.routes.js";

const WORKFLOW_POLICY_KEYS = [
  "debugAssistant",
  "debugWorkflow",
  "enableStreamContextPrimer",
  "streamAnalysisWarmupMs",
  "requireAnalysisForEdits",
  "minFilesReadBeforeEdit",
  "minDiscoveryToolsBeforeEdit",
  "openaiModel",
  "disableLlmCache",
  "directLlmCacheTtl",
  "chatHistoryLimit",
  "runAnalysisWaitMs",
] as const;

describe("/debug/workflow-policy", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(debugRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when VIPER_EXPOSE_WORKFLOW_DEBUG is not 1", async () => {
    const prev = process.env.VIPER_EXPOSE_WORKFLOW_DEBUG;
    delete process.env.VIPER_EXPOSE_WORKFLOW_DEBUG;
    try {
      const res = await app.inject({ method: "GET", url: "/debug/workflow-policy" });
      expect(res.statusCode).toBe(404);
    } finally {
      if (prev === undefined) delete process.env.VIPER_EXPOSE_WORKFLOW_DEBUG;
      else process.env.VIPER_EXPOSE_WORKFLOW_DEBUG = prev;
    }
  });

  it("returns 200 + application/json with policy + meta when gate is on", async () => {
    const prev = process.env.VIPER_EXPOSE_WORKFLOW_DEBUG;
    process.env.VIPER_EXPOSE_WORKFLOW_DEBUG = "1";
    try {
      const res = await app.inject({ method: "GET", url: "/debug/workflow-policy" });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/json/);

      const body = JSON.parse(res.body) as Record<string, unknown>;
      for (const k of WORKFLOW_POLICY_KEYS) {
        expect(body).toHaveProperty(k);
      }
      expect(body).toHaveProperty("meta");
      const meta = body.meta as Record<string, unknown>;
      expect(typeof meta.ts).toBe("string");
      expect(meta).toHaveProperty("nodeEnv");
      // Forward-compat optional fields (may be omitted when undefined in JSON)
      expect(
        body.modeDefault === undefined ||
          body.modeDefault === null ||
          typeof body.modeDefault === "string",
      ).toBe(true);
      expect(
        body.modelRouteDefault === undefined ||
          body.modelRouteDefault === null ||
          typeof body.modelRouteDefault === "string",
      ).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.VIPER_EXPOSE_WORKFLOW_DEBUG;
      else process.env.VIPER_EXPOSE_WORKFLOW_DEBUG = prev;
    }
  });
});
