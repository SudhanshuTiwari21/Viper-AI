import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Clock,
  MoreHorizontal,
  Scan,
  Code2,
  Sparkles,
} from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChat } from "../contexts/chat-context";
import type { ExecutionStep, PendingDiff, ChatMode } from "../contexts/chat-context";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { usePendingEdits } from "../contexts/pending-edits-context";
import {
  sendChatStream,
  formatChatResponse,
  runAnalysis,
  runAnalysisScan,
  formatScanReport,
  applyPatch as apiApplyPatch,
  rejectPatch as apiRejectPatch,
  buildV2rayTunSubscriptionImportDeepLink,
  type ChatResponse,
} from "../services/agent-api";
import { filterPatchByHunks, buildInitialHunkStatuses } from "../lib/filter-patch";
import { buildFileDiffWithHunks } from "../lib/hunk-model";
import { useSmartScroll } from "../hooks/use-smart-scroll";

function formatTimeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "Now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h`;
  return `${Math.floor(d / 86400_000)}d`;
}

const STEP_NARRATIONS: Record<string, string> = {
  SEARCH_SYMBOL: "Searching the codebase for relevant symbols\u2026",
  SEARCH_EMBEDDING: "Running semantic search across your project\u2026",
  READ_FILE: "Reading and analyzing source files\u2026",
  IMPLEMENT: "Generating and refining the proposed changes\u2026",
  VALIDATE: "Validating edits against the current workspace\u2026",
  ANALYZE: "Tracing structure and dependencies\u2026",
};

