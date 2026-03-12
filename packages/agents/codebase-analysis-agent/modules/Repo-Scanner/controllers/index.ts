import {
  repoScannerService,
  fileSysWalkerService,
  languageDetectorService,
  moduleDetectorService,
  fileClassifierService,
} from "../services";
import type {
  RepoScanWorkspaceResult,
  RepoScanResult,
  RepoScanWithLanguagesResult,
  RepoScanWithModulesResult,
  RepoScanWithClassificationResult,
} from "../types/repo-scanner.types";
import type { FileWalkerResult, WalkOptions } from "../types/filewalker.types";
import type { FileWithLanguage, LanguageDetectorOptions } from "../types/language-detector.types";
import type { FileWithModule, ModuleDetectorOptions } from "../types/module-detector.types";
import type { FileWithType } from "../types/file-classification.types";
import { FileType } from "../types/file-classification.types";

/**
 * Scan an existing workspace (no git clone). Use Git Tool for clone/pull/checkout.
 */
export async function scanRepo(
  workspacePath: string,
  repo_id: string,
  branch?: string
): Promise<RepoScanResult> {
  try {
    return await repoScannerService.scanRepo(workspacePath, repo_id, branch);
  } catch (error) {
    throw new Error(`Failed to scan workspace: ${error}`);
  }
}

export async function scanRepoWithLanguages(
  workspacePath: string,
  repo_id: string,
  branch?: string
): Promise<RepoScanWithLanguagesResult> {
  try {
    return await repoScannerService.scanRepoWithLanguages(workspacePath, repo_id, branch);
  } catch (error) {
    throw new Error(`Failed to scan workspace with languages: ${error}`);
  }
}

export async function walkRepo(
  workspacePath: string,
  options?: WalkOptions
): Promise<FileWalkerResult> {
  return fileSysWalkerService.walk(workspacePath, options);
}

export async function detectLanguages(
  workspacePath: string,
  files: string[],
  options?: LanguageDetectorOptions
): Promise<FileWithLanguage[]> {
  return languageDetectorService.detectAll(workspacePath, files, options);
}

export async function scanRepoWithModules(
  workspacePath: string,
  repo_id: string,
  branch?: string
): Promise<RepoScanWithModulesResult> {
  try {
    return await repoScannerService.scanRepoWithModules(workspacePath, repo_id, branch);
  } catch (error) {
    throw new Error(`Failed to scan workspace with modules: ${error}`);
  }
}

export function detectModules(
  files: string[],
  options?: ModuleDetectorOptions
): FileWithModule[] {
  return moduleDetectorService.detectAll(files, options);
}

export async function scanRepoWithClassification(
  workspacePath: string,
  repo_id: string,
  branch?: string
): Promise<RepoScanWithClassificationResult> {
  try {
    return await repoScannerService.scanRepoWithClassification(workspacePath, repo_id, branch);
  } catch (error) {
    throw new Error(`Failed to scan workspace with classification: ${error}`);
  }
}

export function classifyFiles(files: string[]): FileWithType[] {
  return fileClassifierService.classifyAll(files);
}

export function filterByType(
  classified: FileWithType[],
  ...types: FileType[]
): FileWithType[] {
  return fileClassifierService.filterByType(classified, ...types);
}

export { FileType };
