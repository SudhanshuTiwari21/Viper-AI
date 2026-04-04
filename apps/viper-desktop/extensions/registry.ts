export interface RegistryEntry {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  repositoryUrl: string;
  packageUrl: string;
}

const BUILTIN_REGISTRY: RegistryEntry[] = [
  {
    id: "viper-python",
    name: "viper-python",
    displayName: "Python",
    version: "2024.3.1",
    description: "Rich Python language support including IntelliSense, linting, debugging, and Jupyter notebook integration",
    author: "Viper",
    downloads: 48200000,
    rating: 4.8,
    tags: ["python", "language", "linting", "debugging", "jupyter"],
    repositoryUrl: "https://github.com/viper-ai/viper-python",
    packageUrl: "https://registry.viper.dev/viper-python/2024.3.1.tar.gz",
  },
  {
    id: "viper-prettier",
    name: "viper-prettier",
    displayName: "Prettier – Code Formatter",
    version: "11.1.0",
    description: "Opinionated code formatter supporting JavaScript, TypeScript, CSS, HTML, JSON, and more",
    author: "Prettier",
    downloads: 39500000,
    rating: 4.6,
    tags: ["formatter", "prettier", "javascript", "typescript", "css"],
    repositoryUrl: "https://github.com/prettier/viper-prettier",
    packageUrl: "https://registry.viper.dev/viper-prettier/11.1.0.tar.gz",
  },
  {
    id: "viper-docker",
    name: "viper-docker",
    displayName: "Docker",
    version: "1.29.3",
    description: "Build, manage, and deploy containerized applications with Dockerfile and Compose support",
    author: "Microsoft",
    downloads: 22800000,
    rating: 4.5,
    tags: ["docker", "containers", "devops", "dockerfile", "compose"],
    repositoryUrl: "https://github.com/microsoft/viper-docker",
    packageUrl: "https://registry.viper.dev/viper-docker/1.29.3.tar.gz",
  },
  {
    id: "viper-tailwind",
    name: "viper-tailwind",
    displayName: "Tailwind CSS IntelliSense",
    version: "0.14.5",
    description: "Intelligent autocomplete, syntax highlighting, and linting for Tailwind CSS class names",
    author: "Tailwind Labs",
    downloads: 15300000,
    rating: 4.9,
    tags: ["tailwind", "css", "intellisense", "autocomplete", "styling"],
    repositoryUrl: "https://github.com/tailwindlabs/viper-tailwind",
    packageUrl: "https://registry.viper.dev/viper-tailwind/0.14.5.tar.gz",
  },
  {
    id: "viper-git-lens",
    name: "viper-git-lens",
    displayName: "GitLens — Git Supercharged",
    version: "16.1.0",
    description: "Visualize code authorship via inline blame, navigate git history, and explore repository insights",
    author: "GitKraken",
    downloads: 31200000,
    rating: 4.4,
    tags: ["git", "blame", "history", "diff", "annotations"],
    repositoryUrl: "https://github.com/gitkraken/viper-git-lens",
    packageUrl: "https://registry.viper.dev/viper-git-lens/16.1.0.tar.gz",
  },
  {
    id: "viper-todo-tree",
    name: "viper-todo-tree",
    displayName: "Todo Tree",
    version: "0.0.226",
    description: "Search workspace for TODO, FIXME, and custom tags then display them in a tree view",
    author: "Gruntfuggly",
    downloads: 8400000,
    rating: 4.7,
    tags: ["todo", "fixme", "annotations", "tree", "productivity"],
    repositoryUrl: "https://github.com/Gruntfuggly/viper-todo-tree",
    packageUrl: "https://registry.viper.dev/viper-todo-tree/0.0.226.tar.gz",
  },
  {
    id: "viper-bracket-pair",
    name: "viper-bracket-pair",
    displayName: "Bracket Pair Colorizer",
    version: "2.0.4",
    description: "Colorize matching brackets to make nested code blocks easier to identify at a glance",
    author: "CoenraadS",
    downloads: 12100000,
    rating: 4.3,
    tags: ["brackets", "colorizer", "readability", "editor", "pairs"],
    repositoryUrl: "https://github.com/CoenraadS/viper-bracket-pair",
    packageUrl: "https://registry.viper.dev/viper-bracket-pair/2.0.4.tar.gz",
  },
  {
    id: "viper-path-intellisense",
    name: "viper-path-intellisense",
    displayName: "Path Intellisense",
    version: "2.9.0",
    description: "Autocomplete file paths in import statements and string literals as you type",
    author: "Christian Kohler",
    downloads: 10600000,
    rating: 4.5,
    tags: ["path", "autocomplete", "imports", "intellisense", "files"],
    repositoryUrl: "https://github.com/ChristianKohler/viper-path-intellisense",
    packageUrl: "https://registry.viper.dev/viper-path-intellisense/2.9.0.tar.gz",
  },
  {
    id: "viper-import-cost",
    name: "viper-import-cost",
    displayName: "Import Cost",
    version: "3.3.0",
    description: "Display the size of imported packages inline in the editor to identify bundle bloat",
    author: "Wix",
    downloads: 6900000,
    rating: 4.2,
    tags: ["import", "size", "bundle", "performance", "javascript"],
    repositoryUrl: "https://github.com/wix/viper-import-cost",
    packageUrl: "https://registry.viper.dev/viper-import-cost/3.3.0.tar.gz",
  },
  {
    id: "viper-error-lens",
    name: "viper-error-lens",
    displayName: "Error Lens",
    version: "3.20.0",
    description: "Highlight and display diagnostics inline — errors, warnings, and info right next to your code",
    author: "Alexander",
    downloads: 9700000,
    rating: 4.8,
    tags: ["errors", "diagnostics", "inline", "linting", "warnings"],
    repositoryUrl: "https://github.com/usernamehw/viper-error-lens",
    packageUrl: "https://registry.viper.dev/viper-error-lens/3.20.0.tar.gz",
  },
];

export function searchRegistry(query: string): RegistryEntry[] {
  if (!query.trim()) return getPopularExtensions();

  const q = query.toLowerCase();
  const scored: { entry: RegistryEntry; score: number }[] = [];

  for (const entry of BUILTIN_REGISTRY) {
    let score = 0;
    const name = entry.name.toLowerCase();
    const display = entry.displayName.toLowerCase();
    const desc = entry.description.toLowerCase();

    if (name === q || display === q) {
      score += 100;
    } else if (name.includes(q) || display.includes(q)) {
      score += 60;
    } else if (desc.includes(q)) {
      score += 30;
    }

    for (const tag of entry.tags) {
      if (tag.toLowerCase().includes(q)) score += 20;
    }

    if (entry.author.toLowerCase().includes(q)) score += 15;

    if (score > 0) scored.push({ entry, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.entry);
}

export function getRegistryEntry(id: string): RegistryEntry | undefined {
  return BUILTIN_REGISTRY.find((e) => e.id === id);
}

export function getPopularExtensions(): RegistryEntry[] {
  return [...BUILTIN_REGISTRY].sort((a, b) => b.downloads - a.downloads);
}
