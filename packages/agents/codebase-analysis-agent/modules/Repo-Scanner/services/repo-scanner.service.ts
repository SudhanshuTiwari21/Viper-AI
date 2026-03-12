import { FileSysWalkerService } from "./filesyswalker.service";
import { LanguageDetectorService } from "./language-detector.service";
import { ModuleDetectorService } from "./module-detector.service";
import { FileClassifierService } from "./file-classifier.service";
import type {
  RepoScanWorkspaceResult,
  RepoScanResult,
  RepoScanWithLanguagesResult,
  RepoScanWithModulesResult,
  RepoScanWithClassificationResult,
} from "../types/repo-scanner.types";

/**
 * Repo Scanner service. Operates only on an existing workspace path.
 * No git operations; cloning is done by the Git Tool (Intent Agent).
 */
export class RepoScannerService {
  constructor(
    private fileWalker = new FileSysWalkerService(),
    private languageDetector = new LanguageDetectorService(),
    private moduleDetector = new ModuleDetectorService(),
    private fileClassifier = new FileClassifierService()
  ) {}

  /** Walk workspace and return file paths. */
  async scanRepo(
    workspacePath: string,
    repo_id: string,
    branch?: string
  ): Promise<RepoScanResult> {
    const files = await this.fileWalker.walkFiles(workspacePath);
    return { workspacePath, repo_id, branch, files };
  }

  /** Walk workspace → detect language per file. */
  async scanRepoWithLanguages(
    workspacePath: string,
    repo_id: string,
    branch?: string
  ): Promise<RepoScanWithLanguagesResult> {
    const files = await this.fileWalker.walkFiles(workspacePath);
    const filesWithLanguage = await this.languageDetector.detectAll(workspacePath, files);
    return { workspacePath, repo_id, branch, filesWithLanguage };
  }

  /** Walk workspace → detect logical module per file. */
  async scanRepoWithModules(
    workspacePath: string,
    repo_id: string,
    branch?: string
  ): Promise<RepoScanWithModulesResult> {
    const files = await this.fileWalker.walkFiles(workspacePath);
    const filesWithModule = this.moduleDetector.detectAll(files);
    return { workspacePath, repo_id, branch, filesWithModule };
  }

  /** Walk workspace → classify each file (source, test, config, etc.). */
  async scanRepoWithClassification(
    workspacePath: string,
    repo_id: string,
    branch?: string
  ): Promise<RepoScanWithClassificationResult> {
    const files = await this.fileWalker.walkFiles(workspacePath);
    const filesWithType = this.fileClassifier.classifyAll(files);
    return { workspacePath, repo_id, branch, filesWithType };
  }
}
