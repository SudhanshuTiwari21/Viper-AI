/**
 * Public auth API for the marketing web app (email + Google OAuth).
 */

import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  oauthExchangeBodySchema,
} from "../validators/auth.schemas.js";
import * as auth from "../services/auth.service.js";

const registerBuckets = new Map<string, { count: number; resetAt: number }>();
const loginBuckets = new Map<string, { count: number; resetAt: number }>();
const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_MAX = 25;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 30;

function clientMeta(req: FastifyRequest): { userAgent: string | null; ip: string | null } {
  const xf = req.headers["x-forwarded-for"];
  const ip =
    typeof xf === "string"
      ? xf.split(",")[0]?.trim() ?? null
      : Array.isArray(xf)
        ? xf[0] ?? null
        : req.socket.remoteAddress ?? null;
  const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  return { userAgent: ua, ip };
}

function rateLimit(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const b = map.get(key);
  if (!b || now > b.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (req, reply) => {
    const ip = clientMeta(req).ip ?? "unknown";
    if (!rateLimit(registerBuckets, `reg:${ip}`, REGISTER_MAX, REGISTER_WINDOW_MS)) {
      return reply.status(429).send({ error: "Too many requests. Try again later." });
    }
    const parsed = registerBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    try {
      const result = await auth.registerWithEmail({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
      });
      if (!result.ok) {
        const status = result.code === "EMAIL_SEND_FAILED" ? 503 : 409;
        return reply.status(status).send({ error: result.message, code: result.code });
      }
      if (result.verificationRequired) {
        return reply.status(201).send({
          user: result.user,
          verificationRequired: true,
          message: "Check your email to verify your account before signing in.",
        });
      }
      const meta = clientMeta(req);
      const tokens = await auth.issueTokens(result.user.id, result.user.email, meta);
      return reply.status(201).send({ user: result.user, ...tokens });
    } catch (e) {
      req.log.error(e);
      return reply.status(500).send({ error: "Registration failed." });
    }
  });

  app.post("/login", async (req, reply) => {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const ip = clientMeta(req).ip ?? "unknown";
    const key = `login:${ip}:${parsed.data.email.toLowerCase()}`;
    if (!rateLimit(loginBuckets, key, LOGIN_MAX, LOGIN_WINDOW_MS)) {
      return reply.status(429).send({ error: "Too many sign-in attempts. Try again later." });
    }
    try {
      const meta = clientMeta(req);
      const result = await auth.loginWithEmail(parsed.data.email, parsed.data.password, meta);
      if (!result.ok) {
        const status =
          result.code === "EMAIL_NOT_VERIFIED" ? 403 : result.code === "INVALID_CREDENTIALS" ? 401 : 400;
        return reply.status(status).send({ error: result.message, code: result.code });
      }
      return reply.send({ user: result.user, ...result.tokens });
    } catch (e) {
      req.log.error(e);
      return reply.status(500).send({ error: "Sign-in failed." });
    }
  });

  app.post("/refresh", async (req, reply) => {
    const parsed = refreshBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    try {
      const meta = clientMeta(req);
      const result = await auth.refreshSession(parsed.data.refreshToken, meta);
      if (!result.ok) {
        return reply.status(401).send({ error: result.message, code: result.code });
      }
      return reply.send({ user: result.user, ...result.tokens });
    } catch (e) {
      req.log.error(e);
      return reply.status(500).send({ error: "Could not refresh session." });
    }
  });

  app.post("/logout", async (req, reply) => {
    const parsed = refreshBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    await auth.logout(parsed.data.refreshToken);
    return reply.send({ ok: true });
  });

  app.post("/desktop/handoff", async (req, reply) => {
    const authz = req.headers.authorization;
    if (typeof authz !== "string" || !authz.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Authorization required." });
    }
    try {
      const result = await auth.createDesktopHandoffFromAccessToken(authz);
      if (!result.ok) {
        return reply.status(401).send({ error: result.message, code: result.code });
      }
      return reply.send({ code: result.code });
    } catch (e) {
      req.log.error(e);
      return reply.status(500).send({ error: "Could not create desktop session." });
    }
  });

  app.post("/oauth/exchange", async (req, reply) => {
    const parsed = oauthExchangeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    try {
      const meta = clientMeta(req);
      const result = await auth.exchangeOAuthCode(parsed.data.code, meta);
      if (!result.ok) {
        return reply.status(401).send({ error: result.message, code: result.code });
      }
      return reply.send({ user: result.user, ...result.tokens });
    } catch (e) {
      req.log.error(e);
      return reply.status(500).send({ error: "Could not complete sign-in." });
    }
  });

  app.get("/verify-email", async (req, reply) => {
    const token = typeof (req.query as { token?: string }).token === "string" ? (req.query as { token: string }).token : "";
    if (!token) {
      return reply.status(400).send({ error: "Missing token." });
    }
    const result = await auth.verifyEmailToken(token);
    if (!result.ok) {
      return reply.status(400).send({ error: result.message });
    }
    return reply.send({ ok: true, message: "Email verified. You can sign in." });
  });

  app.get("/google/start", async (req, reply) => {
    try {
      const { redirectUrl } = await auth.startGoogleOAuth();
      return reply.redirect(redirectUrl, 302);
    } catch (e) {
      req.log.error(e);
      return reply.status(503).send({ error: "Google sign-in is not available." });
    }
  });

  app.get("/google/callback", async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    if (q.error) {
      const web = process.env["VIPER_WEB_APP_URL"] ?? "http://localhost:3000";
      return reply.redirect(`${web.replace(/\/$/, "")}/login?error=oauth_denied`, 302);
    }
    const code = typeof q.code === "string" ? q.code : "";
    const state = typeof q.state === "string" ? q.state : "";
    if (!code || !state) {
      const web = process.env["VIPER_WEB_APP_URL"] ?? "http://localhost:3000";
      return reply.redirect(`${web.replace(/\/$/, "")}/login?error=oauth_invalid`, 302);
    }
    const result = await auth.completeGoogleOAuth(code, state);
    if (!result.ok) {
      const web = process.env["VIPER_WEB_APP_URL"] ?? "http://localhost:3000";
      const msg = encodeURIComponent(result.message);
      return reply.redirect(`${web.replace(/\/$/, "")}/login?error=${msg}`, 302);
    }
    return reply.redirect(result.webRedirectUrl, 302);
  });
};
