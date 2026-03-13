import type { ReactNode } from "react";
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { ContextMenuItem, ContextMenuState } from "./context-menu-types";
import { ContextMenu } from "./context-menu";
import { runCommand } from "../commands/command-registry";

type ContextMenuContextValue = {
  openMenu: (
    items: ContextMenuItem[],
    position: { x: number; y: number },
    target?: ContextMenuState["target"]
  ) => void;
  closeMenu: () => void;
  /** Current target for command execution (set when menu was opened). */
  currentTarget: ContextMenuState["target"];
};

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextMenuState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setState(null);
  }, []);

  const openMenu = useCallback(
    (
      items: ContextMenuItem[],
      position: { x: number; y: number },
      target?: ContextMenuState["target"]
    ) => {
      setState({ x: position.x, y: position.y, items, target });
    },
    []
  );

  const handleCommand = useCallback(
    (commandId: string) => {
      const target = state?.target;
      try {
        runCommand(commandId, { target });
      } catch (err) {
        console.error("[context-menu] runCommand failed:", err);
      }
      closeMenu();
    },
    [state?.target, closeMenu]
  );

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, closeMenu]);

  useEffect(() => {
    if (!state) return;
    const onClick = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) closeMenu();
    };
    const t = setTimeout(() => window.addEventListener("click", onClick, true), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", onClick, true);
    };
  }, [state, closeMenu]);

  const value: ContextMenuContextValue = {
    openMenu,
    closeMenu,
    currentTarget: state?.target ?? undefined,
  };

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      {state && (
        <div
          ref={containerRef}
          className="fixed z-[9999]"
          style={{ left: state.x, top: state.y }}
        >
          <ContextMenu
            items={state.items}
            onCommand={handleCommand}
            closeMenu={closeMenu}
          />
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu(): ContextMenuContextValue {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error("useContextMenu must be used within ContextMenuProvider");
  return ctx;
}
