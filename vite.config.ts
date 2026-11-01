import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, resolve } from "node:path";
import process from "node:process";

const isPackageBuild = process.env.BUILD_MODE === "package";
const isPagesBuild = process.env.GITHUB_PAGES === "true";
const require = createRequire(import.meta.url);
const projWasmDist = dirname(require.resolve("proj-wasm"));
const customProjectionJson = resolve(__dirname, "data/crs/custom-projections.json");
const packageVersion = (JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string }).version;

export const PROJ_WASM_RUNTIME_ASSETS = [
  "proj.db",
  "proj.ini",
  "proj-worker.mjs",
  "fetch-worker.mjs",
  "proj-emscripten.js",
  "proj-emscripten.wasm",
];

const contentTypeForAsset = (asset: string) => {
  switch (extname(asset)) {
    case ".mjs":
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".db":
      return "application/octet-stream";
    case ".ini":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
};

const copyRuntimeAssets = () => ({
  name: "copy-runtime-assets",
  apply: "build" as const,
  async closeBundle() {
    const outputDir = isPackageBuild
      ? resolve(__dirname, "dist")
      : resolve(__dirname, "dist-demo/assets");
    await mkdir(outputDir, { recursive: true });
    await Promise.all(
      PROJ_WASM_RUNTIME_ASSETS.map((asset) =>
        copyFile(join(projWasmDist, asset), join(outputDir, asset)),
      ),
    );

    if (!isPackageBuild) {
      const customProjectionOutput = resolve(__dirname, "dist-demo/data/crs/custom-projections.json");
      await mkdir(dirname(customProjectionOutput), { recursive: true });
      await copyFile(customProjectionJson, customProjectionOutput);
    }
  },
});

const serveProjWasmDemoAssets = () => ({
  name: "serve-proj-wasm-demo-assets",
  async configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body: Buffer) => void }, next: () => void) => void) => void } }) {
    const assetBodies = new Map<string, Buffer>();
    await Promise.all(
      PROJ_WASM_RUNTIME_ASSETS.map(async (asset) => {
        assetBodies.set(asset, await readFile(join(projWasmDist, asset)));
      }),
    );

    server.middlewares.use((req, res, next) => {
      const requestPath = req.url?.split("?")[0] ?? "";
      const assetName = basename(requestPath);
      const body = assetBodies.get(assetName);
      if (!body) {
        next();
        return;
      }

      res.setHeader("Content-Type", contentTypeForAsset(assetName));
      res.end(body);
    });
  },
});

const PROJ_WASM_BROWSER_ID = `${join(projWasmDist, "proj.mjs")}?atlas-browser`;

const aliasProjWasmBrowserRuntime = () => ({
  name: "alias-proj-wasm-browser-runtime",
  enforce: "pre" as const,
  resolveId(source: string) {
    if (source === "proj-wasm") {
      return PROJ_WASM_BROWSER_ID;
    }
    return null;
  },
  async load(id: string) {
    if (id !== PROJ_WASM_BROWSER_ID) {
      return null;
    }

    let code = await readFile(join(projWasmDist, "proj.mjs"), "utf8");
    code = code.replace(
      'const baseUrl = new URL("./", import.meta.url).href;',
      'const baseUrl = globalThis.__ATLAS_PROJ_WASM_ASSET_BASE_URL__ ?? new URL("./", import.meta.url).href;',
    );
    code = code.replace(
      'const workerUrl = new URL("./proj-worker.mjs", import.meta.url);',
      'const workerUrl = new URL("proj-worker.mjs", globalThis.__ATLAS_PROJ_WASM_ASSET_BASE_URL__ ?? new URL("./", import.meta.url).href);',
    );
    return code;
  },
});

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
  define: isPackageBuild ? {} : { __ATLAS_VERSION__: JSON.stringify(packageVersion) },
  base: isPackageBuild ? undefined : isPagesBuild ? "/Atlas/" : "/",
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
    : {
      outDir: "dist-demo",
      copyPublicDir: false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
          crsCandidateLookup: resolve(__dirname, "demo/crs-candidate-lookup.html"),
          benchmark: resolve(__dirname, "demo/benchmark.html"),
        },
      },
    },
  plugins: isPackageBuild
    ? [
      copyRuntimeAssets(),
      removeTsExtensions(),
      dts({
        outDirs: "dist",
        exclude: ["tests", "node_modules"],
        bundleTypes: false,
        tsconfigPath: "./tsconfig.json",
        insertTypesEntry: true,
        staticImport: true,
        beforeWriteFile: (filePath, content) => ({
          filePath,
          content: content
            .replace(/from ['"](\.[^'"]+)\.ts['"]/g, 'from "$1"')
            .replace(/import\(["'](\.[^'"]+)\.ts["']\)/g, 'import("$1")'),
        }),
      }),
    ]
    : [aliasProjWasmBrowserRuntime(), copyRuntimeAssets(), serveProjWasmDemoAssets()],
  optimizeDeps: {
    exclude: ["proj-wasm"],
  },
  test: {
    environment: "node",
    // proj-wasm starts a worker pool per test file; running files at the same time makes the
    // engine tests compete for memory and hit their timeouts at random.
    fileParallelism: false,
  },
});
