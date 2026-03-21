import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { CodePatch } from "../lib/patch-types";
import { useWorkspaceContext } from "./workspace-context";
import type { HunkApprovalStatus } from "../components/inline-diff-viewer";

export interface ExecutionStep {
  stepId: string;
  stepType: string;
  status: "running" | "complete" | "skipped";
  durationMs?: number;
}

export type StreamingPhase =
  | "intent"
  | "planning"
  | "executing"
  | "reasoning"
  | "generating"
  | "awaiting_approval"
  | "done";

export interface PendingDiff {
  file: string;
  before: string;
  after: string;
}

export interface PlanStep {
  id: string;
  type: string;
  description?: string;
}

export interface ExploredCounts {
  files: number;
  functions: number;
  tokens: number;
}

export interface PendingPatchData {
  patch: { changes: unknown[]; operations: unknown[] };
  diffs: PendingDiff[];
  workspacePath: string;
  previewId: string;
  patchHash: string;
  status: "pending" | "approved" | "rejected";
  rollbackId?: string;
  hunkStatuses?: Record<string, HunkApprovalStatus>;
  applySummary?: { applied: number; skipped: number };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  patches?: CodePatch[];
  steps?: ExecutionStep[];
  streamingPhase?: StreamingPhase;
  tokenBuffer?: string;
  pendingPatch?: PendingPatchData;
  planSteps?: PlanStep[];
  exploredFiles?: string[];
  exploredCounts?: ExploredCounts;
  errorMessage?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  attachedPaths?: string[];
}

