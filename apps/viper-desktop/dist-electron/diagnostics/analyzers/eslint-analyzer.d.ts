import type { Diagnostic } from "../types";
/**
 * ESLint analyzer. Uses dynamic import so the app still runs if ESLint is not installed.
 */
export declare function analyzeEslint(rootDir: string, filePaths: string[]): Promise<Map<string, Diagnostic[]>>;
