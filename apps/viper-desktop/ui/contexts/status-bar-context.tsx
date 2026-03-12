import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";

export interface StatusBarState {
  gitBranch: string;
  language: string;
  cursorLine: number;
  cursorCol: number;
}

const defaultState: StatusBarState = {
  gitBranch: "",
  language: "",
  cursorLine: 0,
  cursorCol: 0,
};

type SetStatus = Partial<StatusBarState>;

const StatusBarContext = createContext<{
  status: StatusBarState;
  setStatus: (s: SetStatus) => void;
} | null>(null);

export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [status, setState] = useState<StatusBarState>(defaultState);
  const setStatus = useCallback((s: SetStatus) => {
    setState((prev) => ({ ...prev, ...s }));
  }, []);
  return (
    <StatusBarContext.Provider value={{ status, setStatus }}>
      {children}
    </StatusBarContext.Provider>
  );
}

export function useStatusBar() {
  const ctx = useContext(StatusBarContext);
  if (!ctx) throw new Error("useStatusBar must be used within StatusBarProvider");
  return ctx;
}
