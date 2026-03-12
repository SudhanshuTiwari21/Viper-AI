import { useEffect, useState, useCallback } from "react";
import { MonacoEditor } from "./monaco-editor";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { fsApi } from "../services/filesystem";
import { useEditorTabs } from "../hooks/useEditor";

export function EditorContainer() {
  const { workspace } = useWorkspaceContext();
  const { tabs, activeId, openTab, closeTab, setActiveId, updateContent } =
    useEditorTabs();
  const [saving, setSaving] = useState(false);

  // Listen for file open events from FileExplorer.
  useEffect(() => {
    const handler = async (e: Event) => {
      if (!workspace) return;
      const detail = (e as CustomEvent<{
        root: string;
        path: string;
        content: string;
      }>).detail;
      const ext = detail.path.split(".").pop() ?? "";
      const id = `${detail.root}:${detail.path}`;
      openTab({
        id,
        path: detail.path,
        title: detail.path.split("/").pop() ?? detail.path,
        language: ext,
        content: detail.content,
      });
    };
    window.addEventListener("viper:open-file", handler as EventListener);
    return () =>
      window.removeEventListener("viper:open-file", handler as EventListener);
  }, [workspace, openTab]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  const handleSave = useCallback(async () => {
    if (!workspace || !activeTab) return;
    setSaving(true);
    try {
      await fsApi.writeFile(workspace.root, activeTab.path, activeTab.content);
    } finally {
      setSaving(false);
    }
  }, [workspace, activeTab]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Tabs bar */} 
      <div className="flex items-center h-8 border-b border-zinc-800/80 bg-[#08080a] text-xs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-3 py-1 flex items-center gap-1 border-r border-zinc-800/60 ${
              tab.id === activeId
                ? "bg-zinc-800 text-zinc-100"
                : "bg-transparent text-zinc-400 hover:bg-zinc-900"
            }`}
            onClick={() => setActiveId(tab.id)}
          >
            <span className="truncate max-w-[140px]">{tab.title}</span>
            <span
              className="text-zinc-500 hover:text-zinc-300 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              ×
            </span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          className="text-[10px] px-2 py-0.5 mr-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
          onClick={handleSave}
          disabled={!activeTab || saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Editor body */} 
      <div className="flex-1 min-h-0">
        {!activeTab && (
          <div className="h-full flex items-center justify-center text-sm text-zinc-500">
            Open a file from the explorer to start editing.
          </div>
        )}
        {activeTab && (
          <MonacoEditor
            language={activeTab.language}
            value={activeTab.content}
            onChange={(val) => updateContent(activeTab.id, val)}
          />
        )}
      </div>
    </div>
  );
}

