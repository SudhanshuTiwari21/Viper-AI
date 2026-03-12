import { useMemo } from "react";
import Editor, { OnChange } from "@monaco-editor/react";

interface MonacoEditorProps {
  language: string;
  value: string;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
}

export function MonacoEditor({ language, value, onChange, onCursorChange }: MonacoEditorProps) {
  const handleChange: OnChange = (val) => {
    onChange?.(val ?? "");
  };

  const handleMount = useMemo(() => {
    if (!onCursorChange) return undefined;
    return (editor: import("monaco-editor").editor.IStandaloneCodeEditor) => {
      editor.onDidChangeCursorPosition((e) => {
        onCursorChange(e.position.lineNumber, e.position.column);
      });
      const pos = editor.getPosition();
      if (pos) onCursorChange(pos.lineNumber, pos.column);
    };
  }, [onCursorChange]);

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

