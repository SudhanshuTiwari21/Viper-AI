import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, Terminal as TerminalIcon, Activity, Network } from "lucide-react";
import { ProblemsPanel } from "./panels/problems-panel";
import { DebugConsolePanel } from "./panels/debug-console-panel";
import { TerminalPanel } from "./panels/terminal-panel";
import { PortsPanel } from "./panels/ports-panel";

type PanelId = "problems" | "debug" | "terminal" | "ports";

const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 480;
const DEFAULT_PANEL_HEIGHT = 200;

interface PanelContainerProps {
  initialPanel?: PanelId;
}

export function PanelContainer({ initialPanel = "terminal" }: PanelContainerProps) {
  const [active, setActive] = useState<PanelId>(initialPanel);
  const [visible, setVisible] = useState(true);
  const [height, setHeight] = useState(DEFAULT_PANEL_HEIGHT);

  const startResize = useCallback(() => {
    const move = (ev: MouseEvent) => {
      const newH = window.innerHeight - ev.clientY;
      if (newH >= MIN_PANEL_HEIGHT && newH <= MAX_PANEL_HEIGHT) setHeight(newH);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, []);

  // Cmd/Ctrl + J toggles panel visibility (like VSCode)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabClass = (id: PanelId, label: string) =>
    `flex items-center gap-1 px-[var(--viper-space-2)] py-[var(--viper-space-1)] text-[11px] rounded-t transition-colors flex-shrink-0 ${
      active === id
        ? "text-[#e5e7eb] border-b-2"
        : "text-[#6b7280] hover:text-[#9ca3af] hover:bg-white/5"
    }`;

  return (
    <div
      className="flex flex-col flex-shrink-0 border-t"
      style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
    >
      <div
        className="flex items-center flex-shrink-0 border-b px-[var(--viper-space-1)]"
        style={{ height: 36, borderColor: "var(--viper-border)" }}
      >
        <button
          type="button"
          className={tabClass("problems", "Problems")}
          style={active === "problems" ? { borderBottomColor: "var(--viper-accent)" } : undefined}
          onClick={() => {
            setActive("problems");
            setVisible(true);
          }}
        >
          <AlertTriangle size={12} />
          Problems
        </button>
        <button
          type="button"
          className={tabClass("debug", "Debug Console")}
          style={active === "debug" ? { borderBottomColor: "var(--viper-accent)" } : undefined}
          onClick={() => {
            setActive("debug");
            setVisible(true);
          }}
        >
          <Activity size={12} />
          Debug Console
        </button>
        <button
          type="button"
          className={tabClass("terminal", "Terminal")}
          style={active === "terminal" ? { borderBottomColor: "var(--viper-accent)" } : undefined}
          onClick={() => {
            setActive("terminal");
            setVisible(true);
          }}
        >
          <TerminalIcon size={12} />
          Terminal
        </button>
        <button
          type="button"
          className={tabClass("ports", "Ports")}
          style={active === "ports" ? { borderBottomColor: "var(--viper-accent)" } : undefined}
          onClick={() => {
            setActive("ports");
            setVisible(true);
          }}
        >
          <Network size={12} />
          Ports
        </button>
        <div className="flex-1 min-w-0" />
        <button
          type="button"
          className="text-[10px] px-2 py-1 rounded text-[#6b7280] hover:bg-white/5 hover:text-[#e5e7eb]"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {visible && (
        <>
          <div
            className="flex-shrink-0 h-1 cursor-n-resize hover:bg-[var(--viper-accent)] hover:opacity-30 transition-colors"
            style={{ background: "var(--viper-border)" }}
            onMouseDown={(e) => {
              e.preventDefault();
              startResize();
            }}
            role="separator"
            aria-label="Resize panel"
          />
          <div className="flex flex-col min-h-0 overflow-hidden" style={{ height }}>
            {active === "problems" && <ProblemsPanel />}
            {active === "debug" && <DebugConsolePanel />}
            {active === "terminal" && <TerminalPanel />}
            {active === "ports" && <PortsPanel />}
          </div>
        </>
      )}
    </div>
  );
}

