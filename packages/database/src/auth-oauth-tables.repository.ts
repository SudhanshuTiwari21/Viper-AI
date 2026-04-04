import type { Pool } from "pg";

export async function insertOAuthState(pool: Pool, state_hash: string, expires_at: Date): Promise<void> {
  await pool.query(
    `INSERT INTO auth_oauth_states (state_hash, expires_at) VALUES ($1, $2)
     ON CONFLICT (state_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [state_hash, expires_at.toISOString()],
  );
}

export async function consumeOAuthState(pool: Pool, state_hash: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM auth_oauth_states WHERE state_hash = $1 AND expires_at > now()`, [
    state_hash,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function insertOAuthExchangeCode(
  pool: Pool,
  params: { code_hash: string; user_id: string; expires_at: Date },
): Promise<void> {
  await pool.query(
    `INSERT INTO auth_oauth_exchange_codes (code_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
    [params.code_hash, params.user_id, params.expires_at.toISOString()],
  );
}

/** Marks consumed and returns user_id if valid and unused. */
export async function consumeOAuthExchangeCode(
  pool: Pool,
  code_hash: string,
): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    `UPDATE auth_oauth_exchange_codes
     SET consumed_at = now()
     WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [code_hash],
  );
  return result.rows[0]?.user_id ?? null;
}
