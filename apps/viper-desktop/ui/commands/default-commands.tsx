import { useEffect } from "react";
import { registerCommand, unregisterCommand } from "./command-registry";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { diagnosticsApi, fsApi, shellApi } from "../services/filesystem";
import { useChat } from "../contexts/chat-context";
import { runAnalysis, runAnalysisScan, formatScanReport } from "../services/agent-api";

const COMMAND_IDS = [
  "workspace.openFolder",
  "workspace.closeFolder",
  "workbench.reloadWindow",
  "workbench.toggleTerminal",
  "workbench.focusExplorer",
  "workbench.focusChat",
  "viper.analysis.run",
  "viper.analysis.scan",
  "diagnostics.run",
  "diagnostics.restartWorker",
  "workbench.openCommandPalette",
  "workbench.openSettings",
  "editor.formatDocument",
  "ts.restartServer",
  "eslint.restartServer",
  "explorer.revealInFinder",
  "explorer.copyRelativePath",
  "explorer.copyAbsolutePath",
  "explorer.copyFileUrl",
  "explorer.openTerminalHere",
  "explorer.newFileInFolder",
  "explorer.newFolderInFolder",
  "explorer.rename",
  "explorer.delete",
  "explorer.openToSide",
  "viper.chat.addFile",
  "viper.chat.addFileNew",
  "viper.chat.addDirectory",
  "viper.chat.addDirectoryNew",
] as const;

