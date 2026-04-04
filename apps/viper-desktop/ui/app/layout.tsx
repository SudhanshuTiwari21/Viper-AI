import type { ReactNode } from "react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { useAppRoute } from "../contexts/app-route-context";
import { DiagnosticsSubscription } from "../components/diagnostics-subscription";
import { LoginPlaceholderPage, RegisterPlaceholderPage } from "../components/auth-placeholder-pages";
import { ContextMenuProvider } from "../context-menu/context-menu-provider";

interface LayoutProps {
  children: ReactNode;
}

function getWorkspaceName(root: string | undefined): string {
  if (!root) return "Viper AI";
  const normalized = root.replace(/\/$/, "");
  const name = normalized.split("/").pop() ?? "Workspace";
  return `${name}`;
}

export function Layout({ children }: LayoutProps) {
  const { workspace } = useWorkspaceContext();
  const { route } = useAppRoute();
  const isAuth = route === "login" || route === "register";
  const title = isAuth ? "Viper AI" : getWorkspaceName(workspace?.root);

  return (
    <ContextMenuProvider>
      <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: "var(--viper-bg)" }}>
        <header
          className="flex-shrink-0 h-10 flex items-center px-[var(--viper-space-2)] border-b"
          style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
        >
          <span className="font-semibold text-sm tracking-tight text-[#e5e7eb]">
            {title}
          </span>
          <div className="flex-1 min-w-0" />
        </header>
        {isAuth ? (
          <main className="flex-1 min-h-0 overflow-auto">
            {route === "login" ? <LoginPlaceholderPage /> : <RegisterPlaceholderPage />}
          </main>
        ) : (
          <>
            <DiagnosticsSubscription />
            <main className="flex-1 flex min-h-0">{children}</main>
          </>
        )}
      </div>
    </ContextMenuProvider>
  );
}
