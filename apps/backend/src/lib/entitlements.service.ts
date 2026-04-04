/**
 * F.30 — Entitlement service.
 *
 * Resolves per-workspace capability plans and merges them with the D.20 env
 * tier caps to produce a single `ResolvedEntitlements` snapshot per request.
 *
 * Auth scheme (F.30 stub):
 *   Primary: Authorization: Bearer <token>
 *   Dev override: VIPER_DEV_BEARER_TOKEN + VIPER_DEV_USER_EMAIL
 *
 * Enforcement:
 *   Controlled by VIPER_ENTITLEMENTS_ENFORCE=1 (default 0 = off).
 *   When off, resolveWorkspaceContext() returns null and all assert* helpers
 *   are no-ops → existing behavior is byte-for-byte unchanged.
 *
 * Composition rule (D.20 ∩ DB):
 *   effective_modes  = DB.allowed_modes  ?? ALL_MODES  ∩ always-allowed-by-env (env has no mode gate today)
 *   effective_tiers  = intersection(DB.allowed_model_tiers ?? ALL_TIERS, D.20 entitledModelTiers)
 *   When no DB row exists for the workspace, treat as "allow-all" (safe default).
 *
 * Error codes:
 *   401  — no/invalid bearer token (when enforcement is on)
 *   403  — authenticated but mode/tier not permitted for this workspace
 *   404  — workspace not found in DB (only when enforcement is on + strict mode)
 */

import { createHash } from "node:crypto";
import {
  getPool,
} from "@repo/database";
import {
  getWorkspaceByPathKey,
  upsertWorkspaceByPathKey,
} from "@repo/database";
import {
  getWorkspaceEntitlements,
} from "@repo/database";
import {
  getMembership,
} from "@repo/database";
import {
  getUserByEmail,
  getUserById,
} from "@repo/database";
import type { WorkspaceEntitlementRow, WorkspaceRow } from "@repo/database";
import type { ChatMode, ModelTierSelection } from "../validators/request.schemas.js";
import type { WorkflowRuntimeConfig } from "../config/workflow-flags.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_MODES: ChatMode[] = ["ask", "plan", "debug", "agent"];
const ALL_TIERS: ModelTierSelection[] = ["auto", "premium"];

// ---------------------------------------------------------------------------
// Path key — must match deriveWorkspaceId in request-identity.ts exactly
// ---------------------------------------------------------------------------

/**
 * Produce the 16-hex path_key from a workspace filesystem path.
 * This is the canonical bridge between client-supplied workspacePath and
 * the workspaces.path_key column.
 *
 * Algorithm mirrors deriveWorkspaceId in apps/backend/src/types/request-identity.ts:
 *   normalize (forward slashes, no trailing slash, lowercase on darwin/win32)
 *   SHA-256 → first 16 hex chars
 */
