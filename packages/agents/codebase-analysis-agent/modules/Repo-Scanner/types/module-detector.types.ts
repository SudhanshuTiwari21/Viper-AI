/** Result of module detection for a single file (for File Classification / Job Generator) */
export interface FileWithModule {
  file: string;
  /** Logical module name (e.g. "auth", "payments", "controllers", "services") */
  module: string;
}

export interface ModuleDetectorOptions {
  /** Use folder boundaries (src/X, lib/X, app/X) to infer modules. Default true. */
  useFolderBoundaries?: boolean;
  /** Use framework conventions (controllers/, services/, repositories/). Default true. */
  useConventions?: boolean;
  /** Use package manager files (package.json, pom.xml, go.mod, etc.) to infer package roots. Default true. */
  usePackageManagers?: boolean;
  /** Folder names treated as module roots for boundary detection. Default ["src", "lib", "app"]. */
  boundaryRoots?: string[];
  /** Convention folder names that define a module. Default ["controllers", "services", "repositories"]. */
  conventionFolders?: string[];
}
