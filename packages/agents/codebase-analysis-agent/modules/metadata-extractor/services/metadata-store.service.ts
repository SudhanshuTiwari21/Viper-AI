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
 * All methods are batch-oriented: implementors must perform batched inserts
 * (e.g. INSERT ... VALUES (...), (...), (...) or bulkWrite) to avoid
 * thousands of single-row queries on large repositories.
 */
export interface MetadataStoreAdapter {
  /** Insert functions in one batch. */
  insertFunctionsBatch(records: FunctionMetadata[]): Promise<void>;
  /** Insert classes in one batch. */
  insertClassesBatch(records: ClassMetadata[]): Promise<void>;
  /** Insert import records in one batch. */
  insertImportsBatch(records: ImportMetadata[]): Promise<void>;
  /** Insert relationship edges in one batch. */
  insertRelationshipsBatch(edges: RelationshipEdge[]): Promise<void>;
  /** Insert module records in one batch. */
  insertModulesBatch(records: ModuleRecord[]): Promise<void>;
}

/**
 * Service that delegates to an adapter. Enforces batch semantics: no per-row calls.
 * When no adapter is set, operations are no-ops (MVP).
 */
export class MetadataStoreService {
  private adapter: MetadataStoreAdapter | null = null;

  setAdapter(adapter: MetadataStoreAdapter): void {
    this.adapter = adapter;
  }

  async saveFunctions(records: FunctionMetadata[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.insertFunctionsBatch(records);
  }

  async saveClasses(records: ClassMetadata[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.insertClassesBatch(records);
  }

  async saveImports(records: ImportMetadata[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.insertImportsBatch(records);
  }

  async saveRelationships(edges: RelationshipEdge[]): Promise<void> {
    if (edges.length === 0) return;
    if (this.adapter) await this.adapter.insertRelationshipsBatch(edges);
  }

  async saveModules(records: ModuleRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.insertModulesBatch(records);
  }
}
