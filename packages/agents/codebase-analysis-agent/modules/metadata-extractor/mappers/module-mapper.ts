import * as path from "path";

/**
 * Map file path to logical module. If module already provided (e.g. from Repo Scanner), confirm or adjust.
 * Example: src/auth/login.ts → auth, src/users/service.ts → users.
 */
export function mapFileToModule(file: string, existingModule?: string): { file: string; module: string } {
  const dir = path.dirname(file);
  const segments = dir.split(path.sep).filter(Boolean);
  if (existingModule && existingModule !== "root" && typeof existingModule === "string") {
    return { file, module: existingModule };
  }
  if (segments.length === 0) return { file, module: "root" };
  return { file, module: segments[segments.length - 1] ?? "root" };
}
