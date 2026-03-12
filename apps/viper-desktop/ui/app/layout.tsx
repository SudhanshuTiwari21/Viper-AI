import type { ReactNode } from "react";
import { useWorkspaceContext } from "../contexts/workspace-context";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { workspace } = useWorkspaceContext();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d0d0d] text-zinc-200 overflow-hidden">
      <header className="flex-shrink-0 h-10 px-4 flex items-center border-b border-zinc-800/80 bg-zinc-900/50">
        <span className="font-semibold text-sm text-zinc-300 tracking-tight">
          Viper AI
        </span>
        <span className="ml-3 text-xs text-zinc-500 truncate max-w-[50vw]" title={workspace?.root ?? ""}>
          {workspace ? workspace.root : "No folder opened"}
        </span>
      </header>
      <main className="flex-1 flex min-h-0">
        {children}
      </main>
    </div>
  );
}
