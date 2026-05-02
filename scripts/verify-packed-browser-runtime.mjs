import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "vite";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projWasmDist = dirname(require.resolve("proj-wasm"));
const runtimeAssets = [
  "proj.db",
  "proj.ini",
  "proj-worker.mjs",
  "fetch-worker.mjs",
  "proj-emscripten.js",
  "proj-emscripten.wasm",
];
const projWasmBrowserId = `${join(projWasmDist, "proj.mjs")}?atlas-packed-browser`;

function aliasProjWasmBrowserRuntime() {
  return {
    name: "alias-proj-wasm-browser-runtime",
    enforce: "pre",
    resolveId(source) {
      if (source === "proj-wasm") {
        return projWasmBrowserId;
      }
      return null;
    },
    async load(id) {
      if (id !== projWasmBrowserId) {
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
  };
}

async function assertFile(path) {
  const info = await stat(path);
  if (!info.isFile()) {
    throw new Error(`${path} is not a file`);
  }
  return info;
}

async function main() {
  const tempRoot = join(repoRoot, ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const workDir = await mkdtemp(join(tempRoot, "atlas-packed-browser-"));
  const npmCacheDir = join(workDir, ".npm-cache");
  await mkdir(npmCacheDir, { recursive: true });
  const { stdout } = await execFileAsync("npm", ["pack", "--json"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
  const packResult = JSON.parse(stdout);
  const tarball = join(repoRoot, packResult[0].filename);

  try {
    const unpackDir = join(workDir, "unpacked");
    const consumerDir = join(workDir, "consumer");
    const consumerDistDir = join(consumerDir, "dist");
    const consumerDistAssetsDir = join(consumerDistDir, "assets");
    await mkdir(unpackDir, { recursive: true });
    await execFileAsync("tar", ["-xzf", tarball, "-C", unpackDir]);

    const packageDir = join(unpackDir, "package");
    const packageJson = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
    if (packageJson.exports?.["."].import !== "./dist/atlas.js") {
      throw new Error("packed package export does not point to dist/atlas.js");
    }

    for (const path of [
      "dist/atlas.js",
      "dist/proj.db",
      "dist/proj.ini",
      "dist/proj-worker.mjs",
      "dist/fetch-worker.mjs",
      "dist/proj-emscripten.js",
      "dist/proj-emscripten.wasm",
      "data/crs/custom-projections.json",
    ]) {
      await assertFile(join(packageDir, path));
    }

    const projDb = await assertFile(join(packageDir, "dist/proj.db"));
    if (projDb.size < 1_000_000) {
      throw new Error(`packed dist/proj.db is unexpectedly small (${projDb.size} bytes)`);
    }

    await mkdir(join(consumerDir, "node_modules", "@c4h"), { recursive: true });
    await symlink(packageDir, join(consumerDir, "node_modules", "@c4h", "atlas"), "dir");

    await writeFile(
      join(consumerDir, "index.html"),
      `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Atlas packed browser verification</title></head>
  <body><div id="app"></div><script type="module" src="./main.js"></script></body>
</html>
`,
    );
    await writeFile(
      join(consumerDir, "main.js"),
      `import { initializeProjWasmRuntime, listProjectedCrsFromProjWasm } from "@c4h/atlas";
globalThis.__ATLAS_PROJ_WASM_ASSET_BASE_URL__ = new URL("./assets/", import.meta.url).href;
void initializeProjWasmRuntime({
  projWasmAssetBaseUrl: new URL("./assets/", import.meta.url),
});
document.querySelector("#app").textContent = typeof listProjectedCrsFromProjWasm;
`,
    );

    await build({
      configFile: false,
      logLevel: "error",
      root: consumerDir,
      publicDir: false,
      plugins: [
        aliasProjWasmBrowserRuntime(),
        {
          name: "copy-packed-atlas-runtime-assets",
          apply: "build",
          async closeBundle() {
            await mkdir(consumerDistAssetsDir, { recursive: true });
            await Promise.all(
              runtimeAssets.map((asset) =>
                copyFile(join(packageDir, "dist", asset), join(consumerDistAssetsDir, asset)),
              ),
            );
          },
        },
      ],
      build: {
        outDir: "dist",
        emptyOutDir: true,
      },
    });

    for (const asset of runtimeAssets) {
      await assertFile(join(consumerDistAssetsDir, asset));
    }

    const builtHtml = await readFile(join(consumerDistDir, "index.html"), "utf8");
    if (!builtHtml.includes("/assets/")) {
      throw new Error("packed browser consumer build did not emit bundled asset URLs");
    }

    const builtFiles = await Promise.all(
      (await readdir(consumerDistAssetsDir)).map(async (entry) => {
        const path = join(consumerDistAssetsDir, entry);
        return extname(path).match(/\.(?:js|mjs|css|html)$/) ? readFile(path, "utf8") : null;
      }),
    );
    for (const text of builtFiles.filter(Boolean)) {
      if (/["'`](?:\/assets\/)/.test(text)) {
        throw new Error("packed browser consumer emitted an origin-rooted /assets/ URL");
      }
    }

    console.log("packed browser runtime verified.");
  } finally {
    await rm(workDir, { recursive: true, force: true });
    await rm(tarball, { force: true });
  }
}

await main();
