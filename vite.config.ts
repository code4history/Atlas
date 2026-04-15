import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";
import process from "node:process";

const isPackageBuild = process.env.BUILD_MODE === "package";

const removeTsExtensions = () => ({
  name: "remove-ts-extensions",
  transform(code: string, id: string) {
    if (id.endsWith(".ts") || id.endsWith(".tsx")) {
      return code.replace(
        /from\s+['"](\.\.?\/[^'"]+)\.ts['"]/g,
        'from "$1"',
      );
    }
    return code;
  },
});

export const shouldExternalize = (id: string) => {
  if (id.startsWith("node:")) return true;
  if (id === "fs" || id === "path" || id === "process") return true;
  if (id === "proj-wasm") return true;
  return false;
};

export default defineConfig({
  build: isPackageBuild
    ? {
      outDir: "dist",
      copyPublicDir: false,
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        formats: ["es"],
        name: "atlas",
        fileName: () => "atlas.js",
      },
      rollupOptions: {
        external: shouldExternalize,
      },
    }
    : undefined,
  plugins: [
    removeTsExtensions(),
    dts({
      outDir: "dist",
      exclude: ["tests", "node_modules"],
      rollupTypes: false,
      tsconfigPath: "./tsconfig.json",
      logLevel: "silent",
      insertTypesEntry: true,
      staticImport: true,
      beforeWriteFile: (filePath, content) => ({
        filePath,
        content: content
          .replace(/from ['"](\.[^'"]+)\.ts['"]/g, 'from "$1"')
          .replace(/import\(["'](\.[^'"]+)\.ts["']\)/g, 'import("$1")'),
      }),
    }),
  ],
  test: {
    environment: "node",
  },
});
