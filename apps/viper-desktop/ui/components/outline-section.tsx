import { useMemo } from "react";
import { useCurrentFile } from "../contexts/current-file-context";
import type { SidebarView } from "./activity-bar";

export interface DocumentSymbol {
  name: string;
  kind: "function" | "class" | "method" | "interface" | "variable" | "other";
  line?: number;
}

/** Simple regex-based outline extraction when Monaco document symbols are not available */
function extractSymbols(content: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // function name( or name (
    const fnMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
    if (fnMatch) {
      symbols.push({ name: fnMatch[1], kind: "function", line: i + 1 });
      continue;
    }
    const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
    if (arrowMatch) {
      symbols.push({ name: arrowMatch[1], kind: "function", line: i + 1 });
      continue;
    }
    const classMatch = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({ name: classMatch[1], kind: "class", line: i + 1 });
      continue;
    }
    const methodMatch = trimmed.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::|{)/);
    if (methodMatch && trimmed.startsWith(" ") && !trimmed.startsWith("  ")) {
      symbols.push({ name: methodMatch[1], kind: "method", line: i + 1 });
    }
  }
  return symbols;
}

export interface OutlineSectionProps {
  activeView: SidebarView;
  /** Optional: symbols from Monaco document symbol provider when available */
  symbols?: DocumentSymbol[] | null;
}

export function OutlineSection({ activeView, symbols: propSymbols }: OutlineSectionProps) {
  const { currentFile } = useCurrentFile();

  const symbols = useMemo(() => {
    if (propSymbols && propSymbols.length > 0) return propSymbols;
    if (currentFile.content) return extractSymbols(currentFile.content);
    return [];
  }, [currentFile.content, propSymbols]);

  if (activeView !== "outline") return null;

  return (
    <div className="flex flex-col h-full bg-[#252526]">
      <div className="flex items-center h-9 px-3 flex-shrink-0 border-b border-[#3c3c3c]">
        <span className="text-[#bbbbbb] text-[11px] font-medium uppercase tracking-wider">
          Outline
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 py-1 px-2">
        {!currentFile.path && (
          <p className="text-[#858585] text-[12px]">Open a file to see its outline.</p>
        )}
        {currentFile.path && symbols.length === 0 && (
          <p className="text-[#858585] text-[12px]">No symbols found.</p>
        )}
        {symbols.length > 0 && (
          <ul className="text-[12px] text-[#cccccc] space-y-0.5">
            {symbols.map((s, i) => (
              <li
                key={`${s.name}-${s.line ?? i}`}
                className="flex items-center gap-2 py-0.5 px-1.5 rounded hover:bg-white/[0.06] cursor-pointer font-mono truncate"
                title={s.line ? `Line ${s.line}` : undefined}
              >
                <span className="text-[#6b6b6b] flex-shrink-0 text-[10px]">
                  {s.kind === "class" ? "C" : s.kind === "function" ? "f" : "m"}
                </span>
                <span className="truncate">{s.name}</span>
                {s.line != null && (
                  <span className="text-[#6b6b6b] text-[10px] flex-shrink-0 ml-auto">
                    {s.line}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
