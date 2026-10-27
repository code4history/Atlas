import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { PROJ_WASM_RUNTIME_ASSETS } from "../vite.config.ts";

const require = createRequire(import.meta.url);
const projWasmDist = dirname(require.resolve("proj-wasm"));
const repoDist = new URL("../dist/", import.meta.url);

async function sha256(path: string | URL): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

/**
 * The tracked dist/ redistributes the proj-wasm runtime files (wasm, proj.db, workers) next to
 * dist/atlas.js. They must be byte-identical to the installed proj-wasm, so a dependency update
 * without a rebuild (or a hand-edited file) is caught.
 */
describe("redistributed proj-wasm runtime files", () => {
  it("lists the wasm binary and proj.db among the copied files", () => {
    expect(PROJ_WASM_RUNTIME_ASSETS).toContain("proj-emscripten.wasm");
    expect(PROJ_WASM_RUNTIME_ASSETS).toContain("proj.db");
  });

  for (const asset of PROJ_WASM_RUNTIME_ASSETS) {
    it(`dist/${asset} matches proj-wasm/dist/${asset}`, async () => {
      expect(await sha256(new URL(asset, repoDist))).toBe(await sha256(join(projWasmDist, asset)));
    });
  }
});
