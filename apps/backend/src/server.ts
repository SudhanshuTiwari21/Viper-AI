import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { runMigrations } from "@repo/database";
import { healthRoutes } from "./routes/health.routes.js";
import { analysisRoutes } from "./routes/analysis.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";
import { contextRoutes } from "./routes/context.routes.js";
import { patchRoutes } from "./routes/patch.routes.js";
import { debugRoutes } from "./routes/debug.routes.js";
import { feedbackRoutes } from "./routes/feedback.routes.js";
import { mediaRoutes } from "./routes/media.routes.js";
import { billingRoutes } from "./routes/billing.routes.js";
import { usageRoutes } from "./routes/usage.routes.js";
import { editorRoutes } from "./routes/editor.routes.js";
import { gitRoutes } from "./routes/git.routes.js";
import { testingRoutes } from "./routes/testing.routes.js";
import { opsRoutes } from "./routes/ops.routes.js";

const app = Fastify({
  logger: true,
  /** Long chat/analysis streams; Node/Fastify defaults can close idle sockets too aggressively for SSE. */
  requestTimeout: 0,
  connectionTimeout: 0,
});

if (process.env.DATABASE_URL) {
  try {
    await runMigrations();
  } catch (err) {
    app.log.error(err, "Database migrations failed");
    process.exit(1);
  }
}

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await app.register(healthRoutes);
await app.register(debugRoutes);
await app.register(analysisRoutes);
await app.register(chatRoutes);
await app.register(contextRoutes);
await app.register(patchRoutes);
await app.register(feedbackRoutes);
await app.register(mediaRoutes);
await app.register(billingRoutes);
await app.register(usageRoutes);
await app.register(editorRoutes);
await app.register(gitRoutes);
await app.register(testingRoutes);
await app.register(opsRoutes);

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`Backend server listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
