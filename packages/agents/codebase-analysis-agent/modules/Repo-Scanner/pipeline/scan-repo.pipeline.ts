import path from "path";
import {
  repoScannerService,
  fileSysWalkerService,
  languageDetectorService,
  moduleDetectorService,
  fileClassifierService,
  jobGeneratorService,
} from "../services";
import { FileType, type FileWithType } from "../types/file-classification.types";
import type {
  RepoScanPipelineResult,
  ScannedFileEntry,
  ParseJob,
  RunRepoScannerOptions,
} from "../types/repo-scanner.types";

/** Single data object passed through the pipeline. Each step only modifies state. */
interface PipelineState {
  repoUrl: string;
  repoPath: string;
  branch: string;
  files: string[];
  filesWithLanguage: Array<{ file: string; language: string }>;
  filesWithModule: Array<{ file: string; module: string }>;
  classified: FileWithType[];
  sourceFiles: Array<{ file: string; language: string; module: string }>;
  filesList: ScannedFileEntry[];
  jobs: ParseJob[];
}

async function stepFetch(repoUrl: string, branch: string): Promise<PipelineState> {
  const fetched = await repoScannerService.fetchRepo(repoUrl, branch);
  return {
    repoUrl,
    repoPath: fetched.repoPath,
    branch: fetched.branch,
    files: [],
    filesWithLanguage: [],
    filesWithModule: [],
    classified: [],
    sourceFiles: [],
    filesList: [],
    jobs: [],
  };
}

async function stepWalk(repoPath: string): Promise<string[]> {
  const walked = await fileSysWalkerService.walk(repoPath);
  return walked.files;
}

async function stepDetectLanguages(
  repoPath: string,
  files: string[]
): Promise<Array<{ file: string; language: string }>> {
  return languageDetectorService.detectAll(repoPath, files);
}

function stepDetectModules(files: string[]): Array<{ file: string; module: string }> {
  return moduleDetectorService.detectAll(files);
}

function stepClassify(files: string[]): FileWithType[] {
  return fileClassifierService.classifyAll(files);
}

/** Use maps keyed by file path so we don't rely on array order or index alignment. */
function stepFilterSource(
  files: string[],
  filesWithLanguage: Array<{ file: string; language: string }>,
  filesWithModule: Array<{ file: string; module: string }>,
  classified: FileWithType[]
): { sourceFiles: Array<{ file: string; language: string; module: string }>; filesList: ScannedFileEntry[] } {
  const languageMap = new Map(filesWithLanguage.map((f) => [f.file, f.language]));
  const moduleMap = new Map(filesWithModule.map((f) => [f.file, f.module]));
  const typeMap = new Map(classified.map((f) => [f.file, f.type]));

  const sourceOnly = fileClassifierService.filterByType(classified, FileType.SOURCE);
  const sourceFiles = sourceOnly.map(({ file }) => ({
    file,
    language: languageMap.get(file) ?? "Unknown",
    module: moduleMap.get(file) ?? "root",
  }));

  const filesList: ScannedFileEntry[] = files.map((file) => ({
    file,
    language: languageMap.get(file) ?? "Unknown",
    module: moduleMap.get(file) ?? "root",
    type: typeMap.get(file) ?? FileType.OTHER,
  }));

  return { sourceFiles, filesList };
}

function stepGenerateJobs(
  repoPath: string,
  sourceFiles: Array<{ file: string; language: string; module: string }>
): ParseJob[] {
  const repoName = path.basename(repoPath);
  return jobGeneratorService.generateJobs(repoName, sourceFiles);
}

/**
 * Pipeline: fetch → walk → detectLanguages → detectModules → classify → filterSource → generateJobs.
 * Each step only modifies pipeline state. Returns jobs; orchestrator pushes to Redis if needed.
 */
export async function runRepoScanner(
  repoUrl: string,
  branch = "main",
  options: RunRepoScannerOptions = {}
): Promise<RepoScanPipelineResult> {
  const state = await stepFetch(repoUrl, branch);

  state.files = await stepWalk(state.repoPath);

  state.filesWithLanguage = await stepDetectLanguages(state.repoPath, state.files);

  state.filesWithModule = stepDetectModules(state.files);

  state.classified = stepClassify(state.files);

  const filterResult = stepFilterSource(
    state.files,
    state.filesWithLanguage,
    state.filesWithModule,
    state.classified
  );
  state.sourceFiles = filterResult.sourceFiles;
  state.filesList = filterResult.filesList;

  if (options?.persistMetadata) {
    const repoId = await options.persistMetadata.saveRepository({
      repoUrl: state.repoUrl,
      repoPath: state.repoPath,
      branch: state.branch,
    });
    await options.persistMetadata.insertRepositoryFiles(repoId, state.filesList);
  }

  state.jobs = stepGenerateJobs(state.repoPath, state.sourceFiles);

  return {
    repoPath: state.repoPath,
    branch: state.branch,
    files: state.filesList,
    sourceFiles: state.sourceFiles,
    jobs: state.jobs,
  };
}