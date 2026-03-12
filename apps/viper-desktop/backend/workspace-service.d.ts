export declare const WORKSPACES_ROOT: string;
export interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileNode[];
}
export declare function setupWorkspaceService(): void;
