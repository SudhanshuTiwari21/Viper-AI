import { useMemo } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Check, X, Undo2 } from "lucide-react";

interface MonacoDiffEditorProps {
  originalContent: string;
  modifiedContent: string;
  language: string;
  filePath: string;
  description?: string;
  onAccept: () => void;
  onReject: () => void;
}

export function MonacoDiffEditor({
  originalContent,
  modifiedContent,
  language,
  filePath,
  description,
  onAccept,
  onReject,
}: MonacoDiffEditorProps) {
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
      case "json":
        return "json";
      case "css":
        return "css";
      case "html":
        return "html";
      case "md":
      case "markdown":
        return "markdown";
      default:
        return "plaintext";
    }
  }, [language]);

  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 flex-shrink-0 border-b"
        style={{
          height: 36,
          borderColor: "var(--viper-border)",
          background: "var(--viper-bg)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-[#e5e7eb] truncate">
            {fileName}
          </span>
          <span className="text-2xs text-[#6b7280] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
            AI Changes
          </span>
          {description && (
            <span className="text-2xs text-[#9ca3af] truncate">{description}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            onClick={onAccept}
          >
            <Check size={12} />
            Accept
          </button>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-[var(--viper-border)] text-[#9ca3af] hover:bg-white/[0.04] hover:text-[#e5e7eb] transition-colors"
            onClick={onReject}
          >
            <X size={12} />
            Reject
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <DiffEditor
          height="100%"
          theme="vs-dark"
          language={mappedLang}
          original={originalContent}
          modified={modifiedContent}
          loading={null}
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: "on",
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            smoothScrolling: true,
            scrollBeyondLastLine: false,
            padding: { top: 8, bottom: 8 },
            automaticLayout: true,
            renderOverviewRuler: false,
            diffWordWrap: "on",
          }}
        />
      </div>
    </div>
  );
}

interface UndoAIBarProps {
  lastFile: string;
  onUndo: () => void;
}

export function UndoAIBar({ lastFile, onUndo }: UndoAIBarProps) {
  const fileName = lastFile.split("/").pop() ?? lastFile;
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 flex-shrink-0 border-t"
      style={{
        borderColor: "var(--viper-border)",
        background: "rgba(234, 179, 8, 0.04)",
      }}
    >
      <span className="text-2xs text-[#9ca3af]">
        AI edited {fileName}
      </span>
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
        onClick={onUndo}
      >
        <Undo2 size={10} />
        Undo AI Change
      </button>
    </div>
  );
}
