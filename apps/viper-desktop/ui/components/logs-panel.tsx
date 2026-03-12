import { useOutput } from "../contexts/output-context";

/** Logs panel: same as Output for now, can be split later (e.g. debug vs build logs). */
export function LogsPanel() {
  const { entries, clear } = useOutput();

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--viper-bg)" }}>
      <div
        className="flex items-center justify-between h-8 px-[var(--viper-space-2)] flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Logs
        </span>
        <button
          type="button"
          className="p-[var(--viper-space-1)] rounded text-[#6b7280] hover:bg-white/5 hover:text-[#e5e7eb] transition-colors"
          title="Clear"
          onClick={clear}
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-[var(--viper-space-2)] font-mono text-[12px] whitespace-pre-wrap break-words text-[#9ca3af]">
        {entries.length === 0 && <p className="text-[#6b7280]">No logs yet.</p>}
        {entries.map((e) => (
          <div
            key={e.id}
            className="py-0.5 border-b last:border-0"
            style={{ borderColor: "var(--viper-border)" }}
          >
            <span style={{ color: "var(--viper-accent)" }}>[{e.source}]</span>{" "}
            <span className="text-[#e5e7eb]">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
