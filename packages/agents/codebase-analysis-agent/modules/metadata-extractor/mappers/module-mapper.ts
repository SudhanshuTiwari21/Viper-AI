import * as path from "path";

/**
 * Map file path to logical module. Prefer Repo Scanner data when provided to avoid
 * conflicting module definitions; only derive from path when module is missing.
 * if module provided → use it; else → derive from path (last directory segment).
 */
export function mapFileToModule(file: string, existingModule?: string): { file: string; module: string } {
  if (existingModule && existingModule !== "root" && typeof existingModule === "string") {
    return { file, module: existingModule };
  }
  const dir = path.dirname(file);
  const segments = dir.split(path.sep).filter(Boolean);
  if (segments.length === 0) return { file, module: "root" };
  return { file, module: segments[segments.length - 1] ?? "root" };
}
