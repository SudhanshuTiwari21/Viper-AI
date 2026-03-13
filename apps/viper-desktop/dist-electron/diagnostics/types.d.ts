/** Shared diagnostic shape used by the diagnostics worker and UI. */
export interface Diagnostic {
    file: string;
    line: number;
    column?: number;
    message: string;
    severity: "error" | "warning" | "info";
    source?: string;
}
/** Serializable form for IPC: array of [filePath, diagnostics[]]. */
export type SerializedDiagnosticsMap = Array<[string, Diagnostic[]]>;
