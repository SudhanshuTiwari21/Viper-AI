import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { mediaRoutes } from "./media.routes.js";
import { __clearMediaMemoryForTests } from "../lib/media-store.js";

// Use in-memory store (no DATABASE_URL).
const origDbUrl = process.env.DATABASE_URL;
beforeEach(() => {
  delete process.env.DATABASE_URL;
  __clearMediaMemoryForTests();
});

// Minimal magic-byte buffers
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function toBase64(buf: Buffer): string {
  return buf.toString("base64");
}

describe("POST /media/upload (JSON) + GET /media/:mediaId", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    app = Fastify({ logger: false });
    await app.register(mediaRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    __clearMediaMemoryForTests();
    if (origDbUrl !== undefined) process.env.DATABASE_URL = origDbUrl;
    else delete process.env.DATABASE_URL;
  });

  it("upload PNG → 200 with mediaId + round-trip GET returns bytes", async () => {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "ws-test",
        mimeType: "image/png",
        dataBase64: toBase64(PNG_MAGIC),
      }),
    });
    expect(uploadRes.statusCode).toBe(200);

    const body = JSON.parse(uploadRes.body) as {
      mediaId: string;
      mimeType: string;
      byteSize: number;
      sha256: string;
    };
    expect(body.mediaId).toMatch(/^med_[0-9a-f]{24}$/);
    expect(body.mimeType).toBe("image/png");
    expect(body.byteSize).toBe(PNG_MAGIC.length);
    expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);

    // GET the bytes back
    const getRes = await app.inject({
      method: "GET",
      url: `/media/${body.mediaId}?workspace_id=ws-test`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.headers["content-type"]).toBe("image/png");
    expect(Buffer.from(getRes.rawPayload).equals(PNG_MAGIC)).toBe(true);
  });

  it("upload JPEG → 200, GET returns correct Content-Type", async () => {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "ws-test",
        mimeType: "image/jpeg",
        dataBase64: toBase64(JPEG_MAGIC),
      }),
    });
    expect(uploadRes.statusCode).toBe(200);
    const { mediaId } = JSON.parse(uploadRes.body) as { mediaId: string };

    const getRes = await app.inject({
      method: "GET",
      url: `/media/${mediaId}?workspace_id=ws-test`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.headers["content-type"]).toBe("image/jpeg");
  });

  it("GET with wrong workspace_id → 404 (workspace isolation)", async () => {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "ws-owner",
        mimeType: "image/png",
        dataBase64: toBase64(PNG_MAGIC),
      }),
    });
    const { mediaId } = JSON.parse(uploadRes.body) as { mediaId: string };

    const getRes = await app.inject({
      method: "GET",
      url: `/media/${mediaId}?workspace_id=ws-attacker`,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("GET unknown mediaId → 404", async () => {
    const getRes = await app.inject({
      method: "GET",
      url: "/media/med_doesnotexist000000000000?workspace_id=ws-test",
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("GET without workspace_id → 400", async () => {
    const getRes = await app.inject({
      method: "GET",
      url: "/media/med_someid",
    });
    expect(getRes.statusCode).toBe(400);
  });

  it("upload with missing workspace_id → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mimeType: "image/png",
        dataBase64: toBase64(PNG_MAGIC),
      }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("upload with disallowed mimeType → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "ws-test",
        mimeType: "image/bmp",
        dataBase64: toBase64(PNG_MAGIC),
      }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("upload with MIME/magic mismatch → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "ws-test",
        // Claim PNG but send JPEG magic bytes → should be rejected
        mimeType: "image/png",
        dataBase64: toBase64(JPEG_MAGIC),
      }),
    });
    expect(res.statusCode).toBe(400);
  });

  it("upload oversize file → 413", async () => {
    // Build a fake PNG-magic buffer that exceeds 6 MiB limit
    const OVER_LIMIT = 7 * 1024 * 1024;
    const bigBuf = Buffer.alloc(OVER_LIMIT);
    PNG_MAGIC.copy(bigBuf); // put valid magic bytes at the start
    const res = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "ws-test",
        mimeType: "image/png",
        dataBase64: bigBuf.toString("base64"),
      }),
    });
    expect(res.statusCode).toBe(413);
  });

  it("GET using x-workspace-id header instead of query param", async () => {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/media/upload",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "ws-header-test",
        mimeType: "image/png",
        dataBase64: toBase64(PNG_MAGIC),
      }),
    });
    const { mediaId } = JSON.parse(uploadRes.body) as { mediaId: string };

    const getRes = await app.inject({
      method: "GET",
      url: `/media/${mediaId}`,
      headers: { "x-workspace-id": "ws-header-test" },
    });
    expect(getRes.statusCode).toBe(200);
  });
});
