import { useState, useCallback, useEffect, useRef } from "react";
import {
  RefreshCw,
  Package,
  CheckCircle2,
  XCircle,
  Power,
  PowerOff,
  Loader2,
  FolderOpen,
  AlertCircle,
  Search,
  Download,
  Star,
  Trash2,
} from "lucide-react";

interface ExtensionEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  status: string;
  error?: string;
}

interface RegistryEntry {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  repositoryUrl: string;
  packageUrl: string;
}

type Tab = "installed" | "marketplace";

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ExtensionIcon({ name, active }: { name: string; active?: boolean }) {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
    "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
  ];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  const bg = active ? "#10b981" : colors[idx];
  const letter = (name || "?").charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center justify-center shrink-0 rounded text-[10px] font-bold text-white"
      style={{ width: 28, height: 28, background: bg }}
    >
      {letter}
    </div>
  );
}

function InstalledTab() {
  const [extensions, setExtensions] = useState<ExtensionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const exts = await window.viper.extensions.scan();
      setExtensions(exts);
    } catch {
      setExtensions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scan();
  }, [scan]);

  const handleActivate = useCallback(async (id: string) => {
    const ok = await window.viper.extensions.activate(id);
    if (ok) {
      setExtensions((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "active" } : e)),
      );
    }
  }, []);

  const handleDeactivate = useCallback(async (id: string) => {
    const ok = await window.viper.extensions.deactivate(id);
    if (ok) {
      setExtensions((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "installed" } : e)),
      );
    }
  }, []);

  const handleUninstall = useCallback(async (id: string) => {
    setUninstalling(id);
    try {
      const ok = await window.viper.extensions.uninstall(id);
      if (ok) {
        setExtensions((prev) => prev.filter((e) => e.id !== id));
        setSelectedId(null);
      }
    } finally {
      setUninstalling(null);
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        className="flex items-center justify-between h-8 px-2 flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[10px] text-[#6b7280]">
          {extensions.length} installed
          {extensions.filter((e) => e.status === "active").length > 0 &&
            ` \u00B7 ${extensions.filter((e) => e.status === "active").length} active`}
        </span>
        <button
          type="button"
          className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5"
          onClick={scan}
          disabled={loading}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {extensions.length === 0 && !loading && (
          <div className="px-3 py-6 text-center">
            <FolderOpen size={24} className="mx-auto text-[#4b5563] mb-2" />
            <p className="text-xs text-[#6b7280] mb-1">No extensions installed</p>
            <p className="text-[10px] text-[#4b5563] leading-relaxed">
              Browse the Marketplace tab to discover and install extensions.
            </p>
          </div>
        )}

        {extensions.map((ext) => {
          const isActive = ext.status === "active";
          const isError = ext.status === "error";
          const isSelected = selectedId === ext.id;

          return (
            <div
              key={ext.id}
              className={`px-2 py-1.5 border-b cursor-pointer transition-colors ${
                isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
              }`}
              style={{ borderColor: "var(--viper-border)" }}
              onClick={() => setSelectedId(ext.id === selectedId ? null : ext.id)}
            >
              <div className="flex items-center gap-2">
                <ExtensionIcon name={ext.name} active={isActive} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[#e5e7eb] truncate">{ext.name}</span>
                    <span className="text-[9px] text-[#4b5563]">v{ext.version}</span>
                  </div>
                  <p className="text-[10px] text-[#6b7280] truncate">{ext.description}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {isActive && <CheckCircle2 size={11} className="text-emerald-400" />}
                  {isError && <XCircle size={11} className="text-red-400" />}
                </div>
              </div>

              {isSelected && (
                <div className="mt-1.5 pl-[36px] flex flex-col gap-1">
                  {ext.author && (
                    <span className="text-[10px] text-[#6b7280]">By {ext.author}</span>
                  )}
                  {isError && ext.error && (
                    <div className="flex items-center gap-1 text-[10px] text-red-400">
                      <AlertCircle size={10} />
                      {ext.error}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    {isActive ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--viper-border)] text-[#9ca3af] hover:text-[#e5e7eb] hover:border-red-400/30 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleDeactivate(ext.id); }}
                      >
                        <PowerOff size={10} />
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleActivate(ext.id); }}
                      >
                        <Power size={10} />
                        Activate
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-red-500/20 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      disabled={uninstalling === ext.id}
                      onClick={(e) => { e.stopPropagation(); handleUninstall(ext.id); }}
                    >
                      {uninstalling === ext.id
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Trash2 size={10} />}
                      Uninstall
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarketplaceTab({ installedIds, onInstalled }: { installedIds: Set<string>; onInstalled: (id: string) => void }) {
  const [results, setResults] = useState<RegistryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = q.trim()
        ? await window.viper.extensions.registry.search(q)
        : await window.viper.extensions.registry.popular();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults("");
  }, [fetchResults]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchResults(value), 200);
    },
    [fetchResults],
  );

  const handleInstall = useCallback(async (id: string) => {
    setInstalling(id);
    try {
      const ok = await window.viper.extensions.install(id);
      if (ok) onInstalled(id);
    } finally {
      setInstalling(null);
    }
  }, [onInstalled]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        className="px-2 py-1.5 border-b flex-shrink-0"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded"
          style={{ background: "var(--viper-bg)" }}
        >
          <Search size={12} className="text-[#6b7280] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search extensions..."
            className="flex-1 bg-transparent text-xs text-[#e5e7eb] placeholder-[#4b5563] outline-none"
          />
          {loading && <Loader2 size={11} className="animate-spin text-[#6b7280] shrink-0" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {results.length === 0 && !loading && (
          <div className="px-3 py-6 text-center">
            <Package size={24} className="mx-auto text-[#4b5563] mb-2" />
            <p className="text-xs text-[#6b7280]">No extensions found</p>
          </div>
        )}

        {results.map((entry) => {
          const isInstalled = installedIds.has(entry.id);
          const isInstalling = installing === entry.id;

          return (
            <div
              key={entry.id}
              className="px-2 py-2 border-b hover:bg-white/[0.02] transition-colors"
              style={{ borderColor: "var(--viper-border)" }}
            >
              <div className="flex items-start gap-2">
                <ExtensionIcon name={entry.displayName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#e5e7eb] font-medium truncate">
                      {entry.displayName}
                    </span>
                    <span className="text-[9px] text-[#4b5563]">v{entry.version}</span>
                  </div>
                  <p className="text-[10px] text-[#6b7280] line-clamp-2 leading-relaxed mt-0.5">
                    {entry.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-[#6b7280]">{entry.author}</span>
                    <span className="flex items-center gap-0.5 text-[9px] text-[#6b7280]">
                      <Download size={8} />
                      {formatDownloads(entry.downloads)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-amber-400/80">
                      <Star size={8} fill="currentColor" />
                      {entry.rating}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  {isInstalled ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 size={9} />
                      Installed
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#e5e7eb] hover:text-white transition-colors"
                      style={{ background: "var(--viper-accent)" }}
                      disabled={isInstalling}
                      onClick={() => handleInstall(entry.id)}
                    >
                      {isInstalling
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Download size={10} />}
                      Install
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExtensionsSidebar() {
  const [tab, setTab] = useState<Tab>("marketplace");
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.viper.extensions.scan().then((exts: ExtensionEntry[]) => {
      setInstalledIds(new Set(exts.map((e) => e.id)));
    }).catch(() => {});
  }, [tab]);

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ background: "var(--viper-sidebar)" }}
    >
      <div
        className="flex items-center h-9 px-2 flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af] mr-auto">
          Extensions
        </span>
      </div>

      <div
        className="flex items-center flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <button
          type="button"
          className={`flex-1 py-1.5 text-[11px] font-medium text-center transition-colors border-b-2 ${
            tab === "marketplace"
              ? "text-[#e5e7eb] border-[var(--viper-accent)]"
              : "text-[#6b7280] border-transparent hover:text-[#9ca3af]"
          }`}
          onClick={() => setTab("marketplace")}
        >
          Marketplace
        </button>
        <button
          type="button"
          className={`flex-1 py-1.5 text-[11px] font-medium text-center transition-colors border-b-2 ${
            tab === "installed"
              ? "text-[#e5e7eb] border-[var(--viper-accent)]"
              : "text-[#6b7280] border-transparent hover:text-[#9ca3af]"
          }`}
          onClick={() => setTab("installed")}
        >
          Installed
        </button>
      </div>

      {tab === "installed" ? (
        <InstalledTab />
      ) : (
        <MarketplaceTab
          installedIds={installedIds}
          onInstalled={(id) => setInstalledIds((prev) => new Set([...prev, id]))}
        />
      )}
    </div>
  );
}
