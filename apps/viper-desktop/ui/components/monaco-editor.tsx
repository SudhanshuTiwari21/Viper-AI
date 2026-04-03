/**
 * Monaco editor component.
 *
 * G.36: Registers an InlineCompletionsProvider for ghost-text completions.
 *   - Controlled by VITE_INLINE_COMPLETION_ENABLED (default off at build time).
 *   - Debounced 300ms; AbortController cancels in-flight requests on new triggers.
 *   - Provider registered once on mount, disposed on unmount.
 *   - Supports: typescript, javascript, python, go, rust, java, plaintext.
 *   - Tab accepts the ghost-text suggestion (Monaco default behavior).
 */

import { useMemo, useRef, useEffect } from "react";
import Editor, { OnChange, OnMount } from "@monaco-editor/react";
import { fetchInlineCompletion } from "../services/agent-api.js";

// ---------------------------------------------------------------------------
// G.36: Inline completion kill-switch — read once at module load.
// Using VITE_INLINE_COMPLETION_ENABLED so the build can strip it; if absent
// the feature is off by default (production-safe).
// ---------------------------------------------------------------------------
const INLINE_COMPLETION_ENABLED =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_INLINE_COMPLETION_ENABLED?: string } }).env
      ?.VITE_INLINE_COMPLETION_ENABLED) === "true" ||
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_INLINE_COMPLETION_ENABLED?: string } }).env
      ?.VITE_INLINE_COMPLETION_ENABLED) === "1";

/** Languages for which we register inline completions. */
const INLINE_COMPLETION_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "plaintext",
];

