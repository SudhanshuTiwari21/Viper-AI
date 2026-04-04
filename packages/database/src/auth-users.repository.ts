/**
 * F.29 — Repository for the `users` table.
 *
 * Provides typed CRUD operations for user records. Email lookups are
 * case-insensitive (normalised via lower(trim(email)) in the unique index).
 *
 * No authentication logic lives here — F.30 will add JWT/session wiring
 * and the auth_provider / external_subject fields.
 */
import type { Pool } from "pg";

export type AuthProvider = string; // e.g. "github", "google" — defined by F.30

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  auth_provider: string | null;
  external_subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserParams {
  email: string;
  display_name?: string | null;
  auth_provider?: string | null;
  external_subject?: string | null;
}

/**
 * Insert a new user and return the created row.
 * Throws a Postgres unique-violation error (code 23505) if the
 * normalised email already exists.
 */
export async function createUser(pool: Pool, params: CreateUserParams): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, display_name, auth_provider, external_subject)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      params.email,
      params.display_name ?? null,
      params.auth_provider ?? null,
      params.external_subject ?? null,
    ],
  );
  return result.rows[0]!;
}

/** Look up a user by exact (but case-insensitive) email. Returns null if not found. */
export async function getUserByEmail(pool: Pool, email: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

/** Look up a user by UUID. Returns null if not found. */
export async function getUserById(pool: Pool, id: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

/** Look up a user by auth provider + external subject (for OAuth token exchange in F.30). */
export async function getUserByExternalSubject(
  pool: Pool,
  auth_provider: string,
  external_subject: string,
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users
     WHERE auth_provider = $1 AND external_subject = $2
     LIMIT 1`,
    [auth_provider, external_subject],
  );
  return result.rows[0] ?? null;
}

export interface UpdateUserParams {
  display_name?: string | null;
  auth_provider?: string | null;
  external_subject?: string | null;
}

/** Update mutable user fields. Returns the updated row, or null if id not found. */
export async function updateUser(
  pool: Pool,
  id: string,
  params: UpdateUserParams,
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `UPDATE users
     SET display_name     = COALESCE($2, display_name),
         auth_provider    = COALESCE($3, auth_provider),
         external_subject = COALESCE($4, external_subject),
         updated_at       = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      params.display_name ?? null,
      params.auth_provider ?? null,
      params.external_subject ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

/**
 * Delete a user by UUID. Membership rows cascade automatically.
 * Returns true if a row was deleted.
 */
export async function deleteUser(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM users WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
