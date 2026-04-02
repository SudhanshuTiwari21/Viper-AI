/**
 * E.23 — Local-disk storage driver for media bytes.
 *
 * Storage directory resolution order:
 *   1. VIPER_MEDIA_STORAGE_DIR env var (absolute or relative to cwd)
 *   2. <os.tmpdir()>/.viper-media
 *
 * storageKey is an opaque string issued by media-store (currently the mediaId itself).
 * The driver does NOT expose storage paths in responses or logs (no home-dir leaks).
 *
 * Cloud driver (S3/GCS): swap writeMediaBytes / readMediaBytes / deleteMediaBytes in E.23.1.
 */

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/** Resolved storage root — never logged raw (may contain home dir). */
export function getMediaStorageDir(): string {
  const env = process.env.VIPER_MEDIA_STORAGE_DIR;
  if (env?.trim()) return path.resolve(env.trim());
  return path.join(os.tmpdir(), ".viper-media");
}

async function ensureDir(): Promise<string> {
  const dir = getMediaStorageDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Resolves a storageKey to an absolute path; throws if path traversal is attempted. */
function safePath(dir: string, storageKey: string): string {
  // storageKey is server-generated (mediaId format med_<hex>) — validate defensively anyway.
  const resolved = path.resolve(dir, storageKey);
  const resolvedDir = path.resolve(dir);
  if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
    throw new Error("Invalid storageKey: path traversal detected");
  }
  return resolved;
}

export async function writeMediaBytes(storageKey: string, data: Buffer): Promise<void> {
  const dir = await ensureDir();
  await writeFile(safePath(dir, storageKey), data);
}

export async function readMediaBytes(storageKey: string): Promise<Buffer | null> {
  const dir = getMediaStorageDir();
  try {
    return await readFile(safePath(dir, storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function deleteMediaBytes(storageKey: string): Promise<void> {
  const dir = getMediaStorageDir();
  try {
    await unlink(safePath(dir, storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
