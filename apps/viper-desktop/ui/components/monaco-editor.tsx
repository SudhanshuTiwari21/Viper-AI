import { useMemo } from "react";
import Editor, { OnChange } from "@monaco-editor/react";

interface MonacoEditorProps {
  language: string;
  value: string;
  onChange?: (value: string) => void;
}

export function MonacoEditor({ language, value, onChange }: MonacoEditorProps) {
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

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={mappedLang}
      value={value}
      onChange={handleChange}
      loading={null}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        smoothScrolling: true,
        automaticLayout: true,
      }}
    />
  );
}

