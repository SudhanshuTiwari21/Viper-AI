import { useState, useCallback } from "react";

export interface EditorTab {
  id: string;
  path: string;
  title: string;
  language: string;
  content: string;
  savedContent: string;
  dirty: boolean;
}

interface EditorState {
  tabs: EditorTab[];
  activeId: string | null;
}

export function useEditorTabs() {
  const [state, setState] = useState<EditorState>({ tabs: [], activeId: null });

  const openTab = useCallback((tab: EditorTab) => {
    setState((prev) => {
      const existing = prev.tabs.find((t) => t.path === tab.path);
      if (existing) {
        return {
          tabs: prev.tabs.map((t) =>
            t.id === existing.id
              ? { ...t, content: tab.content, savedContent: tab.content, dirty: false }
              : t
          ),
          activeId: existing.id,
        };
      }
      return {
        tabs: [...prev.tabs, { ...tab, savedContent: tab.content, dirty: false }],
        activeId: tab.id,
      };
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const nextTabs = prev.tabs.filter((t) => t.id !== id);
      const nextActiveId =
        prev.activeId === id
          ? nextTabs[idx - 1]?.id ?? nextTabs[0]?.id ?? null
          : prev.activeId;
      return { tabs: nextTabs, activeId: nextActiveId };
    });
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, activeId: id }));
  }, []);

  const updateContent = useCallback((id: string, content: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.id === id
          ? { ...t, content, dirty: content !== t.savedContent }
          : t
      ),
    }));
  }, []);

  const markSaved = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.id === id ? { ...t, savedContent: t.content, dirty: false } : t
      ),
    }));
  }, []);

  const { tabs, activeId } = state;
  return { tabs, activeId, openTab, closeTab, setActiveId, updateContent, markSaved };
}
