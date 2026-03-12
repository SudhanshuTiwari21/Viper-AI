import type { FileNode } from "../services/filesystem";

const EXT_ICONS: Record<string, string> = {
  ts: "📘",
  tsx: "⚛️",
  js: "📒",
  jsx: "⚛️",
  json: "📋",
  md: "📝",
  py: "🐍",
  go: "🔷",
  rs: "🦀",
  java: "☕",
  html: "🌐",
  css: "🎨",
  scss: "🎨",
  yaml: "⚙️",
  yml: "⚙️",
  sh: "⌨️",
  sql: "🗃️",
  lock: "🔒",
};

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function FileIcon({ node }: { node: FileNode }) {
  if (node.isDirectory) {
    return (
      <span className="text-amber-500/90 mr-1.5 flex-shrink-0" aria-hidden>
        📁
      </span>
    );
  }
  const ext = getExt(node.name);
  const icon = EXT_ICONS[ext] ?? "📄";
  return (
    <span className="text-zinc-400 mr-1.5 flex-shrink-0 w-4 text-center" aria-hidden>
      {icon}
    </span>
  );
}
