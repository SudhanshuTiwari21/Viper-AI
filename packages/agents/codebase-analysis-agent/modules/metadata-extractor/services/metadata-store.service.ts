import type {
  FunctionMetadata,
  ClassMetadata,
  ImportMetadata,
  RelationshipEdge,
} from "../types/metadata.types";

export interface ModuleRecord {
  file: string;
  module: string;
  repo_id: string;
}

/**
 * Adapter for persisting extracted metadata (e.g. PostgreSQL).
 * Implement with a real client; this interface allows batched inserts.
 */
export interface MetadataStoreAdapter {
  saveFunctions(records: FunctionMetadata[]): Promise<void>;
  saveClasses(records: ClassMetadata[]): Promise<void>;
  saveImports(records: ImportMetadata[]): Promise<void>;
  saveRelationships(edges: RelationshipEdge[]): Promise<void>;
  saveModules(records: ModuleRecord[]): Promise<void>;
}

/**
 * In-memory / no-op store for MVP when no database is configured.
 * Replace with a PostgreSQL implementation for production.
 */
export class MetadataStoreService implements MetadataStoreAdapter {
  private adapter: MetadataStoreAdapter | null = null;

  setAdapter(adapter: MetadataStoreAdapter): void {
    this.adapter = adapter;
  }

  async saveFunctions(records: FunctionMetadata[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.saveFunctions(records);
  }

  async saveClasses(records: ClassMetadata[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.saveClasses(records);
  }

  async saveImports(records: ImportMetadata[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.saveImports(records);
  }

  async saveRelationships(edges: RelationshipEdge[]): Promise<void> {
    if (edges.length === 0) return;
    if (this.adapter) await this.adapter.saveRelationships(edges);
  }

  async saveModules(records: ModuleRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.saveModules(records);
  }
}
