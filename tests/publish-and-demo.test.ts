import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("publish and demo packaging", () => {
  it("exposes public npm metadata and publish scripts", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      private?: boolean;
      publishConfig?: { access?: string };
      scripts?: Record<string, string>;
      repository?: { type?: string; url?: string };
      files?: string[];
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.private).toBe(false);
    expect(packageJson.publishConfig?.access).toBe("public");
    expect(packageJson.scripts?.dev).toContain("build:package-runtime");
    expect(packageJson.scripts?.["build:demo"]).toBeDefined();
    expect(packageJson.scripts?.["verify:demo"]).toContain("verify-demo-pages-build.mjs");
    expect(packageJson.scripts?.["verify:packed-browser"]).toContain("verify-packed-browser-runtime.mjs");
    expect(packageJson.scripts?.prepublishOnly).toContain("pnpm run test");
    expect(packageJson.scripts?.prepublishOnly).toContain("pnpm run verify:demo");
    expect(packageJson.scripts?.prepublishOnly).toContain("pnpm run verify:packed-browser");
    expect(packageJson.repository?.type).toBe("git");
    expect(packageJson.repository?.url).toMatch(/github\.com/);
    expect(packageJson.files).toContain("README.ja.md");
    expect(packageJson.dependencies?.["proj-wasm"]).toBeDefined();
    expect(packageJson.devDependencies?.proj4).toBeUndefined();
    expect(packageJson.devDependencies?.["coi-serviceworker"]).toBeUndefined();
  });

  it("ships bilingual README files with cross-links", async () => {
    await access(new URL("../README.md", import.meta.url));
    await access(new URL("../README.ja.md", import.meta.url));

    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    const readmeJa = await readFile(new URL("../README.ja.md", import.meta.url), "utf8");

    expect(readme).toContain("README.ja.md");
    expect(readmeJa).toContain("README.md");
  });

  it("includes GitHub Actions for CI and Pages deployment", async () => {
    await access(new URL("../.github/workflows/test.yml", import.meta.url));
    await access(new URL("../.github/workflows/deploy.yml", import.meta.url));
  });

  it("keeps demo shell independent from lookup runtime at module load", async () => {
    const mainJs = await readFile(new URL("../demo/main.js", import.meta.url), "utf8");
    expect(mainJs).not.toMatch(/^import\s+\{\s*listProjectedCrsForDemo\s*\}/m);
    expect(mainJs).toContain('import("@c4h/atlas")');
    expect(mainJs).toContain("listProjectedCrsFromProjWasm");
    expect(mainJs).toContain("initializeProjWasmRuntime");
    expect(mainJs).toContain("runtimeReady");
    expect(mainJs).toContain("projWasmAssetBaseUrl");
    expect(mainJs).toContain('new URL("assets/", pageRoot)');
  });

  it("uses the C4H demo boilerplate shell", async () => {
    const portal = await readFile(new URL("../index.html", import.meta.url), "utf8");
    const crsSubpage = await readFile(new URL("../demo/crs-candidate-lookup.html", import.meta.url), "utf8");

    expect(portal).toContain('class="c4h-portal"');
    expect(portal).toContain('class="c4h-demo-card"');
    expect(portal).toContain('href="./demo/crs-candidate-lookup.html"');
    expect(portal).not.toContain("benchmark.html");

    expect(crsSubpage).toContain('class="c4h-app"');
    expect(crsSubpage).toContain('class="c4h-back-link"');
    expect(crsSubpage).toContain('href="../index.html"');
    expect(crsSubpage).toContain('href="./demo-shell.css"');
    expect(crsSubpage).toContain('href="./style.css"');
    expect(crsSubpage).toContain('src="./main.js"');
    expect(crsSubpage).toContain('option value="japan" selected');
    expect(crsSubpage).toContain('id="map-board"');
    expect(crsSubpage).toContain('id="tile-layer"');
    expect(crsSubpage).toContain('id="map-canvas"');
    expect(crsSubpage).toContain('id="deprecated-enabled"');
    expect(crsSubpage).toContain('id="onshore-only"');
    expect(crsSubpage).toContain('id="custom-enabled"');
  });

  it("keeps demo build inputs limited to the portal and CRS subpage", async () => {
    const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
    expect(viteConfig).toContain('index: resolve(__dirname, "index.html")');
    expect(viteConfig).toContain('crsCandidateLookup: resolve(__dirname, "demo/crs-candidate-lookup.html")');
    expect(viteConfig).not.toContain("demoIndex");
    expect(viteConfig).not.toContain("benchmark.html");
  });

  it("serves package-distributed runtime assets without isolation headers", async () => {
    const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
    for (const asset of ["proj.db", "proj.ini", "proj-worker.mjs", "proj-emscripten.js", "proj-emscripten.wasm"]) {
      expect(viteConfig).toContain(`"${asset}"`);
    }
    expect(viteConfig).toContain("copy-runtime-assets");
    expect(viteConfig).toContain("serve-proj-wasm-demo-assets");
    expect(viteConfig).toContain("alias-proj-wasm-browser-runtime");
    expect(viteConfig).toContain("PROJ_WASM_BROWSER_ID");
    expect(viteConfig).toContain("__ATLAS_PROJ_WASM_ASSET_BASE_URL__");
    expect(viteConfig).not.toContain("Cross-Origin-Opener-Policy");
    expect(viteConfig).not.toContain("Cross-Origin-Embedder-Policy");
    expect(viteConfig).not.toContain("coi-serviceworker");
  });

  it("has artifact-level Pages verification", async () => {
    const script = await readFile(new URL("../scripts/verify-demo-pages-build.mjs", import.meta.url), "utf8");
    const packedScript = await readFile(new URL("../scripts/verify-packed-browser-runtime.mjs", import.meta.url), "utf8");
    const ci = await readFile(new URL("../.github/workflows/test.yml", import.meta.url), "utf8");
    const deploy = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");

    expect(script).toContain("assets/proj.db");
    expect(script).toContain("/Atlas/assets/");
    expect(script).toContain("origin-rooted /assets/");
    expect(script).toContain("unexpectedly small");
    expect(packedScript).toContain('["pack", "--json"]');
    expect(packedScript).toContain('from "@c4h/atlas"');
    expect(packedScript).toContain("dist/atlas.js");
    expect(packedScript).toContain("dist/proj.db");
    expect(ci).toContain("pnpm run verify:demo");
    expect(ci).toContain("pnpm run verify:packed-browser");
    expect(deploy).toContain("pnpm run verify:demo");
  });
});
