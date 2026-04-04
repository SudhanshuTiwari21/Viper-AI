import type { FastifyInstance } from "fastify";
import { getWorkflowPolicy } from "../controllers/debug-workflow.controller.js";

export async function debugRoutes(app: FastifyInstance): Promise<void> {
  app.get("/debug/workflow-policy", getWorkflowPolicy);
}