interface ChatContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createSession: () => string;
  addMessage: (sessionId: string, message: Omit<ChatMessage, "id">) => string;
  updateMessage: (sessionId: string, messageId: string, content: string, streaming?: boolean) => void;
  setSessionTitle: (sessionId: string, title: string) => void;
  addAttachedPath: (sessionId: string, path: string) => void;
  addAttachedPathToNewSession: (path: string) => string;
  appendTokens: (sessionId: string, messageId: string, tokens: string) => void;
  updateSteps: (sessionId: string, messageId: string, steps: ExecutionStep[]) => void;
  setStreamingPhase: (sessionId: string, messageId: string, phase: StreamingPhase) => void;
  setPendingPatch: (sessionId: string, messageId: string, data: PendingPatchData) => void;
  updatePendingPatchStatus: (sessionId: string, messageId: string, status: PendingPatchData["status"], rollbackId?: string) => void;
  updateHunkStatus: (sessionId: string, messageId: string, hunkId: string, status: HunkApprovalStatus) => void;
  bulkUpdateHunkStatuses: (sessionId: string, messageId: string, hunkIds: string[], status: HunkApprovalStatus) => void;
  setPendingPatchApplySummary: (sessionId: string, messageId: string, summary: { applied: number; skipped: number }) => void;
  setPlanSteps: (sessionId: string, messageId: string, steps: PlanStep[]) => void;
  setExploredFiles: (sessionId: string, messageId: string, files: string[], counts?: ExploredCounts) => void;
  setErrorMessage: (sessionId: string, messageId: string, error: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function newId() {
  return crypto.randomUUID();
}

function createNewSession(): ChatSession {
  return {
    id: newId(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
  };
}

const initialSession = createNewSession();

function updateMsg(
  sessions: ChatSession[],
  sessionId: string,
  messageId: string,
  updater: (m: ChatMessage) => ChatMessage,
): ChatSession[] {
  return sessions.map((s) =>
    s.id === sessionId
      ? { ...s, messages: s.messages.map((m) => (m.id === messageId ? updater(m) : m)) }
      : s,
  );
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspaceContext();

  const [sessions, setSessions] = useState<ChatSession[]>(() => [initialSession]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(() => initialSession.id);

  const normalizeWorkspaceKey = useCallback((rootPath: string) => {
    return rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  }, []);

  const workspaceKey = workspace?.root ? normalizeWorkspaceKey(workspace.root) : null;
  const storageKey = workspaceKey ? `viperai.chat.${workspaceKey}` : null;

  useEffect(() => {
    if (!storageKey) {
      setSessions([initialSession]);
      setActiveSessionIdState(initialSession.id);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        const s = createNewSession();
        setSessions([s]);
        setActiveSessionIdState(s.id);
        return;
      }
      const parsed = JSON.parse(raw) as {
        sessions?: ChatSession[];
        activeSessionId?: string | null;
      };
      if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
        setSessions(parsed.sessions);
      } else {
        setSessions([createNewSession()]);
      }
      const fallbackId = parsed.sessions?.[0]?.id;
      setActiveSessionIdState(parsed.activeSessionId ?? fallbackId ?? null);
    } catch {
      const s = createNewSession();
      setSessions([s]);
      setActiveSessionIdState(s.id);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ sessions, activeSessionId }),
      );
    } catch {
      /* ignore */
    }
  }, [storageKey, sessions, activeSessionId]);

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdState(id);
  }, []);

  const createSession = useCallback((): string => {
    const session = createNewSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionIdState(session.id);
    return session.id;
  }, []);

  const addMessage = useCallback((sessionId: string, message: Omit<ChatMessage, "id">): string => {
    const id = newId();
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, { ...message, id }] }
          : s,
      ),
    );
    return id;
  }, []);

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, content: string, streaming?: boolean) => {
      setSessions((prev) => updateMsg(prev, sessionId, messageId, (m) => ({ ...m, content, streaming })));
    },
    [],
  );

  const setSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s)),
    );
  }, []);

  const addAttachedPath = useCallback((sessionId: string, path: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, attachedPaths: [...(s.attachedPaths ?? []), path] }
          : s,
      ),
    );
  }, []);

  const addAttachedPathToNewSession = useCallback((path: string): string => {
    const session = createNewSession();
    session.attachedPaths = [path];
    setSessions((prev) => [session, ...prev]);
    setActiveSessionIdState(session.id);
    return session.id;
  }, []);

  const appendTokens = useCallback(
    (sessionId: string, messageId: string, tokens: string) => {
      setSessions((prev) =>
        updateMsg(prev, sessionId, messageId, (m) => ({
          ...m,
          tokenBuffer: (m.tokenBuffer ?? "") + tokens,
        })),
      );
    },
    [],
  );

  const updateSteps = useCallback(
    (sessionId: string, messageId: string, steps: ExecutionStep[]) => {
      setSessions((prev) => updateMsg(prev, sessionId, messageId, (m) => ({ ...m, steps })));
    },
    [],
  );

  const setStreamingPhase = useCallback(
    (sessionId: string, messageId: string, phase: StreamingPhase) => {
      setSessions((prev) => updateMsg(prev, sessionId, messageId, (m) => ({ ...m, streamingPhase: phase })));
    },
    [],
  );

  const setPendingPatch = useCallback(
    (sessionId: string, messageId: string, data: PendingPatchData) => {
      setSessions((prev) => updateMsg(prev, sessionId, messageId, (m) => ({ ...m, pendingPatch: data })));
    },
    [],
  );

  const updatePendingPatchStatus = useCallback(
    (sessionId: string, messageId: string, status: PendingPatchData["status"], rollbackId?: string) => {
      setSessions((prev) =>
        updateMsg(prev, sessionId, messageId, (m) =>
          m.pendingPatch
            ? { ...m, pendingPatch: { ...m.pendingPatch, status, rollbackId: rollbackId ?? m.pendingPatch.rollbackId } }
            : m,
        ),
      );
    },
    [],
  );

  const updateHunkStatus = useCallback(
    (sessionId: string, messageId: string, hunkId: string, status: HunkApprovalStatus) => {
      setSessions((prev) =>
        updateMsg(prev, sessionId, messageId, (m) => {
          if (!m.pendingPatch) return m;
          return {
            ...m,
            pendingPatch: {
              ...m.pendingPatch,
              hunkStatuses: { ...(m.pendingPatch.hunkStatuses ?? {}), [hunkId]: status },
            },
          };
        }),
      );
    },
    [],
  );

  const bulkUpdateHunkStatuses = useCallback(
    (sessionId: string, messageId: string, hunkIds: string[], status: HunkApprovalStatus) => {
      setSessions((prev) =>
        updateMsg(prev, sessionId, messageId, (m) => {
          if (!m.pendingPatch) return m;
          const next = { ...(m.pendingPatch.hunkStatuses ?? {}) };
          for (const id of hunkIds) next[id] = status;
          return { ...m, pendingPatch: { ...m.pendingPatch, hunkStatuses: next } };
        }),
      );
    },
    [],
  );

  const setPendingPatchApplySummary = useCallback(
    (sessionId: string, messageId: string, summary: { applied: number; skipped: number }) => {
      setSessions((prev) =>
        updateMsg(prev, sessionId, messageId, (m) =>
          m.pendingPatch ? { ...m, pendingPatch: { ...m.pendingPatch, applySummary: summary } } : m,
        ),
      );
    },
    [],
  );

  const setPlanSteps = useCallback(
    (sessionId: string, messageId: string, steps: PlanStep[]) => {
      setSessions((prev) => updateMsg(prev, sessionId, messageId, (m) => ({ ...m, planSteps: steps })));
    },
    [],
  );

  const setExploredFiles = useCallback(
    (sessionId: string, messageId: string, files: string[], counts?: ExploredCounts) => {
      setSessions((prev) =>
        updateMsg(prev, sessionId, messageId, (m) => ({
          ...m,
          exploredFiles: files,
          exploredCounts: counts,
        })),
      );
    },
    [],
  );

  const setErrorMessage = useCallback(
    (sessionId: string, messageId: string, error: string) => {
      setSessions((prev) => updateMsg(prev, sessionId, messageId, (m) => ({ ...m, errorMessage: error })));
    },
    [],
  );

  const value: ChatContextValue = {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    updateMessage,
    setSessionTitle,
    addAttachedPath,
    addAttachedPathToNewSession,
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
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
