import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Check,
  X,
} from "lucide-react";
import type { PendingDiff } from "../contexts/chat-context";
import {
  buildFileDiffWithHunks,
  type Hunk,
  type FileDiffWithHunks,
} from "../lib/hunk-model";

export type HunkApprovalStatus = "approved" | "rejected";

export interface InlineDiffViewerProps {
  diffs: PendingDiff[];
  hunkStatuses: Record<string, HunkApprovalStatus>;
  onHunkAccept: (hunkId: string) => void;
  onHunkReject: (hunkId: string) => void;
  onFileAcceptAll: (file: string) => void;
  onFileRejectAll: (file: string) => void;
}

function HunkBlock({
  hunk,
  status,
  onAccept,
  onReject,
}: {
  hunk: Hunk;
  status: HunkApprovalStatus;
  onAccept: () => void;
  onReject: () => void;
}) {
  const dimmed = status === "rejected";

  let lineNum = 1;

  return (
    <div
      className={`border-b border-v-border last:border-b-0 transition-opacity duration-150 ${dimmed ? "opacity-35" : ""}`}
    >
      <div className="flex items-center justify-between px-3 py-0.5 bg-v-bg/40">
        <span className="text-2xs text-v-text3 font-mono">
          hunk #{hunk.index + 1}
          {" "}
          <span className="text-v-success/80">+{hunk.addedCount}</span>
          {" "}
          <span className="text-v-error/80">-{hunk.removedCount}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            title="Include this hunk"
            className={`v-press p-1 rounded transition-colors ${
              status === "approved"
                ? "bg-v-success/20 text-v-success"
                : "text-v-text3 hover:bg-white/[0.04] hover:text-v-success"
            }`}
            onClick={onAccept}
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            title="Exclude this hunk"
            className={`v-press p-1 rounded transition-colors ${
              status === "rejected"
                ? "bg-v-error/20 text-v-error"
                : "text-v-text3 hover:bg-white/[0.04] hover:text-v-error"
            }`}
            onClick={onReject}
          >
            <X size={12} />
          </button>
        </span>
      </div>
      <pre className="text-[11px] font-mono leading-relaxed">
        {hunk.lines.map((line, idx) => {
          const prefix =
            line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
          const bgClass =
            line.type === "added"
              ? "bg-v-success/[0.08]"
              : line.type === "removed"
                ? "bg-v-error/[0.08]"
                : "";
          const textClass =
            line.type === "added"
              ? "text-v-success"
              : line.type === "removed"
                ? "text-v-error"
                : "text-v-text2";

          const num = line.type === "removed" ? "" : lineNum++;
          if (line.type === "removed") lineNum = lineNum;

          return (
            <div key={idx} className={`flex ${bgClass} ${textClass} hover:bg-white/[0.02]`}>
              <span className="w-10 shrink-0 select-none text-right pr-2 text-v-text3/50 text-[10px] tabular-nums">
                {num}
              </span>
              <span className="w-4 shrink-0 select-none text-center">{prefix}</span>
              <span className="flex-1 pr-3">{line.text}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function FileDiffBlock({
  fileDiff,
  hunkStatuses,
  onHunkAccept,
  onHunkReject,
  onFileAcceptAll,
  onFileRejectAll,
}: {
  fileDiff: FileDiffWithHunks;
  hunkStatuses: Record<string, HunkApprovalStatus>;
  onHunkAccept: (hunkId: string) => void;
  onHunkReject: (hunkId: string) => void;
  onFileAcceptAll: () => void;
  onFileRejectAll: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const addedCount = fileDiff.hunks.reduce((s, h) => s + h.addedCount, 0);
  const removedCount = fileDiff.hunks.reduce((s, h) => s + h.removedCount, 0);

  const allApproved = fileDiff.hunks.every(
    (h) => (hunkStatuses[h.id] ?? "approved") === "approved",
  );
  const allRejected = fileDiff.hunks.every(
    (h) => (hunkStatuses[h.id] ?? "approved") === "rejected",
  );

  const borderClass = allRejected
    ? "border-v-text3/30 opacity-60"
    : allApproved
      ? "border-v-success/40"
      : "border-v-warning/30";

  return (
    <div className={`rounded-lg bg-v-bg border overflow-hidden transition-colors ${borderClass}`}>
      <div className="flex items-stretch border-b border-v-border min-h-[2.25rem]">
        <button
          type="button"
          className="v-press flex-1 px-3 py-1.5 text-xs font-mono text-v-text flex items-center gap-2 hover:bg-white/[0.02] transition-colors text-left min-w-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <FileCode2 size={12} className="text-v-text3 shrink-0" />
          <span className="truncate flex-1">{fileDiff.file}</span>
          <span className="text-2xs text-v-text3 shrink-0">
            {fileDiff.hunks.length} hunk{fileDiff.hunks.length !== 1 ? "s" : ""}
          </span>
          <span className="text-v-success shrink-0">+{addedCount}</span>
          <span className="text-v-error shrink-0">-{removedCount}</span>
        </button>
        <div className="flex items-center gap-0.5 pr-1.5 border-l border-v-border bg-v-bg/40">
          <button
            type="button"
            title="Include all hunks in this file"
            className={`v-press p-1.5 rounded transition-colors ${
              allApproved
                ? "bg-v-success/20 text-v-success"
                : "text-v-text3 hover:bg-white/[0.04] hover:text-v-success"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onFileAcceptAll();
            }}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            title="Exclude all hunks in this file"
            className={`v-press p-1.5 rounded transition-colors ${
              allRejected
                ? "bg-v-error/20 text-v-error"
                : "text-v-text3 hover:bg-white/[0.04] hover:text-v-error"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onFileRejectAll();
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="max-h-72 overflow-auto">
          {fileDiff.hunks.map((hunk) => (
            <HunkBlock
              key={hunk.id}
              hunk={hunk}
              status={hunkStatuses[hunk.id] ?? "approved"}
              onAccept={() => onHunkAccept(hunk.id)}
              onReject={() => onHunkReject(hunk.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InlineDiffViewer({
  diffs,
  hunkStatuses,
  onHunkAccept,
  onHunkReject,
  onFileAcceptAll,
  onFileRejectAll,
}: InlineDiffViewerProps) {
  if (!diffs.length) return null;

  const fileDiffs: FileDiffWithHunks[] = useMemo(
    () => diffs.map(buildFileDiffWithHunks),
    [diffs],
  );

  const totalAdded = fileDiffs.reduce(
    (s, fd) => s + fd.hunks.reduce((hs, h) => hs + h.addedCount, 0),
    0,
  );
  const totalRemoved = fileDiffs.reduce(
    (s, fd) => s + fd.hunks.reduce((hs, h) => hs + h.removedCount, 0),
    0,
  );

  const allHunks = fileDiffs.flatMap((fd) => fd.hunks);
  const approvedHunks = allHunks.filter(
    (h) => (hunkStatuses[h.id] ?? "approved") === "approved",
  ).length;
  const rejectedHunks = allHunks.filter(
    (h) => (hunkStatuses[h.id] ?? "approved") === "rejected",
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-v-text2">
        <span className="font-medium">
          {diffs.length} file{diffs.length !== 1 ? "s" : ""} changed
          {" \u00b7 "}
          {allHunks.length} hunk{allHunks.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-2">
          <span>
            <span className="text-v-success">+{totalAdded}</span>{" "}
            <span className="text-v-error">-{totalRemoved}</span>
          </span>
          {(approvedHunks > 0 || rejectedHunks > 0) && (
            <span className="text-v-text3">
              ({approvedHunks} included
              {rejectedHunks > 0 ? `, ${rejectedHunks} excluded` : ""})
            </span>
          )}
        </span>
      </div>
      {fileDiffs.map((fd) => (
        <FileDiffBlock
          key={fd.file}
          fileDiff={fd}
          hunkStatuses={hunkStatuses}
          onHunkAccept={onHunkAccept}
          onHunkReject={onHunkReject}
          onFileAcceptAll={() => onFileAcceptAll(fd.file)}
          onFileRejectAll={() => onFileRejectAll(fd.file)}
        />
      ))}
    </div>
  );
}
