import type { SidebarView } from "./activity-bar";

interface SidebarPlaceholderProps {
  view: SidebarView;
  title: string;
  message: string;
}

export function SidebarPlaceholder({ view, title, message }: SidebarPlaceholderProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 p-[var(--viper-space-2)]" style={{ background: "var(--viper-sidebar)" }}>
      <div className="flex items-center h-9 border-b mb-[var(--viper-space-2)]" style={{ borderColor: "var(--viper-border)" }}>
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          {title}
        </span>
      </div>
      <p className="text-[13px] text-[#6b7280]">{message}</p>
    </div>
  );
}
