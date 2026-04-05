/**
 * In-editor settings (Cursor / VS Code–style): category sidebar, search, and structured panels.
 */

import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { emailToInitials, useAuth } from "../contexts/auth-context";
import { getWebAppLoginUrl, getWebAppSignupUrl } from "../lib/web-app-auth-url";
import { useAppRoute } from "../contexts/app-route-context";
import { useWorkspaceContext } from "../contexts/workspace-context";
import {
  Sparkles,
  LayoutGrid,
  Monitor,
  Keyboard,
  FileCode2,
  MessageSquare,
  Info,
  Search,
  ExternalLink,
  Terminal,
  FolderOpen,
  Command,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type SettingsSectionId =
  | "overview"
  | "workbench"
  | "keyboard"
  | "editor"
  | "chat"
  | "about";

interface NavItem {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    description: "What you can configure here",
    icon: LayoutGrid,
  },
  {
    id: "workbench",
    label: "Workbench",
    description: "Layout, palette, workspace",
    icon: Monitor,
  },
  {
    id: "keyboard",
    label: "Keyboard",
    description: "Shortcuts reference",
    icon: Keyboard,
  },
  {
    id: "editor",
    label: "Editor",
    description: "Files, save, format",
    icon: FileCode2,
  },
  {
    id: "chat",
    label: "Chat & AI",
    description: "Model tier and agent",
    icon: MessageSquare,
  },
  {
    id: "about",
    label: "About",
    description: "Product info",
    icon: Info,
  },
];

interface ShortcutDef {
  id: string;
  action: string;
  keys: string;
  /** Extra text matched by search */
  keywords?: string;
}

