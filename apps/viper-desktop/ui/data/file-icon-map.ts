/**
 * Data-driven file icon mapping.
 * Add support for new file types by editing this file only:
 * - FILE_NAMES: exact filename (e.g. .gitignore, Dockerfile) → icon key
 * - FILE_EXTENSIONS: extension → icon key
 * - CATEGORY_EXTENSIONS: list of extensions per category (image, video, etc.) for broad support
 * - ICON_COLORS: icon key or extension → hex color
 */

/** Exact filename (lowercase) → icon key. Enables .gitignore, Dockerfile, Makefile, etc. */
export const FILE_NAMES: Record<string, string> = {
  ".gitignore": "git",
  ".gitattributes": "git",
  ".gitmodules": "git",
  ".gitconfig": "git",
  "dockerfile": "docker",
  "makefile": "file",
  "gemfile": "ruby",
  "rakefile": "ruby",
  "procfile": "file",
  "env": "file",
  ".env": "file",
  ".env.local": "file",
  ".env.development": "file",
  ".env.production": "file",
  ".env.test": "file",
  "jenkinsfile": "jenkins",
  "docker-compose.yml": "docker",
  "docker-compose.yaml": "docker",
};

/** Extension (lowercase) → icon key. Add any new extension here. */
export const FILE_EXTENSIONS: Record<string, string> = {
  ts: "typescript",
  tsx: "react",
  js: "javascript",
  jsx: "react",
  mjs: "javascript",
  cjs: "javascript",
  mts: "typescript",
  cts: "typescript",
  json: "json",
  jsonc: "json",
  json5: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  svg: "svg",
  jpg: "jpeg",
  jpeg: "jpeg",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  pyi: "python",
  pyw: "python",
  pyz: "python",
  go: "go",
  rs: "rust",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "cpp",
  h: "cpp",
  hpp: "cpp",
  html: "html",
  htm: "html",
  css: "css",
  scss: "sass",
  sass: "sass",
  less: "css",
  vue: "vue",
  pug: "pug",
  jade: "pug",
  php: "php",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  sc: "scala",
  gradle: "gradle",
  groovy: "gradle",
  cs: "dotnet",
  csx: "dotnet",
  fs: "fsharp",
  fsi: "fsharp",
  fsx: "fsharp",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hrl: "erlang",
  hs: "haskell",
  lhs: "haskell",
  clj: "clojure",
  cljs: "clojure",
  cljc: "clojure",
  lua: "lua",
  pl: "perl",
  pm: "perl",
  r: "r",
  zig: "zig",
  dart: "dart",
  swift: "swift",
  jl: "julia",
  nim: "nim",
  ml: "ocaml",
  mli: "ocaml",
  tf: "terraform",
  tfvars: "terraform",
  sol: "solidity",
  graphql: "graphql",
  gql: "graphql",
  prisma: "prisma",
  sh: "bash",
  bash: "bash",
  zsh: "zsh",
  fish: "shell",
  ps1: "shell",
  bat: "shell",
  cmd: "shell",
  sql: "postgresql",
  sqlite: "sqlite",
  db: "sqlite",
};

/** Category → list of extensions. Used when FILE_EXTENSIONS has no match. */
export const CATEGORY_EXTENSIONS: Record<string, string[]> = {
  image: [
    "png", "gif", "webp", "avif", "bmp", "ico", "tiff", "tif", "heic", "heif",
    "raw", "cr2", "nef", "arw", "dng", "webp", "apng",
  ],
  video: [
    "mp4", "webm", "mov", "avi", "mkv", "m4v", "ogv", "wmv", "flv", "3gp",
  ],
  audio: [
    "mp3", "wav", "ogg", "m4a", "flac", "aac", "wma", "opus", "weba",
  ],
  archive: [
    "zip", "tar", "gz", "7z", "rar", "bz2", "xz", "z", "tgz", "tbz", "lz",
  ],
  font: [
    "woff", "woff2", "ttf", "otf", "eot",
  ],
  document: [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
    "rtf", "pages", "numbers", "key",
  ],
};

/** Icon key or extension → hex color. */
export const ICON_COLORS: Record<string, string> = {
  git: "#F05032",
  typescript: "#3178C6",
  javascript: "#F7DF1E",
  react: "#61DAFB",
  python: "#3776AB",
  html: "#E34F26",
  css: "#1572B6",
  sass: "#CC6699",
  json: "#cbcb41",
  markdown: "#083fa1",
  go: "#00ADD8",
  rust: "#DEA584",
  docker: "#2496ED",
  kotlin: "#7F52FF",
  scala: "#DC322F",
  elixir: "#4B275F",
  haskell: "#5D4F85",
  clojure: "#5881D8",
  lua: "#000080",
  dart: "#0175C2",
  zig: "#F7A41D",
  terraform: "#7B42BC",
  solidity: "#363636",
  julia: "#9558B2",
  fsharp: "#378BBA",
  erlang: "#A90533",
  ocaml: "#EC6813",
  nim: "#FFC200",
  r: "#276DC3",
  php: "#777BB4",
  ruby: "#CC342D",
  swift: "#F05138",
  java: "#ED8B00",
  dotnet: "#512BD4",
  graphql: "#E10098",
  prisma: "#2D3748",
  pug: "#A86454",
  toml: "#9C4121",
  xml: "#E34F26",
  postgresql: "#336791",
  sqlite: "#003B57",
  svg: "#FFB13B",
  jpeg: "#0066CC",
  image: "#8696a0",
  video: "#8696a0",
  audio: "#8696a0",
  archive: "#8696a0",
  font: "#8696a0",
  document: "#8696a0",
};

const DEFAULT_ICON_KEY = "file";
const DEFAULT_COLOR = "#8696a0";

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Resolve icon key for a file: filename match → extension match → category → file. */
export function getFileIconKey(fileName: string): string {
  const ext = getExt(fileName);
  const nameLower = fileName.toLowerCase();
  const baseName = nameLower.split("/").pop() ?? nameLower;

  if (FILE_NAMES[baseName]) return FILE_NAMES[baseName];
  if (FILE_EXTENSIONS[ext]) return FILE_EXTENSIONS[ext];

  for (const [category, exts] of Object.entries(CATEGORY_EXTENSIONS)) {
    if (exts.includes(ext)) return category;
  }

  return DEFAULT_ICON_KEY;
}

/** Resolve color for an icon key or extension. */
export function getFileIconColor(iconKey: string, ext?: string): string {
  if (ext && ICON_COLORS[ext]) return ICON_COLORS[ext];
  return ICON_COLORS[iconKey] ?? DEFAULT_COLOR;
}
