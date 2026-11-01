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
    // proj4js is only a benchmark comparison engine, never a runtime dependency of the package.
    expect(packageJson.devDependencies?.proj4).toBe("2.22.0");
    expect(packageJson.dependencies?.proj4).toBeUndefined();
    expect(packageJson.devDependencies?.jsdom).toMatch(/^\^30\./);
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

    // 日付変更線跨ぎ bbox の是正が demo/main.js から実際に呼ばれていること。
    // 純関数側の算術は tests/demo-map-geometry.test.ts が検査する ∴ ここは「結線」だけを固定する。
    expect(mainJs).toContain('from "./map-geometry.ts"');
    expect(mainJs).not.toContain("Math.abs(right - left)"); // 巡回性を持たない旧算術
    expect(mainJs).toContain("bboxScreenRects(");
    expect(mainJs).toContain("worldCopyXs(");
  });

  it("uses the C4H demo boilerplate shell", async () => {
    const portal = await readFile(new URL("../index.html", import.meta.url), "utf8");
    const crsSubpage = await readFile(new URL("../demo/crs-candidate-lookup.html", import.meta.url), "utf8");

    expect(portal).toContain('class="c4h-portal"');
    expect(portal).toContain('class="c4h-demo-card"');
    expect(portal).toContain('href="./demo/crs-candidate-lookup.html"');
    expect(portal).toContain('href="./demo/benchmark.html"');
    expect(portal.match(/class="c4h-demo-card"/g)).toHaveLength(2);

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

  it("builds the portal, the CRS subpage and the benchmark subpage", async () => {
    const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
    expect(viteConfig).toContain('index: resolve(__dirname, "index.html")');
    expect(viteConfig).toContain('crsCandidateLookup: resolve(__dirname, "demo/crs-candidate-lookup.html")');
    expect(viteConfig).toContain('benchmark: resolve(__dirname, "demo/benchmark.html")');
    expect(viteConfig).not.toContain("demoIndex");
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
    expect(script).toContain("demo/benchmark.html");
    expect(script).toContain("benchmark-places");
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
    // 起動ブランチの master 化を機械で固定する（目視 diff に頼らない）。
    // Atlas 内で閉じる検査であること自体が要件である — 3 repo を独立公開した後、
    // Teiresias 側から相対パスで Atlas を assert する形は解決不能になるため。
    expect(deploy).toContain("- master");
  });

  it("states the actual MIT license in both READMEs", async () => {
    // package.json の license と LICENSE は MIT だが、README ×2 は
    // 旧 Maplat 系の制限的ライセンス名（実測した表記）を表示していた。
    // 公開すると README が実際より制限的なライセンスを主張する ∴ repo 内で閉じる検査で固定する
    // （outer の走査だけに頼ると、分離後の公開リポジトリ単体では 1 本も走らない）。
    //
    // ⚠️ 禁止語をソースへ**逐語で置かない**（連結して組み立てる）。
    // 「3 repo 全域で当該語が 0 件」を走査で固定する ∴ 検査の実装元が自分でヒットすると、
    // 走査は「検査が存在すること」を欠陥として数えてしまう。走査対象からファイルごと除外するより、
    // 実装元だけを走査面から外すこの形の方が、同ファイルの他の行に対する走査を弱めない
    // （nayuta-implementer「検査の除外を足すとき（H-9）」の「実装元は除外し、実装元の側で規律を強制する」）。
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      license?: string;
    };
    const license = await readFile(new URL("../LICENSE", import.meta.url), "utf8");
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    const readmeJa = await readFile(new URL("../README.ja.md", import.meta.url), "utf8");

    expect(packageJson.license).toBe("MIT");
    expect(license).toContain("MIT License");

    const forbiddenLicenseNames = ["maplat " + "limited", "limited " + "license"];

    for (const [name, text] of [
      ["README.md", readme],
      ["README.ja.md", readmeJa],
    ] as const) {
      expect(text, `${name}: MIT 表記`).toContain("MIT License");
      expect(text, `${name}: LICENSE への参照`).toContain("[LICENSE](./LICENSE)");
      for (const forbidden of forbiddenLicenseNames) {
        expect(text.toLowerCase(), `${name}: 制限ライセンス名の残存`).not.toContain(forbidden);
      }
    }
  });
});
