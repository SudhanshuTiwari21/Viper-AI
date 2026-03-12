import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";
import { terminalApi } from "../services/terminal";

interface TerminalProps {
  workspaceRoot: string | null;
}

export function Terminal({ workspaceRoot }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const rootRef = useRef<string | null>(null);

  const cwd = workspaceRoot ?? "";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new XTerm({
      theme: { background: "#0b0f17", foreground: "#e5e7eb" },
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      cursorBlink: true,
      allowProposedApi: false,
    });
    term.open(el);
    termRef.current = term;

    terminalApi.onData((data: string) => {
      term.write(data);
    });
    term.onData((data: string) => {
      terminalApi.write(data);
    });

    return () => {
      terminalApi.destroy();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rootRef.current === cwd) return;
    rootRef.current = cwd;
    terminalApi.destroy();
    terminalApi
      .create(cwd)
      .then((res) => {
        const term = termRef.current;
        if (!res?.ok || !term) return;
        if (term.cols && term.rows) {
          terminalApi.resize(term.cols, term.rows);
        }
      })
      .catch(() => {});
  }, [cwd]);

  return (
    <div className="h-full flex flex-col text-xs min-h-0" style={{ background: "var(--viper-bg)" }}>
      <div className="flex-1 min-h-0 p-[var(--viper-space-1)]" ref={containerRef} />
    </div>
  );
}
