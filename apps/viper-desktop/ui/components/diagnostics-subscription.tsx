import { useEffect } from "react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { useDiagnostics } from "../contexts/diagnostics-context";
import { diagnosticsApi } from "../services/filesystem";
import type { Diagnostic } from "../contexts/diagnostics-context";

/**
 * Subscribes to workspace and diagnostics IPC: starts the diagnostics worker
 * when a folder is opened and applies incoming diagnostics to the context.
 * Listener is registered first so we don't miss the first diagnostics:update.
 */
export function DiagnosticsSubscription() {
  const { workspace } = useWorkspaceContext();
  const { setAllDiagnostics, clearAllDiagnostics } = useDiagnostics();

  // Register IPC listener immediately so we receive diagnostics:update before any start() completes
  useEffect(() => {
    const remove = diagnosticsApi.onUpdate((payload: Array<[string, Diagnostic[]]>) => {
      setAllDiagnostics(new Map(payload));
    });
    return remove;
  }, [setAllDiagnostics]);

  // Start/stop diagnostics when workspace changes
  useEffect(() => {
    if (!workspace) {
      void diagnosticsApi.start(null);
      clearAllDiagnostics();
      return;
    }
    void diagnosticsApi.start(workspace.root);
  }, [workspace?.root, clearAllDiagnostics]);

  return null;
}
