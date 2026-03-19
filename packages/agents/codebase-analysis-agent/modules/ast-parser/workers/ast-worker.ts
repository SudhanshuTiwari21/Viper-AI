import type { ASTParseJob } from "../types/ast-job.types";
import type { SerializedAST } from "../types/ast-parser.types";
import { ParserEngine } from "../parsers/parser-engine";
import { validateAST } from "../validators/ast-validator";
import { serializeAST } from "../serializers/ast-serializer";
import { extractStructure } from "../extractors/structure-extractor";
import type { MetadataPublisherService } from "../services/metadata-publisher.service";
import type { AstStoreService } from "../services/ast-store.service";

/** Minimal shape for publishing an embedding job (avoids coupling to chunk-embedding-generator). */
export interface EmbeddingRequestJob {
  repo_id: string;
  file: string;
  module: string;
  content: string;
}

export interface ASTWorkerOptions {
  getRepoRoot: (repo: string) => string;
  /** If set, publish extracted metadata + serialized AST to next stage (metadata.extract.request). */
  metadataPublisher?: MetadataPublisherService;
  /** If set, publish one embedding job per parsed file to embedding_generate.request channel. */
  onEmbeddingRequest?: (job: EmbeddingRequestJob) => Promise<void>;
  /** If set, store serialized AST (file_asts). Storage happens inside AST module. */
  astStore?: AstStoreService;
}

/**
 * Receives a job, runs: language router → parser engine → validator → structure extractor → serializer → metadata publisher.
 */
export class ASTWorker {
  private readonly parserEngine: ParserEngine;
  private readonly metadataPublisher?: MetadataPublisherService;
  private readonly onEmbeddingRequest?: (job: EmbeddingRequestJob) => Promise<void>;
  private readonly astStore?: AstStoreService;

  constructor(options: ASTWorkerOptions) {
    this.parserEngine = new ParserEngine({
      getRepoRoot: options.getRepoRoot,
    });
    this.metadataPublisher = options.metadataPublisher;
    this.onEmbeddingRequest = options.onEmbeddingRequest;
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
        // Match MetadataJob shape expected by metadata-extractor
        repo_id: job.repo,
        file: job.file,
        module: job.module ?? "root",
        language: job.language,
        ast: serialized,
      });
    }

    if (this.onEmbeddingRequest) {
      await this.onEmbeddingRequest({
        repo_id: job.repo,
        file: job.file,
        module: job.module ?? "root",
        content,
      });
    }

    return serialized;
  }
}
