// H.43 — Tests for /ops/slo-snapshot and /ops/slo-check routes.
//
// Coverage:
//  Route tests (mocked service):
//   1. Kill-switch off → GET /ops/slo-snapshot returns 404
//   2. Kill-switch off → POST /ops/slo-check returns 404
//   3. Token missing → GET /ops/slo-snapshot returns 401
//   4. Token missing → POST /ops/slo-check returns 401
//   5. Wrong token → 401
//   6. GET /ops/slo-snapshot happy path → 200 with snapshot shape
//   7. POST /ops/slo-check no violations → 200 { ok: true }
//   8. POST /ops/slo-check with violations → 200 { ok: false, violations }
//   9. Service throws → 500
//  10. VIPER_SLO_OPS_TOKEN unset → 401 (safety default)
//
//  Unit tests for pure burn-rate math:
//  11. detectViolations: no violations when all OK
//  12. detectViolations: latency critical when burn_rate ≥ 1.0
//  13. detectViolations: latency warning when burn_rate ≥ 0.8
//  14. detectViolations: quality failover critical
//  15. detectViolations: quality warning at 80% budget consumed
//  16. detectViolations: no alert when below min sample size
//  17. Targets snapshot: LATENCY_TARGETS_MS has expected modes
//  18. QUALITY_TARGETS values

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockBuildSloSnapshot,
  mockPostAlertWebhook,
  mockWorkflowLog,
} = vi.hoisted(() => ({
  mockBuildSloSnapshot: vi.fn(),
  mockPostAlertWebhook: vi.fn(),
  mockWorkflowLog: vi.fn(),
}));

vi.mock("../lib/slo-snapshot.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/slo-snapshot.service.js")>();
  return {
    ...actual,
    buildSloSnapshot: mockBuildSloSnapshot,
    postAlertWebhook: mockPostAlertWebhook,
  };
});

vi.mock("../services/assistant.service.js", () => ({
  workflowLog: mockWorkflowLog,
}));

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<{
  any_breach: boolean;
  breaches: unknown[];
}> = {}) {
  return {
    computed_at: "2026-04-01T00:00:00.000Z",
    window_days: 30,
    latency: [],
    quality: {
      total_requests: 1000,
      failover_requests: 30,
      failover_rate: 0.03,
      failover_burn_rate: 0.6,
      failover_slo_breached: false,
      tier_downgraded_requests: 50,
      downgrade_rate: 0.05,
      downgrade_burn_rate: 0.5,
      downgrade_slo_breached: false,
      requests_with_tokens: 200,
      token_coverage_rate: 0.2,
      avg_total_tokens: 800,
    },
    volume_top_workspaces: [],
    any_breach: false,
    breaches: [],
    ...overrides,
  };
}

function makeViolation() {
  return {
    severity: "critical" as const,
    rule: "latency.p95.agent",
    details: { mode: "agent", p95_ms: 90000, target_p95_ms: 45000, burn_rate: 2.0, request_count: 500 },
  };
}

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const { opsRoutes } = await import("./ops.routes.js");
  await app.register(opsRoutes);
  await app.ready();
  return app;
}

const VALID_TOKEN = "test-slo-token-secret";

// ---------------------------------------------------------------------------
// 1–2. Kill-switch off
// ---------------------------------------------------------------------------

