import type { Diagnostic } from "../types";
/**
 * TypeScript analyzer using the TypeScript compiler API.
 * Discovers tsconfig.json, creates a program, and returns getPreEmitDiagnostics().
 */
export declare function analyzeTypeScript(rootDir: string, filePaths: string[]): Promise<Map<string, Diagnostic[]>>;
