/**
 * E.26 — Playwright browser session facade.
 *
 * Uses a dynamic import of `playwright` so the package can be installed
 * without Playwright (the peer dep is optional). If Playwright is not
 * installed or browsers are not available, operations throw `BrowserRunnerError`
 * with a clear message.
 *
 * Resource bounds (overridable via env):
 *   VIPER_BROWSER_SESSION_TIMEOUT_MS  — max lifetime of a session (default 5 min)
 *   VIPER_BROWSER_NAV_TIMEOUT_MS      — per-navigation timeout (default 30 s)
 *   VIPER_BROWSER_MAX_NAV_COUNT       — max navigations per session (default 20)
 *   VIPER_BROWSER_SCREENSHOT_MAX_BYTES — max raw PNG bytes returned (default 200 KB)
 */

import { isUrlAllowed, getAllowedOriginsFromEnv } from "./url-allowlist.js";
import { envInt } from "./env-helpers.js";

/** Max base64 chars in a screenshot result payload (~200 KB raw). */
const DEFAULT_SCREENSHOT_MAX_BYTES = 200 * 1024;

export class BrowserRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserRunnerError";
  }
}

/**
 * Lazily load the `playwright` module (optional peer dep).
 * Throws `BrowserRunnerError` if not installed.
 */
async function requirePlaywright(): Promise<typeof import("playwright")> {
  try {
    return (await import("playwright")) as typeof import("playwright");
  } catch {
    throw new BrowserRunnerError(
      "Playwright is not installed. Run: npm install -w @repo/browser-runner playwright && npx playwright install chromium",
    );
  }
}

export interface NavigateResult {
  url: string;
  title: string;
  statusCode: number | null;
}

export interface ScreenshotResult {
  /** Human-readable summary for the model. */
  summary: string;
  /** Base64-encoded PNG bytes (possibly truncated to SCREENSHOT_MAX_BYTES). */
  base64: string;
  /** True if the image was truncated. */
  truncated: boolean;
  rawBytes: number;
}

export class BrowserSession {
  private browser: import("playwright").Browser | null = null;
  private page: import("playwright").Page | null = null;
  private navCount = 0;
  private readonly sessionTimeout: number;
  private readonly navTimeout: number;
  private readonly maxNavCount: number;
  private readonly screenshotMaxBytes: number;
  private readonly allowedOrigins: Set<string>;
  private sessionTimer: NodeJS.Timeout | null = null;
  private _closed = false;

  constructor() {
    this.sessionTimeout = envInt("VIPER_BROWSER_SESSION_TIMEOUT_MS", 5 * 60 * 1000);
    this.navTimeout = envInt("VIPER_BROWSER_NAV_TIMEOUT_MS", 30_000);
    this.maxNavCount = envInt("VIPER_BROWSER_MAX_NAV_COUNT", 20);
    this.screenshotMaxBytes = envInt("VIPER_BROWSER_SCREENSHOT_MAX_BYTES", DEFAULT_SCREENSHOT_MAX_BYTES);
    this.allowedOrigins = getAllowedOriginsFromEnv();
  }

  get isClosed(): boolean {
    return this._closed;
  }

  get navigationCount(): number {
    return this.navCount;
  }

  /** Launch the browser and open a blank page. */
  async open(): Promise<void> {
    if (this._closed) throw new BrowserRunnerError("Session is closed.");
    if (this.browser) return; // already open

    const pw = await requirePlaywright();
    this.browser = await pw.chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(this.navTimeout);
    this.page.setDefaultNavigationTimeout(this.navTimeout);

    // Hard lifetime cap
    this.sessionTimer = setTimeout(() => {
      void this.close().catch(() => undefined);
    }, this.sessionTimeout);
  }

  /** Navigate to a URL and return title + status code. */
  async navigate(url: string): Promise<NavigateResult> {
    this.assertOpen();

    if (!isUrlAllowed(url, this.allowedOrigins)) {
      throw new BrowserRunnerError(
        `URL not allowed by policy: "${url}". ` +
          "Only http(s)://localhost and http(s)://127.0.0.1 are allowed by default. " +
          "Set VIPER_BROWSER_ALLOWED_ORIGINS to permit additional origins.",
      );
    }

    if (this.navCount >= this.maxNavCount) {
      throw new BrowserRunnerError(
        `Navigation limit reached (${this.maxNavCount} max per session).`,
      );
    }

    this.navCount++;
    const page = this.page!;
    let statusCode: number | null = null;

    const handler = (response: import("playwright").Response) => {
      if (response.url() === url || response.url().startsWith(url)) {
        statusCode = response.status();
      }
    };
    page.on("response", handler);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.navTimeout });
    } finally {
      page.off("response", handler);
    }

    const title = await page.title().catch(() => "");
    const finalUrl = page.url();

    return { url: finalUrl, title, statusCode };
  }

  /** Take a screenshot of the current page. */
  async screenshot(options?: { fullPage?: boolean }): Promise<ScreenshotResult> {
    this.assertOpen();

    const page = this.page!;
    const pngBuffer = await page.screenshot({
      fullPage: options?.fullPage ?? false,
      type: "png",
    });

    const rawBytes = pngBuffer.byteLength;
    const truncated = rawBytes > this.screenshotMaxBytes;
    const sliced = truncated ? pngBuffer.slice(0, this.screenshotMaxBytes) : pngBuffer;
    const base64 = Buffer.from(sliced).toString("base64");

    const currentUrl = page.url();
    const title = await page.title().catch(() => "");
    const summary = truncated
      ? `Screenshot captured (${rawBytes} bytes, truncated to ${this.screenshotMaxBytes} bytes). Page: "${title}" at ${currentUrl}`
      : `Screenshot captured (${rawBytes} bytes). Page: "${title}" at ${currentUrl}`;

    return { summary, base64, truncated, rawBytes };
  }

  /** Close the browser session and release resources. */
  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    try {
      await this.browser?.close();
    } catch {
      // best-effort
    } finally {
      this.browser = null;
      this.page = null;
    }
  }

  private assertOpen(): void {
    if (this._closed) throw new BrowserRunnerError("Session is closed.");
    if (!this.browser || !this.page) {
      throw new BrowserRunnerError("Session not open. Call open() first.");
    }
  }
}

/**
 * Convenience: create and open a new session in one call.
 * Caller is responsible for calling session.close() when done.
 */
export async function createBrowserSession(): Promise<BrowserSession> {
  const session = new BrowserSession();
  await session.open();
  return session;
}
