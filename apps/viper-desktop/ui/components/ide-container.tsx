import { useState, useCallback, useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { ActivityBar } from "./activity-bar";
import type { SidebarView } from "./activity-bar";
import { WorkbenchSidebar } from "./workbench-sidebar";
import { EditorContainer } from "./editor-container";
import { ChatPanel } from "./chat-panel";
import { PanelContainer } from "./panel-container";
import { StatusBar } from "./status-bar";
import { CommandPalette } from "./command-palette";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { useRegisterDefaultCommands } from "../commands/default-commands";

const MIN_LEFT_SIDEBAR_WIDTH = 200;
const MAX_LEFT_SIDEBAR_WIDTH = 400;
const DEFAULT_LEFT_SIDEBAR_WIDTH = 256;

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 420;
const CHAT_COLLAPSE_THRESHOLD = 80;

export function IDEContainer() {
  const { workspace } = useWorkspaceContext();
  useRegisterDefaultCommands();
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(DEFAULT_LEFT_SIDEBAR_WIDTH);
  const [chatPanelVisible, setChatPanelVisible] = useState(true);
  const [chatPanelWidth, setChatPanelWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const chatWidthBeforeCollapse = useRef(DEFAULT_CHAT_WIDTH);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onOpen = () => setCommandPaletteOpen(true);
    window.addEventListener("viper:open-command-palette", onOpen);
    return () => window.removeEventListener("viper:open-command-palette", onOpen);
  }, []);

  useEffect(() => {
    const onFocusExplorer = () => {
      setSidebarView("explorer");
      setLeftSidebarOpen(true);
    };
    const onFocusChat = () => {
      setChatPanelWidth(chatWidthBeforeCollapse.current);
      setChatPanelVisible(true);
    };
    window.addEventListener("viper:focus-explorer", onFocusExplorer);
    window.addEventListener("viper:focus-chat", onFocusChat);
    return () => {
      window.removeEventListener("viper:focus-explorer", onFocusExplorer);
      window.removeEventListener("viper:focus-chat", onFocusChat);
    };
  }, []);

  // Cmd+B / Ctrl+B: toggle left explorer sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setLeftSidebarOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cmd+L / Ctrl+L: open chat panel only (do not close); restore width if was collapsed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setChatPanelWidth(chatWidthBeforeCollapse.current);
        setChatPanelVisible(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clicking activity bar icon when sidebar is closed opens it
  const handleViewChange = useCallback((view: SidebarView) => {
    setSidebarView(view);
    setLeftSidebarOpen(true);
  }, []);

  const startLeftSidebarResize = useCallback(() => {
    const move = (ev: MouseEvent) => {
      const w = Math.max(MIN_LEFT_SIDEBAR_WIDTH, Math.min(MAX_LEFT_SIDEBAR_WIDTH, ev.clientX - 48));
      setLeftSidebarWidth(w);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, []);

  const startChatResize = useCallback(() => {
    let up: () => void;
    const move = (ev: MouseEvent) => {
      const w = window.innerWidth - ev.clientX;
      if (w < CHAT_COLLAPSE_THRESHOLD) {
        chatWidthBeforeCollapse.current = chatPanelWidth;
        setChatPanelVisible(false);
        setChatPanelWidth(DEFAULT_CHAT_WIDTH);
        up();
        return;
      }
      const clamped = Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, w));
      setChatPanelWidth(clamped);
    };
    up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [chatPanelWidth]);

  useEffect(() => {
    if (chatPanelVisible && chatPanelWidth !== chatWidthBeforeCollapse.current) {
      chatWidthBeforeCollapse.current = chatPanelWidth;
    }
  }, [chatPanelVisible, chatPanelWidth]);

  useEffect(() => {
    const onFocusSearch = () => setSidebarView("search");
    window.addEventListener("viper:focus-search", onFocusSearch);
    return () => window.removeEventListener("viper:focus-search", onFocusSearch);
  }, []);

  return (
    <>
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    <div className="flex-1 flex flex-col min-w-0 relative" style={{ background: "var(--viper-bg)" }}>
      <div className="flex flex-1 min-h-0">
        {/* Left: Activity bar (always visible) + optional resizable sidebar */}
        <ActivityBar activeView={sidebarView} onViewChange={handleViewChange} />
        {leftSidebarOpen && (
          <>
            <div
              className="flex-shrink-0 flex flex-col min-h-0"
              style={{ width: leftSidebarWidth }}
            >
              <WorkbenchSidebar activeView={sidebarView} />
            </div>
            <div
              className="flex-shrink-0 w-1 cursor-col-resize hover:bg-[var(--viper-accent)] hover:opacity-30 transition-colors"
              style={{ background: "var(--viper-border)", minWidth: 4 }}
              onMouseDown={(e) => {
                e.preventDefault();
                startLeftSidebarResize();
              }}
              role="separator"
              aria-label="Resize sidebar"
            />
          </>
        )}

        {/* Center: Editor */}
        <section
          className="flex-1 min-w-0 flex flex-col border-r"
          style={{
            borderColor: "var(--viper-border)",
            background: "var(--viper-bg)",
            minWidth: 0,
          }}
        >
          <EditorContainer />
        </section>

        {/* Right: Resizable chat panel (collapse only by dragging left); when collapsed, show thin tab to reopen */}
        {chatPanelVisible ? (
          <>
            <div
              className="flex-shrink-0 w-1 cursor-col-resize hover:bg-[var(--viper-accent)] hover:opacity-30 transition-colors"
              style={{ background: "var(--viper-border)", minWidth: 4 }}
              onMouseDown={(e) => {
                e.preventDefault();
                startChatResize();
              }}
              role="separator"
              aria-label="Resize chat panel"
            />
            <aside
              className="flex-shrink-0 flex flex-col min-h-0 border-l"
              style={{
                width: chatPanelWidth,
                borderColor: "var(--viper-border)",
                background: "var(--viper-sidebar)",
              }}
            >
              <ChatPanel />
            </aside>
          </>
        ) : (
          <button
            type="button"
            className="flex-shrink-0 w-8 flex flex-col items-center justify-center border-l py-4 gap-1 hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
            onClick={() => {
              setChatPanelWidth(chatWidthBeforeCollapse.current);
              setChatPanelVisible(true);
            }}
            title="Open Chat (⌘L / Ctrl+L)"
          >
            <MessageSquare size={18} className="text-[#9ca3af]" />
            <span className="text-[10px] text-[#6b7280] rotate-90 whitespace-nowrap">Chat</span>
          </button>
        )}
      </div>

      <PanelContainer />

      <StatusBar />
    </div>
    </>
  );
}
