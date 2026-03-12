import { RepoScannerService } from "./repo-scanner.service";
import { FileSysWalkerService } from "./filesyswalker.service";
import { LanguageDetectorService } from "./language-detector.service";
import { ModuleDetectorService } from "./module-detector.service";
import { FileClassifierService } from "./file-classifier.service";
import { JobGeneratorService } from "./job-generator.service";
import { RedisQueueService } from "./redis-queue.service";
import { RepoMetadataStoreService } from "./repo-metadata-store.service";
import { resolveWorkspace } from "./workspace-resolver.service";
import type { FileWalkerResult, WalkOptions } from "../types/filewalker.types";

export const repoScannerService = new RepoScannerService();
export { resolveWorkspace };
export const repoMetadataStoreService = new RepoMetadataStoreService();
export const fileSysWalkerService = new FileSysWalkerService();
export const languageDetectorService = new LanguageDetectorService();
export const moduleDetectorService = new ModuleDetectorService();
export const fileClassifierService = new FileClassifierService();
export const jobGeneratorService = new JobGeneratorService();

export {
  RepoScannerService,
  FileSysWalkerService,
  LanguageDetectorService,
  ModuleDetectorService,
  FileClassifierService,
  JobGeneratorService,
  RedisQueueService,
  RepoMetadataStoreService,
};
export type { RepoMetadataStoreAdapter } from "./repo-metadata-store.service";
export { DEFAULT_PARSE_QUEUE_NAME } from "./redis-queue.service";
export { WorkspaceNotFoundError } from "../types/workspace.types";

export async function walkRepo(
  repoPath: string,
  options?: WalkOptions
): Promise<FileWalkerResult> {
  return fileSysWalkerService.walk(repoPath, options);
}
