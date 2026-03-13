import type { Diagnostic } from "../types";
/** Run pyflakes on a single file and parse output into diagnostics. */
export declare function analyzePython(rootDir: string, relPath: string, _content: string): Promise<Diagnostic[]>;
