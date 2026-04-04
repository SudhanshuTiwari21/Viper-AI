/**
 * E.23 — High-level media store.
 *
 * Persistence strategy (same pattern as D.20/D.21 stores):
 *   • DATABASE_URL absent → in-memory Maps for both metadata and bytes (dev/test only).
 *   • DATABASE_URL present → Postgres for metadata + local-disk for bytes.
 *
 * Key design points:
 *   • mediaId is server-issued: `med_` + 24 random hex chars (96-bit entropy, URL-safe).
 *   • storage_key equals mediaId — one flat file per object under VIPER_MEDIA_STORAGE_DIR.
 *   • TTL: if VIPER_MEDIA_TTL_HOURS is set, expires_at is written; expired objects return null.
 *   • MIME validation: declared mimeType must be in INLINE_IMAGE_MIME_ALLOWLIST; magic-bytes
 *     sniff is run on the first bytes; if the sniff disagrees with the declared type, the
 *     upload is rejected (prevents MIME spoofing).
 *   • resolveMediaBuffer is the E.24 hook — callable from assistant.service once vision is wired.
 */

import crypto from "node:crypto";
import {
  insertChatMedia,
  getChatMedia,
  deleteChatMedia,
  type ChatMediaRow,
} from "@repo/database";
import { getPool } from "@repo/database";
import { writeMediaBytes, readMediaBytes, deleteMediaBytes } from "./media-storage.js";
import { INLINE_IMAGE_MIME_ALLOWLIST } from "../validators/request.schemas.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AllowedMimeType = (typeof INLINE_IMAGE_MIME_ALLOWLIST)[number];

export interface MediaObject {
  mediaId: string;
  workspaceId: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface UploadMediaParams {
  workspaceId: string;
  mimeType: string;
  data: Buffer;
}

// ---------------------------------------------------------------------------
// MIME validation helpers
// ---------------------------------------------------------------------------

/**
 * Returns the MIME type inferred from the first magic bytes, or null if unknown.
 * Handles the four types in INLINE_IMAGE_MIME_ALLOWLIST.
 */
export function sniffMimeType(buf: Buffer): string | null {
  if (buf.length >= 4 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 &&
      buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 4 &&
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif";
  }
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

/**
 * Validates that:
 *   1. `mimeType` is in the allowlist.
 *   2. Magic-bytes sniff either agrees or is inconclusive (null = unknown format, accepted).
 *
 * Returns an error string on rejection, or null on success.
 */
export function validateMimeType(mimeType: string, data: Buffer): string | null {
  const allowed: readonly string[] = INLINE_IMAGE_MIME_ALLOWLIST;
  if (!allowed.includes(mimeType)) {
    return `mimeType "${mimeType}" is not allowed; accepted: ${INLINE_IMAGE_MIME_ALLOWLIST.join(", ")}`;
  }
  const sniffed = sniffMimeType(data);
  if (sniffed !== null && sniffed !== mimeType) {
    return `MIME mismatch: declared "${mimeType}" but magic bytes indicate "${sniffed}"`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// In-memory fallback (no DATABASE_URL)
// ---------------------------------------------------------------------------

const memoryMeta = new Map<string, MediaObject>();
const memoryBytes = new Map<string, Buffer>();

function usePostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateMediaId(): string {
  return `med_${crypto.randomBytes(12).toString("hex")}`;
}

function computeSha256(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getMediaTtlHours(): number | null {
  const v = process.env.VIPER_MEDIA_TTL_HOURS;
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function rowToMeta(row: ChatMediaRow): MediaObject {
  return {
    mediaId: row.id,
    workspaceId: row.workspace_id,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    storageKey: row.storage_key,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store a new media object. Validates MIME + magic bytes before persisting.
 * Throws a `MediaValidationError` on invalid input.
 */
export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export async function saveMedia(params: UploadMediaParams): Promise<MediaObject> {
  const mimeErr = validateMimeType(params.mimeType, params.data);
  if (mimeErr) throw new MediaValidationError(mimeErr);

  const mediaId = generateMediaId();
  const sha256 = computeSha256(params.data);
  const byteSize = params.data.length;
  const ttlHours = getMediaTtlHours();
  const createdAt = new Date();
  const expiresAt = ttlHours ? new Date(createdAt.getTime() + ttlHours * 3_600_000) : null;
  const storageKey = mediaId;

  const meta: MediaObject = {
    mediaId,
    workspaceId: params.workspaceId,
    mimeType: params.mimeType,
    byteSize,
    sha256,
    storageKey,
    createdAt,
    expiresAt,
  };

  if (!usePostgres()) {
    memoryBytes.set(mediaId, params.data);
    memoryMeta.set(mediaId, meta);
    return meta;
  }

  await writeMediaBytes(storageKey, params.data);
  await insertChatMedia(getPool(), {
    id: mediaId,
    workspace_id: params.workspaceId,
    mime_type: params.mimeType,
    byte_size: byteSize,
    sha256,
    storage_key: storageKey,
    expires_at: expiresAt,
  });
  return meta;
}

/**
 * Returns metadata for a media object, or null if not found or workspace mismatch.
 * Does NOT check expiry — callers should check `expiresAt` if they care.
 */
export async function getMediaMeta(
  workspaceId: string,
  mediaId: string,
): Promise<MediaObject | null> {
  if (!usePostgres()) {
    const m = memoryMeta.get(mediaId);
    if (!m || m.workspaceId !== workspaceId) return null;
    return m;
  }
  const row = await getChatMedia(getPool(), mediaId, workspaceId);
  if (!row) return null;
  return rowToMeta(row);
}

/**
 * E.24 hook: load a media object's bytes by workspace + mediaId.
 * Returns null if:
 *   • Not found or workspace mismatch.
 *   • Object is expired (expiresAt < now).
 */
export async function resolveMediaBuffer(
  workspaceId: string,
  mediaId: string,
): Promise<Buffer | null> {
  const meta = await getMediaMeta(workspaceId, mediaId);
  if (!meta) return null;
  if (meta.expiresAt && meta.expiresAt < new Date()) return null;

  if (!usePostgres()) {
    return memoryBytes.get(mediaId) ?? null;
  }
  return readMediaBytes(meta.storageKey);
}

/** Delete a media object. Returns false if not found or workspace mismatch. */
export async function deleteMedia(workspaceId: string, mediaId: string): Promise<boolean> {
  if (!usePostgres()) {
    const m = memoryMeta.get(mediaId);
    if (!m || m.workspaceId !== workspaceId) return false;
    memoryMeta.delete(mediaId);
    memoryBytes.delete(mediaId);
    return true;
  }
  const meta = await getMediaMeta(workspaceId, mediaId);
  if (!meta) return false;
  await deleteMediaBytes(meta.storageKey);
  await deleteChatMedia(getPool(), mediaId, workspaceId);
  return true;
}

/** Test helper — clear in-memory state between test cases. */
export function __clearMediaMemoryForTests(): void {
  memoryMeta.clear();
  memoryBytes.clear();
}
