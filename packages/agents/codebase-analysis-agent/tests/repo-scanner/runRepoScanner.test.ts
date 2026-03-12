import { describe, it, expect, vi, beforeEach } from "vitest";
import { runRepoScanner } from "../../modules/repo-scanner/pipeline/scan-repo.pipeline";
import { FileType } from "../../modules/repo-scanner/types/file-classification.types";
import type { ScannedFileEntry, ParseJob } from "../../modules/repo-scanner/types/repo-scanner.types";
import { WorkspaceNotFoundError } from "../../modules/repo-scanner/types/workspace.types";

const MOCK_REPO_ID = "backend-service";
const MOCK_BRANCH = "main";
const MOCK_WORKSPACE_PATH = "/tmp/repos/backend-service";

const mockResolveWorkspace = vi.fn();
const mockWalk = vi.fn();
const mockDetectAllLanguages = vi.fn();
const mockDetectAllModules = vi.fn();
const mockClassifyAll = vi.fn();
const mockFilterByType = vi.fn();
const mockGenerateJobs = vi.fn();

vi.mock("../../modules/repo-scanner/services", () => ({
  fileSysWalkerService: {
    walk: (...args: unknown[]) => mockWalk(...args),
  },
  languageDetectorService: {
    detectAll: (...args: unknown[]) => mockDetectAllLanguages(...args),
  },
  moduleDetectorService: {
    detectAll: (...args: unknown[]) => mockDetectAllModules(...args),
  },
  fileClassifierService: {
    classifyAll: (...args: unknown[]) => mockClassifyAll(...args),
    filterByType: (...args: unknown[]) => mockFilterByType(...args),
  },
  jobGeneratorService: {
    generateJobs: (...args: unknown[]) => mockGenerateJobs(...args),
  },
}));

vi.mock("../../modules/repo-scanner/services/workspace-resolver.service", () => ({
  resolveWorkspace: (...args: unknown[]) => mockResolveWorkspace(...args),
}));