export function useRegisterDefaultCommands() {
  const { workspace, selectWorkspace, closeWorkspace } = useWorkspaceContext();
  const chat = useChat();

  useEffect(() => {
    registerCommand({
      id: "workspace.openFolder",
      title: "Open Folder",
      category: "Workspace",
      run: () => selectWorkspace(),
    });
    registerCommand({
      id: "workspace.closeFolder",
      title: "Close Folder",
      category: "Workspace",
      run: () => closeWorkspace(),
    });
    registerCommand({
      id: "workbench.reloadWindow",
      title: "Reload Window",
      category: "Workbench",
      run: () => window.location.reload(),
    });
    registerCommand({
      id: "workbench.toggleTerminal",
      title: "Toggle Terminal",
      category: "Workbench",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:menu-toggle-panel"));
      },
    });
    registerCommand({
      id: "workbench.focusExplorer",
      title: "Focus Explorer",
      category: "Workbench",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:focus-explorer"));
      },
    });
    registerCommand({
      id: "workbench.focusChat",
      title: "Focus Chat",
      category: "Workbench",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:focus-chat"));
      },
    });
    registerCommand({
      id: "viper.analysis.run",
      title: "Run Codebase Analysis",
      category: "Viper",
      run: async () => {
        if (!workspace?.root) {
          window.alert("Open a workspace folder first.");
          return;
        }
        try {
          await runAnalysis(workspace.root);
          window.alert("Analysis started. The backend is building the code intelligence (symbols, embeddings, dependency graph).");
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Analysis failed. Is the backend running on port 4000?");
        }
      },
    });
    registerCommand({
      id: "viper.analysis.scan",
      title: "Test Codebase Scan (current workspace)",
      category: "Viper",
      run: async () => {
        if (!workspace?.root) {
          window.alert("Open a workspace folder first.");
          return;
        }
        const sessionId = chat.activeSessionId ?? chat.createSession();
        try {
          const result = await runAnalysisScan(workspace.root);
          const report = formatScanReport(result);
          chat.addMessage(sessionId, { role: "assistant", content: report });
          window.dispatchEvent(new CustomEvent("viper:focus-chat"));
        } catch (e) {
          chat.addMessage(sessionId, {
            role: "assistant",
            content: `Scan failed: ${e instanceof Error ? e.message : "Unknown error"}. Is the backend running on port 4000?`,
          });
          window.dispatchEvent(new CustomEvent("viper:focus-chat"));
        }
      },
    });
    registerCommand({
      id: "diagnostics.run",
      title: "Run Diagnostics",
      category: "Diagnostics",
      run: () => {
        if (workspace?.root) void diagnosticsApi.start(workspace.root);
      },
    });
    registerCommand({
      id: "diagnostics.restartWorker",
      title: "Restart Diagnostics Worker",
      category: "Diagnostics",
      run: () => diagnosticsApi.restart(),
    });
    registerCommand({
      id: "workbench.openCommandPalette",
      title: "Open Command Palette",
      category: "Workbench",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:open-command-palette"));
      },
    });
    registerCommand({
      id: "workbench.openSettings",
      title: "Open Settings",
      category: "Workbench",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:open-settings"));
      },
    });
    registerCommand({
      id: "editor.formatDocument",
      title: "Format Document",
      category: "Editor",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:format-document"));
      },
    });
    registerCommand({
      id: "ts.restartServer",
      title: "Restart TypeScript Server",
      category: "Language Servers",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:restart-ts-server"));
      },
    });
    registerCommand({
      id: "eslint.restartServer",
      title: "Restart ESLint Server",
      category: "Language Servers",
      run: () => {
        window.dispatchEvent(new CustomEvent("viper:restart-eslint-server"));
      },
    });

    registerCommand({
      id: "explorer.revealInFinder",
      title: "Reveal in Finder",
      category: "Explorer",
      run: async (args) => {
        if (!workspace?.root || !args?.target) return;
        await shellApi.revealInFolder(workspace.root, args.target.path);
      },
    });

    registerCommand({
      id: "explorer.copyRelativePath",
      title: "Copy Path",
      category: "Explorer",
      run: async (args) => {
        if (!args?.target) return;
        try {
          await navigator.clipboard.writeText(args.target.path || args.target.workspaceRoot);
        } catch {
          // ignore
        }
      },
    });

    registerCommand({
      id: "explorer.copyAbsolutePath",
      title: "Copy Absolute Path",
      category: "Explorer",
      run: async (args) => {
        if (!args?.target) return;
        const full = args.target.path
          ? `${args.target.workspaceRoot}/${args.target.path}`.replace(/\/+/g, "/")
          : args.target.workspaceRoot;
        try {
          await navigator.clipboard.writeText(full);
        } catch {
          // ignore
        }
      },
    });

    registerCommand({
      id: "explorer.copyFileUrl",
      title: "Copy File URL",
      category: "Explorer",
      run: async (args) => {
        if (!args?.target) return;
        const full = `${args.target.workspaceRoot}/${args.target.path}`.replace(/\/+/g, "/");
        const url = `file://${full}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // ignore
        }
      },
    });

    registerCommand({
      id: "explorer.openTerminalHere",
      title: "Open in Integrated Terminal",
      category: "Explorer",
      run: (args) => {
        const cwd = args?.target
          ? `${args.target.workspaceRoot}/${args.target.path}`.replace(/\/+/g, "/")
          : workspace?.root ?? "";
        window.dispatchEvent(
          new CustomEvent("viper:open-terminal-here", { detail: { cwd } })
        );
      },
    });

    registerCommand({
      id: "explorer.newFileInFolder",
      title: "New File…",
      category: "Explorer",
      run: async (args) => {
        if (!workspace?.root) return;
        const base = args?.target?.path ?? "";
        const name = window.prompt("New file name", "new-file.ts");
        if (!name) return;
        const rel = base ? `${base.replace(/\/$/, "")}/${name}` : name;
        await fsApi.createFile(workspace.root, rel);
      },
    });

    registerCommand({
      id: "explorer.newFolderInFolder",
      title: "New Folder…",
      category: "Explorer",
      run: async (args) => {
        if (!workspace?.root) return;
        const base = args?.target?.path ?? "";
        const name = window.prompt("New folder name", "new-folder");
        if (!name) return;
        const rel = base ? `${base.replace(/\/$/, "")}/${name}` : name;
        await fsApi.createFolder(workspace.root, rel);
      },
    });

    registerCommand({
      id: "explorer.rename",
      title: "Rename",
      category: "Explorer",
      run: async (args) => {
        if (!workspace?.root || !args?.target) return;
        const current = args.target.path;
        const parts = current.split("/");
        const baseName = parts.pop() ?? current;
        const parent = parts.join("/");
        const next = window.prompt("Rename", baseName);
        if (!next || next === baseName) return;
        const newRel = parent ? `${parent}/${next}` : next;
        await fsApi.renamePath(workspace.root, current, newRel);
      },
    });

    registerCommand({
      id: "explorer.delete",
      title: "Delete",
      category: "Explorer",
      run: async (args) => {
        if (!workspace?.root || !args?.target) return;
        const ok = window.confirm(`Delete "${args.target.path || args.target.workspaceRoot}"?`);
        if (!ok) return;
        if (args.target.path) {
          await fsApi.deletePath(workspace.root, args.target.path);
        }
      },
    });

    registerCommand({
      id: "explorer.openToSide",
      title: "Open to the Side",
      category: "Explorer",
      run: (args) => {
        if (!args?.target || !workspace?.root) return;
        const relPath = args.target.path;
        fsApi
          .readFile(workspace.root, relPath)
          .then((content) => {
            window.dispatchEvent(
              new CustomEvent("viper:open-file", {
                detail: { root: workspace.root, path: relPath, content },
              })
            );
          })
          .catch(() => {});
      },
    });

    registerCommand({
      id: "viper.chat.addFile",
      title: "Add File to Viper Chat",
      category: "Chat",
      run: (args) => {
        if (!workspace?.root || !args?.target) return;
        const full = `${workspace.root}/${args.target.path}`.replace(/\/+/g, "/");
        const sessionId = chat.activeSessionId ?? chat.createSession();
        chat.addAttachedPath(sessionId, full);
        chat.setActiveSessionId(sessionId);
      },
    });

    registerCommand({
      id: "viper.chat.addFileNew",
      title: "Add File to New Viper Chat",
      category: "Chat",
      run: (args) => {
        if (!workspace?.root || !args?.target) return;
        const full = `${workspace.root}/${args.target.path}`.replace(/\/+/g, "/");
        const sessionId = chat.addAttachedPathToNewSession(full);
        chat.setActiveSessionId(sessionId);
      },
    });

    registerCommand({
      id: "viper.chat.addDirectory",
      title: "Add Directory to Viper Chat",
      category: "Chat",
      run: (args) => {
        if (!workspace?.root || !args?.target) return;
        const base = args.target.path || "";
        const full = base
          ? `${workspace.root}/${base}`.replace(/\/+/g, "/")
          : workspace.root;
        const sessionId = chat.activeSessionId ?? chat.createSession();
        chat.addAttachedPath(sessionId, full);
        chat.setActiveSessionId(sessionId);
      },
    });

    registerCommand({
      id: "viper.chat.addDirectoryNew",
      title: "Add Directory to New Viper Chat",
      category: "Chat",
      run: (args) => {
        if (!workspace?.root || !args?.target) return;
        const base = args.target.path || "";
        const full = base
          ? `${workspace.root}/${base}`.replace(/\/+/g, "/")
          : workspace.root;
        const sessionId = chat.addAttachedPathToNewSession(full);
        chat.setActiveSessionId(sessionId);
      },
    });

    return () => {
      COMMAND_IDS.forEach((id) => unregisterCommand(id));
    };
  }, [selectWorkspace, workspace?.root, chat]);
}
