import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Clock,
  MoreHorizontal,
  Scan,
} from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChat } from "../contexts/chat-context";
import type { ExecutionStep, PendingDiff } from "../contexts/chat-context";
import { useWorkspaceContext } from "../contexts/workspace-context";
import {
  sendChatStream,
  formatChatResponse,
  runAnalysis,
  runAnalysisScan,
  formatScanReport,
  applyPatch as apiApplyPatch,
  rejectPatch as apiRejectPatch,
  type ChatResponse,
} from "../services/agent-api";
import { filterPatchByHunks, buildInitialHunkStatuses } from "../lib/filter-patch";
import { buildFileDiffWithHunks } from "../lib/hunk-model";

function formatTimeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "Now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h`;
  return `${Math.floor(d / 86400_000)}d`;
}

export function ChatPanel() {
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    updateMessage,
    appendTokens,
    updateSteps,
    setStreamingPhase,
    setPendingPatch,
    updatePendingPatchStatus,
    updateHunkStatus,
    bulkUpdateHunkStatuses,
    setPendingPatchApplySummary,
    setPlanSteps,
    setExploredFiles,
    setErrorMessage,
  } = useChat();
  const { workspace } = useWorkspaceContext();
  const [streaming, setStreaming] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [pastChatsOpen, setPastChatsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ─── Send handler ─── */

  const handleSend = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || streaming || !activeSessionId) return;

      const workspacePath = workspace?.root ?? "";
      if (!workspacePath) {
        addMessage(activeSessionId, {
          role: "assistant",
          content: "Open a workspace folder first so the agent can use your codebase context.",
        });
        return;
      }

      const lastMessages = messages
        .filter((m) => !m.streaming)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

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
                setStreamingPhase(sid, assistantId, "intent");
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
                const d = event.data as { stepId: string; stepType: string };
                steps.push({ stepId: d.stepId, stepType: d.stepType, status: "running" });
                updateSteps(sid, assistantId, [...steps]);
                setStreamingPhase(sid, assistantId, "executing");
                break;
              }

              case "step:complete": {
                const d = event.data as { stepId: string; durationMs: number };
                const step = steps.find((s) => s.stepId === d.stepId);
                if (step) {
                  step.status = "complete";
                  step.durationMs = d.durationMs;
                }
                updateSteps(sid, assistantId, [...steps]);
                break;
              }

              case "step:skip": {
                const d = event.data as { stepId: string; stepType: string };
                steps.push({ stepId: d.stepId, stepType: d.stepType, status: "skipped" });
                updateSteps(sid, assistantId, [...steps]);
                break;
              }

              case "context:retrieved": {
                const d = event.data as {
                  files?: string[];
                  counts?: { files: number; functions: number; tokens: number };
                };
                if (d.files) {
                  setExploredFiles(sid, assistantId, d.files, d.counts);
                }
                break;
              }

              case "patch:start":
                setStreamingPhase(sid, assistantId, "generating");
                break;

              case "token": {
                const d = event.data as { content: string };
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
                const d = event.data as { summary?: string };
                if (d.summary) {
                  appendTokens(sid, assistantId, `\n\n**Reflection:** ${d.summary}`);
                }
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
                setStreamingPhase(sid, assistantId, "done");
                break;
            }
          },
          activeSessionId,
          lastMessages,
        );
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Request failed";
        setErrorMessage(sid, assistantId, errorText);
        updateMessage(sid, assistantId, "", false);
      } finally {
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
      updateSteps,
      setStreamingPhase,
      setPendingPatch,
      setPlanSteps,
      setExploredFiles,
      setErrorMessage,
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

  const pastChats = sessions.slice(0, 10).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col h-full min-h-0 bg-v-bg">
      {/* ─── Header ─── */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-v-border">
        <span className="text-sm font-medium text-v-text">Viper AI</span>
        <div className="flex-1 min-w-0" />

        {/* Past chats toggle */}
        <button
          type="button"
          className="v-press p-1.5 rounded-lg text-v-text3 hover:bg-white/[0.04] hover:text-v-text transition-colors"
          title="History"
          onClick={() => setPastChatsOpen((v) => !v)}
        >
          <Clock size={15} />
        </button>

        {/* Actions menu */}
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
                    className={`v-press w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate flex items-center justify-between gap-2 transition-colors ${
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
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
      >
        <div className="flex flex-col gap-5 p-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-center py-20">
              <p className="text-sm text-v-text3">
                Ask anything about your code.
              </p>
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
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── Sticky input ─── */}
      <div className="shrink-0 border-t border-v-border bg-v-bg p-3 max-w-3xl mx-auto w-full">
        <ChatInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  );
}
