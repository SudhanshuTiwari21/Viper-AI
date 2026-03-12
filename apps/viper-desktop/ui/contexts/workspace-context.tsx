import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useWorkspace, type WorkspaceState } from "../hooks/useWorkspace";

type WorkspaceContextValue = {
  workspace: WorkspaceState | null;
  reload: () => Promise<void>;
  selectWorkspace: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspace();
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  return ctx;
}