describe("kill-switch off", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.VIPER_SLO_OPS_ENABLED;
    delete process.env.VIPER_SLO_OPS_TOKEN;
    app = await buildApp();
  });
  afterAll(async () => { await app.close(); });

  it("GET /ops/slo-snapshot → 404", async () => {
    const res = await app.inject({ method: "GET", url: "/ops/slo-snapshot" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /ops/slo-check → 404", async () => {
    const res = await app.inject({
      method: "POST", url: "/ops/slo-check",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 3–5. Token auth
// ---------------------------------------------------------------------------

describe("auth checks (kill-switch on)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.VIPER_SLO_OPS_ENABLED = "1";
    process.env.VIPER_SLO_OPS_TOKEN = VALID_TOKEN;
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_SLO_OPS_ENABLED;
    delete process.env.VIPER_SLO_OPS_TOKEN;
  });
  afterEach(() => { vi.clearAllMocks(); });

  it("GET /ops/slo-snapshot with no token → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/ops/slo-snapshot" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /ops/slo-snapshot with wrong token → 401", async () => {
    const res = await app.inject({
      method: "GET", url: "/ops/slo-snapshot",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /ops/slo-check with no token → 401", async () => {
    const res = await app.inject({
      method: "POST", url: "/ops/slo-check",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 10. Unset token → always 401
// ---------------------------------------------------------------------------

describe("VIPER_SLO_OPS_TOKEN unset → 401 safety default", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.VIPER_SLO_OPS_ENABLED = "1";
    delete process.env.VIPER_SLO_OPS_TOKEN;
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_SLO_OPS_ENABLED;
  });

  it("GET /ops/slo-snapshot without token configured → 401", async () => {
    const res = await app.inject({
      method: "GET", url: "/ops/slo-snapshot",
      headers: { Authorization: "Bearer anything" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toContain("VIPER_SLO_OPS_TOKEN");
  });
});

// ---------------------------------------------------------------------------
// 6–9. Happy paths (kill-switch on, valid token)
// ---------------------------------------------------------------------------

describe("kill-switch on + valid token", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.VIPER_SLO_OPS_ENABLED = "1";
    process.env.VIPER_SLO_OPS_TOKEN = VALID_TOKEN;
    delete process.env.VIPER_SLO_ALERT_WEBHOOK_URL;
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_SLO_OPS_ENABLED;
    delete process.env.VIPER_SLO_OPS_TOKEN;
  });
  afterEach(() => { vi.clearAllMocks(); });

  const AUTH = { Authorization: `Bearer ${VALID_TOKEN}` };

  it("GET /ops/slo-snapshot → 200 with snapshot shape", async () => {
    const snap = makeSnapshot();
    mockBuildSloSnapshot.mockResolvedValueOnce(snap);

    const res = await app.inject({
      method: "GET", url: "/ops/slo-snapshot",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("computed_at");
    expect(body).toHaveProperty("window_days", 30);
    expect(body).toHaveProperty("quality");
    expect(body).toHaveProperty("latency");
    expect(body).toHaveProperty("any_breach", false);
    expect(body).toHaveProperty("breaches");
  });

  it("POST /ops/slo-check with no violations → 200 { ok: true }", async () => {
    mockBuildSloSnapshot.mockResolvedValueOnce(makeSnapshot({ any_breach: false, breaches: [] }));

    const res = await app.inject({
      method: "POST", url: "/ops/slo-check",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.violations).toHaveLength(0);
    expect(mockWorkflowLog).toHaveBeenCalledWith(
      "slo:check:ok", null, expect.objectContaining({ any_breach: false }),
    );
  });

  it("POST /ops/slo-check with violations → 200 { ok: false, violations }", async () => {
    const violation = makeViolation();
    mockBuildSloSnapshot.mockResolvedValueOnce(
      makeSnapshot({ any_breach: true, breaches: [violation] }),
    );

    const res = await app.inject({
      method: "POST", url: "/ops/slo-check",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.violation_count).toBe(1);
    expect(body.violations[0].rule).toBe("latency.p95.agent");
    expect(mockWorkflowLog).toHaveBeenCalledWith(
      "slo:alert:fired", null, expect.objectContaining({ violation_count: 1 }),
    );
  });

  it("GET /ops/slo-snapshot service throws → 500", async () => {
    mockBuildSloSnapshot.mockRejectedValueOnce(new Error("DB down"));

    const res = await app.inject({
      method: "GET", url: "/ops/slo-snapshot",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBeDefined();
  });

  it("POST /ops/slo-check with violations + webhook → webhook called", async () => {
    process.env.VIPER_SLO_ALERT_WEBHOOK_URL = "https://hooks.example.com/alerts";
    const violation = makeViolation();
    mockBuildSloSnapshot.mockResolvedValueOnce(
      makeSnapshot({ any_breach: true, breaches: [violation] }),
    );
    mockPostAlertWebhook.mockResolvedValueOnce(undefined);

    await app.inject({
      method: "POST", url: "/ops/slo-check",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(mockPostAlertWebhook).toHaveBeenCalledWith(
      "https://hooks.example.com/alerts",
      [violation],
    );
    delete process.env.VIPER_SLO_ALERT_WEBHOOK_URL;
  });
});

// ---------------------------------------------------------------------------
// Unit tests: detectViolations (pure burn-rate math)
// ---------------------------------------------------------------------------

import {
  detectViolations,
  LATENCY_TARGETS_MS,
  QUALITY_TARGETS,
  ALERT_THRESHOLDS,
  type LatencyModeSlice,
  type QualitySnapshot,
} from "../lib/slo-snapshot.service.js";

function makeLatencySlice(
  mode: string,
  p95_ms: number,
  request_count = 1000,
): LatencyModeSlice {
  const target = LATENCY_TARGETS_MS[mode] ?? null;
  const sloEvaluated = request_count >= ALERT_THRESHOLDS.minSampleRequests && target != null;
  const burnRate = target != null ? p95_ms / target : null;
  return {
    mode,
    request_count,
    p50_ms: p95_ms / 2,
    p95_ms,
    p99_ms: p95_ms * 1.1,
    target_p95_ms: target,
    exceedance_rate: null,
    burn_rate: burnRate,
    slo_evaluated: sloEvaluated,
    slo_breached: sloEvaluated && burnRate != null && burnRate >= 1.0,
  };
}

function makeQualitySlice(overrides: Partial<QualitySnapshot> = {}): QualitySnapshot {
  return {
    total_requests: 1000,
    failover_requests: 30,
    failover_rate: 0.03,
    failover_burn_rate: 0.6,
    failover_slo_breached: false,
    tier_downgraded_requests: 50,
    downgrade_rate: 0.05,
    downgrade_burn_rate: 0.5,
    downgrade_slo_breached: false,
    requests_with_tokens: 200,
    token_coverage_rate: 0.2,
    avg_total_tokens: 800,
    ...overrides,
  };
}

describe("detectViolations — burn-rate math", () => {
  it("no violations when all SLOs healthy", () => {
    const latency = [makeLatencySlice("ask", 5_000)]; // p95=5s, target=15s → burn=0.33
    const quality = makeQualitySlice();
    expect(detectViolations(latency, quality)).toHaveLength(0);
  });

  it("critical violation when latency burn_rate ≥ 1.0", () => {
    // agent target=45000, actual p95=90000 → burn=2.0
    const latency = [makeLatencySlice("agent", 90_000)];
    const quality = makeQualitySlice();
    const violations = detectViolations(latency, quality);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("critical");
    expect(violations[0]?.rule).toBe("latency.p95.agent");
  });

  it("warning violation when latency burn_rate ≥ 0.8 < 1.0", () => {
    // ask target=15000, p95=13000 → burn=0.867
    const latency = [makeLatencySlice("ask", 13_000)];
    const quality = makeQualitySlice();
    const violations = detectViolations(latency, quality);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("warning");
    expect(violations[0]?.rule).toBe("latency.p95.ask");
  });

  it("critical quality violation: failover burn_rate ≥ 1.0", () => {
    // failover target=0.05, actual=0.06 → burn=1.2
    const latency: LatencyModeSlice[] = [];
    const quality = makeQualitySlice({
      failover_rate: 0.06,
      failover_burn_rate: 1.2,
      failover_slo_breached: true,
    });
    const violations = detectViolations(latency, quality);
    expect(violations.some((v) => v.rule === "quality.failover_rate" && v.severity === "critical")).toBe(true);
  });

  it("warning quality violation: failover burn_rate 0.8–1.0", () => {
    const latency: LatencyModeSlice[] = [];
    const quality = makeQualitySlice({
      failover_rate: 0.04,
      failover_burn_rate: 0.8,
    });
    const violations = detectViolations(latency, quality);
    expect(violations.some((v) => v.rule === "quality.failover_rate" && v.severity === "warning")).toBe(true);
  });

  it("no violation below minimum sample size", () => {
    // burn_rate ≥ 1.0 but only 50 requests (below min 100)
    const latency = [makeLatencySlice("agent", 90_000, 50)]; // not slo_evaluated
    const quality = makeQualitySlice({ total_requests: 50 });
    const violations = detectViolations(latency, quality);
    expect(violations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: target constants
// ---------------------------------------------------------------------------

describe("SLO target constants", () => {
  it("LATENCY_TARGETS_MS has all expected modes", () => {
    expect(LATENCY_TARGETS_MS["ask"]).toBe(15_000);
    expect(LATENCY_TARGETS_MS["plan"]).toBe(25_000);
    expect(LATENCY_TARGETS_MS["debug"]).toBe(25_000);
    expect(LATENCY_TARGETS_MS["agent"]).toBe(45_000);
  });

  it("QUALITY_TARGETS values match SLO.md", () => {
    expect(QUALITY_TARGETS.failoverRateMax).toBe(0.05);
    expect(QUALITY_TARGETS.tierDowngradeRateMax).toBe(0.10);
  });
});
