import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

export interface DatabaseConfig extends PoolConfig {
  connectionString?: string;
}

/**
 * Get or create the PostgreSQL connection pool.
 * Call initDatabase(config) once at app startup; then use getPool() in repositories.
 */
export function initDatabase(config: DatabaseConfig): Pool {
  if (pool) return pool;
  pool = new Pool(config);
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    const conn = process.env.DATABASE_URL ?? "postgresql://localhost:5432/viper";
    pool = new Pool({ connectionString: conn });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
