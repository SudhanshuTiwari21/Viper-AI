import { useEffect, useState } from "react";
import { useWorkspaceContext } from "../contexts/workspace-context";
import { useStatusBar } from "../contexts/status-bar-context";

export function StatusBar() {
  const { workspace } = useWorkspaceContext();
  const { status } = useStatusBar();
  const [branch, setBranch] = useState("");

  useEffect(() => {
    if (!workspace?.root || typeof window.viper?.git?.branch !== "function") {
      setBranch("");
      return;
    }
    window.viper.git.branch(workspace.root).then(setBranch).catch(() => setBranch(""));
  }, [workspace?.root]);

  const displayBranch = branch || "main";
  const langLabel = status.language ? (status.language.charAt(0).toUpperCase() + status.language.slice(1)) : "";
  const pos = status.cursorLine > 0 ? `Ln ${status.cursorLine}, Col ${status.cursorCol}` : "";

  const parts = [displayBranch, langLabel, pos].filter(Boolean);
  const text = parts.join(" | ");

  return (
    <footer
      className="flex-shrink-0 h-6 flex items-center px-[var(--viper-space-2)] text-[11px] font-mono"
      style={{
        background: "#0b0f17",
        borderTop: "1px solid var(--viper-border)",
        color: "#9ca3af",
      }}
    >
      <span className="truncate">{text || "Viper AI"}</span>
    </footer>
  );
}
