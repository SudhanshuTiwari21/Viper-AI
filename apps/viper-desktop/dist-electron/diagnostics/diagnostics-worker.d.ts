import type { Diagnostic, SerializedDiagnosticsMap } from "./types";
/** Collect all analyzable file paths under root (same rules as workspace tree). */
export declare function collectFilePaths(rootDir: string): Promise<string[]>;
/** Run all analyzers for the given files and merge results into a single map. */
export declare function runAnalyzers(rootDir: string, filePaths: string[], readFile: (relPath: string) => Promise<string>): Promise<Map<string, Diagnostic[]>>;
/** Serialize map for IPC. */
export declare function serializeDiagnosticsMap(map: Map<string, Diagnostic[]>): SerializedDiagnosticsMap;
