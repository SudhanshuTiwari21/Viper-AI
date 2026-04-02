import {
  FolderOpen,
  Search,
  GitBranch,
  Puzzle,
  PlayCircle,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type SidebarView =
  | "explorer"
  | "search"
  | "git"
  | "extensions"
  | "run"
  | "usage";

interface ActivityBarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

const VIEWS: { id: SidebarView; icon: LucideIcon; title: string }[] = [
  { id: "explorer", icon: FolderOpen, title: "Explorer" },
  { id: "search", icon: Search, title: "Search" },
  { id: "git", icon: GitBranch, title: "Source Control" },
  { id: "extensions", icon: Puzzle, title: "Extensions" },
  { id: "run", icon: PlayCircle, title: "Run & Debug" },
  { id: "usage", icon: BarChart3, title: "Usage & Plan" },
];

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  return (
    <aside
      className="flex flex-col w-12 flex-shrink-0 items-center py-[var(--viper-space-1)] gap-[var(--viper-space-1)]"
      style={{ background: "var(--viper-sidebar)", borderRight: "1px solid var(--viper-border)" }}
      role="tablist"
      aria-label="Primary"
    >
      {VIEWS.map(({ id, icon: Icon, title }) => {
        const isActive = activeView === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={title}
            title={title}
            className={`relative w-12 h-10 flex items-center justify-center rounded transition-all duration-150 ${
              isActive
                ? "text-[var(--viper-accent)]"
                : "text-[#9ca3af] hover:text-[#e5e7eb] hover:shadow-[0_0_12px_rgba(34,197,94,0.15)]"
            }`}
            onClick={() => onViewChange(id)}
          >
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                style={{ background: "var(--viper-accent)" }}
              />
            )}
            <Icon size={22} strokeWidth={1.75} />
          </button>
        );
      })}
    </aside>
  );
}
