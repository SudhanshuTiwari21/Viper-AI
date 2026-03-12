export function ProblemsPanel() {
  // Stub implementation – later wire to real diagnostics (TS, lint, build).
  return (
    <div className="flex flex-col h-full" style={{ background: "var(--viper-bg)" }}>
      <div
        className="flex items-center justify-between h-8 px-[var(--viper-space-2)] flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Problems
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-[var(--viper-space-2)] text-[12px] text-[#9ca3af]">
        <p className="text-[#6b7280]">No problems recorded yet.</p>
      </div>
    </div>
  );
}

