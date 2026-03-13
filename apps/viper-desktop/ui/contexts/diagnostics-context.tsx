import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState, useCallback } from "react";

export interface Diagnostic {
  file: string;
  line: number;
  column?: number;
  message: string;
  severity: "error" | "warning" | "info";
  source?: string;
}

/** Internal representation: Map<workspace-relative file path, Diagnostic[]> */
export type DiagnosticsMap = Map<string, Diagnostic[]>;

type DiagnosticsContextValue = {
  /** All diagnostics for the current workspace, keyed by workspace-relative path. */
  diagnostics: DiagnosticsMap;

  /**
   * Replace diagnostics for a single file.
   * Pass an empty array to clear diagnostics for that file.
   */
  setFileDiagnostics: (path: string, diagnostics: Diagnostic[]) => void;

  /** Replace the entire diagnostics map in one go (used by workspace analyzers). */
  setAllDiagnostics: (next: DiagnosticsMap) => void;

  /** Clear all diagnostics (e.g. when closing workspace or restarting worker). */
  clearAllDiagnostics: () => void;

  /** Back-compat helper used by Monaco: update error count for a file. */
  setFileErrors: (path: string, count: number) => void;

  /** Get all diagnostics for a file (empty array if none). */
  getFileDiagnostics: (filePath: string) => Diagnostic[];

  /**
   * Get aggregated counts for a file.
   * Returns { errors, warnings, info } – all zero if the file has no diagnostics.
   */
  getFileErrorCount: (filePath: string) => {
    errors: number;
    warnings: number;
    info: number;
  };
};

const DiagnosticsContext = createContext<DiagnosticsContextValue | null>(null);

export function DiagnosticsProvider({ children }: { children: ReactNode }) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsMap>(() => new Map());

  const setFileDiagnostics = useCallback((path: string, fileDiagnostics: Diagnostic[]) => {
    setDiagnostics((prev) => {
      const next = new Map(prev);
      if (!fileDiagnostics.length) {
        next.delete(path);
      } else {
        next.set(path, fileDiagnostics);
      }
      return next;
    });
  }, []);

  const setAllDiagnostics = useCallback((next: DiagnosticsMap) => {
    // Always clone to ensure React state change is detected even if caller reuses a Map.
    setDiagnostics(new Map(next));
  }, []);

  const clearAllDiagnostics = useCallback(() => {
    setDiagnostics(() => new Map());
  }, []);

  const setFileErrors = useCallback(
    (path: string, count: number) => {
      // Treat editor-provided counts as anonymous "error" diagnostics.
      // This keeps the explorer UI in sync for active files without
      // requiring Monaco to construct full Diagnostic objects.
      if (count <= 0) {
        setFileDiagnostics(path, []);
        return;
      }
      const syntheticDiagnostics: Diagnostic[] = [
        {
          file: path,
          line: 1,
          column: 1,
          message: `Editor reported ${count} error(s)`,
          severity: "error",
          source: "editor",
        },
      ];
      setFileDiagnostics(path, syntheticDiagnostics);
    },
    [setFileDiagnostics]
  );

  const getFileDiagnostics = useCallback(
    (filePath: string) => diagnostics.get(filePath) ?? [],
    [diagnostics]
  );

  const getFileErrorCount = useCallback(
    (filePath: string) => {
      const list = diagnostics.get(filePath) ?? [];
      let errors = 0;
      let warnings = 0;
      let info = 0;
      for (const d of list) {
        if (d.severity === "error") errors += 1;
        else if (d.severity === "warning") warnings += 1;
        else info += 1;
      }
      return { errors, warnings, info };
    },
    [diagnostics]
  );

  const value = useMemo<DiagnosticsContextValue>(
    () => ({
      diagnostics,
      setFileDiagnostics,
      setAllDiagnostics,
      clearAllDiagnostics,
      setFileErrors,
      getFileDiagnostics,
      getFileErrorCount,
    }),
    [
      diagnostics,
      setFileDiagnostics,
      setAllDiagnostics,
      clearAllDiagnostics,
      setFileErrors,
      getFileDiagnostics,
      getFileErrorCount,
    ]
  );

  return <DiagnosticsContext.Provider value={value}>{children}</DiagnosticsContext.Provider>;
}

export function useDiagnostics(): DiagnosticsContextValue {
  const ctx = useContext(DiagnosticsContext);
  if (!ctx) throw new Error("useDiagnostics must be used within DiagnosticsProvider");
  return ctx;
}
