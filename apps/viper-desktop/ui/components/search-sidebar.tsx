import { useState, useCallback, useEffect, useRef } from "react";
import { Search, FileText, X, ChevronRight, Loader2, Replace, ChevronDown } from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import type { FileNode } from "../services/filesystem";
import { fsApi } from "../services/filesystem";

interface SearchMatch {
  filePath: string;
  line: number;
  content: string;
}

interface FileSearchResult {
  filePath: string;
  matches: SearchMatch[];
}

function flattenTree(nodes: FileNode[], prefix = ""): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (!node.isDirectory) {
      result.push(fullPath);
    }
    if (node.children) {
      result.push(...flattenTree(node.children, fullPath));
    }
  }
  return result;
}

const SEARCHABLE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "json", "md", "css", "scss", "html",
  "py", "go", "rs", "java", "yaml", "yml", "toml", "txt", "sql",
  "sh", "bash", "zsh", "env", "xml", "svg", "graphql", "prisma",
]);

function isSearchableFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return SEARCHABLE_EXTENSIONS.has(ext);
}

export function SearchSidebar() {
  const { workspace } = useWorkspaceContext();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [replaceValue, setReplaceValue] = useState("");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async () => {
    if (!workspace || !query.trim()) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setSearching(true);
    try {
      const allFiles = flattenTree(workspace.tree).filter(isSearchableFile);
      const grouped: FileSearchResult[] = [];
      let totalMatches = 0;
      const maxTotal = 500;

      for (const filePath of allFiles) {
        if (abort.signal.aborted || totalMatches >= maxTotal) break;

        let content: string;
        try {
          content = await fsApi.readFile(workspace.root, filePath);
        } catch {
          continue;
        }

        const lines = content.split("\n");
        const fileMatches: SearchMatch[] = [];

        for (let i = 0; i < lines.length; i++) {
          if (totalMatches >= maxTotal) break;
          const line = lines[i]!;
          const hay = caseSensitive ? line : line.toLowerCase();
          const needle = caseSensitive ? query : query.toLowerCase();

          let found = false;
          if (useRegex) {
            try {
              const re = new RegExp(query, caseSensitive ? "" : "i");
              found = re.test(line);
            } catch {
              found = hay.includes(needle);
            }
          } else if (wholeWord) {
            const re = new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, caseSensitive ? "" : "i");
            found = re.test(line);
          } else {
            found = hay.includes(needle);
          }

          if (found) {
            fileMatches.push({ filePath, line: i + 1, content: line.trim() });
            totalMatches++;
          }
        }

        if (fileMatches.length > 0) {
          grouped.push({ filePath, matches: fileMatches });
        }
      }

      if (!abort.signal.aborted) {
        setResults(grouped);
        setExpandedFiles(new Set(grouped.slice(0, 5).map((g) => g.filePath)));
      }
    } finally {
      if (!abort.signal.aborted) {
        setSearching(false);
      }
    }
  }, [workspace, query, caseSensitive, wholeWord, useRegex]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(doSearch, 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const openFile = useCallback(
    (filePath: string) => {
      if (!workspace) return;
      fsApi.readFile(workspace.root, filePath).then((content) => {
        window.dispatchEvent(
          new CustomEvent("viper:open-file", {
            detail: { root: workspace.root, path: filePath, content },
          }),
        );
      }).catch(() => {});
    },
    [workspace],
  );

  const replaceInFile = useCallback(
    async (filePath: string) => {
      if (!workspace || !query.trim()) return;
      try {
        const content = await fsApi.readFile(workspace.root, filePath);
        let replaced: string;
        if (useRegex) {
          try {
            const re = new RegExp(query, `g${caseSensitive ? "" : "i"}`);
            replaced = content.replace(re, replaceValue);
          } catch {
            replaced = content.split(query).join(replaceValue);
          }
        } else if (wholeWord) {
          const re = new RegExp(
            `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            `g${caseSensitive ? "" : "i"}`,
          );
          replaced = content.replace(re, replaceValue);
        } else if (caseSensitive) {
          replaced = content.split(query).join(replaceValue);
        } else {
          const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          replaced = content.replace(re, replaceValue);
        }
        if (replaced !== content) {
          await fsApi.writeFile(workspace.root, filePath, replaced);
        }
      } catch {}
    },
    [workspace, query, replaceValue, caseSensitive, wholeWord, useRegex],
  );

  const replaceAll = useCallback(async () => {
    if (!workspace || !query.trim() || results.length === 0) return;
    setReplacing(true);
    try {
      for (const group of results) {
        await replaceInFile(group.filePath);
      }
      setResults([]);
    } finally {
      setReplacing(false);
    }
  }, [workspace, query, results, replaceInFile]);

  const totalMatches = results.reduce((s, r) => s + r.matches.length, 0);

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ background: "var(--viper-sidebar)" }}
    >
      <div
        className="flex items-center h-9 px-2 flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Search
        </span>
        <button
          type="button"
          className={`ml-auto p-1 rounded transition-colors ${
            replaceOpen ? "text-[var(--viper-accent)]" : "text-[#6b7280] hover:text-[#9ca3af]"
          }`}
          title="Toggle Replace"
          onClick={() => setReplaceOpen((v) => !v)}
        >
          <ChevronDown size={13} className={replaceOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>

      <div className="px-2 pt-2 pb-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-1 rounded border px-1.5 py-1"
          style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
        >
          <Search size={13} className="text-[#6b7280] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 min-w-0 bg-transparent text-xs text-[#e5e7eb] outline-none placeholder:text-[#4b5563]"
            placeholder="Search in files..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="shrink-0 text-[#6b7280] hover:text-[#e5e7eb]"
              onClick={() => { setQuery(""); setResults([]); }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              caseSensitive
                ? "border-[var(--viper-accent)] text-[var(--viper-accent)] bg-[var(--viper-accent)]/10"
                : "border-[var(--viper-border)] text-[#6b7280] hover:text-[#9ca3af]"
            }`}
            title="Match Case"
            onClick={() => setCaseSensitive((v) => !v)}
          >
            Aa
          </button>
          <button
            type="button"
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              wholeWord
                ? "border-[var(--viper-accent)] text-[var(--viper-accent)] bg-[var(--viper-accent)]/10"
                : "border-[var(--viper-border)] text-[#6b7280] hover:text-[#9ca3af]"
            }`}
            title="Match Whole Word"
            onClick={() => setWholeWord((v) => !v)}
          >
            Ab
          </button>
          <button
            type="button"
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              useRegex
                ? "border-[var(--viper-accent)] text-[var(--viper-accent)] bg-[var(--viper-accent)]/10"
                : "border-[var(--viper-border)] text-[#6b7280] hover:text-[#9ca3af]"
            }`}
            title="Use Regular Expression"
            onClick={() => setUseRegex((v) => !v)}
          >
            .*
          </button>
          {searching && <Loader2 size={12} className="ml-auto animate-spin text-[var(--viper-accent)]" />}
        </div>

        {replaceOpen && (
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 rounded border px-1.5 py-1 flex-1"
              style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
            >
              <Replace size={13} className="text-[#6b7280] shrink-0" />
              <input
                type="text"
                className="flex-1 min-w-0 bg-transparent text-xs text-[#e5e7eb] outline-none placeholder:text-[#4b5563]"
                placeholder="Replace..."
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="px-1.5 py-1 rounded text-[10px] font-medium border border-[var(--viper-border)] text-[#6b7280] hover:text-[#e5e7eb] hover:border-[var(--viper-accent)] transition-colors disabled:opacity-40"
              title="Replace All"
              onClick={replaceAll}
              disabled={replacing || !query.trim() || results.length === 0}
            >
              {replacing ? <Loader2 size={10} className="animate-spin" /> : "All"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-1">
        {results.length === 0 && query && !searching && (
          <div className="px-2 py-3 text-xs text-[#6b7280] text-center">
            No results found
          </div>
        )}

        {results.length > 0 && (
          <div className="px-1 py-1 text-[10px] text-[#6b7280]">
            {totalMatches} result{totalMatches !== 1 ? "s" : ""} in {results.length} file{results.length !== 1 ? "s" : ""}
          </div>
        )}

        {results.map((group) => {
          const isExpanded = expandedFiles.has(group.filePath);
          const fileName = group.filePath.split("/").pop() ?? group.filePath;
          const dirPath = group.filePath.includes("/")
            ? group.filePath.slice(0, group.filePath.lastIndexOf("/"))
            : "";

          return (
            <div key={group.filePath} className="mb-0.5">
              <button
                type="button"
                className="group w-full flex items-center gap-1 px-1.5 py-1 rounded text-left hover:bg-white/[0.03] transition-colors"
                onClick={() => {
                  setExpandedFiles((prev) => {
                    const next = new Set(prev);
                    if (next.has(group.filePath)) next.delete(group.filePath);
                    else next.add(group.filePath);
                    return next;
                  });
                }}
              >
                <ChevronRight
                  size={12}
                  className={`shrink-0 text-[#6b7280] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                />
                <FileText size={12} className="shrink-0 text-[#6b7280]" />
                <span className="text-xs text-[#e5e7eb] truncate">{fileName}</span>
                {dirPath && (
                  <span className="text-[10px] text-[#4b5563] truncate ml-1">{dirPath}</span>
                )}
                <span className="ml-auto text-[10px] text-[#4b5563] shrink-0">
                  {group.matches.length}
                </span>
                {replaceOpen && (
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[#6b7280] hover:text-[var(--viper-accent)] shrink-0"
                    title={`Replace all in ${fileName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      replaceInFile(group.filePath).then(() => {
                        setResults((prev) => prev.filter((g) => g.filePath !== group.filePath));
                      });
                    }}
                  >
                    <Replace size={11} />
                  </button>
                )}
              </button>

              {isExpanded && (
                <div className="pl-6">
                  {group.matches.slice(0, 20).map((match, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-1.5 py-0.5 rounded hover:bg-white/[0.03] transition-colors flex items-baseline gap-1.5"
                      onClick={() => openFile(match.filePath)}
                    >
                      <span className="text-[10px] text-[#6b7280] tabular-nums shrink-0 w-6 text-right">
                        {match.line}
                      </span>
                      <span className="text-[11px] text-[#9ca3af] font-mono truncate">
                        {match.content.slice(0, 120)}
                      </span>
                    </button>
                  ))}
                  {group.matches.length > 20 && (
                    <div className="px-1.5 py-0.5 text-[10px] text-[#4b5563]">
                      ...and {group.matches.length - 20} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
