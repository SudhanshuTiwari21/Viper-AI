import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: false,            // <— disable DTS build to avoid TS2792 errors
  sourcemap: true,
  clean: true,
  target: "node22",
  outDir: "dist",
  external: [
    "tree-sitter",
    "tree-sitter-c-sharp",
    "tree-sitter-cpp",
    "tree-sitter-go",
    "tree-sitter-java",
    "tree-sitter-javascript",
    "tree-sitter-python",
    "tree-sitter-rust",
    "tree-sitter-typescript"
  ]
});