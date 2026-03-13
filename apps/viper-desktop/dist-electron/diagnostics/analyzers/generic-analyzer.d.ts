import type { Diagnostic } from "../types";
/**
 * Fallback analyzer: no language-specific tooling.
 * Detects TODO/FIXME-style comments as warnings.
 */
export declare function analyzeGeneric(filePath: string, content: string): Diagnostic[];
