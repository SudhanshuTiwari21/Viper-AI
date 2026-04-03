/**
 * G.39 — Test assistant panel.
 *
 * Two sections:
 *   1. "Suggest test commands" — reads changed files via git:diffNameOnly,
 *      sends to /testing/suggest-commands, shows copyable command chips.
 *   2. "Triage failure output" — textarea paste + Analyze button,
 *      shows summary, bullets, and suggested follow-up commands.
 */

import { useState, useCallback } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  FlaskConical,
  Bug,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import {
  fetchSuggestTestCommands,
  fetchTriageFailure,
  type TestCommand,
  type TriageFailureResult,
} from "../services/agent-api";

// ---------------------------------------------------------------------------
// Copyable chip
// ---------------------------------------------------------------------------

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [text]);

  return (
    <div
      className="flex items-start gap-1.5 rounded px-2 py-1.5 group"
      style={{ background: "var(--viper-bg)", border: "1px solid var(--viper-border)" }}
    >
      <code className="flex-1 text-[11px] text-[#d1d5db] font-mono break-all leading-relaxed">
        {text}
      </code>
      <button
        type="button"
        className="flex-shrink-0 p-0.5 text-[#6b7280] hover:text-[#e5e7eb] transition-colors mt-0.5"
        onClick={handleCopy}
        title="Copy command"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface TestPanelProps {
  workspacePath: string | null;
}

export function TestPanel({ workspacePath }: TestPanelProps) {
  const { workspace } = useWorkspaceContext();

  // -- Suggest section --
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestCommands, setSuggestCommands] = useState<TestCommand[] | null>(null);
  const [suggestExpanded, setSuggestExpanded] = useState(true);

  // -- Triage section --
  const [triageExpanded, setTriageExpanded] = useState(true);
  const [triageOutput, setTriageOutput] = useState("");
  const [triageRunner, setTriageRunner] = useState<"vitest" | "jest" | "unknown">("vitest");
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triageResult, setTriageResult] = useState<TriageFailureResult | null>(null);

  const root = workspacePath ?? workspace?.root ?? null;

  const handleSuggest = useCallback(async () => {
    if (!root) return;
    setSuggestLoading(true);
    setSuggestError(null);
    setSuggestCommands(null);
    try {
      const changedFiles = await window.viper.git.diffNameOnly(root);
      if (changedFiles.length === 0) {
        setSuggestError("No changed files detected (git diff --name-only HEAD returned nothing).");
        return;
      }
      const result = await fetchSuggestTestCommands({
        workspacePath: root,
        changedFiles,
        packageHint: "auto",
      });
      setSuggestCommands(result.commands);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Suggest failed.");
    } finally {
      setSuggestLoading(false);
    }
  }, [root]);

  const handleTriage = useCallback(async () => {
    if (!root || !triageOutput.trim()) return;
    setTriageLoading(true);
    setTriageError(null);
    setTriageResult(null);
    try {
      const result = await fetchTriageFailure({
        workspacePath: root,
        runnerOutput: triageOutput,
        runner: triageRunner,
      });
      setTriageResult(result);
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : "Triage failed.");
    } finally {
      setTriageLoading(false);
    }
  }, [root, triageOutput, triageRunner]);

  if (!root) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center text-xs text-[#6b7280] p-4">
        Open a folder to use the test assistant.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-y-auto"
      style={{ background: "var(--viper-sidebar)" }}
    >
      {/* Header */}
      <div
        className="flex items-center h-9 px-2 flex-shrink-0 border-b"
        style={{ borderColor: "var(--viper-border)" }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
          Test Assistant
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Suggest test commands */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-shrink-0">
        <button
          type="button"
          className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-white/[0.03] transition-colors"
          onClick={() => setSuggestExpanded((v) => !v)}
        >
          {suggestExpanded
            ? <ChevronDown size={12} className="text-[#6b7280]" />
            : <ChevronRight size={12} className="text-[#6b7280]" />}
          <FlaskConical size={12} className="text-[#9ca3af]" />
          <span className="text-[11px] font-medium text-[#9ca3af] uppercase">
            Suggest commands from changes
          </span>
        </button>

        {suggestExpanded && (
          <div className="px-2 pb-2 flex flex-col gap-2">
            <p className="text-[10px] text-[#6b7280] leading-relaxed">
              Runs <code className="text-[#9ca3af]">git diff --name-only HEAD</code>, maps changed
              files to candidate test commands for this monorepo.
            </p>

            <button
              type="button"
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-40 border"
              style={{
                borderColor: "var(--viper-accent)",
                color: "var(--viper-accent)",
                background: "transparent",
              }}
              onClick={handleSuggest}
              disabled={suggestLoading}
            >
              {suggestLoading
                ? <Loader2 size={11} className="animate-spin" />
                : <Sparkles size={11} />}
              Suggest test commands from changes
            </button>

            {suggestError && (
              <p className="text-[10px] text-[#ef4444]">{suggestError}</p>
            )}

            {suggestCommands && suggestCommands.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {suggestCommands.map((cmd, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    {cmd.cwd && (
                      <span className="text-[10px] text-[#6b7280]">
                        in <code className="text-[#9ca3af]">{cmd.cwd}</code>
                      </span>
                    )}
                    <CopyChip text={cmd.shell} />
                    <p className="text-[10px] text-[#4b5563] leading-snug pl-0.5">
                      {cmd.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {suggestCommands && suggestCommands.length === 0 && (
              <p className="text-[10px] text-[#6b7280]">
                No test commands could be inferred from the changed files.
              </p>
            )}
          </div>
        )}
      </div>

      <div
        className="flex-shrink-0 h-px"
        style={{ background: "var(--viper-border)" }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Triage failure output */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-shrink-0">
        <button
          type="button"
          className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-white/[0.03] transition-colors"
          onClick={() => setTriageExpanded((v) => !v)}
        >
          {triageExpanded
            ? <ChevronDown size={12} className="text-[#6b7280]" />
            : <ChevronRight size={12} className="text-[#6b7280]" />}
          <Bug size={12} className="text-[#9ca3af]" />
          <span className="text-[11px] font-medium text-[#9ca3af] uppercase">
            Triage failure output
          </span>
        </button>

        {triageExpanded && (
          <div className="px-2 pb-2 flex flex-col gap-2">
            <p className="text-[10px] text-[#6b7280] leading-relaxed">
              Paste test runner output below and click Analyze to get a structured failure summary.
            </p>

            {/* Runner selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6b7280]">Runner:</span>
              {(["vitest", "jest", "unknown"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className="px-1.5 py-0.5 rounded text-[10px] transition-colors"
                  style={{
                    background:
                      triageRunner === r
                        ? "var(--viper-accent)"
                        : "var(--viper-bg)",
                    color: triageRunner === r ? "#0b0f17" : "#9ca3af",
                    border: `1px solid ${triageRunner === r ? "var(--viper-accent)" : "var(--viper-border)"}`,
                  }}
                  onClick={() => setTriageRunner(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              className="w-full min-h-[100px] max-h-[200px] rounded border px-2 py-1.5 text-[11px] font-mono bg-transparent text-[#d1d5db] outline-none placeholder:text-[#4b5563] resize-y"
              style={{ borderColor: "var(--viper-border)", background: "var(--viper-bg)" }}
              placeholder={"Paste test runner output here…\n\nExample:\n FAIL src/lib/foo.test.ts\n × should do X\n   Error: expected 1 to be 2"}
              value={triageOutput}
              onChange={(e) => setTriageOutput(e.target.value)}
            />

            <button
              type="button"
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded text-[11px] font-medium transition-colors disabled:opacity-40 border"
              style={{
                borderColor: "var(--viper-border)",
                color: triageOutput.trim() ? "#e5e7eb" : "#6b7280",
                background: "transparent",
              }}
              onClick={handleTriage}
              disabled={triageLoading || !triageOutput.trim()}
            >
              {triageLoading
                ? <Loader2 size={11} className="animate-spin" />
                : <Bug size={11} />}
              Analyze failure
            </button>

            {triageError && (
              <p className="text-[10px] text-[#ef4444]">{triageError}</p>
            )}

            {triageResult && (
              <div
                className="rounded p-2 flex flex-col gap-2"
                style={{
                  background: "var(--viper-bg)",
                  border: "1px solid var(--viper-border)",
                }}
              >
                {/* Summary */}
                <p className="text-[11px] text-[#e5e7eb] leading-snug">
                  {triageResult.summary}
                </p>

                {/* Bullets */}
                {triageResult.bullets.length > 0 && (
                  <ul className="flex flex-col gap-0.5 pl-3">
                    {triageResult.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="text-[10px] text-[#9ca3af] leading-snug list-disc"
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Suggested commands */}
                {triageResult.suggestedCommands.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">
                      Try:
                    </span>
                    {triageResult.suggestedCommands.map((cmd, i) => (
                      <CopyChip key={i} text={cmd} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
