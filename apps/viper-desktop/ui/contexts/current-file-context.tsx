import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback } from "react";

export interface CurrentFileState {
  path: string | null;
  content: string | null;
}

type SetCurrentFile = (path: string | null, content: string | null) => void;

const CurrentFileContext = createContext<{
  currentFile: CurrentFileState;
  setCurrentFile: SetCurrentFile;
} | null>(null);

export function CurrentFileProvider({ children }: { children: ReactNode }) {
  const [currentFile, setState] = useState<CurrentFileState>({
    path: null,
    content: null,
  });
  const setCurrentFile = useCallback<SetCurrentFile>((path, content) => {
    setState({ path, content });
  }, []);
  return (
    <CurrentFileContext.Provider value={{ currentFile, setCurrentFile }}>
      {children}
    </CurrentFileContext.Provider>
  );
}

export function useCurrentFile() {
  const ctx = useContext(CurrentFileContext);
  if (!ctx) throw new Error("useCurrentFile must be used within CurrentFileProvider");
  return ctx;
}
