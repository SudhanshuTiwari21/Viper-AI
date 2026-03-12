/**
 * Symbol lookup index: symbol name → node id (canonical).
 * Stored in memory for MVP; can be backed by Redis for multi-worker sharing.
 */
export class SymbolIndexService {
  private index = new Map<string, string>();

  set(symbolName: string, nodeId: string): void {
    this.index.set(symbolName, nodeId);
  }

  get(symbolName: string): string | undefined {
    return this.index.get(symbolName);
  }

  has(symbolName: string): boolean {
    return this.index.has(symbolName);
  }

  /** Register multiple symbols from the same node (e.g. file path as key). */
  setMany(entries: Array<{ key: string; nodeId: string }>): void {
    for (const { key, nodeId } of entries) {
      this.index.set(key, nodeId);
    }
  }

  /** Build index from node list: name → id for function/class nodes. */
  buildFromNodeIds(nodes: Array<{ id: string; name?: string }>): void {
    for (const n of nodes) {
      if (n.name) this.index.set(n.name, n.id);
      this.index.set(n.id, n.id);
    }
  }

  clear(): void {
    this.index.clear();
  }

  size(): number {
    return this.index.size;
  }
}
