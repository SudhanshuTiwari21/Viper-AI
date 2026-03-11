import { GitService } from "./git.service";
import { FileSysWalkerService } from "./filesyswalker.service";
import { LanguageDetectorService } from "./language-detector.service";
import { ModuleDetectorService } from "./module-detector.service";
import { FileClassifierService } from "./file-classifier.service";
import type {
  RepoFetchResult,
  RepoScanResult,
  RepoScanWithLanguagesResult,
  RepoScanWithModulesResult,
  RepoScanWithClassificationResult,
} from "../types/repo-scanner.types";

export class RepoScannerService {
  constructor(
    private gitService = new GitService(),
    private fileWalker = new FileSysWalkerService(),
    private languageDetector = new LanguageDetectorService(),
    private moduleDetector = new ModuleDetectorService(),
    private fileClassifier = new FileClassifierService()
  ) {}

  async fetchRepo(repoUrl: string, branch = "main"): Promise<RepoFetchResult> {
    const repoPath = await this.gitService.cloneOrUpdateRepo(repoUrl);
    await this.gitService.checkoutBranch(repoPath, branch);
    return { repoPath, branch };
  }

  /** Clone/fetch repo, then run File System Walker to get all file paths. */
  async scanRepo(repoUrl: string, branch = "main"): Promise<RepoScanResult> {
    const { repoPath, branch: resolvedBranch } = await this.fetchRepo(repoUrl, branch);
    const files = await this.fileWalker.walkFiles(repoPath);
    return { repoPath, branch: resolvedBranch, files };
  }

  /** Clone/fetch → walk files → detect language per file (for File Classification pipeline). */
  async scanRepoWithLanguages(
    repoUrl: string,
    branch = "main"
  ): Promise<RepoScanWithLanguagesResult> {
    const { repoPath, branch: resolvedBranch } = await this.fetchRepo(repoUrl, branch);
    const files = await this.fileWalker.walkFiles(repoPath);
    const filesWithLanguage = await this.languageDetector.detectAll(repoPath, files);
    return { repoPath, branch: resolvedBranch, filesWithLanguage };
  }

  /** Clone/fetch → walk files → detect logical module per file (Module/Service Detector). */
  async scanRepoWithModules(
    repoUrl: string,
    branch = "main"
  ): Promise<RepoScanWithModulesResult> {
    const { repoPath, branch: resolvedBranch } = await this.fetchRepo(repoUrl, branch);
    const files = await this.fileWalker.walkFiles(repoPath);
    const filesWithModule = this.moduleDetector.detectAll(files);
    return { repoPath, branch: resolvedBranch, filesWithModule };
  }

  /** Clone/fetch → walk files → classify each file (source, test, config, documentation, generated). */
  async scanRepoWithClassification(
    repoUrl: string,
    branch = "main"
  ): Promise<RepoScanWithClassificationResult> {
    const { repoPath, branch: resolvedBranch } = await this.fetchRepo(repoUrl, branch);
    const files = await this.fileWalker.walkFiles(repoPath);
    const filesWithType = this.fileClassifier.classifyAll(files);
    return { repoPath, branch: resolvedBranch, filesWithType };
  }
}