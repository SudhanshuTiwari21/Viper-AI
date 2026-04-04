export type ViperEvent = "workspace:fileChanged" | "workspace:opened" | "workspace:closed" | "editor:fileOpened" | "editor:fileSaved" | "editor:selectionChanged" | "debug:started" | "debug:stopped";
type Handler = (...args: unknown[]) => void;
export declare class ViperEventEmitter {
    private listeners;
    on(event: string, handler: Handler): void;
    off(event: string, handler: Handler): void;
    once(event: string, handler: Handler): void;
    emit(event: string, ...args: unknown[]): void;
}
export declare const extensionEvents: ViperEventEmitter;
export {};
