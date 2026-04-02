import { describe, it, expect, beforeEach } from "vitest";
import {
  saveFeedback,
  getFeedbackStats,
  __clearFeedbackMemoryForTests,
} from "./chat-feedback-store.js";

describe("chat-feedback-store (in-memory)", () => {
  beforeEach(() => {
    __clearFeedbackMemoryForTests();
  });

  it("saves and retrieves feedback stats", async () => {
    await saveFeedback({
      workspace_id: "ws-1",
      request_id: "req-1",
      rating: "up",
    });
    await saveFeedback({
      workspace_id: "ws-1",
      request_id: "req-2",
      rating: "down",
    });
    await saveFeedback({
      workspace_id: "ws-1",
      request_id: "req-3",
      rating: "up",
    });

    const stats = await getFeedbackStats("ws-1");
    expect(stats.up).toBe(2);
    expect(stats.down).toBe(1);
    expect(stats.total).toBe(3);
  });

  it("filters by workspace_id", async () => {
    await saveFeedback({
      workspace_id: "ws-1",
      request_id: "req-1",
      rating: "up",
    });
    await saveFeedback({
      workspace_id: "ws-2",
      request_id: "req-2",
      rating: "down",
    });

    const stats1 = await getFeedbackStats("ws-1");
    expect(stats1.up).toBe(1);
    expect(stats1.down).toBe(0);

    const stats2 = await getFeedbackStats("ws-2");
    expect(stats2.up).toBe(0);
    expect(stats2.down).toBe(1);
  });

  it("returns zeroes for unknown workspace", async () => {
    const stats = await getFeedbackStats("ws-unknown");
    expect(stats).toEqual({ up: 0, down: 0, total: 0 });
  });
});
