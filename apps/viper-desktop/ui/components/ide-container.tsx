import { FileExplorer } from "./file-explorer";
import { EditorContainer } from "./editor-container";
import { ChatPanel } from "./chat-panel";
import { Terminal } from "./terminal";
import { useWorkspaceContext } from "../contexts/workspace-context";

export function IDEContainer() {
  const { workspace } = useWorkspaceContext();

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0b0b]">
      <div className="flex flex-1 min-h-0">
        {/* Left: File explorer */}
        <aside className="w-64 flex-shrink-0 border-r border-zinc-800/80 bg-[#0f0f10]">
          <FileExplorer />
        </aside>

        {/* Center: Editor tabs + Monaco */}
        <section className="flex-1 min-w-0 border-r border-zinc-800/80 bg-[#050507]">
          <EditorContainer />
        </section>

        {/* Right: AI Chat panel */}
        <aside className="w-[420px] flex-shrink-0 border-l border-zinc-800/80 bg-[#0d0d0d]">
          <ChatPanel />
        </aside>
      </div>

      {/* Bottom terminal: real shell via node-pty */}
      <div className="h-40 border-t border-zinc-800/80 bg-black/90">
        <Terminal workspaceRoot={workspace?.root ?? null} />
      </div>
    </div>
  );
}
