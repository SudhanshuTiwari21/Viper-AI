import type { ContextMenuItem as Item } from "./context-menu-types";
import { ContextMenuItem } from "./context-menu-item";

interface ContextMenuProps {
  items: Item[];
  onCommand: (commandId: string) => void;
  closeMenu: () => void;
  /** When true, only render the list (for submenus). */
  embedded?: boolean;
}

export function ContextMenu({
  items,
  onCommand,
  closeMenu,
  embedded = false,
}: ContextMenuProps) {
  const list = (
    <div className="py-1 min-w-[200px]">
      {items.map((item) => (
        <ContextMenuItem
          key={item.id}
          item={item}
          onCommand={onCommand}
          closeMenu={closeMenu}
        />
      ))}
    </div>
  );

  if (embedded) return list;

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl py-1"
      role="menu"
    >
      {list}
    </div>
  );
}
