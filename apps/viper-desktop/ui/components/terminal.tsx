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
  const hasShownBannerRef = useRef(false);

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

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitRef.current = fitAddon;
    fitAddon.fit();
    if (term.cols && term.rows) {
      terminalApi.resize(term.cols, term.rows);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) return;
      fitRef.current.fit();
      if (termRef.current.cols && termRef.current.rows) {
        terminalApi.resize(termRef.current.cols, termRef.current.rows);
      }
    });
    resizeObserver.observe(el);

    terminalApi.onData((data: string) => {
      term.write(data);
    });
    term.onData((data: string) => {
      terminalApi.write(data);
    });

    const onOpenHere = (e: Event) => {
      const detail = (e as CustomEvent<{ cwd?: string }>).detail;
      const nextCwd = detail?.cwd ?? "";
      rootRef.current = nextCwd;
      terminalApi
        .destroy()
        .then(() => terminalApi.create(nextCwd))
        .then(() => {
          if (termRef.current?.cols && termRef.current?.rows) {
            terminalApi.resize(termRef.current.cols, termRef.current.rows);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("viper:open-terminal-here", onOpenHere as EventListener);

    return () => {
      resizeObserver.disconnect();
      terminalApi.destroy();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      window.removeEventListener("viper:open-terminal-here", onOpenHere as EventListener);
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
        if (!term) return;

        if (!hasShownBannerRef.current) {
          term.write(`\x1b[38;5;244m[Terminal] Starting shell in ${cwd || "default directory"}...\x1b[0m\r\n`);
          hasShownBannerRef.current = true;
        }

        if (!res?.ok) {
          term.write(
            "\x1b[38;5;203m[Terminal] Failed to start shell. See Electron console for details.\x1b[0m\r\n"
          );
          return;
        }

        if (term.cols && term.rows) {
          terminalApi.resize(term.cols, term.rows);
        }
      })
      .catch(() => {
        const term = termRef.current;
        if (!term) return;
        term.write(
          "\x1b[38;5;203m[Terminal] Error starting shell. See Electron console for details.\x1b[0m\r\n"
        );
      });
  }, [cwd]);

  return (
    <div
      className="h-full w-full flex flex-col text-xs min-h-0"
      style={{ background: "var(--viper-bg)" }}
    >
      <div
        className="flex-1 min-h-0 w-full overflow-auto p-[var(--viper-space-1)]"
        ref={containerRef}
      />
    </div>
  );
}
