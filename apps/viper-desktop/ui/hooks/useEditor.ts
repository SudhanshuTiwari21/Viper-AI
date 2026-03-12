import { useState, useCallback } from "react";

export interface EditorTab {
  id: string;
  path: string;
  title: string;
  language: string;
  content: string;
}

export function useEditorTabs() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const openTab = useCallback((tab: EditorTab) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.path === tab.path);
      if (existing) {
        setActiveId(existing.id);
        return prev;
      }
      const next = [...prev, tab];
      setActiveId(tab.id);
      return next;
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id) {
        setActiveId(next[idx - 1]?.id ?? next[0]?.id ?? null);
      }
      return next;
    });
  }, [activeId]);

  const updateContent = useCallback((id: string, content: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content } : t)));
  }, []);

  return { tabs, activeId, openTab, closeTab, setActiveId, updateContent };
}