export function ChatPanel() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    updateMessage,
    appendTokens,
    finalizeTokenBuffer,
    updateSteps,
    setStreamingPhase,
    setPendingPatch,
    updatePendingPatchStatus,
    updateHunkStatus,
    bulkUpdateHunkStatuses,
    setPendingPatchApplySummary,
    setPlanSteps,
    setExploredFiles,
    setExplorationPhase,
    setActionNarration,
    setErrorMessage,
    appendThinkingTokens,
    clearThinkingBuffer,
    appendPlanNarrativeTokens,
    clearPlanNarrativeBuffer,
    appendToolCall,
    completeToolCall,
    appendCommandOutput,
    setAwaitingApproval,
    setChatMode,
  } = useChat();
  const { workspace } = useWorkspaceContext();
  const { addPendingEdit } = usePendingEdits();
  const [streaming, setStreaming] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [pastChatsOpen, setPastChatsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  /** Synchronous guard — two rapid sends can both see streaming===false before re-render (duplicate /chat/stream). */
  const streamInFlightRef = useRef(false);

  const { scrollContainerRef, bottomRef, scrollToBottom } = useSmartScroll();

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];
  const currentMode: ChatMode = activeSession?.chatMode ?? "agent";

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ─── Send handler ─── */

  const handleSend = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || streaming || !activeSessionId) return;
      if (streamInFlightRef.current) return;
      streamInFlightRef.current = true;

      const workspacePath = workspace?.root ?? "";
      if (!workspacePath) {
        streamInFlightRef.current = false;
        addMessage(activeSessionId, {
          role: "assistant",
          content: "Open a workspace folder first so the agent can use your codebase context.",
        });
        return;
      }

      // Drop empty entries — API requires content.min(1); failed/aborted streams can leave "" assistant rows.
      const lastMessages = messages
        .filter((m) => !m.streaming && m.content.trim().length > 0)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.trim() }));

      addMessage(activeSessionId, {
        role: "user",
        content: prompt.trim(),
      });

      const assistantId = addMessage(activeSessionId, {
        role: "assistant",
        content: "",
        streaming: true,
      });

      const sid = activeSessionId;
      const steps: ExecutionStep[] = [];

      setStreaming(true);
      try {
        await sendChatStream(
          prompt.trim(),
          workspacePath,
          (event) => {
            switch (event.type) {
              case "intent":
                setStreamingPhase(sid, assistantId,
                  currentMode === "plan" ? "planning" : "intent");
                break;

              case "workspace:preparing": {
                setStreamingPhase(sid, assistantId, "indexing");
                setExplorationPhase(sid, assistantId, "exploring");
                break;
              }

              case "thinking:start":
                setStreamingPhase(sid, assistantId, "indexing");
                break;

              case "thinking:delta": {
                const d = event.data as { content: string };
                appendThinkingTokens(sid, assistantId, d.content);
                break;
              }

              case "thinking:complete":
                break;

              case "plan:narrative:start":
                clearPlanNarrativeBuffer(sid, assistantId);
                clearThinkingBuffer(sid, assistantId);
                setStreamingPhase(sid, assistantId, "planning");
                break;

              case "plan:narrative:delta": {
                const d = event.data as { content: string };
                appendPlanNarrativeTokens(sid, assistantId, d.content);
                break;
              }

              case "plan:narrative:complete":
                break;

              case "plan": {
                setStreamingPhase(sid, assistantId, "planning");
                const planData = event.data as { steps?: Array<{ id: string; type: string; description?: string }> };
                if (planData.steps) {
                  setPlanSteps(sid, assistantId, planData.steps);
                }
                break;
              }

              case "step:start": {
                if (currentMode === "ask" || currentMode === "plan") break;
                const d = event.data as { stepId: string; stepType: string };
                // Autonomous loop re-runs the same plan step IDs across iterations — upsert, don’t append duplicates
                // or step:complete only updates the first row and the rest spin forever.
                const idx = steps.findIndex((s) => s.stepId === d.stepId);
                if (idx >= 0) {
                  steps[idx] = {
                    stepId: d.stepId,
                    stepType: d.stepType,
                    status: "running",
                    durationMs: undefined,
                  };
                } else {
                  steps.push({ stepId: d.stepId, stepType: d.stepType, status: "running" });
                }
                updateSteps(sid, assistantId, [...steps]);
                setStreamingPhase(sid, assistantId, "executing");
                const narration = STEP_NARRATIONS[d.stepType];
                if (narration) {
                  setActionNarration(sid, assistantId, narration);
                }
                break;
              }

              case "step:complete": {
                if (currentMode === "ask" || currentMode === "plan") break;
                const d = event.data as { stepId: string; durationMs: number };
                const step = steps.find((s) => s.stepId === d.stepId);
                if (step) {
                  step.status = "complete";
                  step.durationMs = d.durationMs;
                }
                updateSteps(sid, assistantId, [...steps]);
                setActionNarration(sid, assistantId, "");
                break;
              }

              case "step:skip": {
                const d = event.data as { stepId: string; stepType: string };
                const skipIdx = steps.findIndex((s) => s.stepId === d.stepId);
                if (skipIdx >= 0) {
                  steps[skipIdx] = {
                    stepId: d.stepId,
                    stepType: d.stepType,
                    status: "skipped",
                  };
                } else {
                  steps.push({ stepId: d.stepId, stepType: d.stepType, status: "skipped" });
                }
                updateSteps(sid, assistantId, [...steps]);
                break;
              }

              case "retrieval:confidence":
                // B.6: structured ranking confidence — UI parity deferred; ignore without breaking stream.
                break;

              case "context:retrieved": {
                const d = event.data as {
                  files?: string[] | number;
                  counts?: { files: number; functions: number; tokens: number };
                };
                if (Array.isArray(d.files)) {
                  setExploredFiles(sid, assistantId, d.files, d.counts);
                  setExplorationPhase(sid, assistantId, "done");
                }
                break;
              }

              case "context:explored": {
                const d = event.data as {
                  files: string[];
                  counts?: { files: number; functions: number; tokens: number };
                };
                if (d.files?.length) {
                  setExploredFiles(sid, assistantId, d.files, d.counts);
                  setExplorationPhase(sid, assistantId, "done");
                }
                break;
              }

              case "context:searching":
                setExplorationPhase(sid, assistantId, "exploring");
                break;

              case "tool:start": {
                if (currentMode === "ask" || currentMode === "plan") break;
                const d = event.data as { tool: string; args: Record<string, string> };
                const tcId = `${d.tool}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                appendToolCall(sid, assistantId, {
                  id: tcId,
                  tool: d.tool,
                  args: d.args,
                  status: "running",
                });
                break;
              }

              case "tool:result": {
                if (currentMode === "ask" || currentMode === "plan") break;
                const d = event.data as { tool: string; summary: string; durationMs: number };
                completeToolCall(sid, assistantId, d.tool, d.summary, d.durationMs);
                break;
              }

              case "validation:started":
              case "validation:passed":
              case "validation:failed":
                // B.8: optional narration later; swallow so unknown-event handling never breaks the stream.
                break;

              case "auto-repair:attempt":
              case "auto-repair:result":
                // B.9 (WS9): bounded shell repair after validation failure; safe no-op for the desktop parser.
                break;

              case "workflow:gate": {
                const d = event.data as {
                  gate: "edit";
                  status: "blocked" | "passed";
                  reason?: string;
                  metrics?: {
                    filesRead?: number;
                    requiredFilesRead?: number;
                    discoveryCount?: number;
                    requiredDiscovery?: number;
                    analysisReady?: boolean;
                    retrievalOverall?: number;
                    retrievalThreshold?: number;
                    confidenceSchemaVersion?: string;
                  };
                };
                if (d.gate === "edit") {
                  if (d.status === "blocked") {
                    const label =
                      d.reason === "analysis_not_ready"
                        ? "Edit is waiting for analysis warmup."
                        : d.reason === "insufficient_files_read"
                          ? `Read more files before editing (${d.metrics?.filesRead ?? 0}/${d.metrics?.requiredFilesRead ?? 0}).`
                          : d.reason === "insufficient_discovery"
                            ? `Run discovery first (${d.metrics?.discoveryCount ?? 0}/${d.metrics?.requiredDiscovery ?? 0}).`
                            : d.reason === "insufficient_retrieval_confidence"
                              ? `Retrieval confidence too low (${(d.metrics?.retrievalOverall ?? 0).toFixed(2)} / required ${(d.metrics?.retrievalThreshold ?? 0).toFixed(2)}). Read or search more targeted files and retry.`
                            : d.reason === "mode_tool_blocked"
                              ? "This tool is not available in the current mode."
                            : "Edit is currently blocked by workflow policy.";
                    setActionNarration(sid, assistantId, label);
                  } else {
                    setActionNarration(sid, assistantId, "Edit gate passed. Applying change...");
                  }
                }
                break;
              }

              case "command:output": {
                const d = event.data as { content: string };
                appendCommandOutput(sid, assistantId, d.content);
                break;
              }

              case "step:awaiting_approval": {
                const d = event.data as {
                  summary: string;
                  editedFiles: string[];
                  stepNumber: number;
                  fileSnapshots?: Array<{
                    filePath: string;
                    beforeContent: string;
                    afterContent: string;
                  }>;
                };
                setAwaitingApproval(sid, assistantId, {
                  summary: d.summary,
                  editedFiles: d.editedFiles,
                  stepNumber: d.stepNumber,
                });

                if (d.fileSnapshots?.length) {
                  for (const snap of d.fileSnapshots) {
                    addPendingEdit({
                      id: `edit-${snap.filePath}-${Date.now()}`,
                      filePath: snap.filePath,
                      originalContent: snap.beforeContent,
                      modifiedContent: snap.afterContent,
                      description: d.summary,
                      timestamp: Date.now(),
                    });

                    if (workspace?.root) {
                      window.dispatchEvent(
                        new CustomEvent("viper:open-file", {
                          detail: {
                            root: workspace.root,
                            path: snap.filePath,
                            content: snap.afterContent,
                          },
                        }),
                      );
                    }
                  }
                }
                break;
              }

              case "patch:start":
                setStreamingPhase(sid, assistantId, "generating");
                break;

              case "token": {
                const d = event.data as { content: string };
                setStreamingPhase(sid, assistantId, "generating");
                clearThinkingBuffer(sid, assistantId);
                appendTokens(sid, assistantId, d.content);
                break;
              }

              case "patch:preview": {
                const d = event.data as {
                  patch: { changes: unknown[]; operations: unknown[] };
                  diffs: PendingDiff[];
                  workspacePath: string;
                  previewId: string;
                  patchHash: string;
                };
                setPendingPatch(sid, assistantId, {
                  patch: d.patch,
                  diffs: d.diffs,
                  workspacePath: d.workspacePath,
                  previewId: d.previewId,
                  patchHash: d.patchHash,
                  status: "pending",
                  hunkStatuses: buildInitialHunkStatuses(d.diffs),
                });
                setStreamingPhase(sid, assistantId, "awaiting_approval");
                break;
              }

              case "reasoning:start":
                setStreamingPhase(sid, assistantId, "reasoning");
                break;

              case "reflection": {
                // Reflection is for timeline / logs only — do not append diagnostics into the reply
                // (avoids raw JSON + issue lists next to the diff preview).
                break;
              }

              case "result": {
                const data = event.data as unknown as ChatResponse;
                const full = formatChatResponse(data);
                updateMessage(sid, assistantId, full, false);
                break;
              }

              case "error": {
                const d = event.data as { message: string };
                setErrorMessage(sid, assistantId, d.message);
                updateMessage(sid, assistantId, "", false);
                break;
              }

              case "done":
                finalizeTokenBuffer(sid, assistantId);
                window.setTimeout(() => {
                  setStreamingPhase(sid, assistantId, "done");
                  setActionNarration(sid, assistantId, "");
                }, 120);
                break;
            }
          },
          activeSessionId,
          lastMessages,
          undefined,
          currentMode,
        );
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Request failed";
        setErrorMessage(sid, assistantId, errorText);
        updateMessage(sid, assistantId, "", false);
      } finally {
        finalizeTokenBuffer(sid, assistantId);
        streamInFlightRef.current = false;
        setStreaming(false);
      }
    },
    [
      activeSessionId,
      streaming,
      workspace?.root,
      messages,
      addMessage,
      updateMessage,
      appendTokens,
      finalizeTokenBuffer,
      updateSteps,
      setStreamingPhase,
      setPendingPatch,
      setPlanSteps,
      setExploredFiles,
      setExplorationPhase,
      setActionNarration,
      setErrorMessage,
      appendThinkingTokens,
      clearThinkingBuffer,
      appendPlanNarrativeTokens,
      clearPlanNarrativeBuffer,
      appendToolCall,
      completeToolCall,
      appendCommandOutput,
      setAwaitingApproval,
      addPendingEdit,
      currentMode,
    ],
  );

  /* ─── Hunk-level approval handlers ─── */

  const handleApplySelected = useCallback(
    async (messageId: string) => {
      if (!activeSessionId) return;
      const session = sessions.find((s) => s.id === activeSessionId);
      const msg = session?.messages.find((m) => m.id === messageId);
      if (!msg?.pendingPatch || msg.pendingPatch.status !== "pending") return;

      const pp = msg.pendingPatch;
      const hs = pp.hunkStatuses ?? {};

      const { patch: filtered, appliedFiles, skippedFiles } =
        filterPatchByHunks(pp.patch, pp.diffs, hs);

      if (filtered.changes.length === 0) {
        updateMessage(
          activeSessionId,
          messageId,
          `${msg.content}\n\n(No approved hunks to apply.)`,
          false,
        );
        return;
      }

      try {
        const result = await apiApplyPatch(
          pp.workspacePath,
          filtered,
          pp.previewId,
          pp.patchHash,
        );
        setPendingPatchApplySummary(activeSessionId, messageId, {
          applied: appliedFiles,
          skipped: skippedFiles,
        });
        updatePendingPatchStatus(
          activeSessionId,
          messageId,
          "approved",
          result.rollbackId,
        );
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Apply failed";
        setErrorMessage(activeSessionId, messageId, errorText);
      }
    },
    [activeSessionId, sessions, updatePendingPatchStatus, updateMessage, setPendingPatchApplySummary, setErrorMessage],
  );

  const handleRejectProposal = useCallback(
    async (messageId: string) => {
      if (!activeSessionId) return;
      try {
        await apiRejectPatch();
      } catch {
        /* best-effort */
      }
      updatePendingPatchStatus(activeSessionId, messageId, "rejected");
    },
    [activeSessionId, updatePendingPatchStatus],
  );

  const handleIncludeAll = useCallback(
    (messageId: string) => {
      if (!activeSessionId) return;
      const session = sessions.find((s) => s.id === activeSessionId);
      const msg = session?.messages.find((m) => m.id === messageId);
      if (!msg?.pendingPatch) return;
      const allHunkIds = msg.pendingPatch.diffs.flatMap(
        (d) => buildFileDiffWithHunks(d).hunks.map((h) => h.id),
      );
      bulkUpdateHunkStatuses(activeSessionId, messageId, allHunkIds, "approved");
    },
    [activeSessionId, sessions, bulkUpdateHunkStatuses],
  );

  const handleHunkAccept = useCallback(
    (messageId: string, hunkId: string) => {
      if (!activeSessionId) return;
      updateHunkStatus(activeSessionId, messageId, hunkId, "approved");
    },
    [activeSessionId, updateHunkStatus],
  );

  const handleHunkReject = useCallback(
    (messageId: string, hunkId: string) => {
      if (!activeSessionId) return;
      updateHunkStatus(activeSessionId, messageId, hunkId, "rejected");
    },
    [activeSessionId, updateHunkStatus],
  );

  const handleFileAcceptAll = useCallback(
    (messageId: string, file: string) => {
      if (!activeSessionId) return;
      const session = sessions.find((s) => s.id === activeSessionId);
      const msg = session?.messages.find((m) => m.id === messageId);
      if (!msg?.pendingPatch) return;
      const diff = msg.pendingPatch.diffs.find((d) => d.file === file);
      if (!diff) return;
      const ids = buildFileDiffWithHunks(diff).hunks.map((h) => h.id);
      bulkUpdateHunkStatuses(activeSessionId, messageId, ids, "approved");
    },
    [activeSessionId, sessions, bulkUpdateHunkStatuses],
  );

  const handleFileRejectAll = useCallback(
    (messageId: string, file: string) => {
      if (!activeSessionId) return;
      const session = sessions.find((s) => s.id === activeSessionId);
      const msg = session?.messages.find((m) => m.id === messageId);
      if (!msg?.pendingPatch) return;
      const diff = msg.pendingPatch.diffs.find((d) => d.file === file);
      if (!diff) return;
      const ids = buildFileDiffWithHunks(diff).hunks.map((h) => h.id);
      bulkUpdateHunkStatuses(activeSessionId, messageId, ids, "rejected");
    },
    [activeSessionId, sessions, bulkUpdateHunkStatuses],
  );

  /* ─── Analysis handlers ─── */

  const handleAnalyseCodebase = useCallback(async () => {
    if (!activeSessionId || analysing) return;
    const workspacePath = workspace?.root ?? "";
    if (!workspacePath) {
      addMessage(activeSessionId, {
        role: "assistant",
        content: "Open a workspace folder first.",
      });
      return;
    }
    setAnalysing(true);
    const msgId = addMessage(activeSessionId, {
      role: "assistant",
      content: "Running codebase analysis\u2026",
    });
    try {
      await runAnalysis(workspacePath);
      updateMessage(
        activeSessionId,
        msgId,
        "**Codebase analysis started.** The backend is running Scanner, AST Parser, Metadata Extractor, Dependency Graph Builder, and Embedding Generator.",
        false,
      );
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "Analysis failed";
      setErrorMessage(activeSessionId, msgId, errorText);
      updateMessage(activeSessionId, msgId, "", false);
    } finally {
      setAnalysing(false);
    }
  }, [activeSessionId, analysing, workspace?.root, addMessage, updateMessage, setErrorMessage]);

  const handleScanOnly = useCallback(async () => {
    if (!activeSessionId || analysing) return;
    const workspacePath = workspace?.root ?? "";
    if (!workspacePath) {
      addMessage(activeSessionId, {
        role: "assistant",
        content: "Open a workspace folder first.",
      });
      return;
    }
    setAnalysing(true);
    const msgId = addMessage(activeSessionId, {
      role: "assistant",
      content: "Scanning workspace\u2026",
    });
    try {
      const data = await runAnalysisScan(workspacePath);
      const report = formatScanReport(data);
      updateMessage(activeSessionId, msgId, report, false);
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "Scan failed";
      setErrorMessage(activeSessionId, msgId, errorText);
      updateMessage(activeSessionId, msgId, "", false);
    } finally {
      setAnalysing(false);
    }
  }, [activeSessionId, analysing, workspace?.root, addMessage, updateMessage, setErrorMessage]);

  const handleContinueStep = useCallback(() => {
    if (streaming) return;
    handleSend("Yes, continue with the next step.");
  }, [streaming, handleSend]);

  const handleStopStep = useCallback(() => {
    if (streaming) return;
    handleSend("Stop here, that's enough for now.");
  }, [streaming, handleSend]);

  const pastChats = sessions.slice(0, 10).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col h-full min-h-0 bg-v-bg">
      {/* ─── Header ─── */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-v-border">
        <span className="text-sm font-medium text-v-text">Viper AI</span>
        <div className="flex-1 min-w-0" />

        <button
          type="button"
          className="v-press p-1.5 rounded-lg text-v-text3 hover:bg-white/[0.04] hover:text-v-text transition-colors"
          title="History"
          onClick={() => setPastChatsOpen((v) => !v)}
        >
          <Clock size={15} />
        </button>

        <div className="relative">
          <button
            type="button"
            className="v-press p-1.5 rounded-lg text-v-text3 hover:bg-white/[0.04] hover:text-v-text transition-colors"
            title="More actions"
            onClick={() => setActionsOpen((v) => !v)}
          >
            <MoreHorizontal size={15} />
          </button>
          {actionsOpen && (
            <div className="absolute right-0 top-full mt-1 py-1 rounded-lg border border-v-border bg-v-bg2 shadow-xl z-20 min-w-[220px]">
              <button
                type="button"
                className="v-press w-full text-left px-3 py-2 text-xs text-v-text hover:bg-white/[0.04] flex items-center gap-2 disabled:opacity-40"
                onClick={() => { handleAnalyseCodebase(); setActionsOpen(false); }}
                disabled={streaming || analysing}
              >
                <Scan size={14} className="text-v-accent" />
                Analyse Codebase
              </button>
              <button
                type="button"
                className="v-press w-full text-left px-3 py-2 text-xs text-v-text hover:bg-white/[0.04] flex items-center gap-2 disabled:opacity-40"
                onClick={() => { handleScanOnly(); setActionsOpen(false); }}
                disabled={streaming || analysing}
              >
                <Scan size={14} className="text-v-text3" />
                Scan only (Repo Scanner)
              </button>
              {import.meta.env.VITE_SUBSCRIPTION_IMPORT_URL ? (
                <button
                  type="button"
                  className="v-press w-full text-left px-3 py-2 text-xs text-v-text hover:bg-white/[0.04] flex items-center gap-2"
                  title="Opens v2RayTun via the deep link from docs.v2raytun.com/deep-link. Set VITE_SUBSCRIPTION_PUBLIC_ORIGIN if the URL uses localhost."
                  onClick={() => {
                    const subUrl = import.meta.env.VITE_SUBSCRIPTION_IMPORT_URL as string;
                    const deepLink = buildV2rayTunSubscriptionImportDeepLink(subUrl);
                    const open = window.viper?.shell?.openExternal;
                    if (open) {
                      void open(deepLink).catch(() => {
                        window.location.href = deepLink;
                      });
                    } else {
                      window.location.href = deepLink;
                    }
                    setActionsOpen(false);
                  }}
                >
                  <Code2 size={14} className="text-v-accent" />
                  Open subscription in v2RayTun
                </button>
              ) : null}
            </div>
          )}
        </div>

        <button
          type="button"
          className="v-press p-1.5 rounded-lg text-v-text3 hover:bg-white/[0.04] hover:text-v-text transition-colors"
          title="New chat"
          onClick={() => createSession()}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* ─── Past chats collapsible ─── */}
      {pastChatsOpen && (
        <div className="shrink-0 border-b border-v-border bg-v-bg2 animate-v-fade-in">
          <div className="px-3 py-2">
            <ul className="space-y-0.5 max-h-40 overflow-y-auto">
              {pastChats.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`v-press w-full text-left px-2 py-1.5 rounded-lg text-xs truncate flex items-center justify-between gap-2 transition-colors ${
                      s.id === activeSessionId
                        ? "bg-v-accent/10 text-v-text"
                        : "text-v-text2 hover:bg-white/[0.03] hover:text-v-text"
                    }`}
                    onClick={() => {
                      setActiveSessionId(s.id);
                      setPastChatsOpen(false);
                    }}
                  >
                    <span className="truncate min-w-0">{s.title}</span>
                    <span className="text-2xs text-v-text3 shrink-0">
                      {formatTimeAgo(s.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ─── Message stream ─── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
      >
        <div className="flex flex-col gap-3 p-2 max-w-3xl mx-auto">
          {/* ─── Empty state ─── */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 animate-v-fade-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-v-bg2 border border-v-border">
                <Sparkles size={24} className="text-v-accent" />
              </div>
              <div className="text-center space-y-1.5">
                <h2 className="text-base font-medium text-v-text">
                  Ask anything about your codebase
                </h2>
                <p className="text-sm text-v-text3 max-w-sm">
                  Viper can search, understand, modify, and explain your code.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {[
                  "Explain the auth flow",
                  "Find unused exports",
                  "Refactor this function",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="v-press px-3 py-1.5 rounded-lg text-xs text-v-text2 border border-v-border hover:bg-white/[0.03] hover:text-v-text transition-colors"
                    onClick={() => handleSend(q)}
                  >
                    <Code2 size={12} className="inline mr-1.5 -mt-px" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              onApplySelected={handleApplySelected}
              onRejectProposal={handleRejectProposal}
              onIncludeAll={handleIncludeAll}
              onHunkAccept={handleHunkAccept}
              onHunkReject={handleHunkReject}
              onFileAcceptAll={handleFileAcceptAll}
              onFileRejectAll={handleFileRejectAll}
              onContinueStep={handleContinueStep}
              onStopStep={handleStopStep}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ─── Sticky input ─── */}
      <div className="shrink-0 border-t border-v-border bg-v-bg px-3 py-1.5 max-w-3xl mx-auto w-full space-y-1.5">
        <div className="flex items-center gap-1">
          {(["ask", "plan", "debug", "agent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={streaming}
              onClick={() => activeSessionId && setChatMode(activeSessionId, m)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors ${
                currentMode === m
                  ? "bg-v-accent/15 text-v-accent"
                  : "text-v-text3 hover:bg-white/[0.04] hover:text-v-text"
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              {m}
            </button>
          ))}
        </div>
        <ChatInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  );
}
