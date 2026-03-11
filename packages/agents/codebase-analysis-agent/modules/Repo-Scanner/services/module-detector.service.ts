import path from "path";
import type { FileWithModule, ModuleDetectorOptions } from "../types/module-detector.types";

/** File names that indicate a package/module root (package managers) */
const PACKAGE_MANAGER_FILES = [
  "package.json",
  "pom.xml",
  "go.mod",
  "go.sum",
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "Cargo.toml",
  "Cargo.lock",
];

const DEFAULT_OPTIONS: Required<ModuleDetectorOptions> = {
  useFolderBoundaries: true,
  useConventions: true,
  usePackageManagers: true,
  boundaryRoots: ["src", "lib", "app"],
  conventionFolders: ["controllers", "services", "repositories"],
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function isPackageManagerFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (PACKAGE_MANAGER_FILES.includes(base)) return true;
  if (base.endsWith(".csproj") || base.endsWith(".sln")) return true;
  return false;
}

/** Derive package root directories from the list of file paths. */
function getPackageRootsFromFiles(files: string[]): string[] {
  const roots = new Set<string>();
  for (const file of files) {
    if (!isPackageManagerFile(file)) continue;
    const dir = path.dirname(file);
    roots.add(normalizePath(dir));
  }
  return Array.from(roots).sort((a, b) => b.length - a.length); // longest first for prefix match
}

/** Find the nearest (deepest) package root that contains the given file path. */
function findNearestPackageRoot(filePath: string, packageRoots: string[]): string | null {
  const normalized = normalizePath(filePath);
  const fileDir = path.dirname(normalized);
  for (const root of packageRoots) {
    if (root === "" && fileDir !== "") continue;
    if (root === "" || fileDir === root || fileDir.startsWith(root + "/")) {
      return root;
    }
  }
  return null;
}

export class ModuleDetectorService {
  /**
   * Detect logical module for a single file path using package roots, folder boundaries, and conventions.
   */
  detectModule(
    filePath: string,
    packageRoots: string[],
    options: ModuleDetectorOptions = {}
  ): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const normalized = normalizePath(filePath);

    if (opts.usePackageManagers && packageRoots.length > 0) {
      const root = findNearestPackageRoot(filePath, packageRoots);
      if (root !== null) {
        if (root === "") return "root";
        const segment = path.basename(root);
        return segment || "root";
      }
    }

    if (opts.useFolderBoundaries && opts.boundaryRoots?.length) {
      for (const root of opts.boundaryRoots) {
        const re = new RegExp(`^${root}/([^/]+)(?:/|$)`);
        const match = normalized.match(re);
        const segment = match?.[1];
        if (segment) return segment;
      }
    }

    if (opts.useConventions && opts.conventionFolders?.length) {
      for (const folder of opts.conventionFolders) {
        if (normalized.includes(`/${folder}/`) || normalized.startsWith(`${folder}/`)) {
          return folder;
        }
      }
    }

    return "root";
  }

  /**
   * Get all package/module root directories from a list of file paths.
   */
  getPackageRoots(files: string[]): string[] {
    return getPackageRootsFromFiles(files);
  }

  /**
   * Detect logical module for each file. Uses package manager files in the list to infer roots,
   * then applies folder boundaries and framework conventions.
   */
  detectAll(
    files: string[],
    options: ModuleDetectorOptions = {}
  ): FileWithModule[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const packageRoots = opts.usePackageManagers ? getPackageRootsFromFiles(files) : [];

    return files.map((file) => ({
      file,
      module: this.detectModule(file, packageRoots, opts),
    }));
  }
}
