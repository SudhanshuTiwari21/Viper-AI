import { useOutput } from "../../contexts/output-context";

export function DebugConsolePanel() {
  const { entries } = useOutput();

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--viper-bg)" }}>
      <div
        className="flex items-center justify-between h-8 px-[var(--viper-space-2)] flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Debug Console
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-[var(--viper-space-2)] font-mono text-[12px] whitespace-pre-wrap break-words text-[#9ca3af]">
        {entries.length === 0 && (
          <p className="text-[#6b7280]">
            No debug output yet. Logs from Electron/agents will appear here.
          </p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="py-0.5">
            <span className="text-[#6b7280] mr-1">
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
            <span style={{ color: "var(--viper-accent)" }}>[{e.source}]</span>{" "}
            <span className="text-[#e5e7eb]">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

