export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export async function listWorkspace(root: string | null) {
  return window.viper.workspace.list(root);
}

export async function selectWorkspace() {
  return window.viper.workspace.select();
}

export async function watchWorkspace(root: string | null) {
  return window.viper.workspace.watch(root);
}

export const fsApi = {
  readFile: (root: string, rel: string) => window.viper.fs.readFile(root, rel),
  writeFile: (root: string, rel: string, content: string) =>
    window.viper.fs.writeFile(root, rel, content),
  createFile: (root: string, rel: string) => window.viper.fs.createFile(root, rel),
  createFolder: (root: string, rel: string) => window.viper.fs.createFolder(root, rel),
  deletePath: (root: string, rel: string) => window.viper.fs.deletePath(root, rel),
  renamePath: (root: string, oldRel: string, newRel: string) =>
    window.viper.fs.renamePath(root, oldRel, newRel),
  onFileChanged: (cb: (payload: { path: string }) => void) =>
    window.viper.fs.onFileChanged(cb),
};

export const shellApi = {
  revealInFolder: (workspaceRoot: string, relPath: string) =>
    window.viper.shell.revealInFolder(workspaceRoot, relPath),
};

export const diagnosticsApi = {
  start: (root: string | null) => window.viper.diagnostics.start(root),
  runForFile: (root: string, relPath: string) =>
    window.viper.diagnostics.runForFile(root, relPath),
  restart: () => window.viper.diagnostics.restart(),
  onUpdate: (cb: (payload: Array<[string, unknown[]]>) => void) => window.viper.diagnostics.onUpdate(cb),
};
