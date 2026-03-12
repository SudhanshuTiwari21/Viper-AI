import path from "path";
import {
  fileSysWalkerService,
  languageDetectorService,
  moduleDetectorService,
  fileClassifierService,
  jobGeneratorService,
} from "../services";
import { resolveWorkspace } from "../services/workspace-resolver.service";
import { FileType, type FileWithType } from "../types/file-classification.types";
import type {
  RepoScanPipelineResult,
  ScannedFileEntry,
  ParseJob,
  RunRepoScannerInput,
  RunRepoScannerOptions,
} from "../types/repo-scanner.types";

/** Single data object passed through the pipeline. Each step only modifies state. */
interface PipelineState {
  workspacePath: string;
  repo_id: string;
  branch?: string;
  files: string[];
  filesWithLanguage: Array<{ file: string; language: string }>;
  filesWithModule: Array<{ file: string; module: string }>;
  classified: FileWithType[];
  sourceFiles: Array<{ file: string; language: string; module: string }>;
  filesList: ScannedFileEntry[];
  jobs: ParseJob[];
}

async function stepWalk(workspacePath: string): Promise<string[]> {
  const walked = await fileSysWalkerService.walk(workspacePath);
  return walked.files;
}

async function stepDetectLanguages(
  workspacePath: string,
  files: string[]
): Promise<Array<{ file: string; language: string }>> {
  return languageDetectorService.detectAll(workspacePath, files);
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
  repo_id: string,
  sourceFiles: Array<{ file: string; language: string; module: string }>
): ParseJob[] {
  return jobGeneratorService.generateJobs(repo_id, sourceFiles);
}

/**
 * Pipeline: resolveWorkspace → walkWorkspace → detectLanguages → detectModules → classify → filterSource → generateJobs.
 * No git operations; workspace must already exist (e.g. cloned by Git Tool).
 */
export async function runRepoScanner(
  input: RunRepoScannerInput,
  options: RunRepoScannerOptions = {}
): Promise<RepoScanPipelineResult> {
  const resolved = await resolveWorkspace(input);
  const state: PipelineState = {
    workspacePath: resolved.workspacePath,
    repo_id: resolved.repo_id,
    branch: resolved.branch,
    files: [],
    filesWithLanguage: [],
    filesWithModule: [],
    classified: [],
    sourceFiles: [],
    filesList: [],
    jobs: [],
  };

  state.files = await stepWalk(state.workspacePath);

  state.filesWithLanguage = await stepDetectLanguages(state.workspacePath, state.files);

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
      repo_id: state.repo_id,
      workspacePath: state.workspacePath,
      branch: state.branch,
    });
    await options.persistMetadata.insertRepositoryFiles(repoId, state.filesList);
  }

  state.jobs = stepGenerateJobs(state.repo_id, state.sourceFiles);

  return {
    workspacePath: state.workspacePath,
    repo_id: state.repo_id,
    branch: state.branch,
    files: state.filesList,
    sourceFiles: state.sourceFiles,
    jobs: state.jobs,
  };
}
