import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { projWasmExclusions as exclusions } from "../src/proj-wasm-exclusions.ts";

const require = createRequire(import.meta.url);
const projWasmDist = dirname(require.resolve("proj-wasm"));

/**
 * `src/proj-wasm-exclusions.ts` は、入っている proj-wasm の実行時で測った表である。
 * proj-wasm（と同梱の proj.db）が変わったら作り直す必要があるので、版と SHA-256 で突き合わせる。
 * 作り直し: `node scripts/generate-proj-wasm-exclusions.mjs`
 */
describe("proj-wasm exclusion table", () => {
  it("was generated from the installed proj-wasm and its proj.db", async () => {
    const projWasmPackage = JSON.parse(await readFile(join(projWasmDist, "..", "package.json"), "utf8")) as { version: string };
    const projDbSha256 = createHash("sha256").update(await readFile(join(projWasmDist, "proj.db"))).digest("hex");

    expect(exclusions.projWasmVersion).toBe(projWasmPackage.version);
    expect(exclusions.projDbSha256).toBe(projDbSha256);
  });

  it("lists rows as AUTHORITY:CODE ids with a reason for every PROJ string failure", () => {
    const idPattern = /^[A-Z0-9_]+:[^\s:]+$/;
    expect(exclusions.wkt2Unavailable.length).toBeGreaterThan(0);
    expect(exclusions.proj4Unavailable.length).toBeGreaterThan(0);
    expect(exclusions.wkt2Unavailable.every((id) => idPattern.test(id))).toBe(true);
    expect(exclusions.proj4Unavailable.every((entry) => idPattern.test(entry.id) && entry.reason.length > 0)).toBe(true);
    expect(new Set(exclusions.wkt2Unavailable).size).toBe(exclusions.wkt2Unavailable.length);
    expect(new Set(exclusions.proj4Unavailable.map((entry) => entry.id)).size).toBe(exclusions.proj4Unavailable.length);
  });

  it("contains the rows that broke searches without an area filter", () => {
    const proj4Ids = exclusions.proj4Unavailable.map((entry) => entry.id);
    for (const id of ["EPSG:32600", "ESRI:54051", "ESRI:54100", "ESRI:102299"]) {
      expect(proj4Ids).toContain(id);
    }
    expect(exclusions.wkt2Unavailable).toContain("IAU_2015:1020");
  });
});
