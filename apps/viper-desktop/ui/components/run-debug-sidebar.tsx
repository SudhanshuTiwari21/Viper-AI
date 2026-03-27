import { useState, useCallback, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Plus,
  ChevronRight,
  ChevronDown,
  TerminalSquare,
  Loader2,
  Trash2,
  Circle,
  StepForward,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  FileCode,
  Bug,
} from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { fsApi } from "../services/filesystem";

type DebugType = "node" | "python" | "go";

interface LaunchConfig {
  name: string;
  type: DebugType;
  request: "launch" | "attach";
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  stopOnEntry?: boolean;
}

interface BreakpointEntry {
  id: string;
  file: string;
  line: number;
  enabled: boolean;
  verified: boolean;
}

interface StackFrameEntry {
  id: number;
  name: string;
  source: { path: string; name: string };
  line: number;
  column: number;
}

interface ScopeEntry {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

interface VariableEntry {
  name: string;
  value: string;
  type: string;
  variablesReference: number;
}

interface ThreadEntry {
  id: number;
  name: string;
}

type SessionStatus = "idle" | "running" | "stopped" | "terminated";

const DEFAULT_CONFIGS: LaunchConfig[] = [
  { name: "Node: Current File", type: "node", request: "launch", program: "${file}", stopOnEntry: false },
  { name: "Python: Current File", type: "python", request: "launch", program: "${file}" },
];

function SectionHeader({
  title,
  open,
  onToggle,
  action,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] hover:bg-white/[0.03] select-none"
      onClick={onToggle}
    >
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      <span className="flex-1 text-left">{title}</span>
      {action && (
        <span onClick={(e) => e.stopPropagation()}>{action}</span>
      )}
    </button>
  );
}