const ALL_SHORTCUTS: ShortcutDef[] = [
  {
    id: "palette",
    action: "Command Palette",
    keys: "⌘⇧P · Ctrl+Shift+P",
    keywords: "commands palette fuzzy",
  },
  {
    id: "quickopen",
    action: "Quick Open file",
    keys: "⌘P · Ctrl+P",
    keywords: "files goto",
  },
  {
    id: "sidebar",
    action: "Toggle primary sidebar",
    keys: "⌘B · Ctrl+B",
    keywords: "explorer activity bar left",
  },
  {
    id: "chat",
    action: "Focus chat panel (after opening a folder)",
    keys: "⌘L · Ctrl+L",
    keywords: "assistant copilot workspace",
  },
  {
    id: "save",
    action: "Save active file",
    keys: "⌘S · Ctrl+S",
    keywords: "write disk",
  },
  {
    id: "settings",
    action: "Open Settings",
    keys: "⌘, · Ctrl+,",
    keywords: "preferences options",
  },
  {
    id: "terminal",
    action: "Toggle bottom panel (terminal / problems)",
    keys: "View menu · Command Palette",
    keywords: "terminal problems debug ports",
  },
  {
    id: "aiedit",
    action: "AI Edit selection",
    keys: "⌘⇧E · Ctrl+Shift+E",
    keywords: "inline edit selection",
  },
  {
    id: "format",
    action: "Format document",
    keys: "Command Palette → Format Document",
    keywords: "prettier format",
  },
];

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums border"
      style={{
        background: "rgba(0,0,0,0.35)",
        borderColor: "var(--viper-border)",
        color: "#d1d5db",
        boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </kbd>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
    >
      <div
        className="px-[var(--viper-space-2)] py-3 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <h3 className="text-[13px] font-semibold text-[#f3f4f6] tracking-tight">{title}</h3>
        {subtitle ? <p className="text-[12px] text-[#9ca3af] mt-0.5 leading-snug">{subtitle}</p> : null}
      </div>
      <div className="px-[var(--viper-space-2)] py-[var(--viper-space-2)]">{children}</div>
    </section>
  );
}

function GhostButton({
  children,
  onClick,
  icon: Icon,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 text-[12px] font-medium rounded-md px-2.5 py-1.5 transition-colors border border-[var(--viper-border)] bg-white/[0.03] text-[#e5e7eb] ${
        disabled
          ? "opacity-45 cursor-not-allowed"
          : "hover:bg-white/[0.07] hover:border-[var(--viper-accent)]"
      }`}
    >
      {Icon ? <Icon size={14} className="text-[var(--viper-accent)] flex-shrink-0" /> : null}
      {children}
    </button>
  );
}

function ShortcutTable({ rows }: { rows: ShortcutDef[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-[#6b7280] py-6 text-center">
        No shortcuts match your search.
      </p>
    );
  }
  return (
    <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--viper-border)" }}>
      <table className="w-full text-left text-[12px] border-collapse">
        <thead>
          <tr style={{ background: "rgba(0,0,0,0.25)" }}>
            <th
              className="py-2 px-3 font-medium text-[#9ca3af] uppercase tracking-wider text-[10px]"
              style={{ width: "42%" }}
            >
              Action
            </th>
            <th className="py-2 px-3 font-medium text-[#9ca3af] uppercase tracking-wider text-[10px]">
              Shortcut
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className="border-t transition-colors"
              style={{
                borderColor: "var(--viper-border)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              <td className="py-2.5 px-3 text-[#e5e7eb] align-middle">{row.action}</td>
              <td className="py-2.5 px-3 align-middle">
                <Kbd>{row.keys}</Kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section bodies
// ---------------------------------------------------------------------------

const OVERVIEW_ACTIONS: {
  title: string;
  description: string;
  event: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Commands",
    description: "Run any workbench command from the palette.",
    event: "viper:open-command-palette",
    icon: Command,
  },
  {
    title: "Files",
    description: "Open a file by name with Quick Open.",
    event: "viper:open-quick-open",
    icon: FolderOpen,
  },
  {
    title: "Bottom panel",
    description: "Terminal, Problems, Debug Console, Ports.",
    event: "viper:menu-toggle-panel",
    icon: Terminal,
  },
];

function OverviewSection() {
  return (
    <div className="space-y-[var(--viper-space-2)]">
      <div
        className="rounded-lg border p-[var(--viper-space-2)] flex gap-3"
        style={{
          borderColor: "var(--viper-border)",
          background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, transparent 55%)",
        }}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(59,130,246,0.15)" }}
        >
          <Sparkles size={20} className="text-[var(--viper-accent)]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#f9fafb]">At a glance</h2>
          <p className="text-[13px] text-[#9ca3af] mt-1 leading-relaxed">
            Browse categories on the left or use search to filter shortcuts. Chat mode, model tier, and
            attachments are configured in the <span className="text-[#d1d5db]">chat panel</span>, not here.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OVERVIEW_ACTIONS.map(({ title, description, event, icon: Icon }) => (
          <button
            key={title}
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(event))}
            className="text-left rounded-lg border border-[var(--viper-border)] bg-[var(--viper-sidebar)] p-3 transition-all hover:border-[var(--viper-accent)] hover:bg-white/[0.04]"
          >
            <Icon size={16} className="text-[var(--viper-accent)] mb-2" />
            <div className="text-[12px] font-semibold text-[#e5e7eb]">{title}</div>
            <div className="text-[11px] text-[#6b7280] mt-0.5 leading-snug">{description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkbenchSection() {
  return (
    <div className="space-y-[var(--viper-space-2)]">
      <Panel
        title="Activity bar"
        subtitle="Icons on the far left open Explorer, Search, Git, Extensions, Run & Debug, Usage, and Tests."
      >
        <p className="text-[13px] text-[#9ca3af] leading-relaxed">
          Click an icon to switch the sidebar view. If the sidebar is hidden, choosing an icon opens it
          again.
        </p>
      </Panel>
      <Panel title="Quick actions" subtitle="Common workbench commands.">
        <div className="flex flex-wrap gap-2">
          <GhostButton
            icon={Command}
            onClick={() => window.dispatchEvent(new CustomEvent("viper:open-command-palette"))}
          >
            Command Palette
          </GhostButton>
          <GhostButton
            icon={FolderOpen}
            onClick={() => window.dispatchEvent(new CustomEvent("viper:open-quick-open"))}
          >
            Quick Open
          </GhostButton>
          <GhostButton
            icon={Terminal}
            onClick={() => window.dispatchEvent(new CustomEvent("viper:menu-toggle-panel"))}
          >
            Toggle bottom panel
          </GhostButton>
          <GhostButton
            icon={ExternalLink}
            onClick={() => window.location.reload()}
          >
            Reload window
          </GhostButton>
        </div>
      </Panel>
    </div>
  );
}

function EditorSection() {
  return (
    <div className="space-y-[var(--viper-space-2)]">
      <Panel
        title="Appearance"
        subtitle="The code editor uses Monaco with a dark theme aligned to the IDE."
      >
        <p className="text-[13px] text-[#9ca3af] leading-relaxed">
          Light theme and font controls are not exposed yet; they can be added here when wired to
          preferences storage.
        </p>
      </Panel>
      <Panel title="Saving" subtitle="Files write to your workspace on disk.">
        <ul className="text-[13px] text-[#9ca3af] space-y-2 list-disc pl-4 leading-relaxed">
          <li>
            <Kbd>⌘S</Kbd> / <Kbd>Ctrl+S</Kbd> saves the active editor tab.
          </li>
          <li>Dirty tabs show a dot in the tab label until saved.</li>
          <li>Switching focus or closing the app can trigger auto-save for dirty files.</li>
        </ul>
      </Panel>
      <Panel title="Format & AI" subtitle="From the Command Palette or shortcuts.">
        <p className="text-[13px] text-[#9ca3af] leading-relaxed mb-3">
          Format Document and AI Edit Selection are available when a real file tab is active—not on this
          Settings page.
        </p>
        <GhostButton icon={Command} onClick={() => window.dispatchEvent(new CustomEvent("viper:open-command-palette"))}>
          Open Command Palette
        </GhostButton>
      </Panel>
    </div>
  );
}

function ChatSection() {
  const { workspace } = useWorkspaceContext();
  const hasWorkspace = Boolean(workspace?.root);
  return (
    <Panel
      title="Chat & model tier"
      subtitle="Conversation controls live next to your messages."
    >
      <p className="text-[13px] text-[#9ca3af] leading-relaxed mb-4">
        Switch <strong className="text-[#d1d5db] font-medium">Ask / Plan / Agent</strong> modes and choose{" "}
        <strong className="text-[#d1d5db] font-medium">Auto vs Premium</strong> (and premium model) from
        the chat header controls. Those values apply per session and are sent with each request.
        {!hasWorkspace ? (
          <>
            {" "}
            <span className="text-[#d1d5db]">Open a folder first</span> — Chat is unavailable until a
            workspace is loaded.
          </>
        ) : null}
      </p>
      <GhostButton
        icon={MessageSquare}
        disabled={!hasWorkspace}
        title={hasWorkspace ? undefined : "Open a folder first to use Chat"}
        onClick={() => window.dispatchEvent(new CustomEvent("viper:focus-chat"))}
      >
        Focus chat panel
      </GhostButton>
    </Panel>
  );
}

function AboutSection() {
  return (
    <Panel title="Viper AI Desktop" subtitle="Local-first IDE with an integrated agent.">
      <dl className="text-[13px] space-y-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#6b7280] font-medium">Product</dt>
          <dd className="text-[#e5e7eb] mt-0.5">Viper AI — editor, chat, and workspace tools.</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#6b7280] font-medium">Documentation</dt>
          <dd className="text-[#9ca3af] mt-0.5 leading-relaxed">
            See the repository <span className="text-[#d1d5db]">README</span> and <span className="text-[#d1d5db]">docs/</span>{" "}
            for setup, backend configuration, and product notes.
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Account (auth entry + signed-in profile)
// ---------------------------------------------------------------------------

function SettingsAccountBar() {
  const { user, signOut } = useAuth();
  const { navigate } = useAppRoute();

  if (user) {
    const initials = emailToInitials(user.email);
    return (
      <div
        className="flex-shrink-0 flex items-center gap-3 px-[var(--viper-space-2)] py-3 border-b"
        style={{ borderColor: "var(--viper-border)", background: "rgba(59,130,246,0.06)" }}
      >
        <div
          className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-semibold border"
          style={{
            background: "linear-gradient(145deg, rgba(59,130,246,0.35), rgba(59,130,246,0.12))",
            borderColor: "var(--viper-border)",
            color: "#e5e7eb",
          }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[#f3f4f6] truncate">{user.email}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
              style={{
                borderColor: "var(--viper-accent)",
                color: "var(--viper-accent)",
                background: "rgba(59,130,246,0.1)",
              }}
            >
              {user.plan}
            </span>
            <span className="text-[11px] text-[#6b7280]">Signed in</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex-shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--viper-border)] text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 flex flex-wrap items-center gap-3 px-[var(--viper-space-2)] py-3 border-b"
      style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
    >
      <p className="text-[12px] text-[#9ca3af] min-w-0 flex-1 leading-snug">
        Sign in to connect your Viper account (usage, billing, and sync—coming soon).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const open = window.viper?.shell?.openExternal;
            if (open) void open(getWebAppLoginUrl());
            else navigate("/login");
          }}
          className="text-[12px] font-medium px-3 py-1.5 rounded-md transition-opacity hover:opacity-90"
          style={{ background: "var(--viper-accent)", color: "#0b0f17" }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            const open = window.viper?.shell?.openExternal;
            if (open) void open(getWebAppSignupUrl());
            else navigate("/register");
          }}
          className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--viper-border)] text-[#e5e7eb] hover:bg-white/5"
        >
          Create account
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function shortcutMatches(row: ShortcutDef, q: string): boolean {
  if (!q) return true;
  const n = normalize(q);
  const hay = normalize(`${row.action} ${row.keys} ${row.keywords ?? ""} ${row.id}`);
  return hay.includes(n);
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function IdeSettingsPage() {
  const [section, setSection] = useState<SettingsSectionId>("overview");
  const [query, setQuery] = useState("");

  const filteredShortcuts = useMemo(() => {
    const q = query.trim();
    if (!q) return ALL_SHORTCUTS;
    return ALL_SHORTCUTS.filter((r) => shortcutMatches(r, q));
  }, [query]);

  const searchActive = query.trim().length > 0;

  const content = searchActive ? (
    <div className="space-y-[var(--viper-space-2)]">
      <h2 className="text-[16px] font-semibold text-[#f9fafb]">Search results</h2>
      <p className="text-[12px] text-[#9ca3af]">
        {filteredShortcuts.length} shortcut{filteredShortcuts.length === 1 ? "" : "s"} matching &ldquo;
        {query.trim()}&rdquo;
      </p>
      <ShortcutTable rows={filteredShortcuts} />
    </div>
  ) : (
    <>
      {section === "overview" && <OverviewSection />}
      {section === "workbench" && <WorkbenchSection />}
      {section === "keyboard" && (
        <div className="space-y-3">
          <p className="text-[13px] text-[#9ca3af] leading-relaxed">
            Reference for default bindings. Platform keys show macOS first, then Windows / Linux.
          </p>
          <ShortcutTable rows={ALL_SHORTCUTS} />
        </div>
      )}
      {section === "editor" && <EditorSection />}
      {section === "chat" && <ChatSection />}
      {section === "about" && <AboutSection />}
    </>
  );

  return (
    <div className="h-full min-h-0 flex flex-col" style={{ background: "var(--viper-bg)", color: "#e5e7eb" }}>
      {/* Top bar */}
      <header
        className="flex-shrink-0 flex items-center gap-[var(--viper-space-2)] px-[var(--viper-space-2)] py-3 border-b"
        style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
      >
        <h1 className="text-[15px] font-semibold text-[#f9fafb] tracking-tight flex-shrink-0">
          Settings
        </h1>
        <div className="flex-1 min-w-0 max-w-md ml-auto">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings and shortcuts…"
              aria-label="Search settings"
              className="w-full rounded-md border border-[var(--viper-border)] bg-[var(--viper-bg)] pl-8 pr-3 py-1.5 text-[13px] text-[#e5e7eb] outline-none transition-shadow placeholder:text-[#6b7280] focus:border-[var(--viper-accent)] focus:ring-1 focus:ring-[var(--viper-accent)]"
            />
          </div>
        </div>
      </header>

      <SettingsAccountBar />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav
          className="flex-shrink-0 w-[220px] border-r overflow-y-auto py-2"
          style={{ borderColor: "var(--viper-border)", background: "var(--viper-sidebar)" }}
          aria-label="Settings sections"
        >
          {NAV.map((item) => {
            const active = !searchActive && section === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setQuery("");
                  setSection(item.id);
                }}
                className={`w-full text-left px-3 py-2 flex gap-2.5 border-l-2 transition-colors ${
                  active
                    ? "border-l-[var(--viper-accent)] bg-[rgba(59,130,246,0.08)]"
                    : "border-l-transparent hover:bg-white/[0.04]"
                }`}
              >
                <Icon
                  size={18}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: active ? "var(--viper-accent)" : "#9ca3af" }}
                  strokeWidth={1.75}
                />
                <span className="min-w-0">
                  <span
                    className="block text-[13px] font-medium leading-tight"
                    style={{ color: active ? "#f3f4f6" : "#d1d5db" }}
                  >
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-[#6b7280] leading-snug mt-0.5">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Main */}
        <div className="flex-1 min-w-0 overflow-y-auto px-[var(--viper-space-3)] py-[var(--viper-space-2)]">
          <div className="max-w-3xl">{content}</div>
        </div>
      </div>
    </div>
  );
}
