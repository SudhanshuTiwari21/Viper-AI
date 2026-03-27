import { describe, it, expect } from "vitest";
import { ChatRequestSchema, ChatModeSchema } from "./request.schemas.js";

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
