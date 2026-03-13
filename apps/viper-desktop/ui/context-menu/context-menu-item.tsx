import { useState } from "react";
import type { ContextMenuItem as Item } from "./context-menu-types";
import { ContextMenu } from "./context-menu";

interface ContextMenuItemProps {
  item: Item;
  onCommand: (commandId: string) => void;
  closeMenu: () => void;
}

export function ContextMenuItem({ item, onCommand, closeMenu }: ContextMenuItemProps) {
  const [submenuOpen, setSubmenuOpen] = useState(false);

  if (item.separator) {
    return (
      <div
        className="my-1 h-px bg-zinc-700"
        role="separator"
      />
    );
  }

  const hasSubmenu = item.submenu && item.submenu.length > 0;
  const disabled = item.disabled ?? false;

  const handleClick = () => {
    if (disabled) return;
    if (item.command) {
      onCommand(item.command);
      closeMenu();
    } else if (hasSubmenu) {
      setSubmenuOpen((o) => !o);
    }
  };

  const handleSubmenuCommand = (commandId: string) => {
    onCommand(commandId);
    closeMenu();
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={() => hasSubmenu && setSubmenuOpen(true)}
        onMouseLeave={() => hasSubmenu && setSubmenuOpen(false)}
        className={`
          w-full flex items-center justify-between gap-4 px-3 py-1.5 text-left text-sm
          rounded transition-colors
          ${disabled ? "text-zinc-500 cursor-not-allowed" : "text-zinc-200 hover:bg-zinc-800 cursor-pointer"}
        `}
      >
        <span className="flex items-center gap-2 min-w-0">
          {item.icon && <span className="text-zinc-400 flex-shrink-0">{item.icon}</span>}
          <span className="truncate">{item.label}</span>
        </span>
        {item.shortcut && (
          <span className="text-zinc-500 text-xs flex-shrink-0">{item.shortcut}</span>
        )}
        {hasSubmenu && (
          <span className="text-zinc-500 flex-shrink-0 ml-1">▶</span>
        )}
      </button>
      {hasSubmenu && submenuOpen && item.submenu && (
        <div
          className="absolute left-full top-0 ml-0.5 z-[100] min-w-[180px] py-1 rounded-md border border-zinc-700 bg-zinc-900 shadow-xl"
          onMouseEnter={() => setSubmenuOpen(true)}
          onMouseLeave={() => setSubmenuOpen(false)}
        >
          <ContextMenu
            items={item.submenu}
            onCommand={onCommand}
            closeMenu={closeMenu}
            embedded
          />
        </div>
      )}
    </div>
  );
}