export function resolvePathKey(workspacePath: string): string {
  let p = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (process.platform === "win32" || process.platform === "darwin") {
    p = p.toLowerCase();
  }
  if (!p) return "0".repeat(16);
  return createHash("sha256").update(p).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedEntitlements {
  /** UUID of the resolved workspace row. */
  workspaceId: string;
  /** The path_key that was used for lookup. */
  pathKey: string;
  /** Effective allowed modes after DB ∩ env. */
  allowedModes: Set<ChatMode>;
  /** Effective allowed model tiers after DB ∩ D.20 env caps. */
  allowedModelTiers: Set<ModelTierSelection>;
  /** Raw flags JSONB from the DB row (or empty object when no row). */
  flags: Record<string, unknown>;
  /** The resolved user id if a bearer token was provided and resolved. */
  userId: string | null;
}

/** Typed error thrown by assert* helpers — maps to an HTTP status. */
export class EntitlementError extends Error {
  constructor(
    message: string,
    readonly statusCode: 401 | 403 | 404,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

export function isEntitlementsEnforced(): boolean {
  const v = process.env["VIPER_ENTITLEMENTS_ENFORCE"];
  return v === "1" || v?.toLowerCase() === "true";
}

/** Dev-mode: resolve bearer token from env; returns user email or null. */
function resolveDevToken(token: string): string | null {
  const devToken = process.env["VIPER_DEV_BEARER_TOKEN"];
  if (!devToken || devToken !== token) return null;
  return process.env["VIPER_DEV_USER_EMAIL"] ?? null;
}

/** Extract Bearer token from Authorization header. Returns null if absent/malformed. */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Core resolver
// ---------------------------------------------------------------------------

/**
 * Resolve workspace entitlements for an incoming request.
 *
 * @param workspacePath  Path from the request body (same as today).
 * @param authHeader     Value of the Authorization header (may be undefined).
 * @param config         Workflow runtime config (supplies D.20 tier caps).
 * @returns              ResolvedEntitlements snapshot, or null when enforcement is off.
 *
 * When enforcement is off the function returns null quickly (no DB calls).
 * Callers must check `if (!resolved) return;` before asserting.
 */
export async function resolveWorkspaceContext(
  workspacePath: string,
  authHeader: string | undefined,
  config: WorkflowRuntimeConfig,
): Promise<ResolvedEntitlements | null> {
  if (!isEntitlementsEnforced()) return null;

  const pathKey = resolvePathKey(workspacePath);
  const pool = getPool();

  // ---------------------------------------------------------------------------
  // 1. Resolve or create the workspace row (lazy upsert on first request)
  // ---------------------------------------------------------------------------
  let workspace: WorkspaceRow;
  const found = await getWorkspaceByPathKey(pool, pathKey);
  if (found) {
    workspace = found;
  } else {
    // Auto-create a workspace row so new path keys work without manual seeding.
    workspace = await upsertWorkspaceByPathKey(pool, pathKey);
  }

  // ---------------------------------------------------------------------------
  // 2. Resolve user (optional — membership check only if user resolved)
  // ---------------------------------------------------------------------------
  let userId: string | null = null;
  const token = extractBearerToken(authHeader);

  if (token) {
    // Dev path: VIPER_DEV_BEARER_TOKEN + VIPER_DEV_USER_EMAIL
    const devEmail = resolveDevToken(token);
    if (devEmail) {
      const user = await getUserByEmail(pool, devEmail);
      userId = user?.id ?? null;
    } else {
      // F.30 stub: token is treated as a user UUID (F.30.1/F.35 will add JWT verify)
      const userById = await getUserById(pool, token).catch(() => null);
      userId = userById?.id ?? null;
    }
  }

  // If enforcement is on and no token → 401
  if (!token) {
    throw new EntitlementError(
      "Authorization required. Provide a Bearer token or set VIPER_ENTITLEMENTS_ENFORCE=0 for unauthenticated access.",
      401,
    );
  }

  // If token was provided but did not resolve to a user → 401
  if (!userId) {
    throw new EntitlementError("Invalid or expired bearer token.", 401);
  }

  // Membership check (optional — unknown workspace UUIDs are created lazily above)
  const membership = await getMembership(pool, workspace.id, userId);
  if (!membership) {
    throw new EntitlementError(
      `User is not a member of workspace ${workspace.id}. ` +
        "Use upsertMembership to add the user, or set VIPER_ENTITLEMENTS_ENFORCE=0.",
      403,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Load DB plan (null row = allow-all)
  // ---------------------------------------------------------------------------
  const planRow = await getWorkspaceEntitlements(pool, workspace.id);

  // ---------------------------------------------------------------------------
  // 4. Merge DB ∩ D.20 env caps
  // ---------------------------------------------------------------------------
  const { allowedModes, allowedModelTiers } = mergeEntitlements(planRow, config);

  return {
    workspaceId: workspace.id,
    pathKey,
    allowedModes,
    allowedModelTiers,
    flags: planRow?.flags ?? {},
    userId,
  };
}

// ---------------------------------------------------------------------------
// Merge logic (pure — easy to unit-test)
// ---------------------------------------------------------------------------

/**
 * Compute effective entitlements as intersection of DB plan and D.20 env caps.
 *
 * Composition rule:
 *   - modes: DB.allowed_modes ?? ALL_MODES  (env has no mode gate today)
 *   - tiers: DB.allowed_model_tiers ?? ALL_TIERS  ∩  config.entitledModelTiers
 *
 * When planRow is null (no DB row), both sets fall back to ALL_*.
 * D.20 env caps are always applied on top regardless.
 */
export function mergeEntitlements(
  planRow: WorkspaceEntitlementRow | null,
  config: Pick<WorkflowRuntimeConfig, "entitledModelTiers">,
): Pick<ResolvedEntitlements, "allowedModes" | "allowedModelTiers"> {
  // Modes: DB list or ALL_MODES if not specified
  const dbModes: Set<string> = planRow?.allowed_modes
    ? new Set(planRow.allowed_modes)
    : new Set(ALL_MODES);
  const allowedModes = new Set<ChatMode>(
    ALL_MODES.filter((m) => dbModes.has(m)),
  );

  // Tiers: DB list or ALL_TIERS (legacy `fast` → auto), then intersect with D.20 env-entitled tiers
  const dbTiersRaw = planRow?.allowed_model_tiers ?? [...ALL_TIERS];
  const dbTiers = new Set<string>();
  for (const t of dbTiersRaw) {
    if (t === "fast") dbTiers.add("auto");
    else dbTiers.add(t);
  }
  const allowedModelTiers = new Set<ModelTierSelection>(
    ALL_TIERS.filter(
      (t) => dbTiers.has(t) && config.entitledModelTiers.has(t),
    ),
  );

  return { allowedModes, allowedModelTiers };
}

// ---------------------------------------------------------------------------
// Assert helpers (throw EntitlementError on violation)
// ---------------------------------------------------------------------------

/**
 * Assert that `mode` is permitted by the resolved entitlements.
 * No-op when `resolved` is null (enforcement off).
 */
export function assertModeAllowed(
  resolved: ResolvedEntitlements | null,
  mode: ChatMode,
): void {
  if (!resolved) return;
  if (!resolved.allowedModes.has(mode)) {
    throw new EntitlementError(
      `Chat mode "${mode}" is not permitted for this workspace. Allowed: ${[...resolved.allowedModes].join(", ")}`,
      403,
    );
  }
}

/**
 * Assert that `tier` is permitted by the resolved entitlements.
 * No-op when `resolved` is null (enforcement off).
 */
export function assertModelTierAllowed(
  resolved: ResolvedEntitlements | null,
  tier: ModelTierSelection,
): void {
  if (!resolved) return;
  if (!resolved.allowedModelTiers.has(tier)) {
    throw new EntitlementError(
      `Model tier "${tier}" is not permitted for this workspace. Allowed: ${[...resolved.allowedModelTiers].join(", ")}`,
      403,
    );
  }
}
