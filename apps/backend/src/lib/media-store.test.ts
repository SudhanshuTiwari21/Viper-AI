import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  saveMedia,
  getMediaMeta,
  resolveMediaBuffer,
  deleteMedia,
  sniffMimeType,
  validateMimeType,
  MediaValidationError,
  __clearMediaMemoryForTests,
} from "./media-store.js";

// Ensure no DATABASE_URL is set during these unit tests (in-memory path).
const origDbUrl = process.env.DATABASE_URL;
beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.VIPER_MEDIA_TTL_HOURS;
  __clearMediaMemoryForTests();
});
afterEach(() => {
  if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
  else delete process.env.DATABASE_URL;
  delete process.env.VIPER_MEDIA_TTL_HOURS;
  __clearMediaMemoryForTests();
});

// ---------------------------------------------------------------------------
// Minimal image buffers with correct magic bytes (enough for sniff tests)
// ---------------------------------------------------------------------------
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_MAGIC = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP_MAGIC = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x00, 0x00, 0x00, 0x00, // file size (dummy)
  0x57, 0x45, 0x42, 0x50, // "WEBP"
]);
// A buffer with no recognizable magic bytes (plain text)
const UNKNOWN_MAGIC = Buffer.from("hello world");

describe("sniffMimeType", () => {
  it("detects PNG", () => expect(sniffMimeType(PNG_MAGIC)).toBe("image/png"));
  it("detects JPEG", () => expect(sniffMimeType(JPEG_MAGIC)).toBe("image/jpeg"));
  it("detects GIF", () => expect(sniffMimeType(GIF_MAGIC)).toBe("image/gif"));
  it("detects WEBP", () => expect(sniffMimeType(WEBP_MAGIC)).toBe("image/webp"));
  it("returns null for unknown bytes", () => expect(sniffMimeType(UNKNOWN_MAGIC)).toBeNull());
  it("returns null for empty buffer", () => expect(sniffMimeType(Buffer.alloc(0))).toBeNull());
});

describe("validateMimeType", () => {
  it("accepts png with PNG magic bytes", () =>
    expect(validateMimeType("image/png", PNG_MAGIC)).toBeNull());

  it("accepts jpeg with JPEG magic bytes", () =>
    expect(validateMimeType("image/jpeg", JPEG_MAGIC)).toBeNull());

  it("accepts allowed mime with unknown magic bytes (inconclusive sniff)", () =>
    expect(validateMimeType("image/png", UNKNOWN_MAGIC)).toBeNull());

  it("rejects disallowed mime type", () => {
    const err = validateMimeType("application/pdf", PNG_MAGIC);
    expect(err).not.toBeNull();
    expect(err).toContain("application/pdf");
  });

  it("rejects mime mismatch (declared png but jpeg magic)", () => {
    const err = validateMimeType("image/png", JPEG_MAGIC);
    expect(err).not.toBeNull();
    expect(err).toContain("mismatch");
  });
});

