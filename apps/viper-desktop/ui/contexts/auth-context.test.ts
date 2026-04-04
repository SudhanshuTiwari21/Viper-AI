import { describe, it, expect } from "vitest";
import { emailToInitials } from "./auth-context";

describe("emailToInitials", () => {
  it("uses two parts from email local segment", () => {
    expect(emailToInitials("jane.doe@corp.io")).toBe("JD");
  });
  it("uses first two chars for single token", () => {
    expect(emailToInitials("alpha@x.dev")).toBe("AL");
  });
});
