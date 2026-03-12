interface PortInfo {
  port: number;
  service: string;
  url: string;
}

const COMMON_PORTS: PortInfo[] = [
  { port: 5173, service: "Vite Dev Server", url: "http://localhost:5173" },
  { port: 3000, service: "Node / Next.js Dev", url: "http://localhost:3000" },
];

export function PortsPanel() {
  // For now this is a static list; later we can detect live ports.
  const ports = COMMON_PORTS;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--viper-bg)" }}>
      <div
        className="flex items-center justify-between h-8 px-[var(--viper-space-2)] flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Ports
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-[var(--viper-space-2)] text-[12px] text-[#9ca3af]">
        {ports.length === 0 && <p className="text-[#6b7280]">No active ports detected.</p>}
        {ports.length > 0 && (
          <table className="w-full text-left text-[12px]">
            <thead className="text-[#6b7280] border-b" style={{ borderColor: "var(--viper-border)" }}>
              <tr>
                <th className="py-1 pr-2">Port</th>
                <th className="py-1 pr-2">Service</th>
                <th className="py-1 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p) => (
                <tr key={p.port} className="border-b last:border-0" style={{ borderColor: "var(--viper-border)" }}>
                  <td className="py-1 pr-2 text-[#e5e7eb]">{p.port}</td>
                  <td className="py-1 pr-2">{p.service}</td>
                  <td className="py-1 pr-2">
                    <button
                      type="button"
                      className="text-[11px] text-[var(--viper-accent)] hover:underline"
                      onClick={() => window.open(p.url, "_blank")}
                    >
                      Open in browser
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

