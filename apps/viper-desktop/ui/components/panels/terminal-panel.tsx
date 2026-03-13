import { useWorkspaceContext } from "../../contexts/workspace-context";
import { Terminal } from "../terminal";

export function TerminalPanel() {
  const { workspace } = useWorkspaceContext();

  return (
    <div className="flex-1 min-h-0">
      <Terminal workspaceRoot={workspace?.root ?? null} />
    </div>
  );
}

