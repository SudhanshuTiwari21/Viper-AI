import type { Diagnostic } from "../types";
export declare function analyzeWithLsp(rootDir: string, filePaths: string[], readFile: (relPath: string) => Promise<string>): Promise<Map<string, Diagnostic[]>>;
