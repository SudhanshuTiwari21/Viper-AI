import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";

export interface OutputEntry {
  id: string;
  source: string;
  message: string;
  timestamp: number;
}

type AddOutput = (source: string, message: string) => void;

const OutputContext = createContext<{
  entries: OutputEntry[];
  addOutput: AddOutput;
  clear: () => void;
} | null>(null);

let idCounter = 0;
function nextId() {
  return `out-${++idCounter}`;
}

export function OutputProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  const addOutput = useCallback<AddOutput>((source, message) => {
    setEntries((prev) => [
      ...prev,
      { id: nextId(), source, message, timestamp: Date.now() },
    ]);
  }, []);
  const clear = useCallback(() => setEntries([]), []);
  return (
    <OutputContext.Provider value={{ entries, addOutput, clear }}>
      {children}
    </OutputContext.Provider>
  );
}

export function useOutput() {
  const ctx = useContext(OutputContext);
  if (!ctx) throw new Error("useOutput must be used within OutputProvider");
  return ctx;
}
