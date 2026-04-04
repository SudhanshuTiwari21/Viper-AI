export { readWorkspaceFile } from "./tools/read-file.tool.js";
// G.40: privacy boundary — exported so backend and other packages can reuse
export {
  isPrivacyAllowed,
  isPrivacyAllowedSync,
  checkPrivacy,
  matchesGlob,
  clearPrivacyCache,
  PrivacyDeniedError,
  BUILTIN_DENY_GLOBS,
} from "./privacy.js";
export type { PrivacyConfig, PrivacyCheckResult } from "./privacy.js";
export { listWorkspaceDirectory } from "./tools/list-directory.tool.js";
export { searchWorkspaceText } from "./tools/search-text.tool.js";
export { searchWorkspaceFiles } from "./tools/search-files.tool.js";
export { editWorkspaceFile } from "./tools/edit-file.tool.js";
export { createWorkspaceFile } from "./tools/create-file.tool.js";
export { runWorkspaceCommand } from "./tools/run-command.tool.js";
export type { RunCommandCallbacks } from "./tools/run-command.tool.js";

export type {
  ReadFileResult,
  DirectoryEntry,
  ListDirectoryResult,
  ListDirectoryOptions,
  TextMatch,
  SearchTextResult,
  SearchTextOptions,
  SearchFilesResult,
  EditFileResult,
  CreateFileResult,
  RunCommandResult,
} from "./workspace-tools.types.js";
