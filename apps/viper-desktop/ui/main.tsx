import React, { Component, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { WorkspaceProvider } from "./contexts/workspace-context";
import { CurrentFileProvider } from "./contexts/current-file-context";
import { OutputProvider } from "./contexts/output-context";
import { StatusBarProvider } from "./contexts/status-bar-context";
import { ChatProvider } from "./contexts/chat-context";
import { DiagnosticsProvider } from "./contexts/diagnostics-context";
import { PendingEditsProvider } from "./contexts/pending-edits-context";
import { Layout } from "./app/layout";
import { Page } from "./app/page";
import "./styles/globals.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "#0d0d0d",
            color: "#e5e5e5",
            fontFamily: "system-ui, sans-serif",
            padding: 24,
            flexDirection: "column",
            gap: 12,
            textAlign: "left",
          }}
        >
          <strong style={{ color: "#f87171" }}>Something went wrong</strong>
          <pre style={{ fontSize: 12, color: "#a1a1aa", overflow: "auto", maxWidth: "100%" }}>
            {e.message}
          </pre>
          {e.stack && (
            <pre style={{ fontSize: 11, color: "#71717a", overflow: "auto", maxHeight: 200 }}>
              {e.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <WorkspaceProvider>
      <CurrentFileProvider>
        <OutputProvider>
          <StatusBarProvider>
            <DiagnosticsProvider>
              <ChatProvider>
                <PendingEditsProvider>
                  <Layout>
                    <Page />
                  </Layout>
                </PendingEditsProvider>
              </ChatProvider>
            </DiagnosticsProvider>
          </StatusBarProvider>
        </OutputProvider>
      </CurrentFileProvider>
    </WorkspaceProvider>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root");

if (typeof window !== "undefined" && window.viper) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  rootEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0d0d0d;color:#a1a1aa;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
      <div>
        <p style="font-size:14px;margin-bottom:8px;">Viper API not available.</p>
        <p style="font-size:12px;color:#71717a;">Run this app with Electron: <code style="background:#27272a;padding:2px 6px;border-radius:4px;">npm run dev</code></p>
      </div>
    </div>
  `;
}
