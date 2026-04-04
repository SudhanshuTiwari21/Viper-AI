import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Fuse from "fuse.js";
import { FileText, Folder } from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import type { FileNode } from "../services/filesystem";
import { fsApi } from "../services/filesystem";

interface FileEntry {
  path: string;
  name: string;
  dir: string;
}

function flattenToEntries(nodes: FileNode[], prefix = ""): FileEntry[] {
  const result: FileEntry[] = [];
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (!node.isDirectory) {
      const dir = prefix || ".";
      result.push({ path: fullPath, name: node.name, dir });
    }
    if (node.children) {
      result.push(...flattenToEntries(node.children, fullPath));
    }
  }
  return result;
}

interface QuickOpenProps {
  open: boolean;
  onClose: () => void;
}

export function QuickOpen({ open, onClose }: QuickOpenProps) {
  const { workspace } = useWorkspaceContext();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allFiles = useMemo(() => {
    if (!workspace?.tree) return [];
    return flattenToEntries(workspace.tree);
  }, [workspace?.tree]);

  const fuse = useMemo(
    () =>
      new Fuse(allFiles, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "path", weight: 0.3 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [allFiles],
  );

  const results = useMemo(() => {
    if (!query.trim()) return allFiles.slice(0, 30);
    return fuse.search(query, { limit: 30 }).map((r) => r.item);
  }, [query, fuse, allFiles]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const openFile = useCallback(
    (entry: FileEntry) => {
      if (!workspace) return;
      onClose();
      fsApi.readFile(workspace.root, entry.path).then((content) => {
        window.dispatchEvent(
          new CustomEvent("viper:open-file", {
            detail: { root: workspace.root, path: entry.path, content },
          }),
        );
      }).catch(() => {});
    },
    [workspace, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const entry = results[selectedIndex];
        if (entry) openFile(entry);
      }
    },
    [onClose, results, selectedIndex, openFile],
  );

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const selected = el.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[560px] max-h-[60vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden"
        style={{
          borderColor: "var(--viper-border)",
          background: "var(--viper-sidebar)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b"
          style={{ borderColor: "var(--viper-border)" }}
        >
          <FileText size={14} className="text-[#6b7280] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 min-w-0 bg-transparent text-sm text-[#e5e7eb] outline-none placeholder:text-[#4b5563]"
            placeholder="Type a file name to open..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto min-h-0"
        >
          {results.length === 0 && (
            <div className="px-3 py-4 text-xs text-[#6b7280] text-center">
              No matching files
            </div>
          )}
          {results.map((entry, idx) => (
            <button
              key={entry.path}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                idx === selectedIndex
                  ? "bg-[var(--viper-accent)]/10 text-[#e5e7eb]"
                  : "text-[#9ca3af] hover:bg-white/[0.03]"
              }`}
              onClick={() => openFile(entry)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <FileText size={14} className="shrink-0 text-[#6b7280]" />
              <span className="text-xs truncate">{entry.name}</span>
              <span className="text-[10px] text-[#4b5563] truncate ml-auto">
                {entry.dir}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
