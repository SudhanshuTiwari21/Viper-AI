import { describe, it, expect } from "vitest";
import { hashString } from "./hash.js";

describe("hashString", () => {
  it("returns deterministic SHA256 hex", () => {
    const a = hashString("hello");
    const b = hashString("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different input gives different hash", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
