import {
  repoScannerService,
  fileSysWalkerService,
  languageDetectorService,
  moduleDetectorService,
  fileClassifierService,
} from "../services";
import type {
  RepoFetchResult,
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

export async function fetchRepo(
  repoUrl: string,
  branch = "main"
): Promise<RepoFetchResult> {
  try {
    return await repoScannerService.fetchRepo(repoUrl, branch);
  } catch (error) {
    throw new Error(`Failed to fetch repository: ${error}`);
  }
}

export async function scanRepo(
  repoUrl: string,
  branch = "main"
): Promise<RepoScanResult> {
  try {
    return await repoScannerService.scanRepo(repoUrl, branch);
  } catch (error) {
    throw new Error(`Failed to scan repository: ${error}`);
  }
}

export async function scanRepoWithLanguages(
  repoUrl: string,
  branch = "main"
): Promise<RepoScanWithLanguagesResult> {
  try {
    return await repoScannerService.scanRepoWithLanguages(repoUrl, branch);
  } catch (error) {
    throw new Error(`Failed to scan repository with languages: ${error}`);
  }
}

export async function walkRepo(
  repoPath: string,
  options?: WalkOptions
): Promise<FileWalkerResult> {
  return fileSysWalkerService.walk(repoPath, options);
}

export async function detectLanguages(
  repoPath: string,
  files: string[],
  options?: LanguageDetectorOptions
): Promise<FileWithLanguage[]> {
  return languageDetectorService.detectAll(repoPath, files, options);
}

export async function scanRepoWithModules(
  repoUrl: string,
  branch = "main"
): Promise<RepoScanWithModulesResult> {
  try {
    return await repoScannerService.scanRepoWithModules(repoUrl, branch);
  } catch (error) {
    throw new Error(`Failed to scan repository with modules: ${error}`);
  }
}

export function detectModules(
  files: string[],
  options?: ModuleDetectorOptions
): FileWithModule[] {
  return moduleDetectorService.detectAll(files, options);
}

export async function scanRepoWithClassification(
  repoUrl: string,
  branch = "main"
): Promise<RepoScanWithClassificationResult> {
  try {
    return await repoScannerService.scanRepoWithClassification(repoUrl, branch);
  } catch (error) {
    throw new Error(`Failed to scan repository with classification: ${error}`);
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
