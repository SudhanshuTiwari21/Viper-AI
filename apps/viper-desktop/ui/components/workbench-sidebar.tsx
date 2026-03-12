import type { SidebarView } from "./activity-bar";
import { ExplorerSection } from "./explorer-section";
import { SidebarPlaceholder } from "./sidebar-placeholder";
import type { DocumentSymbol } from "./outline-section";

export interface WorkbenchSidebarProps {
  activeView: SidebarView;
  documentSymbols?: DocumentSymbol[] | null;
}

export function WorkbenchSidebar({ activeView, documentSymbols }: WorkbenchSidebarProps) {
  return (
    <div
      className="w-full flex-shrink-0 flex flex-col min-h-0"
      style={{ background: "var(--viper-sidebar)", borderRight: "1px solid var(--viper-border)" }}
    >
      <ExplorerSection activeView={activeView} />
      {activeView === "search" && (
        <SidebarPlaceholder
          view="search"
          title="Search"
          message="Search across your workspace. Coming soon."
        />
      )}
      {activeView === "git" && (
        <SidebarPlaceholder
          view="git"
          title="Source Control"
          message="View changes and commits. Coming soon."
        />
      )}
      {activeView === "extensions" && (
        <SidebarPlaceholder
          view="extensions"
          title="Extensions"
          message="Install extensions. Coming soon."
        />
      )}
      {activeView === "run" && (
        <SidebarPlaceholder
          view="run"
          title="Run & Debug"
          message="Configure and run/debug tasks. Coming soon."
        />
      )}
    </div>
  );
}
