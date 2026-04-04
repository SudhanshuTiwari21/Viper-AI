import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isBrowserToolsEnabled, BROWSER_TOOL_NAMES } from "../index.js";
import { BrowserRunnerError, BrowserSession } from "../browser-session.js";

// ---------------------------------------------------------------------------
// isBrowserToolsEnabled (env kill-switch)
// ---------------------------------------------------------------------------

describe("isBrowserToolsEnabled", () => {
  const ORIG = process.env["VIPER_BROWSER_TOOLS"];

  afterEach(() => {
    if (ORIG === undefined) {
      delete process.env["VIPER_BROWSER_TOOLS"];
    } else {
      process.env["VIPER_BROWSER_TOOLS"] = ORIG;
    }
  });

  it("returns false when env var is unset (default-off)", () => {
    delete process.env["VIPER_BROWSER_TOOLS"];
    expect(isBrowserToolsEnabled()).toBe(false);
  });

  it("returns false when set to '0'", () => {
    process.env["VIPER_BROWSER_TOOLS"] = "0";
    expect(isBrowserToolsEnabled()).toBe(false);
  });

  it("returns false when set to 'false'", () => {
    process.env["VIPER_BROWSER_TOOLS"] = "false";
    expect(isBrowserToolsEnabled()).toBe(false);
  });

  it("returns true when set to '1'", () => {
    process.env["VIPER_BROWSER_TOOLS"] = "1";
    expect(isBrowserToolsEnabled()).toBe(true);
  });

  it("returns true when set to 'true'", () => {
    process.env["VIPER_BROWSER_TOOLS"] = "true";
    expect(isBrowserToolsEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BROWSER_TOOL_NAMES
// ---------------------------------------------------------------------------

describe("BROWSER_TOOL_NAMES", () => {
  it("exports browser_navigate and browser_screenshot", () => {
    expect(BROWSER_TOOL_NAMES).toContain("browser_navigate");
    expect(BROWSER_TOOL_NAMES).toContain("browser_screenshot");
  });
});

// ---------------------------------------------------------------------------
// BrowserRunnerError
// ---------------------------------------------------------------------------

describe("BrowserRunnerError", () => {
  it("is an Error subclass with correct name", () => {
    const err = new BrowserRunnerError("test msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("BrowserRunnerError");
    expect(err.message).toBe("test msg");
  });
});

// ---------------------------------------------------------------------------
// BrowserSession — unit tests with mocked Playwright
// ---------------------------------------------------------------------------

describe("BrowserSession — URL policy enforcement", () => {
  it("throws BrowserRunnerError for blocked URL on navigate() before even calling playwright", async () => {
    const session = new BrowserSession();

    // Simulate open without actually launching playwright by injecting mocks
    // @ts-expect-error — accessing private for test
    session.browser = {};
    // @ts-expect-error — accessing private for test
    session._closed = false;

    const mockPage = {
      setDefaultTimeout: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      goto: vi.fn().mockResolvedValue({}),
      title: vi.fn().mockResolvedValue("My App"),
      url: vi.fn().mockReturnValue("http://localhost:3000/"),
    };
    // @ts-expect-error — accessing private for test
    session.page = mockPage;

    // Allowed URL — should not throw
    await expect(session.navigate("http://localhost:3000")).resolves.toMatchObject({
      title: "My App",
    });

    // Blocked URL — file:
    await expect(session.navigate("file:///etc/passwd")).rejects.toThrow(BrowserRunnerError);
    await expect(session.navigate("file:///etc/passwd")).rejects.toThrow(/not allowed by policy/);

    // Blocked URL — external https
    await expect(session.navigate("https://evil.example.com")).rejects.toThrow(BrowserRunnerError);
  });

  it("rejects navigate when nav count exceeds limit", async () => {
    const session = new BrowserSession();
    // @ts-expect-error
    session.browser = {};
    // @ts-expect-error
    session._closed = false;
    const mockPage = {
      setDefaultTimeout: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      goto: vi.fn().mockResolvedValue({}),
      title: vi.fn().mockResolvedValue("Page"),
      url: vi.fn().mockReturnValue("http://localhost/"),
    };
    // @ts-expect-error
    session.page = mockPage;
    // @ts-expect-error
    session.maxNavCount = 1;
    // @ts-expect-error
    session.navCount = 1;

    await expect(session.navigate("http://localhost/")).rejects.toThrow(
      /Navigation limit reached/,
    );
  });

  it("throws when session is closed", async () => {
    const session = new BrowserSession();
    // @ts-expect-error
    session._closed = true;
    await expect(session.navigate("http://localhost/")).rejects.toThrow(/Session is closed/);
    await expect(session.screenshot()).rejects.toThrow(/Session is closed/);
  });
});

// ---------------------------------------------------------------------------
// BrowserSession — screenshot truncation (unit, no Playwright)
// ---------------------------------------------------------------------------

describe("BrowserSession — screenshot summary", () => {
  it("includes truncation notice when image exceeds max bytes", async () => {
    const session = new BrowserSession();
    // @ts-expect-error
    session.browser = {};
    // @ts-expect-error
    session._closed = false;
    // @ts-expect-error
    session.screenshotMaxBytes = 10; // very small cap

    const bigBuffer = Buffer.alloc(100, 0xff); // 100 bytes > 10 byte cap
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(bigBuffer),
      title: vi.fn().mockResolvedValue("My Page"),
      url: vi.fn().mockReturnValue("http://localhost/"),
    };
    // @ts-expect-error
    session.page = mockPage;

    const result = await session.screenshot();
    expect(result.truncated).toBe(true);
    expect(result.rawBytes).toBe(100);
    expect(result.summary).toMatch(/truncated/);
    // base64 should be at most ceil(10 * 4/3) chars
    expect(result.base64.length).toBeLessThanOrEqual(16);
  });
});
