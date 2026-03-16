import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./database.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = await readdir(migrationsDir);
  const sqlFiles = files
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of sqlFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = await readFile(filePath, "utf-8");
    await pool.query(sql);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log("[Viper] Database migrations completed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Viper] Migrations failed:", err);
      process.exit(1);
    });
}
