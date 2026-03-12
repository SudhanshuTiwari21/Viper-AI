export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

declare global {
  interface Window {
    viper: {
      workspace: {
        list: (root: string | null) => Promise<{ root: string | null; tree: FileNode[] }>;
        select: () => Promise<{ root: string; tree: FileNode[] } | null>;
        watch: (root: string | null) => Promise<void>;
      };
      fs: {
        readFile: (root: string, rel: string) => Promise<string>;
        writeFile: (root: string, rel: string, content: string) => Promise<void>;
        createFile: (root: string, rel: string) => Promise<void>;
        createFolder: (root: string, rel: string) => Promise<void>;
        deletePath: (root: string, rel: string) => Promise<void>;
        renamePath: (root: string, oldRel: string, newRel: string) => Promise<void>;
        onFileChanged: (cb: (payload: { path: string }) => void) => void;
      };
      terminal: {
        create: (root: string) => Promise<{ ok: boolean }>;
        write: (data: string) => Promise<void>;
        resize: (cols: number, rows: number) => Promise<void>;
        destroy: () => Promise<void>;
        onData: (cb: (data: string) => void) => void;
      };
      git: {
        branch: (root: string) => Promise<string>;
        log: (root: string, relPath: string) => Promise<string[]>;
      };
    };
  }
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
