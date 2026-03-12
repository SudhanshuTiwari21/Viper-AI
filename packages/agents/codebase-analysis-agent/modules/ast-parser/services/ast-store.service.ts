/**
 * Stores serialized ASTs. Used by the AST Parsing Layer only.
 * Table: file_asts. Orchestrator does not store ASTs.
 */
export interface AstStoreAdapter {
  saveAST(params: { repo_id: string; file: string; ast: unknown }): Promise<void>;
}

export class AstStoreService {
  private adapter: AstStoreAdapter | null = null;

  setAdapter(adapter: AstStoreAdapter): void {
    this.adapter = adapter;
  }

  async saveAST(params: { repo_id: string; file: string; ast: unknown }): Promise<void> {
    if (this.adapter) await this.adapter.saveAST(params);
  }
}
