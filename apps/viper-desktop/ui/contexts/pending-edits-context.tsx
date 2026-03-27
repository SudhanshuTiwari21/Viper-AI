import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";

export interface PendingEdit {
  id: string;
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  description: string;
  timestamp: number;
}

interface PendingEditsContextValue {
  pendingEdits: PendingEdit[];
  addPendingEdit: (edit: PendingEdit) => void;
  removePendingEdit: (id: string) => void;
  getPendingEditForFile: (filePath: string) => PendingEdit | undefined;
  clearAllPending: () => void;
  /** Stack of accepted edits for undo support */
  acceptedStack: AcceptedEdit[];
  pushAccepted: (edit: AcceptedEdit) => void;
  popAccepted: () => AcceptedEdit | undefined;
}

export interface AcceptedEdit {
  id: string;
  filePath: string;
  beforeContent: string;
  afterContent: string;
  description: string;
  timestamp: number;
}

const PendingEditsContext = createContext<PendingEditsContextValue | null>(null);

export function PendingEditsProvider({ children }: { children: ReactNode }) {
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [acceptedStack, setAcceptedStack] = useState<AcceptedEdit[]>([]);

  const addPendingEdit = useCallback((edit: PendingEdit) => {
    setPendingEdits((prev) => {
      const existing = prev.findIndex((e) => e.filePath === edit.filePath);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = edit;
        return next;
      }
      return [...prev, edit];
    });
  }, []);

  const removePendingEdit = useCallback((id: string) => {
    setPendingEdits((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const getPendingEditForFile = useCallback(
    (filePath: string) => pendingEdits.find((e) => e.filePath === filePath),
    [pendingEdits],
  );

  const clearAllPending = useCallback(() => {
    setPendingEdits([]);
  }, []);

  const pushAccepted = useCallback((edit: AcceptedEdit) => {
    setAcceptedStack((prev) => [...prev, edit]);
  }, []);

  const popAccepted = useCallback((): AcceptedEdit | undefined => {
    let popped: AcceptedEdit | undefined;
    setAcceptedStack((prev) => {
      if (prev.length === 0) return prev;
      popped = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return popped;
  }, []);

  return (
    <PendingEditsContext.Provider
      value={{
        pendingEdits,
        addPendingEdit,
        removePendingEdit,
        getPendingEditForFile,
        clearAllPending,
        acceptedStack,
        pushAccepted,
        popAccepted,
      }}
    >
      {children}
    </PendingEditsContext.Provider>
  );
}

export function usePendingEdits() {
  const ctx = useContext(PendingEditsContext);
  if (!ctx) throw new Error("usePendingEdits must be used within PendingEditsProvider");
  return ctx;
}
