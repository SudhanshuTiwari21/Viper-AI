import { useEffect, useState, useCallback, useRef } from "react";
import type { FileNode } from "../services/filesystem";
import { selectWorkspace, watchWorkspace, listWorkspace, fsApi } from "../services/filesystem";

export interface WorkspaceState {
  root: string;
  tree: FileNode[];
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const workspaceRootRef = useRef<string | null>(null);
  workspaceRootRef.current = workspace?.root ?? null;

  const reload = useCallback(async () => {
    const root = workspaceRootRef.current;
    if (!root) return;
    const { tree } = await listWorkspace(root);
    setWorkspace((prev) => (prev ? { ...prev, tree } : null));
  }, []);

  const selectWorkspaceFolder = useCallback(async () => {
    const data = await selectWorkspace();
    if (data) {
      setWorkspace({ root: data.root, tree: data.tree });
      await watchWorkspace(data.root);
    }
  }, []);

  const closeWorkspace = useCallback(async () => {
    setWorkspace(null);
    await watchWorkspace(null);
  }, []);

  useEffect(() => {
    fsApi.onFileChanged(() => {
      if (workspaceRootRef.current) reload();
    });
  }, [reload]);

  return { workspace, reload, selectWorkspace: selectWorkspaceFolder, closeWorkspace };
}
