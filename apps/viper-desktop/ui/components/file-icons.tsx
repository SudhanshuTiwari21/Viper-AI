import { IoFolder, IoFolderOpen } from "react-icons/io5";
import { FILE_ICON_REGISTRY } from "../data/file-icon-registry";
import { getFileIconKey, getFileIconColor } from "../data/file-icon-map";
import type { FileNode } from "../services/filesystem";

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

interface FileIconProps {
  node: FileNode;
  /** Only used for directories: true = expanded, false = collapsed */
  expanded?: boolean;
}

const iconSize = 16;
const iconClass = "flex-shrink-0 mr-1.5";

/** Cursor-style: muted grey folder icons (not yellow) */
const FOLDER_COLOR = "#7a7a7a";

export function FileIcon({ node, expanded = false }: FileIconProps) {
  if (node.isDirectory) {
    const FolderIcon = expanded ? IoFolderOpen : IoFolder;
    return (
      <span className={iconClass} style={{ width: iconSize, height: iconSize, color: FOLDER_COLOR }}>
        <FolderIcon size={iconSize} />
      </span>
    );
  }

  const iconKey = getFileIconKey(node.name);
  const ext = getExt(node.name);
  const IconComponent = FILE_ICON_REGISTRY[iconKey] ?? FILE_ICON_REGISTRY.file;
  const color = getFileIconColor(iconKey, ext);

  return (
    <span
      className={iconClass}
      style={{
        width: iconSize,
        height: iconSize,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IconComponent size={iconSize} />
    </span>
  );
}
