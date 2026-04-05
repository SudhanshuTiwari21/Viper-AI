import { useWorkspaceContext } from "../contexts/workspace-context";

function WelcomeButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="px-[var(--viper-space-2)] py-[var(--viper-space-1)] rounded border text-sm font-medium transition-all duration-200 hover:shadow-[0_0_16px_rgba(34,197,94,0.25)]"
      style={{
        borderColor: "var(--viper-border)",
        color: "#e5e7eb",
        background: "var(--viper-sidebar)",
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function EditorWelcome() {
  const { selectWorkspace } = useWorkspaceContext();

  const handleOpenFile = () => {
    selectWorkspace().catch(console.error);
  };

  const handleSearchFiles = () => {
    window.dispatchEvent(new CustomEvent("viper:focus-search"));
  };

  const handleAskViper = () => {
    selectWorkspace().catch(console.error);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-[var(--viper-space-3)]">
      <h2 className="text-xl font-semibold text-[#e5e7eb] mb-2">Welcome to Viper AI</h2>
      <p className="text-sm text-[#9ca3af] mb-[var(--viper-space-3)] max-w-sm">
        Open a folder to use Chat and AI; search and files need a workspace too.
      </p>
      <div className="flex flex-wrap justify-center gap-[var(--viper-space-2)]">
        <WelcomeButton label="Open File" onClick={handleOpenFile} />
        <WelcomeButton label="Search Files" onClick={handleSearchFiles} />
        <WelcomeButton label="Open Folder for Chat" onClick={handleAskViper} />
      </div>
    </div>
  );
}
