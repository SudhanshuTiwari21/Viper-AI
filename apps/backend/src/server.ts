import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { runMigrations } from "@repo/database";
import { healthRoutes } from "./routes/health.routes.js";
import { analysisRoutes } from "./routes/analysis.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";
import { contextRoutes } from "./routes/context.routes.js";

const app = Fastify({ logger: true });

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
