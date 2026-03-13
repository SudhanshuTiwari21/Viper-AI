export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  command?: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  /** Target for command execution (e.g. explorer node). */
  target?: ExplorerContextTarget;
}

/** Target of a context menu action (file, folder, or root). */
export interface ExplorerContextTarget {
  path: string;
  isDirectory: boolean;
  workspaceRoot: string;
  /** For root, path is "". */
  name: string;
}
