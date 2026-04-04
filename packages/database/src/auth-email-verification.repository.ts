import type { Pool } from "pg";

export async function insertEmailVerificationToken(
  pool: Pool,
  params: { user_id: string; token_hash: string; expires_at: Date },
): Promise<void> {
  await pool.query(`DELETE FROM auth_email_verification_tokens WHERE user_id = $1`, [params.user_id]);
  await pool.query(
    `INSERT INTO auth_email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [params.user_id, params.token_hash, params.expires_at.toISOString()],
  );
}

export async function consumeEmailVerificationToken(
  pool: Pool,
  token_hash: string,
): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    `DELETE FROM auth_email_verification_tokens
     WHERE token_hash = $1 AND expires_at > now()
     RETURNING user_id`,
    [token_hash],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function markUserEmailVerified(pool: Pool, user_id: string): Promise<void> {
  await pool.query(`UPDATE users SET email_verified_at = now(), updated_at = now() WHERE id = $1`, [
    user_id,
  ]);
}
