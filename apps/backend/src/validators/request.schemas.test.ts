import { describe, it, expect } from "vitest";
import { ChatRequestSchema, ChatModeSchema, ModelTierSelectionSchema, ChatFeedbackSchema, FeedbackStatsQuerySchema } from "./request.schemas.js";

describe("ChatRequestSchema (C.11 mode)", () => {
  it("omitted mode → parses as agent", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "hi",
      workspacePath: "/tmp/w",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe("agent");
  });

  it("empty string mode → agent", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "hi",
      workspacePath: "/w",
      mode: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe("agent");
  });

  it.each(["ask", "plan", "debug", "agent"] as const)("accepts literal %s", (m) => {
    const r = ChatRequestSchema.safeParse({
      prompt: "x",
      workspacePath: "/w",
      mode: m,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe(m);
  });

  it("normalizes case and whitespace", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "x",
      workspacePath: "/w",
      mode: "  ASK  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe("ask");
  });

  it("rejects invalid mode string", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "x",
      workspacePath: "/w",
      mode: "play",
    });
    expect(r.success).toBe(false);
  });

  it("sanitizeChatMessages does not strip mode", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "ok",
      workspacePath: "/w",
      mode: "debug",
      messages: [{ role: "user", content: "  hello  " }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mode).toBe("debug");
      expect(r.data.messages).toEqual([{ role: "user", content: "hello" }]);
    }
  });
});

describe("ChatModeSchema", () => {
  it("direct enum rejects wrong case without preprocess", () => {
    expect(ChatModeSchema.safeParse("Agent").success).toBe(false);
  });
});

describe("ChatRequestSchema (D.19/D.20 modelTier)", () => {
  it("omitted modelTier → undefined (D.20: server may load persisted tier)", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "hi",
      workspacePath: "/tmp/w",
      mode: "agent",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.modelTier).toBeUndefined();
  });

  it("null / empty string modelTier → undefined", () => {
    const r1 = ChatRequestSchema.safeParse({
      prompt: "hi",
      workspacePath: "/w",
      modelTier: null,
    });
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.modelTier).toBeUndefined();

    const r2 = ChatRequestSchema.safeParse({
      prompt: "hi",
      workspacePath: "/w",
      modelTier: "",
    });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.modelTier).toBeUndefined();
  });

  it.each(["auto", "premium", "fast"] as const)("accepts modelTier %s", (t) => {
    const r = ChatRequestSchema.safeParse({
      prompt: "x",
      workspacePath: "/w",
      modelTier: t,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.modelTier).toBe(t);
  });

  it("normalizes case and whitespace for modelTier", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "x",
      workspacePath: "/w",
      modelTier: "  PREMIUM  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.modelTier).toBe("premium");
  });

  it("rejects invalid modelTier", () => {
    const r = ChatRequestSchema.safeParse({
      prompt: "x",
      workspacePath: "/w",
      modelTier: "turbo",
    });
    expect(r.success).toBe(false);
  });
});

describe("ModelTierSelectionSchema", () => {
  it("direct parse is strict", () => {
    expect(ModelTierSelectionSchema.safeParse("Auto").success).toBe(false);
  });
});

describe("ChatFeedbackSchema (D.21)", () => {
  it("accepts minimal feedback", () => {
    const r = ChatFeedbackSchema.safeParse({
      request_id: "req-1",
      rating: "up",
      workspace_id: "ws-1",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rating).toBe("up");
      expect(r.data.tags).toEqual([]);
    }
  });

  it("accepts full feedback with tags + comment", () => {
    const r = ChatFeedbackSchema.safeParse({
      request_id: "req-1",
      message_id: "msg-1",
      rating: "down",
      tags: ["incorrect", "too_slow"],
      comment: "Was not helpful",
      workspace_id: "ws-1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid rating", () => {
    const r = ChatFeedbackSchema.safeParse({
      request_id: "req-1",
      rating: "meh",
      workspace_id: "ws-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid tag", () => {
    const r = ChatFeedbackSchema.safeParse({
      request_id: "req-1",
      rating: "up",
      tags: ["not_a_tag"],
      workspace_id: "ws-1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects comment over 1000 chars", () => {
    const r = ChatFeedbackSchema.safeParse({
      request_id: "req-1",
      rating: "up",
      comment: "x".repeat(1001),
      workspace_id: "ws-1",
    });
    expect(r.success).toBe(false);
  });
});

describe("FeedbackStatsQuerySchema (D.21)", () => {
  it("accepts workspace_id only", () => {
    const r = FeedbackStatsQuerySchema.safeParse({ workspace_id: "ws-1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.since).toBeUndefined();
  });

  it("parses ISO date string to Date", () => {
    const r = FeedbackStatsQuerySchema.safeParse({
      workspace_id: "ws-1",
      since: "2025-01-01T00:00:00Z",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.since).toBeInstanceOf(Date);
  });

  it("ignores invalid date string gracefully", () => {
    const r = FeedbackStatsQuerySchema.safeParse({
      workspace_id: "ws-1",
      since: "not-a-date",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.since).toBeUndefined();
  });
});
