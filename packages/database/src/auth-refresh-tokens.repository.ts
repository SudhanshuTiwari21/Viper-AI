import type { Pool } from "pg";

export interface AuthRefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip_inferred: string | null;
}

export async function insertRefreshToken(
  pool: Pool,
  params: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
    user_agent?: string | null;
    ip_inferred?: string | null;
  },
): Promise<AuthRefreshTokenRow> {
  const result = await pool.query<AuthRefreshTokenRow>(
    `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_inferred)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.user_id,
      params.token_hash,
      params.expires_at.toISOString(),
      params.user_agent ?? null,
      params.ip_inferred ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function getRefreshTokenByHash(
  pool: Pool,
  token_hash: string,
): Promise<AuthRefreshTokenRow | null> {
  const result = await pool.query<AuthRefreshTokenRow>(
    `SELECT * FROM auth_refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
     LIMIT 1`,
    [token_hash],
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE auth_refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function revokeAllRefreshTokensForUser(pool: Pool, user_id: string): Promise<void> {
  await pool.query(
    `UPDATE auth_refresh_tokens SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [user_id],
  );
}