describe("saveMedia (in-memory)", () => {
  it("returns a MediaObject with a med_ prefix mediaId", async () => {
    const result = await saveMedia({ workspaceId: "ws-1", mimeType: "image/png", data: PNG_MAGIC });
    expect(result.mediaId).toMatch(/^med_[0-9a-f]{24}$/);
    expect(result.mimeType).toBe("image/png");
    expect(result.workspaceId).toBe("ws-1");
    expect(result.byteSize).toBe(PNG_MAGIC.length);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt).toBeNull();
  });

  it("throws MediaValidationError for disallowed mimeType", async () => {
    await expect(
      saveMedia({ workspaceId: "ws-1", mimeType: "image/bmp" as "image/png", data: PNG_MAGIC }),
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("throws MediaValidationError for mime/magic mismatch", async () => {
    await expect(
      saveMedia({ workspaceId: "ws-1", mimeType: "image/gif", data: JPEG_MAGIC }),
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("sets expiresAt when VIPER_MEDIA_TTL_HOURS is configured", async () => {
    process.env.VIPER_MEDIA_TTL_HOURS = "1";
    const before = Date.now();
    const result = await saveMedia({ workspaceId: "ws-1", mimeType: "image/png", data: PNG_MAGIC });
    const after = Date.now();
    expect(result.expiresAt).not.toBeNull();
    const exp = result.expiresAt!.getTime();
    expect(exp).toBeGreaterThanOrEqual(before + 3_600_000 - 100);
    expect(exp).toBeLessThanOrEqual(after + 3_600_000 + 100);
  });
});

describe("getMediaMeta (in-memory)", () => {
  it("returns null for unknown mediaId", async () => {
    expect(await getMediaMeta("ws-1", "med_notexist")).toBeNull();
  });

  it("returns null for wrong workspace_id", async () => {
    const { mediaId } = await saveMedia({
      workspaceId: "ws-1",
      mimeType: "image/png",
      data: PNG_MAGIC,
    });
    expect(await getMediaMeta("ws-OTHER", mediaId)).toBeNull();
  });

  it("returns meta for correct workspace_id", async () => {
    const saved = await saveMedia({ workspaceId: "ws-1", mimeType: "image/png", data: PNG_MAGIC });
    const meta = await getMediaMeta("ws-1", saved.mediaId);
    expect(meta).not.toBeNull();
    expect(meta!.mediaId).toBe(saved.mediaId);
    expect(meta!.sha256).toBe(saved.sha256);
  });
});

describe("resolveMediaBuffer (in-memory)", () => {
  it("returns original bytes after save", async () => {
    const saved = await saveMedia({ workspaceId: "ws-1", mimeType: "image/jpeg", data: JPEG_MAGIC });
    const buf = await resolveMediaBuffer("ws-1", saved.mediaId);
    expect(buf).not.toBeNull();
    expect(buf!.equals(JPEG_MAGIC)).toBe(true);
  });

  it("returns null for wrong workspace_id", async () => {
    const saved = await saveMedia({ workspaceId: "ws-1", mimeType: "image/jpeg", data: JPEG_MAGIC });
    expect(await resolveMediaBuffer("ws-BAD", saved.mediaId)).toBeNull();
  });

  it("returns null after TTL expires", async () => {
    process.env.VIPER_MEDIA_TTL_HOURS = "0.0001"; // ~0.36s — use fake timers instead
    const saved = await saveMedia({ workspaceId: "ws-1", mimeType: "image/png", data: PNG_MAGIC });

    // Artificially mark as expired by mutating stored meta through a re-save trick:
    // Simplest approach: check that expiresAt is set, then fake "now" past it.
    const meta = await getMediaMeta("ws-1", saved.mediaId);
    expect(meta!.expiresAt).not.toBeNull();

    // Patch Date to simulate expiry — override new Date() to return a future date
    const futureTime = meta!.expiresAt!.getTime() + 1000;
    const OrigDate = globalThis.Date;
    class FakeDate extends OrigDate {
      constructor(value?: number | string | Date) {
        super(value !== undefined ? value : futureTime);
      }
      static override now(): number { return futureTime; }
    }
    globalThis.Date = FakeDate as unknown as typeof Date;

    try {
      const buf = await resolveMediaBuffer("ws-1", saved.mediaId);
      expect(buf).toBeNull();
    } finally {
      globalThis.Date = OrigDate;
    }
  });
});

describe("deleteMedia (in-memory)", () => {
  it("returns false for unknown mediaId", async () => {
    expect(await deleteMedia("ws-1", "med_notexist")).toBe(false);
  });

  it("returns false for wrong workspace_id", async () => {
    const { mediaId } = await saveMedia({
      workspaceId: "ws-1",
      mimeType: "image/png",
      data: PNG_MAGIC,
    });
    expect(await deleteMedia("ws-OTHER", mediaId)).toBe(false);
  });

  it("deletes and returns true; subsequent resolve returns null", async () => {
    const { mediaId } = await saveMedia({
      workspaceId: "ws-1",
      mimeType: "image/png",
      data: PNG_MAGIC,
    });
    expect(await deleteMedia("ws-1", mediaId)).toBe(true);
    expect(await resolveMediaBuffer("ws-1", mediaId)).toBeNull();
  });
});
