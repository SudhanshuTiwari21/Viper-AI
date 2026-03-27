import { useState, useEffect } from "react";
import {
  ChevronRight,
  FileText,
  FolderOpen,
  Search,
  Loader2,
  Pencil,
  FilePlus,
  CheckCircle2,
  TerminalSquare,
} from "lucide-react";
import type { ToolCallEntry } from "../contexts/chat-context";
import { CommandOutput } from "./command-output";

const TOOL_ICONS: Record<string, typeof FileText> = {
  read_file: FileText,
  list_directory: FolderOpen,
  search_text: Search,
  search_files: Search,
  edit_file: Pencil,
  create_file: FilePlus,
  run_command: TerminalSquare,
};

function shortPath(fullPath?: string): string {
  if (!fullPath) return "file";
  const parts = fullPath.split("/");
  return parts.length > 2
    ? `.../${parts.slice(-2).join("/")}`
    : fullPath;
}

function formatDuration(ms?: number): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function runningLabel(entry: ToolCallEntry): string {
  const p = entry.args.path ?? entry.args.file ?? entry.args.directory ?? "";
  switch (entry.tool) {
    case "read_file":
      return `Reading ${shortPath(p)}`;
    case "list_directory":
      return `Listing ${shortPath(p) || "directory"}`;
    case "search_text":
      return `Searching for "${entry.args.pattern ?? ""}"`;
    case "search_files":
      return `Finding files matching "${entry.args.pattern ?? ""}"`;
    case "edit_file":
      return `Editing ${shortPath(p)}`;
    case "create_file":
      return `Creating ${shortPath(p)}`;
    case "run_command":
      return `Running: ${entry.args.command ?? "command"}`;
    default:
      return `Running ${entry.tool}`;
  }
}

function doneLabel(entry: ToolCallEntry): string {
  const p = entry.args.path ?? entry.args.file ?? entry.args.directory ?? "";
  const dur = formatDuration(entry.durationMs);
  const durSuffix = dur ? ` ${dur}` : "";

  if (entry.summary && entry.summary !== entry.tool) {
    return `${entry.summary}${durSuffix}`;
  }

  switch (entry.tool) {
    case "read_file":
      return `Read ${shortPath(p)}${durSuffix}`;
    case "list_directory":
      return `Listed ${shortPath(p) || "directory"}${durSuffix}`;
    case "search_text":
      return `Searched "${entry.args.pattern ?? ""}"${durSuffix}`;
    case "search_files":
      return `Found files matching "${entry.args.pattern ?? ""}"${durSuffix}`;
    case "edit_file":
      return `Edited ${shortPath(p)}${durSuffix}`;
    case "create_file":
      return `Created ${shortPath(p)}${durSuffix}`;
    case "run_command":
      return `Ran: ${entry.args.command ?? "command"}${durSuffix}`;
    default:
      return `${entry.tool}${durSuffix}`;
  }
}

function ToolCallRow({ entry }: { entry: ToolCallEntry }) {
  const Icon = TOOL_ICONS[entry.tool] ?? FileText;
  const isRunning = entry.status === "running";
  const label = isRunning ? runningLabel(entry) : doneLabel(entry);

  return (
    <div className="flex items-center gap-1.5 text-2xs leading-tight py-[3px] group">
      {isRunning ? (
        <Loader2 size={11} className="shrink-0 animate-spin text-v-accent" />
      ) : (
        <Icon size={11} className="shrink-0 text-v-text3/60" />
      )}
      <span className={`truncate min-w-0 ${isRunning ? "text-v-text2" : "text-v-text3"}`}>
        {label}
      </span>
      {!isRunning && entry.durationMs != null && (
        <span className="shrink-0 text-v-text3/50 tabular-nums ml-auto">
          {formatDuration(entry.durationMs)}
        </span>
      )}
    </div>
  );
}

interface ToolActivityProps {
  toolCalls: ToolCallEntry[];
}

export function ToolActivity({ toolCalls }: ToolActivityProps) {
  const [expanded, setExpanded] = useState(false);
  const [autoExpanded, setAutoExpanded] = useState(false);

  const hasRunningCommand = toolCalls.some(
    (tc) => tc.tool === "run_command" && tc.status === "running" && tc.commandOutput,
  );

  useEffect(() => {
    if (hasRunningCommand && !autoExpanded) {
      setExpanded(true);
      setAutoExpanded(true);
    }
  }, [hasRunningCommand, autoExpanded]);

  if (toolCalls.length === 0) return null;

  const doneCount = toolCalls.filter((tc) => tc.status === "done").length;
  const runningCount = toolCalls.length - doneCount;
  const allDone = runningCount === 0;

  const filesRead = toolCalls.filter(
    (tc) => tc.tool === "read_file" && tc.status === "done",
  ).length;
  const searches = toolCalls.filter(
    (tc) => (tc.tool === "search_text" || tc.tool === "search_files") && tc.status === "done",
  ).length;
  const edits = toolCalls.filter(
    (tc) => (tc.tool === "edit_file" || tc.tool === "create_file") && tc.status === "done",
  ).length;
  const listed = toolCalls.some(
    (tc) => tc.tool === "list_directory" && tc.status === "done",
  );
  const commands = toolCalls.filter(
    (tc) => tc.tool === "run_command" && tc.status === "done",
  ).length;

  const summaryParts: string[] = [];
  if (filesRead > 0) summaryParts.push(`${filesRead} file${filesRead > 1 ? "s" : ""}`);
  if (searches > 0) summaryParts.push(`${searches} search${searches > 1 ? "es" : ""}`);
  if (edits > 0) summaryParts.push(`${edits} file${edits > 1 ? "s" : ""} edited`);
  if (commands > 0) summaryParts.push(`${commands} command${commands > 1 ? "s" : ""} ran`);
  if (listed) summaryParts.push("project structure");

  const summaryText = allDone
    ? `Explored ${summaryParts.join(", ") || `${doneCount} tool call${doneCount > 1 ? "s" : ""}`}`
    : runningCount === 1
      ? runningLabel(toolCalls.find((tc) => tc.status === "running")!)
      : `Working... (${runningCount} in progress)`;

  return (
    <div className="animate-v-fade-in rounded-lg border border-v-border/40 bg-v-bg2/20 overflow-hidden">
      <button
        type="button"
        className="v-press flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {allDone ? (
          <>
            <ChevronRight
              size={12}
              className={`shrink-0 text-v-text3/60 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
            />
            <CheckCircle2 size={12} className="shrink-0 text-v-text3/50" />
          </>
        ) : (
          <Loader2 size={12} className="shrink-0 animate-spin text-v-accent" />
        )}
        <span className={`text-2xs ${allDone ? "text-v-text3" : "text-v-text2"}`}>
          {summaryText}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2 pt-0.5 border-t border-v-border/20">
          <div className="flex flex-col gap-1">
            {toolCalls.map((tc) => {
              if (tc.tool === "run_command" && tc.commandOutput != null) {
                return (
                  <CommandOutput
                    key={tc.id}
                    command={String(tc.args.command ?? "command")}
                    output={tc.commandOutput}
                    isRunning={tc.status === "running"}
                    exitStatus={tc.summary}
                  />
                );
              }
              return <ToolCallRow key={tc.id} entry={tc} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
