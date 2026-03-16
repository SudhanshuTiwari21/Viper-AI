import Fastify from "fastify";
import { healthRoutes } from "./routes/health.routes.js";
import { analysisRoutes } from "./routes/analysis.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";
import { contextRoutes } from "./routes/context.routes.js";

const app = Fastify({ logger: true });

await app.register(healthRoutes);
await app.register(analysisRoutes);
await app.register(chatRoutes);
await app.register(contextRoutes);

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`Backend server listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
