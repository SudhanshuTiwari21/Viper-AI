/**
 * Web auth: email/password (Argon2id), refresh tokens (hashed at rest), Google OAuth.
 * Does not log passwords or raw refresh tokens.
 */

import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import * as jose from "jose";
import {
  getPool,
  createUser,
  deleteUser,
  getUserByEmail,
  getUserById,
  getUserByExternalSubject,
  toPublicUser,
  insertRefreshToken,
  getRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  insertOAuthState,
  consumeOAuthState,
  insertOAuthExchangeCode,
  consumeOAuthExchangeCode,
  insertEmailVerificationToken,
  consumeEmailVerificationToken,
  markUserEmailVerified,
} from "@repo/database";
import type { UserRow } from "@repo/database";
import { isSmtpConfigured, sendVerificationEmail } from "../lib/mail.js";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_CODE_TTL_MS = 2 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function getJwtSecret(): Uint8Array {
  const raw = process.env["VIPER_JWT_SECRET"] ?? process.env["JWT_SECRET"];
  if (!raw || raw.length < 32) {
    throw new Error("VIPER_JWT_SECRET (or JWT_SECRET) must be set to a random string of at least 32 characters");
  }
  return new TextEncoder().encode(raw);
}

export function skipEmailVerification(): boolean {
  const v = process.env["VIPER_AUTH_SKIP_EMAIL_VERIFICATION"];
  return v === "1" || v?.toLowerCase() === "true";
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export async function signAccessToken(userId: string, email: string): Promise<string> {
  const secret = getJwtSecret();
  return new jose.SignJWT({ sub: userId, email, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret);
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueTokens(
  userId: string,
  email: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<AuthTokens> {
  const pool = getPool();
  const accessToken = await signAccessToken(userId, email);
  const refreshRaw = randomBytes(48).toString("base64url");
  const tokenHash = sha256Hex(refreshRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await insertRefreshToken(pool, {
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    user_agent: meta?.userAgent ?? null,
    ip_inferred: meta?.ip ?? null,
  });
  return { accessToken, refreshToken: refreshRaw, expiresIn: ACCESS_TTL_SEC };
}

function publicUserWithPlan(row: UserRow) {
  return {
    ...toPublicUser(row),
    plan: "Free" as const,
  };
}

export async function registerWithEmail(params: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<
  | { ok: true; user: ReturnType<typeof publicUserWithPlan>; verificationRequired: boolean }
  | { ok: false; code: "EMAIL_EXISTS" | "EMAIL_SEND_FAILED"; message: string }
> {
  const pool = getPool();
  const existing = await getUserByEmail(pool, params.email);
  if (existing) {
    return { ok: false, code: "EMAIL_EXISTS", message: "An account with this email already exists." };
  }
  const password_hash = await hashPassword(params.password);
  const verified = skipEmailVerification();
  const row = await createUser(pool, {
    email: params.email.trim().toLowerCase(),
    display_name: params.displayName?.trim() || null,
    auth_provider: "email",
    external_subject: null,
    password_hash,
    email_verified_at: verified ? new Date().toISOString() : null,
  });
  if (!verified) {
    const raw = randomBytes(32).toString("base64url");
    await insertEmailVerificationToken(pool, {
      user_id: row.id,
      token_hash: sha256Hex(raw),
      expires_at: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    });
    const base = process.env["VIPER_WEB_APP_URL"] ?? "http://localhost:3000";
    const verifyUrl = `${base.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(raw)}`;
    if (isSmtpConfigured()) {
      const sent = await sendVerificationEmail({ to: row.email, verifyUrl });
      if (!sent.ok) {
        await deleteUser(pool, row.id);
        return {
          ok: false,
          code: "EMAIL_SEND_FAILED",
          message:
            "We could not send the verification email. Check SMTP settings or try again in a few minutes.",
        };
      }
    } else if (process.env["VIPER_AUTH_LOG_VERIFY_TOKEN"] === "1") {
      console.info(`[auth] dev verification link: ${verifyUrl}`);
    }
  }
  return {
    ok: true,
    user: publicUserWithPlan(row),
    verificationRequired: !verified,
  };
}

export async function loginWithEmail(
  email: string,
  password: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<
  | { ok: true; tokens: AuthTokens; user: ReturnType<typeof publicUserWithPlan> }
  | { ok: false; code: string; message: string }
> {
  const pool = getPool();
  const row = await getUserByEmail(pool, email);
  if (!row || !row.password_hash) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password." };
  }
  const valid = await verifyPassword(row.password_hash, password);
  if (!valid) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password." };
  }
  if (!row.email_verified_at && !skipEmailVerification()) {
    return {
      ok: false,
      code: "EMAIL_NOT_VERIFIED",
      message: "Verify your email before signing in. Check your inbox for the confirmation link.",
    };
  }
  const tokens = await issueTokens(row.id, row.email, meta);
  return { ok: true, tokens, user: publicUserWithPlan(row) };
}

export async function refreshSession(
  refreshTokenRaw: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<
  | { ok: true; tokens: AuthTokens; user: ReturnType<typeof publicUserWithPlan> }
  | { ok: false; code: string; message: string }
> {
  const pool = getPool();
  const tokenHash = sha256Hex(refreshTokenRaw);
  const rt = await getRefreshTokenByHash(pool, tokenHash);
  if (!rt) {
    return { ok: false, code: "INVALID_REFRESH", message: "Session expired. Please sign in again." };
  }
  await revokeRefreshToken(pool, rt.id);
  const user = await getUserById(pool, rt.user_id);
  if (!user) {
    return { ok: false, code: "INVALID_REFRESH", message: "Session expired. Please sign in again." };
  }
  const tokens = await issueTokens(user.id, user.email, meta);
  return { ok: true, tokens, user: publicUserWithPlan(user) };
}

export async function logout(refreshTokenRaw: string): Promise<void> {
  const pool = getPool();
  const tokenHash = sha256Hex(refreshTokenRaw);
  const rt = await getRefreshTokenByHash(pool, tokenHash);
  if (rt) await revokeRefreshToken(pool, rt.id);
}

export async function logoutAll(userId: string): Promise<void> {
  const pool = getPool();
  await revokeAllRefreshTokensForUser(pool, userId);
}

/** Build Google authorize URL and persist hashed state. */
export async function startGoogleOAuth(): Promise<{ redirectUrl: string }> {
  const clientId = process.env["VIPER_GOOGLE_CLIENT_ID"];
  const apiPublic = process.env["VIPER_API_PUBLIC_URL"] ?? `http://localhost:${process.env["PORT"] || "4000"}`;
  if (!clientId) {
    throw new Error("VIPER_GOOGLE_CLIENT_ID is not configured");
  }
  const redirectUri = `${apiPublic.replace(/\/$/, "")}/auth/google/callback`;
  const state = randomBytes(24).toString("base64url");
  const pool = getPool();
  await insertOAuthState(pool, sha256Hex(state), new Date(Date.now() + OAUTH_STATE_TTL_MS));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return { redirectUrl };
}

export async function completeGoogleOAuth(
  code: string,
  state: string,
): Promise<
  | { ok: true; webRedirectUrl: string }
  | { ok: false; code: string; message: string }
> {
  const clientId = process.env["VIPER_GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["VIPER_GOOGLE_CLIENT_SECRET"];
  const apiPublic = process.env["VIPER_API_PUBLIC_URL"] ?? `http://localhost:${process.env["PORT"] || "4000"}`;
  const webAppUrl = process.env["VIPER_WEB_APP_URL"] ?? "http://localhost:3000";
  if (!clientId || !clientSecret) {
    return { ok: false, code: "OAUTH_NOT_CONFIGURED", message: "Google sign-in is not configured." };
  }
  const pool = getPool();
  const okState = await consumeOAuthState(pool, sha256Hex(state));
  if (!okState) {
    return { ok: false, code: "INVALID_STATE", message: "Invalid or expired OAuth state. Try again." };
  }
  const redirectUri = `${apiPublic.replace(/\/$/, "")}/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) {
    return { ok: false, code: "TOKEN_EXCHANGE_FAILED", message: "Could not complete Google sign-in." };
  }
  const tokensJson = (await tokenRes.json()) as { access_token?: string };
  const access = tokensJson.access_token;
  if (!access) {
    return { ok: false, code: "TOKEN_EXCHANGE_FAILED", message: "Could not complete Google sign-in." };
  }
  const uiRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!uiRes.ok) {
    return { ok: false, code: "PROFILE_FAILED", message: "Could not read Google profile." };
  }
  const profile = (await uiRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!profile.sub || !profile.email) {
    return { ok: false, code: "PROFILE_INCOMPLETE", message: "Google did not return a verified email." };
  }
  if (profile.email_verified === false) {
    return { ok: false, code: "EMAIL_UNVERIFIED", message: "Your Google email must be verified." };
  }
  const emailNorm = profile.email.trim().toLowerCase();
  let user = await getUserByExternalSubject(pool, "google", profile.sub);
  if (!user) {
    const byEmail = await getUserByEmail(pool, emailNorm);
    if (byEmail) {
      if (byEmail.auth_provider === "email" && byEmail.password_hash) {
        return {
          ok: false,
          code: "ACCOUNT_EXISTS",
          message: "This email is already registered with a password. Sign in with email instead.",
        };
      }
      if (byEmail.external_subject && byEmail.external_subject !== profile.sub) {
        return { ok: false, code: "ACCOUNT_CONFLICT", message: "Could not link this Google account." };
      }
    }
    user = await createUser(pool, {
      email: emailNorm,
      display_name: profile.name ?? null,
      auth_provider: "google",
      external_subject: profile.sub,
      password_hash: null,
      email_verified_at: new Date().toISOString(),
    });
  }
  const exchangeRaw = randomBytes(32).toString("base64url");
  await insertOAuthExchangeCode(pool, {
    code_hash: sha256Hex(exchangeRaw),
    user_id: user.id,
    expires_at: new Date(Date.now() + EXCHANGE_CODE_TTL_MS),
  });
  const webRedirectUrl = `${webAppUrl.replace(/\/$/, "")}/auth/callback?code=${encodeURIComponent(exchangeRaw)}`;
  return { ok: true, webRedirectUrl };
}

/**
 * Mint a one-time exchange code for the desktop IDE, using a valid web access JWT.
 * Same redemption path as Google OAuth (`POST /auth/oauth/exchange`).
 */
export async function createDesktopHandoffFromAccessToken(
  authorizationHeader: string,
): Promise<
  | { ok: true; code: string }
  | { ok: false; code: string; message: string }
> {
  const raw = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  if (!raw) {
    return { ok: false, code: "UNAUTHORIZED", message: "Authorization required." };
  }
  let userId: string;
  try {
    const secret = getJwtSecret();
    const { payload } = await jose.jwtVerify(raw, secret, { algorithms: ["HS256"] });
    if (payload.typ !== "access" || typeof payload.sub !== "string") {
      return { ok: false, code: "INVALID_TOKEN", message: "Invalid session." };
    }
    userId = payload.sub;
  } catch {
    return { ok: false, code: "INVALID_TOKEN", message: "Invalid or expired session." };
  }
  const pool = getPool();
  const user = await getUserById(pool, userId);
  if (!user) {
    return { ok: false, code: "INVALID_TOKEN", message: "User not found." };
  }
  const codeRaw = randomBytes(32).toString("base64url");
  await insertOAuthExchangeCode(pool, {
    code_hash: sha256Hex(codeRaw),
    user_id: user.id,
    expires_at: new Date(Date.now() + EXCHANGE_CODE_TTL_MS),
  });
  return { ok: true, code: codeRaw };
}

export async function exchangeOAuthCode(
  code: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<
  | { ok: true; tokens: AuthTokens; user: ReturnType<typeof publicUserWithPlan> }
  | { ok: false; code: string; message: string }
> {
  const pool = getPool();
  const userId = await consumeOAuthExchangeCode(pool, sha256Hex(code));
  if (!userId) {
    return { ok: false, code: "INVALID_CODE", message: "Invalid or expired sign-in code." };
  }
  const user = await getUserById(pool, userId);
  if (!user) {
    return { ok: false, code: "INVALID_CODE", message: "Invalid or expired sign-in code." };
  }
  const tokens = await issueTokens(user.id, user.email, meta);
  return { ok: true, tokens, user: publicUserWithPlan(user) };
}

export async function verifyEmailToken(rawToken: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const pool = getPool();
  const userId = await consumeEmailVerificationToken(pool, sha256Hex(rawToken));
  if (!userId) {
    return { ok: false, message: "Invalid or expired verification link." };
  }
  await markUserEmailVerified(pool, userId);
  return { ok: true };
}
