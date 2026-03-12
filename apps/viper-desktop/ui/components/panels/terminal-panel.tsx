import { useWorkspaceContext } from "../../contexts/workspace-context";
import { Terminal } from "../terminal";

export function TerminalPanel() {
  const { workspace } = useWorkspaceContext();
  return <Terminal workspaceRoot={workspace?.root ?? null} />;
}

