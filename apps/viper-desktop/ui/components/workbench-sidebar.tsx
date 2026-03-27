import type { SidebarView } from "./activity-bar";
import { ExplorerSection } from "./explorer-section";
import { SearchSidebar } from "./search-sidebar";
import { GitSidebar } from "./git-sidebar";
import { RunDebugSidebar } from "./run-debug-sidebar";
import { ExtensionsSidebar } from "./extensions-sidebar";
import type { DocumentSymbol } from "./outline-section";

export interface WorkbenchSidebarProps {
  activeView: SidebarView;
  documentSymbols?: DocumentSymbol[] | null;
}

export function WorkbenchSidebar({ activeView, documentSymbols }: WorkbenchSidebarProps) {
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
    </div>
  );
}