/** Debounce delay in ms before firing the completion request. */
const DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonacoEditorProps {
  language: string;
  value: string;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  /** Workspace-relative path of the current file (for diagnostics). */
  currentFilePath?: string | null;
  /** Called when error count for the current file changes (from Monaco markers). */
  onDiagnosticsChange?: (path: string, errorCount: number) => void;
  /** Workspace root path — forwarded to the inline-complete backend. */
  workspacePath?: string | null;
  /** G.37: Callback that receives the editor instance so parent can read selection. */
  onEditorInstance?: (editor: Parameters<OnMount>[0] | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonacoEditor({
  language,
  value,
  onChange,
  onCursorChange,
  currentFilePath,
  onDiagnosticsChange,
  workspacePath,
  onEditorInstance,
}: MonacoEditorProps) {
  const markersDisposableRef = useRef<{ dispose(): void } | null>(null);
  /** Holds all provider disposables so we can clean up on unmount. */
  const inlineDisposablesRef = useRef<{ dispose(): void }[]>([]);
  /** AbortController for the most recent in-flight completion request. */
  const abortRef = useRef<AbortController | null>(null);
  /** setTimeout handle for the debounce timer. */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      markersDisposableRef.current?.dispose();
      markersDisposableRef.current = null;
      // Dispose all inline completion providers on unmount.
      for (const d of inlineDisposablesRef.current) d.dispose();
      inlineDisposablesRef.current = [];
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange: OnChange = (val) => {
    onChange?.(val ?? "");
  };

  const mappedLang = useMemo(() => {
    switch (language.toLowerCase()) {
      case "ts":
      case "typescript":
        return "typescript";
      case "js":
      case "javascript":
        return "javascript";
      case "python":
      case "py":
        return "python";
      case "go":
        return "go";
      case "rust":
      case "rs":
        return "rust";
      case "java":
        return "java";
      default:
        return "plaintext";
    }
  }, [language]);

  const handleMount: OnMount = useMemo(() => {
    return (editor, monaco) => {
      // ----- Cursor position tracking -----
      if (onCursorChange) {
        editor.onDidChangeCursorPosition((e) => {
          onCursorChange(e.position.lineNumber, e.position.column);
        });
        const pos = editor.getPosition();
        if (pos) onCursorChange(pos.lineNumber, pos.column);
      }

      // ----- Diagnostics (markers) -----
      if (currentFilePath != null && currentFilePath !== "" && onDiagnosticsChange) {
        const update = () => {
          const model = editor.getModel();
          if (!model) return;
          const markers = monaco.editor.getModelMarkers({ resource: model.uri });
          const errors = markers.filter(
            (m) => m.severity === monaco.MarkerSeverity.Error
          ).length;
          onDiagnosticsChange(currentFilePath, errors);
        };
        update();
        markersDisposableRef.current = monaco.editor.onDidChangeMarkers(update);
      }

      // ----- G.37: Expose editor instance + register keybinding -----
      onEditorInstance?.(editor);

      editor.addAction({
        id: "viper.aiEditSelection",
        label: "Viper: AI Edit Selection",
        keybindings: [
          // Cmd+Shift+E (Mac) / Ctrl+Shift+E (Windows/Linux)
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
        ],
        contextMenuGroupId: "viper",
        contextMenuOrder: 1,
        run: () => {
          window.dispatchEvent(new CustomEvent("viper:trigger-ai-edit"));
        },
      });

      // ----- G.36: Inline completions provider -----
      if (!INLINE_COMPLETION_ENABLED) return;

      // Dispose any previously registered providers (language change guard).
      for (const d of inlineDisposablesRef.current) d.dispose();
      inlineDisposablesRef.current = [];

      for (const langId of INLINE_COMPLETION_LANGUAGES) {
        const disposable = monaco.languages.registerInlineCompletionsProvider(langId, {
          provideInlineCompletions: async (_model, position, _context, token) => {
            // Cancel previous request
            if (debounceRef.current) clearTimeout(debounceRef.current);
            abortRef.current?.abort();

            const model = editor.getModel();
            if (!model) return { items: [] };

            const fullText = model.getValue();
            const offset = model.getOffsetAt(position);
            const textBeforeCursor = fullText.slice(0, offset);
            const textAfterCursor = fullText.slice(offset, offset + 512);

            // Debounce: wait DEBOUNCE_MS before firing
            await new Promise<void>((resolve, reject) => {
              if (token.isCancellationRequested) {
                reject(new Error("cancelled"));
                return;
              }
              debounceRef.current = setTimeout(() => {
                if (token.isCancellationRequested) reject(new Error("cancelled"));
                else resolve();
              }, DEBOUNCE_MS);
              // Also cancel on Monaco cancellation token
              token.onCancellationRequested(() => {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                reject(new Error("cancelled"));
              });
            }).catch(() => null);

            if (token.isCancellationRequested) return { items: [] };

            const abort = new AbortController();
            abortRef.current = abort;

            // Cancel via Monaco token too
            token.onCancellationRequested(() => abort.abort());

            const filePath = currentFilePath ?? model.uri.path ?? "unknown";
            const wsPath = workspacePath ?? "/";

            const result = await fetchInlineCompletion(
              {
                workspacePath: wsPath,
                filePath,
                languageId: langId,
                textBeforeCursor,
                textAfterCursor,
                cursorLine: position.lineNumber,
                cursorColumn: position.column,
              },
              abort.signal,
            );

            if (!result.text || token.isCancellationRequested) return { items: [] };

            return {
              items: [
                {
                  insertText: result.text,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                },
              ],
            };
          },
          freeInlineCompletions: () => {
            // No-op — Monaco calls this when it's done with the items
          },
        });

        inlineDisposablesRef.current.push(disposable);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCursorChange, currentFilePath, onDiagnosticsChange, workspacePath, onEditorInstance]);

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={mappedLang}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      loading={null}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        lineNumbers: "on",
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 3,
        renderLineHighlight: "all",
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        padding: { top: 8, bottom: 8 },
        automaticLayout: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        bracketPairColorization: { enabled: true },
        renderWhitespace: "selection",
        // G.36: show inline completions as ghost text (Tab to accept)
        inlineSuggest: {
          enabled: INLINE_COMPLETION_ENABLED,
          mode: "prefix",
        },
      }}
    />
  );
}
