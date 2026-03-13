import { useEffect, useState, useCallback } from "react";
import { MonacoEditor } from "./monaco-editor";
import { EditorWelcome } from "./editor-welcome";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { useCurrentFile } from "../contexts/current-file-context";
import { useStatusBar } from "../contexts/status-bar-context";
import { useDiagnostics } from "../contexts/diagnostics-context";
import { fsApi } from "../services/filesystem";
import { useEditorTabs } from "../hooks/useEditor";
import type { CodePatch } from "../lib/patch-types";
import {
  applyPatchToContent,
  validatePatchAgainstContent,
} from "../lib/patch-engine";

export function EditorContainer() {
  const { workspace } = useWorkspaceContext();
  const { setCurrentFile } = useCurrentFile();
  const { setStatus } = useStatusBar();
  const { setFileErrors } = useDiagnostics();
  const { tabs, activeId, openTab, closeTab, setActiveId, updateContent, markSaved } =
    useEditorTabs();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{
        root: string;
        path: string;
        content: string;
      }>).detail;
      if (!detail?.path) return;
      const ext = detail.path.split(".").pop() ?? "";
      const id = `${detail.root}:${detail.path}`;
      openTab({
        id,
        path: detail.path,
        title: detail.path.split("/").pop() ?? detail.path,
        language: ext,
        content: typeof detail.content === "string" ? detail.content : "",
      });
    };
    window.addEventListener("viper:open-file", handler as EventListener);
    return () =>
      window.removeEventListener("viper:open-file", handler as EventListener);
  }, [openTab]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (activeTab) {
      setCurrentFile(activeTab.path, activeTab.content);
      setStatus({
        language: activeTab.language,
        cursorLine: 0,
        cursorCol: 0,
      });
    } else {
      setCurrentFile(null, null);
      setStatus({ language: "", cursorLine: 0, cursorCol: 0 });
    }
  }, [activeTab?.id, activeTab?.path, activeTab?.content, activeTab?.language, setCurrentFile, setStatus]);

  const handleCursorChange = useCallback(
    (line: number, col: number) => {
      setStatus({ cursorLine: line, cursorCol: col });
    },
    [setStatus]
  );

  const handleSave = useCallback(async () => {
    if (!workspace || !activeTab) return;
    setSaving(true);
    try {
      await fsApi.writeFile(workspace.root, activeTab.path, activeTab.content);
      markSaved(activeTab.id);
    } finally {
      setSaving(false);
    }
  }, [workspace, activeTab, markSaved]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ patches?: CodePatch[] | null }>).detail;
      const patches = detail?.patches;
      if (!patches || patches.length === 0) return;

      // Build quick lookup for open tabs by path.
      const tabByPath = new Map(tabs.map((t) => [t.path, t]));

      patches.forEach((patch) => {
        const tab = tabByPath.get(patch.file);
        if (!tab) {
          // For now we only apply to open tabs. In the future we can
          // auto-open files and apply patches to them.
          console.warn(
            "[viper] Skipping patch for unopened file:",
            patch.file
          );
          return;
        }

        const validation = validatePatchAgainstContent(
          patch.file,
          tab.content,
          patch
        );
        if (!validation.ok) {
          console.warn(
            "[viper] Patch validation failed for",
            patch.file,
            validation.errors
          );
          return;
        }

        const nextContent = applyPatchToContent(tab.content, patch);
        updateContent(tab.id, nextContent);
      });
    };

    window.addEventListener("viper:apply-patch", handler as EventListener);
    return () =>
      window.removeEventListener("viper:apply-patch", handler as EventListener);
  }, [tabs, updateContent]);

  // Save all dirty tabs (used for auto-save on blur/close)
  const saveAllDirty = useCallback(async () => {
    if (!workspace) return;
    const dirtyTabs = tabs.filter((t) => t.dirty);
    if (dirtyTabs.length === 0) return;
    await Promise.all(
      dirtyTabs.map(async (t) => {
        await fsApi.writeFile(workspace.root, t.path, t.content);
        markSaved(t.id);
      })
    );
  }, [workspace, tabs, markSaved]);

  // Respond to native "File > Save" / "File > Save All" menu actions.
  useEffect(() => {
    const handleMenuSave = () => {
      void handleSave();
    };
    const handleMenuSaveAll = () => {
      void saveAllDirty();
    };
    window.addEventListener("viper:menu-save", handleMenuSave);
    window.addEventListener("viper:menu-save-all", handleMenuSaveAll);
    return () => {
      window.removeEventListener("viper:menu-save", handleMenuSave);
      window.removeEventListener("viper:menu-save-all", handleMenuSaveAll);
    };
  }, [handleSave, saveAllDirty]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // Auto-save on window blur / beforeunload (VS Code-style "on window change")
  useEffect(() => {
    const onBlur = () => {
      void saveAllDirty();
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBlur);
    };
  }, [saveAllDirty]);

  return (
    <div className="flex flex-col h-full">
      {/* Editor tabs: horizontal scroll, close, active highlight */}
      <div
        className="flex items-center flex-shrink-0 border-b overflow-x-auto"
        style={{
          height: 36,
          borderColor: "var(--viper-border)",
          background: "var(--viper-bg)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              className={`flex items-center gap-[var(--viper-space-1)] px-[var(--viper-space-2)] py-[var(--viper-space-1)] min-w-0 max-w-[180px] border-r text-xs transition-colors flex-shrink-0 ${
                isActive
                  ? "text-[#e5e7eb] border-[var(--viper-accent)] border-b-0 -mb-px"
                  : "text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-white/5"
              }`}
              style={{
                borderRightColor: "var(--viper-border)",
                background: isActive ? "var(--viper-sidebar)" : "transparent",
              }}
              onClick={() => setActiveId(tab.id)}
            >
              <span className="truncate flex items-center gap-1">
                {tab.title}
                {tab.dirty && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
              <span
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ×
              </span>
            </button>
          );
        })}
        <div className="flex-1 min-w-0" />
        <button
          className="flex-shrink-0 mx-[var(--viper-space-1)] px-[var(--viper-space-2)] py-1 rounded text-[11px] font-medium transition-all hover:shadow-[0_0_8px_rgba(34,197,94,0.2)] disabled:opacity-50"
          style={{
            background: "var(--viper-accent)",
            color: "#0b0f17",
          }}
          onClick={handleSave}
          disabled={!activeTab || saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Editor body or welcome */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!activeTab && <EditorWelcome />}
        {activeTab && (
          <MonacoEditor
            key={activeTab.id}
            language={activeTab.language}
            value={activeTab.content}
            onChange={(val) => updateContent(activeTab.id, val)}
            onCursorChange={handleCursorChange}
            currentFilePath={activeTab.path}
            onDiagnosticsChange={setFileErrors}
          />
        )}
      </div>
    </div>
  );
}
