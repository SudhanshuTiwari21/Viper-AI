import { useMemo, useRef, useEffect } from "react";
import Editor, { OnChange, OnMount } from "@monaco-editor/react";

interface MonacoEditorProps {
  language: string;
  value: string;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  /** Workspace-relative path of the current file (for diagnostics). */
  currentFilePath?: string | null;
  /** Called when error count for the current file changes (from Monaco markers). */
  onDiagnosticsChange?: (path: string, errorCount: number) => void;
}

export function MonacoEditor({
  language,
  value,
  onChange,
  onCursorChange,
  currentFilePath,
  onDiagnosticsChange,
}: MonacoEditorProps) {
  const markersDisposableRef = useRef<{ dispose(): void } | null>(null);

  useEffect(() => {
    return () => {
      markersDisposableRef.current?.dispose();
      markersDisposableRef.current = null;
    };
  }, []);

  const handleChange: OnChange = (val) => {
    onChange?.(val ?? "");
  };

  const handleMount: OnMount = useMemo(() => {
    return (editor, monaco) => {
      if (onCursorChange) {
        editor.onDidChangeCursorPosition((e) => {
          onCursorChange(e.position.lineNumber, e.position.column);
        });
        const pos = editor.getPosition();
        if (pos) onCursorChange(pos.lineNumber, pos.column);
      }

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
    };
  }, [onCursorChange, currentFilePath, onDiagnosticsChange]);

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
      }}
    />
  );
}