function makeFilesWithLanguage(files: string[], lang = "TypeScript") {
  return files.map((file) => ({ file, language: lang }));
}
function makeFilesWithModule(files: string[], module = "root") {
  return files.map((file) => ({ file, module }));
}
function makeClassified(files: string[], type: FileType) {
  return files.map((file) => ({ file, type }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveWorkspace.mockResolvedValue({
    workspacePath: MOCK_WORKSPACE_PATH,
    repo_id: MOCK_REPO_ID,
    branch: MOCK_BRANCH,
  });
  mockWalk.mockResolvedValue({
    files: ["src/auth/login.ts", "src/auth/session.ts", "README.md"],
    directories: [],
  });
  mockDetectAllLanguages.mockImplementation((_workspacePath: string, files: string[]) =>
    Promise.resolve(makeFilesWithLanguage(files))
  );
  mockDetectAllModules.mockImplementation((files: string[]) => makeFilesWithModule(files));
  mockClassifyAll.mockImplementation((files: string[]) => {
    const result = files.map((file) => ({
      file,
      type: file.endsWith(".md") ? FileType.DOCUMENTATION : FileType.SOURCE,
    }));
    return result;
  });
  mockFilterByType.mockImplementation(
    (classified: Array<{ file: string; type: FileType }>, type: FileType) =>
      classified.filter((c) => c.type === type)
  );
  mockGenerateJobs.mockImplementation(
    (_repoId: string, sourceFiles: Array<{ file: string; language: string; module: string }>) =>
      sourceFiles.map((f) => ({
        repo: MOCK_REPO_ID,
        file: f.file,
        language: f.language.toLowerCase(),
        module: f.module,
      }))
  );
});

describe("runRepoScanner", () => {
  it("1. pipeline executes all stages and returns correct output structure", async () => {
    const result = await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
      branch: MOCK_BRANCH,
    });

    expect(result).toMatchObject({
      workspacePath: MOCK_WORKSPACE_PATH,
      repo_id: MOCK_REPO_ID,
      branch: MOCK_BRANCH,
    });
    expect(Array.isArray(result.files)).toBe(true);
    expect(Array.isArray(result.sourceFiles)).toBe(true);
    expect(Array.isArray(result.jobs)).toBe(true);
    expect(result.files.length).toBe(3);
    expect(result.sourceFiles.length).toBe(2);
    expect(result.jobs.length).toBe(2);

    expect(mockResolveWorkspace).toHaveBeenCalledWith({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
      branch: MOCK_BRANCH,
    });
    expect(mockWalk).toHaveBeenCalledWith(MOCK_WORKSPACE_PATH);
    expect(mockDetectAllLanguages).toHaveBeenCalledWith(MOCK_WORKSPACE_PATH, expect.any(Array));
    expect(mockDetectAllModules).toHaveBeenCalledWith(expect.any(Array));
    expect(mockClassifyAll).toHaveBeenCalledWith(expect.any(Array));
    expect(mockFilterByType).toHaveBeenCalled();
    expect(mockGenerateJobs).toHaveBeenCalledWith(MOCK_REPO_ID, expect.any(Array));
  });

  it("2. file metadata (language, module, type) is aggregated correctly into filesList", async () => {
    const files = ["src/a.ts", "src/b.py", "docs/readme.md"];
    mockWalk.mockResolvedValue({ files, directories: [] });
    mockDetectAllLanguages.mockResolvedValue([
      { file: "src/a.ts", language: "TypeScript" },
      { file: "src/b.py", language: "Python" },
      { file: "docs/readme.md", language: "Markdown" },
    ]);
    mockDetectAllModules.mockReturnValue([
      { file: "src/a.ts", module: "a" },
      { file: "src/b.py", module: "b" },
      { file: "docs/readme.md", module: "root" },
    ]);
    mockClassifyAll.mockReturnValue([
      { file: "src/a.ts", type: FileType.SOURCE },
      { file: "src/b.py", type: FileType.SOURCE },
      { file: "docs/readme.md", type: FileType.DOCUMENTATION },
    ]);
    mockFilterByType.mockImplementation(
      (classified: Array<{ file: string; type: FileType }>, type: FileType) =>
        classified.filter((c) => c.type === type)
    );

    const result = await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
    });

    expect(result.files).toHaveLength(3);
    const filesList = result.files as ScannedFileEntry[];
    expect(filesList.find((f) => f.file === "src/a.ts")).toMatchObject({
      file: "src/a.ts",
      language: "TypeScript",
      module: "a",
      type: FileType.SOURCE,
    });
    expect(filesList.find((f) => f.file === "docs/readme.md")).toMatchObject({
      file: "docs/readme.md",
      language: "Markdown",
      module: "root",
      type: FileType.DOCUMENTATION,
    });
  });

  it("3. only source files generate jobs (non-source filtered out)", async () => {
    const files = ["src/login.ts", "tests/login.test.ts", "README.md"];
    mockWalk.mockResolvedValue({ files, directories: [] });
    mockClassifyAll.mockReturnValue([
      { file: "src/login.ts", type: FileType.SOURCE },
      { file: "tests/login.test.ts", type: FileType.TEST },
      { file: "README.md", type: FileType.DOCUMENTATION },
    ]);
    mockFilterByType.mockImplementation(
      (classified: Array<{ file: string; type: FileType }>, type: FileType) =>
        classified.filter((c) => c.type === type)
    );
    mockGenerateJobs.mockImplementation(
      (_: string, sourceFiles: Array<{ file: string; language: string; module: string }>) =>
        sourceFiles.map((f) => ({
          repo: MOCK_REPO_ID,
          file: f.file,
          language: "typescript",
          module: "root",
        }))
    );

    const result = await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
    });

    expect(result.files.length).toBe(3);
    expect(result.sourceFiles.length).toBe(1);
    expect(result.sourceFiles[0]).toBeDefined();
    expect(result.sourceFiles[0]!.file).toBe("src/login.ts");
    expect(result.jobs.length).toBe(1);
    expect((result.jobs as ParseJob[])[0]).toBeDefined();
    expect((result.jobs as ParseJob[])[0]!.file).toBe("src/login.ts");
  });

  it("4. metadata persistence runs when persistMetadata is provided", async () => {
    const saveRepository = vi.fn().mockResolvedValue("repo-uuid-123");
    const insertRepositoryFiles = vi.fn().mockResolvedValue(undefined);

    const result = await runRepoScanner(
      { repo_id: MOCK_REPO_ID, workspacePath: MOCK_WORKSPACE_PATH, branch: MOCK_BRANCH },
      { persistMetadata: { saveRepository, insertRepositoryFiles } }
    );

    expect(saveRepository).toHaveBeenCalledTimes(1);
    expect(saveRepository).toHaveBeenCalledWith({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
      branch: MOCK_BRANCH,
    });
    expect(insertRepositoryFiles).toHaveBeenCalledTimes(1);
    expect(insertRepositoryFiles).toHaveBeenCalledWith("repo-uuid-123", expect.any(Array));
    const insertedFiles = (insertRepositoryFiles.mock.calls[0] as unknown[])[1] as ScannedFileEntry[];
    expect(insertedFiles).toHaveLength(result.files.length);
  });

  it("5. metadata persistence is skipped when persistMetadata is not provided", async () => {
    const saveRepository = vi.fn();
    const insertRepositoryFiles = vi.fn();

    await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
    });

    expect(saveRepository).not.toHaveBeenCalled();
    expect(insertRepositoryFiles).not.toHaveBeenCalled();
  });

  it("6. job generation receives correct sourceFiles input", async () => {
    mockWalk.mockResolvedValue({ files: ["src/a.ts", "src/b.ts"], directories: [] });
    mockClassifyAll.mockReturnValue([
      { file: "src/a.ts", type: FileType.SOURCE },
      { file: "src/b.ts", type: FileType.SOURCE },
    ]);
    mockFilterByType.mockImplementation(
      (classified: Array<{ file: string; type: FileType }>, type: FileType) =>
        classified.filter((c) => c.type === type)
    );
    mockGenerateJobs.mockClear();

    await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
    });

    expect(mockGenerateJobs).toHaveBeenCalledWith(
      MOCK_REPO_ID,
      expect.arrayContaining([
        expect.objectContaining({ file: "src/a.ts", language: "TypeScript", module: "root" }),
        expect.objectContaining({ file: "src/b.ts", language: "TypeScript", module: "root" }),
      ])
    );
  });

  it("7. pipeline handles empty repository (walker returns no files)", async () => {
    mockWalk.mockResolvedValue({ files: [], directories: [] });
    mockDetectAllLanguages.mockResolvedValue([]);
    mockDetectAllModules.mockReturnValue([]);
    mockClassifyAll.mockReturnValue([]);
    mockFilterByType.mockReturnValue([]);
    mockGenerateJobs.mockReturnValue([]);

    const result = await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
    });

    expect(result.files).toEqual([]);
    expect(result.sourceFiles).toEqual([]);
    expect(result.jobs).toEqual([]);
    expect(result.workspacePath).toBe(MOCK_WORKSPACE_PATH);
    expect(result.repo_id).toBe(MOCK_REPO_ID);
    expect(result.branch).toBe(MOCK_BRANCH);
    expect(mockGenerateJobs).toHaveBeenCalledWith(MOCK_REPO_ID, []);
  });

  it("8. pipeline handles unknown languages gracefully", async () => {
    mockWalk.mockResolvedValue({ files: ["src/unknown.xyz"], directories: [] });
    mockDetectAllLanguages.mockResolvedValue([
      { file: "src/unknown.xyz", language: "Unknown" },
    ]);
    mockDetectAllModules.mockReturnValue([{ file: "src/unknown.xyz", module: "root" }]);
    mockClassifyAll.mockReturnValue([{ file: "src/unknown.xyz", type: FileType.OTHER }]);
    mockFilterByType.mockReturnValue([]);
    mockGenerateJobs.mockReturnValue([]);

    const result = await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      file: "src/unknown.xyz",
      language: "Unknown",
      module: "root",
    });
    expect(result.sourceFiles).toHaveLength(0);
    expect(result.jobs).toHaveLength(0);
  });

  it("9. pipeline returns deterministic output structure (shape)", async () => {
    const result = await runRepoScanner({
      repo_id: MOCK_REPO_ID,
      workspacePath: MOCK_WORKSPACE_PATH,
    });

    expect(result).toHaveProperty("workspacePath");
    expect(result).toHaveProperty("repo_id");
    expect(result).toHaveProperty("branch");
    expect(result).toHaveProperty("files");
    expect(result).toHaveProperty("sourceFiles");
    expect(result).toHaveProperty("jobs");
    expect(Object.keys(result).sort()).toEqual([
      "branch",
      "files",
      "jobs",
      "repo_id",
      "sourceFiles",
      "workspacePath",
    ]);

    for (const entry of result.files) {
      expect(entry).toHaveProperty("file");
      expect(entry).toHaveProperty("language");
      expect(entry).toHaveProperty("module");
      expect(entry).toHaveProperty("type");
    }
    for (const entry of result.sourceFiles) {
      expect(entry).toHaveProperty("file");
      expect(entry).toHaveProperty("language");
      expect(entry).toHaveProperty("module");
    }
    for (const job of result.jobs) {
      expect(job).toHaveProperty("repo");
      expect(job).toHaveProperty("file");
      expect(job).toHaveProperty("language");
      expect(job).toHaveProperty("module");
    }
  });

  it("10. throws WorkspaceNotFoundError when workspace path does not exist", async () => {
    mockResolveWorkspace.mockRejectedValue(
      new WorkspaceNotFoundError("/nonexistent/workspace")
    );

    await expect(
      runRepoScanner({ repo_id: MOCK_REPO_ID, workspacePath: "/nonexistent/workspace" })
    ).rejects.toThrow(WorkspaceNotFoundError);

    expect(mockWalk).not.toHaveBeenCalled();
  });
});
