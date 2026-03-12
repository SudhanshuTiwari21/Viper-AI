import type { ASTParseJob } from "../types/ast-job.types";
import type { SerializedAST } from "../types/ast-parser.types";
import { ParserEngine } from "../parsers/parser-engine";
import { validateAST } from "../validators/ast-validator";
import { serializeAST } from "../serializers/ast-serializer";
import { extractStructure } from "../extractors/structure-extractor";
import type { MetadataPublisherService } from "../services/metadata-publisher.service";
import type { AstStoreService } from "../services/ast-store.service";

export interface ASTWorkerOptions {
  getRepoRoot: (repo: string) => string;
  /** If set, publish extracted metadata + serialized AST to next stage (metadata.extract.request). */
  metadataPublisher?: MetadataPublisherService;
  /** If set, store serialized AST (file_asts). Storage happens inside AST module. */
  astStore?: AstStoreService;
}

/**
 * Receives a job, runs: language router → parser engine → validator → structure extractor → serializer → metadata publisher.
 */
export class ASTWorker {
  private readonly parserEngine: ParserEngine;
  private readonly metadataPublisher?: MetadataPublisherService;
  private readonly astStore?: AstStoreService;

  constructor(options: ASTWorkerOptions) {
    this.parserEngine = new ParserEngine({
      getRepoRoot: options.getRepoRoot,
    });
    this.metadataPublisher = options.metadataPublisher;
    this.astStore = options.astStore;
  }

  async run(job: ASTParseJob): Promise<SerializedAST | SerializedAST[]> {
    const content = await this.parserEngine.readFile(job.repo, job.file);
    const ast = await this.parserEngine.generateAST(
      job.repo,
      job.file,
      job.language,
      content
    );

    const validation = validateAST(ast);
    if (!validation.valid) {
      throw new Error(`AST validation failed: ${validation.errors.join("; ")}`);
    }

    const extracted = extractStructure({
      repo_id: job.repo,
      file: job.file,
      ast,
      content,
    });

    const serialized = serializeAST(ast);

    if (this.astStore) {
      await this.astStore.saveAST({ repo_id: job.repo, file: job.file, ast: serialized });
    }

    if (this.metadataPublisher) {
      await this.metadataPublisher.publish({
        repo_id: job.repo,
        file: job.file,
        functions: extracted.functions,
        imports: extracted.imports,
        serialized_ast: serialized,
      });
    }

    return serialized;
  }
}