export function RunDebugSidebar() {
  const { workspace } = useWorkspaceContext();
  const [configs, setConfigs] = useState<LaunchConfig[]>(DEFAULT_CONFIGS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [stoppedReason, setStoppedReason] = useState<string | undefined>();
  const [threads, setThreads] = useState<ThreadEntry[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | undefined>();
  const [stackFrames, setStackFrames] = useState<StackFrameEntry[]>([]);
  const [scopes, setScopes] = useState<ScopeEntry[]>([]);
  const [variables, setVariables] = useState<Map<number, VariableEntry[]>>(new Map());
  const [breakpoints, setBreakpoints] = useState<BreakpointEntry[]>([]);

  const [configFormOpen, setConfigFormOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<DebugType>("node");
  const [newProgram, setNewProgram] = useState("");

  const [sectLaunch, setSectLaunch] = useState(true);
  const [sectBreakpoints, setSectBreakpoints] = useState(true);
  const [sectCallStack, setSectCallStack] = useState(true);
  const [sectVariables, setSectVariables] = useState(true);

  const [expandedScopes, setExpandedScopes] = useState<Set<number>>(new Set());
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!workspace?.root) return;
    fsApi
      .readFile(workspace.root, ".viper/launch.json")
      .then((content) => {
        try {
          const parsed = JSON.parse(content);
          const cfgs: LaunchConfig[] = (parsed.configurations ?? []).map(
            (c: Record<string, unknown>) => ({
              name: c.name ?? "Unnamed",
              type: (c.type as DebugType) ?? "node",
              request: (c.request as "launch" | "attach") ?? "launch",
              program: (c.program as string) ?? "",
              args: c.args as string[] | undefined,
              cwd: c.cwd as string | undefined,
              stopOnEntry: c.stopOnEntry as boolean | undefined,
            }),
          );
          if (cfgs.length > 0) setConfigs(cfgs);
        } catch {}
      })
      .catch(() => {});
  }, [workspace?.root]);

  useEffect(() => {
    const unsub = window.viper.debug.onEvent((event: unknown) => {
      const e = event as Record<string, unknown>;
      switch (e.type) {
        case "stopped":
          setStatus("stopped");
          setStoppedReason(e.reason as string);
          setActiveThreadId(e.threadId as number);
          break;
        case "continued":
          setStatus("running");
          setStoppedReason(undefined);
          break;
        case "exited":
        case "terminated":
          setStatus("terminated");
          setSessionId(null);
          setThreads([]);
          setStackFrames([]);
          setScopes([]);
          setVariables(new Map());
          break;
      }
    });
    cleanupRef.current = unsub;
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  useEffect(() => {
    if (status !== "stopped" || activeThreadId == null) return;
    window.viper.debug.getStackTrace(activeThreadId).then((frames) => {
      setStackFrames(frames ?? []);
      if (frames && frames.length > 0) {
        window.viper.debug.getScopes(frames[0].id).then((s) => {
          setScopes(s ?? []);
        });
      }
    });
  }, [status, activeThreadId]);

  const loadVariables = useCallback(async (ref: number) => {
    const vars = await window.viper.debug.getVariables(ref);
    setVariables((prev) => {
      const next = new Map(prev);
      next.set(ref, vars ?? []);
      return next;
    });
  }, []);

  const toggleScope = useCallback(
    (ref: number) => {
      setExpandedScopes((prev) => {
        const next = new Set(prev);
        if (next.has(ref)) {
          next.delete(ref);
        } else {
          next.add(ref);
          loadVariables(ref);
        }
        return next;
      });
    },
    [loadVariables],
  );

  const launchDebug = useCallback(async () => {
    if (!workspace?.root) return;
    const config = configs[selectedIdx];
    if (!config) return;

    const resolved: LaunchConfig = {
      ...config,
      program: config.program.replace("${file}", "index.js"),
      cwd: config.cwd ?? workspace.root,
    };

    const res = await window.viper.debug.launch(resolved as Parameters<typeof window.viper.debug.launch>[0]);
    if (res.ok && res.sessionId) {
      setSessionId(res.sessionId);
      setStatus("running");
      if (res.session) {
        setThreads(res.session.threads ?? []);
        setActiveThreadId(res.session.activeThreadId);
        if (res.session.status === "stopped") {
          setStatus("stopped");
          setStoppedReason(res.session.stoppedReason);
        }
      }
    }
  }, [workspace?.root, configs, selectedIdx]);

  const stopDebug = useCallback(async () => {
    if (!sessionId) return;
    await window.viper.debug.terminate(sessionId);
    setSessionId(null);
    setStatus("idle");
    setThreads([]);
    setStackFrames([]);
    setScopes([]);
    setVariables(new Map());
  }, [sessionId]);

  const debugAction = useCallback(
    async (action: "continue" | "stepOver" | "stepInto" | "stepOut") => {
      if (activeThreadId == null) return;
      await window.viper.debug[action](activeThreadId);
    },
    [activeThreadId],
  );

  const toggleBreakpoint = useCallback((id: string) => {
    setBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, enabled: !bp.enabled } : bp)),
    );
  }, []);

  const removeBreakpoint = useCallback((id: string) => {
    setBreakpoints((prev) => prev.filter((bp) => bp.id !== id));
  }, []);

  const clearAllBreakpoints = useCallback(() => {
    setBreakpoints([]);
  }, []);

  const createLaunchJson = useCallback(async () => {
    if (!workspace?.root) return;
    const template = JSON.stringify(
      {
        version: "0.1.0",
        configurations: [
          {
            name: "Node: Launch Program",
            type: "node",
            request: "launch",
            program: "${file}",
            stopOnEntry: false,
          },
        ],
      },
      null,
      2,
    );
    try {
      await fsApi.createFolder(workspace.root, ".viper");
    } catch {}
    await fsApi.writeFile(workspace.root, ".viper/launch.json", template);
  }, [workspace?.root]);

  const addConfig = useCallback(() => {
    if (!newName.trim() || !newProgram.trim()) return;
    setConfigs((prev) => [
      ...prev,
      {
        name: newName.trim(),
        type: newType,
        request: "launch",
        program: newProgram.trim(),
      },
    ]);
    setNewName("");
    setNewProgram("");
    setConfigFormOpen(false);
  }, [newName, newType, newProgram]);

  const isDebugging = status === "running" || status === "stopped";

  if (!workspace) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-xs text-[#6b7280] p-4">
        Open a folder to run and debug.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ background: "var(--viper-sidebar)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between h-9 px-2 flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Run & Debug
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
            title="Create launch.json"
            onClick={createLaunchJson}
          >
            <FileCode size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
            title="Add Configuration"
            onClick={() => setConfigFormOpen((v) => !v)}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Launch bar */}
      <div className="px-2 pt-2 pb-1.5 flex items-center gap-1 flex-shrink-0">
        <select
          className="flex-1 min-w-0 rounded border px-1.5 py-1 text-xs bg-transparent text-[#e5e7eb] outline-none"
          style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(Number(e.target.value))}
        >
          {configs.map((c, i) => (
            <option key={i} value={i}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 rounded transition-colors"
          style={{
            background: isDebugging ? "#ef4444" : "var(--viper-accent)",
            color: "#0b0f17",
          }}
          title={isDebugging ? "Stop" : "Start Debugging"}
          onClick={isDebugging ? stopDebug : launchDebug}
        >
          {isDebugging ? <Square size={12} /> : <Play size={12} />}
        </button>
      </div>

      {/* Debug toolbar */}
      {isDebugging && (
        <div
          className="flex items-center gap-0.5 px-2 py-1 border-b"
          style={{ borderColor: "var(--viper-border)" }}
        >
          <button
            type="button"
            className="p-1 rounded text-[#e5e7eb] hover:bg-white/10 disabled:opacity-30"
            title="Continue"
            disabled={status !== "stopped"}
            onClick={() => debugAction("continue")}
          >
            <Play size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-[#e5e7eb] hover:bg-white/10 disabled:opacity-30"
            title="Step Over"
            disabled={status !== "stopped"}
            onClick={() => debugAction("stepOver")}
          >
            <StepForward size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-[#e5e7eb] hover:bg-white/10 disabled:opacity-30"
            title="Step Into"
            disabled={status !== "stopped"}
            onClick={() => debugAction("stepInto")}
          >
            <ArrowDownToLine size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-[#e5e7eb] hover:bg-white/10 disabled:opacity-30"
            title="Step Out"
            disabled={status !== "stopped"}
            onClick={() => debugAction("stepOut")}
          >
            <ArrowUpFromLine size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-[#e5e7eb] hover:bg-white/10"
            title="Restart"
            onClick={async () => {
              await stopDebug();
              setTimeout(launchDebug, 200);
            }}
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className="p-1 rounded text-[#ef4444] hover:bg-white/10"
            title="Stop"
            onClick={stopDebug}
          >
            <Square size={13} />
          </button>
          <div className="flex-1" />
          {status === "stopped" && stoppedReason && (
            <span className="text-[10px] text-[#f59e0b]">
              Paused: {stoppedReason}
            </span>
          )}
          {status === "running" && (
            <Loader2 size={11} className="animate-spin text-[var(--viper-accent)]" />
          )}
        </div>
      )}

      {/* Add config form */}
      {configFormOpen && (
        <div
          className="px-2 py-2 flex flex-col gap-1 border-b"
          style={{ borderColor: "var(--viper-border)" }}
        >
          <input
            className="rounded border px-1.5 py-1 text-xs bg-transparent text-[#e5e7eb] outline-none placeholder:text-[#4b5563]"
            style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
            placeholder="Config name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            className="rounded border px-1.5 py-1 text-xs bg-transparent text-[#e5e7eb] outline-none"
            style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
            value={newType}
            onChange={(e) => setNewType(e.target.value as DebugType)}
          >
            <option value="node">Node.js</option>
            <option value="python">Python</option>
            <option value="go">Go</option>
          </select>
          <input
            className="rounded border px-1.5 py-1 text-xs bg-transparent text-[#e5e7eb] outline-none placeholder:text-[#4b5563]"
            style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
            placeholder="Program path (e.g. src/index.js)"
            value={newProgram}
            onChange={(e) => setNewProgram(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addConfig();
            }}
          />
          <button
            type="button"
            className="px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{
              background: "var(--viper-accent)",
              color: "#0b0f17",
            }}
            onClick={addConfig}
          >
            Add
          </button>
        </div>
      )}

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Launch configs section */}
        <SectionHeader
          title="Configurations"
          open={sectLaunch}
          onToggle={() => setSectLaunch((v) => !v)}
        />
        {sectLaunch && (
          <div className="px-1 py-0.5">
            {configs.map((config, i) => (
              <button
                key={i}
                type="button"
                className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors ${
                  i === selectedIdx
                    ? "bg-[var(--viper-accent)]/10 text-[#e5e7eb]"
                    : "text-[#9ca3af] hover:bg-white/[0.03]"
                }`}
                onClick={() => setSelectedIdx(i)}
                onDoubleClick={launchDebug}
              >
                <Bug size={11} className="shrink-0 text-[#6b7280]" />
                <span className="text-xs truncate flex-1">{config.name}</span>
                <span className="text-[10px] text-[#4b5563]">{config.type}</span>
              </button>
            ))}
          </div>
        )}

        {/* Breakpoints section */}
        <SectionHeader
          title="Breakpoints"
          open={sectBreakpoints}
          onToggle={() => setSectBreakpoints((v) => !v)}
          action={
            breakpoints.length > 0 ? (
              <button
                type="button"
                className="p-0.5 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
                title="Clear All Breakpoints"
                onClick={clearAllBreakpoints}
              >
                <Trash2 size={11} />
              </button>
            ) : undefined
          }
        />
        {sectBreakpoints && (
          <div className="px-1 py-0.5">
            {breakpoints.length === 0 && (
              <div className="px-2 py-1 text-[10px] text-[#4b5563]">
                No breakpoints set.
              </div>
            )}
            {breakpoints.map((bp) => (
              <div
                key={bp.id}
                className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-[#9ca3af] hover:bg-white/[0.03] rounded group"
              >
                <button
                  type="button"
                  className="shrink-0"
                  onClick={() => toggleBreakpoint(bp.id)}
                >
                  <Circle
                    size={10}
                    className={
                      bp.enabled
                        ? "fill-[#ef4444] text-[#ef4444]"
                        : "text-[#4b5563]"
                    }
                  />
                </button>
                <span className="truncate flex-1 text-[11px]">
                  {bp.file.split("/").pop()}:{bp.line}
                </span>
                <button
                  type="button"
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-[#6b7280] hover:text-[#e5e7eb]"
                  onClick={() => removeBreakpoint(bp.id)}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Call stack section */}
        {isDebugging && (
          <>
            <SectionHeader
              title="Call Stack"
              open={sectCallStack}
              onToggle={() => setSectCallStack((v) => !v)}
            />
            {sectCallStack && (
              <div className="px-1 py-0.5">
                {threads.map((thread) => (
                  <div key={thread.id}>
                    <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-[#9ca3af] font-medium">
                      <TerminalSquare size={10} className="text-[#6b7280]" />
                      {thread.name}
                      {thread.id === activeThreadId && status === "stopped" && (
                        <span className="text-[10px] text-[#f59e0b] ml-auto">paused</span>
                      )}
                    </div>
                    {thread.id === activeThreadId &&
                      stackFrames.map((frame) => (
                        <button
                          key={frame.id}
                          type="button"
                          className="w-full flex items-center gap-1 px-4 py-0.5 text-[11px] text-[#9ca3af] hover:bg-white/[0.03] rounded text-left"
                        >
                          <span className="text-[#e5e7eb] truncate">{frame.name}</span>
                          <span className="text-[#4b5563] ml-auto shrink-0">
                            {frame.source.name}:{frame.line}
                          </span>
                        </button>
                      ))}
                  </div>
                ))}
                {threads.length === 0 && (
                  <div className="px-2 py-1 text-[10px] text-[#4b5563]">
                    No threads.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Variables section */}
        {isDebugging && status === "stopped" && (
          <>
            <SectionHeader
              title="Variables"
              open={sectVariables}
              onToggle={() => setSectVariables((v) => !v)}
            />
            {sectVariables && (
              <div className="px-1 py-0.5">
                {scopes.map((scope) => (
                  <div key={scope.variablesReference}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-1 px-2 py-0.5 text-[11px] text-[#9ca3af] font-medium hover:bg-white/[0.03] rounded"
                      onClick={() => toggleScope(scope.variablesReference)}
                    >
                      {expandedScopes.has(scope.variablesReference) ? (
                        <ChevronDown size={10} />
                      ) : (
                        <ChevronRight size={10} />
                      )}
                      {scope.name}
                    </button>
                    {expandedScopes.has(scope.variablesReference) &&
                      (variables.get(scope.variablesReference) ?? []).map((v) => (
                        <div
                          key={v.name}
                          className="flex items-center gap-1 px-5 py-0.5 text-[11px] hover:bg-white/[0.03] rounded"
                        >
                          <span className="text-[#93c5fd]">{v.name}</span>
                          <span className="text-[#4b5563]">=</span>
                          <span className="text-[#e5e7eb] truncate">{v.value}</span>
                          <span className="text-[#4b5563] ml-auto text-[10px] shrink-0">
                            {v.type}
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
                {scopes.length === 0 && (
                  <div className="px-2 py-1 text-[10px] text-[#4b5563]">
                    No scopes available.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      {isDebugging && (
        <div
          className="px-2 py-1.5 border-t text-[10px] text-[#6b7280] flex items-center gap-1"
          style={{ borderColor: "var(--viper-border)" }}
        >
          <Bug size={10} className="text-[var(--viper-accent)]" />
          {status === "running" && "Debugging..."}
          {status === "stopped" && `Paused on ${stoppedReason ?? "breakpoint"}`}
        </div>
      )}
    </div>
  );
}
