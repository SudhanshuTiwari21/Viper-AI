import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";
import type { CodePatch } from "../lib/patch-types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  /**
   * Optional structured patches proposed by the AI.
   * When present, the UI can render a diff + Apply/Reject controls.
   */
  patches?: CodePatch[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatContextValue {
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createSession: () => string;
  addMessage: (sessionId: string, message: Omit<ChatMessage, "id">) => string;
  updateMessage: (sessionId: string, messageId: string, content: string, streaming?: boolean) => void;
  setSessionTitle: (sessionId: string, title: string) => void;
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
  }
}

const initialSession = createNewSession();

export function ChatProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [initialSession]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(() => initialSession.id);

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
          : s
      )
    );
    return id;
  }, []);

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, content: string, streaming?: boolean) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === messageId ? { ...m, content, streaming } : m
                ),
              }
            : s
        )
      );
    },
    []
  );

  const setSessionTitle = useCallback((sessionId: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
  }, []);

  const value: ChatContextValue = {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    addMessage,
    updateMessage,
    setSessionTitle,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
