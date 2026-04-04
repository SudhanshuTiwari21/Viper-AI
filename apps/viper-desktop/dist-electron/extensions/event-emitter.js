"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extensionEvents = exports.ViperEventEmitter = void 0;
class ViperEventEmitter {
    listeners = new Map();
    on(event, handler) {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(handler);
    }
    off(event, handler) {
        this.listeners.get(event)?.delete(handler);
    }
    once(event, handler) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            handler(...args);
        };
        this.on(event, wrapper);
    }
    emit(event, ...args) {
        const set = this.listeners.get(event);
        if (!set)
            return;
        for (const handler of set) {
            try {
                handler(...args);
            }
            catch (err) {
                console.error(`[ViperEventEmitter] Error in handler for "${event}":`, err);
            }
        }
    }
}
exports.ViperEventEmitter = ViperEventEmitter;
exports.extensionEvents = new ViperEventEmitter();
