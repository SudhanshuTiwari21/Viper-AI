/**
 * E.24 — Unit tests for the multimodal content builder.
 *
 * The media-store is mocked so these tests run without Postgres or a real
 * filesystem.  Integration with the real store is covered by media.routes.test.ts.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  buildMultimodalUserContent,
  MultimodalResolutionError,
} from "./multimodal-content.js";

// ---------------------------------------------------------------------------
// Mock the media-store module — isolates this unit test from storage.
// ---------------------------------------------------------------------------
vi.mock("./media-store.js", () => ({
  getMediaMeta: vi.fn(),
  resolveMediaBuffer: vi.fn(),
}));

import { getMediaMeta, resolveMediaBuffer } from "./media-store.js";

const mockGetMediaMeta = vi.mocked(getMediaMeta);
const mockResolveMediaBuffer = vi.mocked(resolveMediaBuffer);

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";
const JPEG_BASE64 = "/9j/4AAQSkZJRgABAQAAAQABAAD";

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// inline_base64 — no store interaction required
// ---------------------------------------------------------------------------

describe("buildMultimodalUserContent — inline_base64", () => {
  it("produces a leading text part followed by one image_url part", async () => {
    const parts = await buildMultimodalUserContent(
      "describe this image",
      [{ kind: "image", source: { type: "inline_base64", mimeType: "image/png", data: PNG_BASE64 } }],
      "ws-1",
    );

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: "text", text: "describe this image" });
    expect(parts[1]).toMatchObject({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${PNG_BASE64}`, detail: "auto" },
    });
  });

  it("supports image/jpeg mimeType", async () => {
    const parts = await buildMultimodalUserContent(
      "describe",
      [{ kind: "image", source: { type: "inline_base64", mimeType: "image/jpeg", data: JPEG_BASE64 } }],
      "ws-1",
    );
    expect((parts[1] as { image_url: { url: string } }).image_url.url).toBe(
      `data:image/jpeg;base64,${JPEG_BASE64}`,
    );
  });

  it("handles multiple inline attachments in order", async () => {
    const parts = await buildMultimodalUserContent(
      "compare",
      [
        { kind: "image", source: { type: "inline_base64", mimeType: "image/png", data: "aaa" } },
        { kind: "image", source: { type: "inline_base64", mimeType: "image/jpeg", data: "bbb" } },
      ],
      "ws-1",
    );
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ type: "text", text: "compare" });
    const url1 = (parts[1] as { image_url: { url: string } }).image_url.url;
    const url2 = (parts[2] as { image_url: { url: string } }).image_url.url;
    expect(url1).toContain("image/png");
    expect(url2).toContain("image/jpeg");
  });

  it("does not call getMediaMeta for inline_base64", async () => {
    await buildMultimodalUserContent(
      "test",
      [{ kind: "image", source: { type: "inline_base64", mimeType: "image/webp", data: "xyz" } }],
      "ws-1",
    );
    expect(mockGetMediaMeta).not.toHaveBeenCalled();
    expect(mockResolveMediaBuffer).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// media_ref — resolves via mocked store
// ---------------------------------------------------------------------------

describe("buildMultimodalUserContent — media_ref", () => {
  const mockMeta = {
    mediaId: "med_abc123",
    workspaceId: "ws-1",
    mimeType: "image/png",
    byteSize: 4,
    sha256: "deadbeef",
    storageKey: "med_abc123",
    createdAt: new Date(),
    expiresAt: null,
  };

  it("resolves bytes and constructs a data URL", async () => {
    mockGetMediaMeta.mockResolvedValue(mockMeta);
    mockResolveMediaBuffer.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const parts = await buildMultimodalUserContent(
      "what is this",
      [{ kind: "image", source: { type: "media_ref", mediaId: "med_abc123" } }],
      "ws-1",
    );

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: "text", text: "what is this" });
    const imgPart = parts[1] as { type: string; image_url: { url: string } };
    expect(imgPart.type).toBe("image_url");
    expect(imgPart.image_url.url).toMatch(/^data:image\/png;base64,/);
    expect(mockGetMediaMeta).toHaveBeenCalledWith("ws-1", "med_abc123");
    expect(mockResolveMediaBuffer).toHaveBeenCalledWith("ws-1", "med_abc123");
  });

  it("throws MultimodalResolutionError (400) when meta is null (not found / wrong workspace)", async () => {
    mockGetMediaMeta.mockResolvedValue(null);

    await expect(
      buildMultimodalUserContent(
        "text",
        [{ kind: "image", source: { type: "media_ref", mediaId: "med_notexist" } }],
        "ws-wrong",
      ),
    ).rejects.toThrow(MultimodalResolutionError);

    await expect(
      buildMultimodalUserContent(
        "text",
        [{ kind: "image", source: { type: "media_ref", mediaId: "med_notexist" } }],
        "ws-wrong",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws MultimodalResolutionError (400) when media has expired", async () => {
    const expiredMeta = {
      mediaId: "med_abc123",
      workspaceId: "ws-1",
      mimeType: "image/png",
      byteSize: 4,
      sha256: "deadbeef",
      storageKey: "med_abc123",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() - 1000), // in the past
    };
    mockGetMediaMeta.mockResolvedValue(expiredMeta);

    await expect(
      buildMultimodalUserContent(
        "text",
        [{ kind: "image", source: { type: "media_ref", mediaId: "med_abc123" } }],
        "ws-1",
      ),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("expired") });
  });

  it("throws MultimodalResolutionError (502) when meta exists but bytes are unavailable", async () => {
    mockGetMediaMeta.mockResolvedValue(mockMeta);
    mockResolveMediaBuffer.mockResolvedValue(null);

    await expect(
      buildMultimodalUserContent(
        "text",
        [{ kind: "image", source: { type: "media_ref", mediaId: "med_abc123" } }],
        "ws-1",
      ),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

// ---------------------------------------------------------------------------
// Mixed inline_base64 + media_ref
// ---------------------------------------------------------------------------

describe("buildMultimodalUserContent — mixed sources", () => {
  it("handles a mix of inline and media_ref attachments in order", async () => {
    mockGetMediaMeta.mockResolvedValue({
      mediaId: "med_1",
      workspaceId: "ws-mix",
      mimeType: "image/jpeg",
      byteSize: 3,
      sha256: "ff",
      storageKey: "med_1",
      createdAt: new Date(),
      expiresAt: null,
    });
    mockResolveMediaBuffer.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));

    const parts = await buildMultimodalUserContent(
      "compare these",
      [
        { kind: "image", source: { type: "inline_base64", mimeType: "image/png", data: "inlineData" } },
        { kind: "image", source: { type: "media_ref", mediaId: "med_1" } },
      ],
      "ws-mix",
    );

    expect(parts).toHaveLength(3);
    const url1 = (parts[1] as { image_url: { url: string } }).image_url.url;
    const url2 = (parts[2] as { image_url: { url: string } }).image_url.url;
    expect(url1).toBe("data:image/png;base64,inlineData");
    expect(url2).toMatch(/^data:image\/jpeg;base64,/);
  });
});

// ---------------------------------------------------------------------------
// Edge: empty attachments list
// ---------------------------------------------------------------------------

describe("buildMultimodalUserContent — edge cases", () => {
  it("returns only a text part when attachments array is empty", async () => {
    const parts = await buildMultimodalUserContent("prompt", [], "ws-1");
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: "text", text: "prompt" });
  });
});
