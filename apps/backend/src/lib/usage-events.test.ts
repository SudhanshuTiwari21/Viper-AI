/**
 * F.31 — Unit tests for usage-events.ts emitter.
 *
 * Tests:
 *  1. Kill-switch env parsing (isUsageEventsEnabled, isUsageEventsStdoutEnabled).
 *  2. recordUsageEvent with kill-switch off → no DB call.
 *  3. recordUsageEvent with kill-switch on but no DATABASE_URL → no DB call.
 *  4. recordUsageEvent with kill-switch on + DATABASE_URL → calls insertUsageEvent.
 *  5. Idempotency: duplicate request_id returns null from insertUsageEvent → no crash.
 *  6. DB errors are swallowed, do not propagate.
 *  7. Stdout emission when VIPER_USAGE_EVENTS_STDOUT=1.
 *  8. Stdout NOT emitted when stdout switch is off.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must use vi.hoisted so they are defined before vi.mock factories run
// ---------------------------------------------------------------------------

const { mockInsertUsageEvent, mockComputeUsageCostUnits } = vi.hoisted(() => ({
  mockInsertUsageEvent: vi.fn(),
  mockComputeUsageCostUnits: vi.fn().mockReturnValue(42n),
}));

vi.mock("@repo/database", () => ({
  getPool: vi.fn().mockReturnValue({}),
  insertUsageEvent: mockInsertUsageEvent,
}));

vi.mock("../services/assistant.service.js", () => ({
  workflowLog: vi.fn(),
}));

vi.mock("@repo/model-registry", () => ({
  resolveModelSpec: vi.fn().mockReturnValue({ provider: "openai" }),
  computeUsageCostUnits: mockComputeUsageCostUnits,
}));

import {
  isUsageEventsEnabled,
  isUsageEventsStdoutEnabled,
  recordUsageEvent,
} from "./usage-events.js";
import type { RouteTelemetry } from "../types/route-telemetry.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IDENTITY = {
  request_id: "req-uuid-test",
  workspace_id: "abc1234567890def",
  conversation_id: null,
};

const TELEMETRY: RouteTelemetry = {
  request_id: IDENTITY.request_id,
  workspace_id: IDENTITY.workspace_id,
  conversation_id: null,
  mode: "agent",
  effective_model_tier: "auto",
  primary_model_id: "gpt-4o-mini",
  final_model_id: "gpt-4o-mini",
  fallback_chain: ["gpt-4o-mini"],
  fallback_count: 0,
  intent: "code_edit",
  route_mode: "auto",
  tier_downgraded: false,
  latency_ms: 800,
};

const BASE_RECORD = {
  telemetry: TELEMETRY,
  stream: false,
  entitlements: null,
  tokens: null,
  identity: IDENTITY,
  billing_bucket: "auto" as const,
};

// ---------------------------------------------------------------------------
// isUsageEventsEnabled
// ---------------------------------------------------------------------------

describe("isUsageEventsEnabled", () => {
  const ORIG = process.env["VIPER_USAGE_EVENTS"];
  afterEach(() => {
    if (ORIG === undefined) delete process.env["VIPER_USAGE_EVENTS"];
    else process.env["VIPER_USAGE_EVENTS"] = ORIG;
  });

  it("returns false when unset (default off)", () => {
    delete process.env["VIPER_USAGE_EVENTS"];
    expect(isUsageEventsEnabled()).toBe(false);
  });

  it("returns false when '0'", () => {
    process.env["VIPER_USAGE_EVENTS"] = "0";
    expect(isUsageEventsEnabled()).toBe(false);
  });

  it("returns true when '1'", () => {
    process.env["VIPER_USAGE_EVENTS"] = "1";
    expect(isUsageEventsEnabled()).toBe(true);
  });

  it("returns true when 'true'", () => {
    process.env["VIPER_USAGE_EVENTS"] = "true";
    expect(isUsageEventsEnabled()).toBe(true);
  });
});

describe("isUsageEventsStdoutEnabled", () => {
  const ORIG = process.env["VIPER_USAGE_EVENTS_STDOUT"];
  afterEach(() => {
    if (ORIG === undefined) delete process.env["VIPER_USAGE_EVENTS_STDOUT"];
    else process.env["VIPER_USAGE_EVENTS_STDOUT"] = ORIG;
  });

  it("returns false when unset", () => {
    delete process.env["VIPER_USAGE_EVENTS_STDOUT"];
    expect(isUsageEventsStdoutEnabled()).toBe(false);
  });

  it("returns true when '1'", () => {
    process.env["VIPER_USAGE_EVENTS_STDOUT"] = "1";
    expect(isUsageEventsStdoutEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// recordUsageEvent
// ---------------------------------------------------------------------------

describe("recordUsageEvent — kill-switch off (default)", () => {
  const ORIG_EVENTS = process.env["VIPER_USAGE_EVENTS"];
  const ORIG_STDOUT = process.env["VIPER_USAGE_EVENTS_STDOUT"];

  beforeEach(() => {
    delete process.env["VIPER_USAGE_EVENTS"];
    delete process.env["VIPER_USAGE_EVENTS_STDOUT"];
    mockInsertUsageEvent.mockClear();
    mockComputeUsageCostUnits.mockClear();
  });
  afterEach(() => {
    if (ORIG_EVENTS === undefined) delete process.env["VIPER_USAGE_EVENTS"];
    else process.env["VIPER_USAGE_EVENTS"] = ORIG_EVENTS;
    if (ORIG_STDOUT === undefined) delete process.env["VIPER_USAGE_EVENTS_STDOUT"];
    else process.env["VIPER_USAGE_EVENTS_STDOUT"] = ORIG_STDOUT;
  });

  it("does not call insertUsageEvent", async () => {
    await recordUsageEvent(BASE_RECORD);
    expect(mockInsertUsageEvent).not.toHaveBeenCalled();
  });

  it("does not throw", async () => {
    await expect(recordUsageEvent(BASE_RECORD)).resolves.toBeUndefined();
  });
});

describe("recordUsageEvent — kill-switch on, no DATABASE_URL", () => {
  const ORIG_EVENTS = process.env["VIPER_USAGE_EVENTS"];
  const ORIG_DB = process.env["DATABASE_URL"];

  beforeEach(() => {
    process.env["VIPER_USAGE_EVENTS"] = "1";
    delete process.env["DATABASE_URL"];
    mockInsertUsageEvent.mockClear();
  });
  afterEach(() => {
    if (ORIG_EVENTS === undefined) delete process.env["VIPER_USAGE_EVENTS"];
    else process.env["VIPER_USAGE_EVENTS"] = ORIG_EVENTS;
    if (ORIG_DB === undefined) delete process.env["DATABASE_URL"];
    else process.env["DATABASE_URL"] = ORIG_DB;
  });

  it("skips DB insert when DATABASE_URL is absent", async () => {
    await recordUsageEvent(BASE_RECORD);
    expect(mockInsertUsageEvent).not.toHaveBeenCalled();
  });
});

describe("recordUsageEvent — kill-switch on + DATABASE_URL set", () => {
  const ORIG_EVENTS = process.env["VIPER_USAGE_EVENTS"];
  const ORIG_DB = process.env["DATABASE_URL"];

  beforeEach(() => {
    process.env["VIPER_USAGE_EVENTS"] = "1";
    process.env["DATABASE_URL"] = "postgresql://localhost:5432/viper_test";
    mockInsertUsageEvent.mockReset();
    mockInsertUsageEvent.mockResolvedValue({ id: "row-uuid-1" });
    mockComputeUsageCostUnits.mockReset();
    mockComputeUsageCostUnits.mockReturnValue(42n);
  });
  afterEach(() => {
    if (ORIG_EVENTS === undefined) delete process.env["VIPER_USAGE_EVENTS"];
    else process.env["VIPER_USAGE_EVENTS"] = ORIG_EVENTS;
    if (ORIG_DB === undefined) delete process.env["DATABASE_URL"];
    else process.env["DATABASE_URL"] = ORIG_DB;
  });

  it("calls insertUsageEvent with correct fields", async () => {
    await recordUsageEvent(BASE_RECORD);
    expect(mockInsertUsageEvent).toHaveBeenCalledOnce();
    const [, params] = mockInsertUsageEvent.mock.calls[0]!;
    expect(params.request_id).toBe("req-uuid-test");
    expect(params.workspace_path_key).toBe("abc1234567890def");
    expect(params.mode).toBe("agent");
    expect(params.stream).toBeUndefined(); // stream goes in metadata
    expect(params.metadata.stream).toBe(false);
    expect(params.fallback_count).toBe(0);
    expect(params.tier_downgraded).toBe(false);
    expect(params.latency_ms).toBe(800);
    expect(params.provider).toBe("openai");
    expect(params.billing_bucket).toBe("auto");
    expect(params.cost_units).toBe(42n);
  });

  it("passes workspace_uuid and user_uuid from entitlements", async () => {
    await recordUsageEvent({
      ...BASE_RECORD,
      stream: true,
      billing_bucket: "premium",
      entitlements: {
        workspaceId: "ws-uuid-1",
        userId: "user-uuid-1",
        pathKey: "abc1234567890def",
        allowedModes: new Set(["agent"]),
        allowedModelTiers: new Set(["auto"]),
        flags: {},
      },
    });
    const [, params] = mockInsertUsageEvent.mock.calls[0]!;
    expect(params.workspace_uuid).toBe("ws-uuid-1");
    expect(params.user_uuid).toBe("user-uuid-1");
    expect(params.metadata.stream).toBe(true);
    expect(params.billing_bucket).toBe("premium");
  });

  it("sets token fields when provided", async () => {
    await recordUsageEvent({
      ...BASE_RECORD,
      tokens: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
    });
    const [, params] = mockInsertUsageEvent.mock.calls[0]!;
    expect(params.input_tokens).toBe(100);
    expect(params.output_tokens).toBe(200);
    expect(params.total_tokens).toBe(300);
  });

  it("idempotency: insertUsageEvent returning null does not crash", async () => {
    mockInsertUsageEvent.mockResolvedValue(null);
    await expect(recordUsageEvent(BASE_RECORD)).resolves.toBeUndefined();
  });

  it("DB errors are swallowed — never propagate to caller", async () => {
    mockInsertUsageEvent.mockRejectedValue(new Error("connection reset"));
    await expect(recordUsageEvent(BASE_RECORD)).resolves.toBeUndefined();
  });

  it("uses streaming assumed tokens when stream and tokens are null", async () => {
    process.env["VIPER_USAGE_STREAMING_ASSUMED_TOKENS"] = "2048";
    await recordUsageEvent({ ...BASE_RECORD, stream: true, tokens: null });
    expect(mockComputeUsageCostUnits).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "gpt-4o-mini",
        assumedTotalTokensWhenUnknown: 2048,
      }),
    );
    delete process.env["VIPER_USAGE_STREAMING_ASSUMED_TOKENS"];
  });
});

describe("recordUsageEvent — stdout emission", () => {
  const ORIG_EVENTS = process.env["VIPER_USAGE_EVENTS"];
  const ORIG_STDOUT = process.env["VIPER_USAGE_EVENTS_STDOUT"];
  const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  beforeEach(() => {
    delete process.env["VIPER_USAGE_EVENTS"];
    process.env["VIPER_USAGE_EVENTS_STDOUT"] = "1";
    writeSpy.mockClear();
    mockInsertUsageEvent.mockClear();
  });
  afterEach(() => {
    if (ORIG_EVENTS === undefined) delete process.env["VIPER_USAGE_EVENTS"];
    else process.env["VIPER_USAGE_EVENTS"] = ORIG_EVENTS;
    if (ORIG_STDOUT === undefined) delete process.env["VIPER_USAGE_EVENTS_STDOUT"];
    else process.env["VIPER_USAGE_EVENTS_STDOUT"] = ORIG_STDOUT;
    writeSpy.mockRestore();
  });

  it("emits JSON line to stdout with _type=viper.usage.event", async () => {
    await recordUsageEvent(BASE_RECORD);
    const calls = writeSpy.mock.calls.filter((c) => String(c[0]).includes("viper.usage.event"));
    expect(calls.length).toBe(1);
    const parsed = JSON.parse(String(calls[0]![0])) as Record<string, unknown>;
    expect(parsed["_type"]).toBe("viper.usage.event");
    expect(parsed["request_id"]).toBe("req-uuid-test");
    expect(parsed["ts"]).toBeTruthy();
  });

  it("does NOT emit stdout when switch is off", async () => {
    process.env["VIPER_USAGE_EVENTS_STDOUT"] = "0";
    await recordUsageEvent(BASE_RECORD);
    const calls = writeSpy.mock.calls.filter((c) => String(c[0]).includes("viper.usage.event"));
    expect(calls.length).toBe(0);
  });
});
