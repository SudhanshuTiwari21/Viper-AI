export type ViperEvent =
  | "workspace:fileChanged"
  | "workspace:opened"
  | "workspace:closed"
  | "editor:fileOpened"
  | "editor:fileSaved"
  | "editor:selectionChanged"
  | "debug:started"
  | "debug:stopped";

type Handler = (...args: unknown[]) => void;

export class ViperEventEmitter {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  once(event: string, handler: Handler): void {
    const wrapper: Handler = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[ViperEventEmitter] Error in handler for "${event}":`, err);
      }
    }
  }
}

export const extensionEvents = new ViperEventEmitter();
