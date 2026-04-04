import type { SidebarView } from "./activity-bar";
import { ExplorerSection } from "./explorer-section";
import { SearchSidebar } from "./search-sidebar";
import { GitSidebar } from "./git-sidebar";
import { RunDebugSidebar } from "./run-debug-sidebar";
import { ExtensionsSidebar } from "./extensions-sidebar";
import { UsagePanel } from "./usage-panel";
import { TestPanel } from "./test-panel";
import type { DocumentSymbol } from "./outline-section";
import { useWorkspaceContext } from "../contexts/workspace-context";

export interface WorkbenchSidebarProps {
  activeView: SidebarView;
  documentSymbols?: DocumentSymbol[] | null;
}

export function WorkbenchSidebar({ activeView }: WorkbenchSidebarProps) {
  const { workspace } = useWorkspaceContext();

  return (
    <div
      className="w-full flex-1 flex flex-col min-h-0"
      style={{ background: "var(--viper-sidebar)", borderRight: "1px solid var(--viper-border)" }}
    >
      <ExplorerSection activeView={activeView} />
      {activeView === "search" && <SearchSidebar />}
      {activeView === "git" && <GitSidebar />}
      {activeView === "extensions" && <ExtensionsSidebar />}
      {activeView === "run" && <RunDebugSidebar />}
      {activeView === "usage" && (
        <UsagePanel workspacePath={workspace?.root ?? null} />
      )}
      {activeView === "tests" && (
        <TestPanel workspacePath={workspace?.root ?? null} />
      )}
    </div>
  );
}
