import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { terminalApi } from "../services/terminal";

interface TerminalProps {
  workspaceRoot: string | null;
}

export function Terminal({ workspaceRoot }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const rootRef = useRef<string | null>(null);

  // Empty string: backend will use process.env.HOME as cwd
  const cwd = workspaceRoot ?? "";

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: { background: "#050507", foreground: "#e5e5e5" },
      fontSize: 12,
      cursorBlink: true,
      allowProposedApi: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    function doResize() {
      fit.fit();
      const cols = term.cols;
      const rows = term.rows;
      if (cols && rows) terminalApi.resize(cols, rows);
    }

    window.addEventListener("resize", doResize);

    terminalApi.onData((data: string) => {
      term.write(data);
    });
    term.onData((data: string) => {
      terminalApi.write(data);
    });

    return () => {
      window.removeEventListener("resize", doResize);
      terminalApi.destroy();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rootRef.current === cwd) return;
    rootRef.current = cwd;
    terminalApi.destroy();
    terminalApi.create(cwd).then(() => {
      const term = termRef.current;
      const fit = fitRef.current;
      if (term && fit) {
        fit.fit();
        terminalApi.resize(term.cols, term.rows);
      }
    });
  }, [cwd]);

  return (
    <div className="h-full flex flex-col text-xs text-zinc-100 bg-[#050507]">
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800/80 flex-shrink-0">
        <span className="text-[11px] text-zinc-400">Terminal</span>
        {workspaceRoot && (
          <span className="text-[10px] text-zinc-500 truncate max-w-[240px]" title={workspaceRoot}>
            {workspaceRoot}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 p-1" ref={containerRef} />
    </div>
  );
}
