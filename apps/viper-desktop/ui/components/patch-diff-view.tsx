import { useEffect, useState } from "react";
import type { CodePatch } from "../lib/patch-types";
import { diffContentWithPatch, type FileDiff } from "../lib/patch-engine";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { fsApi } from "../services/filesystem";

interface PatchDiffViewProps {
  patches: CodePatch[];
}

interface FileDiffState {
  loading: boolean;
  error?: string;
  diff?: FileDiff;
}

export function PatchDiffView({ patches }: PatchDiffViewProps) {
  const { workspace } = useWorkspaceContext();
  const [diffs, setDiffs] = useState<Record<string, FileDiffState>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadDiffs() {
      if (!workspace?.root) return;
      const next: Record<string, FileDiffState> = {};

      for (const patch of patches) {
        const file = patch.file;
        next[file] = { loading: true };
        try {
          const original = await fsApi.readFile(workspace.root, file);
          if (cancelled) return;
          const diff = diffContentWithPatch(file, original, patch);
          next[file] = { loading: false, diff };
        } catch (err) {
          if (cancelled) return;
          const message =
            err instanceof Error ? err.message : "Failed to load file";
          next[file] = { loading: false, error: message };
        }
      }

      if (!cancelled) {
        setDiffs(next);
      }
    }

    void loadDiffs();

    return () => {
      cancelled = true;
    };
  }, [patches, workspace?.root]);

  if (!patches.length) return null;

  return (
    <div className="mt-2 border-t border-zinc-700/60 pt-2 space-y-2">
      <div className="text-xs font-medium text-zinc-400 mb-1">
        Suggested Changes
      </div>
      {patches.map((patch) => {
        const state = diffs[patch.file];
        return (
          <div
            key={patch.file}
            className="rounded-md bg-zinc-900/80 border border-zinc-800/80 overflow-hidden"
          >
            <div className="px-3 py-1.5 text-xs font-mono text-zinc-300 border-b border-zinc-800/80 flex items-center justify-between">
              <span className="truncate">{patch.file}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
                Diff
              </span>
            </div>
            <div className="max-h-48 overflow-auto text-[11px] font-mono">
              {!state || state.loading ? (
                <div className="px-3 py-2 text-zinc-500">Loading diff…</div>
              ) : state.error ? (
                <div className="px-3 py-2 text-amber-400">
                  Failed to generate diff: {state.error}
                </div>
              ) : !state.diff ? (
                <div className="px-3 py-2 text-zinc-500">
                  No changes detected.
                </div>
              ) : (
                <pre className="px-3 py-2 whitespace-pre">
                  {state.diff.chunks.map((chunk, idx) => {
                    const prefix = chunk.added
                      ? "+"
                      : chunk.removed
                      ? "-"
                      : " ";
                    const colorClass = chunk.added
                      ? "text-emerald-300"
                      : chunk.removed
                      ? "text-rose-300"
                      : "text-zinc-300";

                    return (
                      <div
                        key={idx}
                        className={colorClass}
                      >{`${prefix} ${chunk.value}`}</div>
                    );
                  })}
                </pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

