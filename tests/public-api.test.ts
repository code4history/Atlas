import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shouldExternalize } from "../vite.config.ts";

/**
 * 公開 surface の増分を 2 件に固定する。
 *
 * 「最小 export」は実装行数ではなく `src/index.ts` の export 集合の増分件数で定義する。
 * 以前の baseline は**関数 12・型 9 の計 21 件**であり、
 * 本タスクの増分は `transformLonLatArrayToProjected`（関数）と
 * `TransformLonLatToProjectedOptions`（型）の 2 件だけである。
 * その後に足した `transformLonLatToCandidate`（関数）と `LinearUnit`（型）の 2 件も、
 * 同じ数え方で固定する。
 *
 * 型 export は runtime に現れない ∴ 関数は import した module の key で、型は
 * `src/index.ts` のソーステキストで固定する（両方を測らないと増分件数が数えられない）。
 */
const EXPECTED_RUNTIME_EXPORTS = [
  "bboxToPolygonWkt",
  "createCandidateTransformer",
  "extractAuthorityIdFromWkt",
  "extractWktName",
  "inferApproximateBbox",
  "inferDatumFamily",
  "inferKind",
  "inferPriority",
  "inferWgsEquivalent",
  "initializeProjWasmRuntime",
  "isProjectedPrjPath",
  "isScopeIncluded",
  "listProjectedCrsFromProjWasm",
  "transformLonLatArrayToProjected",
  "transformLonLatToCandidate",
] as const;

const EXPECTED_TYPE_EXPORTS = [
  "AtlasCandidateTransformer",
  "AtlasGeoBasisLike",
  "CandidateAuthorityId",
  "CandidateBbox",
  "CandidateCrsExtent",
  "CandidateDatumFamily",
  "CandidateKind",
  "CandidateSeedScope",
  "InitializeProjWasmRuntimeOptions",
  "LinearUnit",
  "ListProjectedCrsFromProjWasmOptions",
  "ProjectedCrsExclusion",
  "ProjectedCrsInfo",
  "TransformLonLatToProjectedOptions",
] as const;

/** 以前の公開 surface（関数 12・型 9）。増分の差分を数えるための baseline。 */
const BASELINE_EXPORT_COUNT = 21;

describe("public API alignment", () => {
  it("does not export DuckDB-specific APIs", async () => {
    const atlas = await import("../src/index.ts");

    expect("initializeProjWasmRuntime" in atlas).toBe(true);
    expect("listProjectedCrsFromProjWasm" in atlas).toBe(true);
    expect("transformLonLatArrayToProjected" in atlas).toBe(true);

    // 増分は 2 件のみ（関数 13 + 型 10 = 23 = baseline 21 + 2）
    expect(Object.keys(atlas).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS]);

    const indexSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
    const typeExportNames = [...indexSource.matchAll(/export type \{([\s\S]*?)\}/g)]
      .flatMap((match) => match[1].split(","))
      .map((name) => name.trim())
      .filter((name) => name !== "")
      .sort();
    expect(typeExportNames).toEqual([...EXPECTED_TYPE_EXPORTS]);

    // 上の 2 件に、検索から外した行を知らせる型 `ProjectedCrsExclusion` の 1 件と、
    // Teiresias へつなぐ adapter（関数 `createCandidateTransformer` と型 2 件）の 3 件を足す。
    // さらに、単位つきの変換（関数 `transformLonLatToCandidate` と型 `LinearUnit`）の 2 件を足す。
    expect(EXPECTED_RUNTIME_EXPORTS.length + EXPECTED_TYPE_EXPORTS.length).toBe(
      BASELINE_EXPORT_COUNT + 8,
    );

    expect("CandidateCrsStore" in atlas).toBe(false);
    expect("openCandidateCrsStore" in atlas).toBe(false);
    expect("SYSTEM_CRS_DB_FILENAME" in atlas).toBe(false);
    expect("USER_CRS_DB_FILENAME" in atlas).toBe(false);
    expect("CANDIDATE_CRS_SCHEMA_SQL" in atlas).toBe(false);
    expect("CANDIDATE_CRS_TABLE_NAME" in atlas).toBe(false);
  });

  it("does not declare DuckDB as a package dependency", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
      files?: string[];
    };

    expect(packageJson.dependencies?.["@duckdb/node-api"]).toBeUndefined();
    expect(packageJson.scripts?.["crs:build-system-db"]).toBeUndefined();
    expect(packageJson.files).not.toContain("data");
    expect(packageJson.files).toContain("data/crs/custom-projections.json");
  });

  it("does not depend on Teiresias (the adapter matches its transformer type by shape only)", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as Record<string, unknown>;
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const deps = (packageJson[field] ?? {}) as Record<string, string>;
      expect(Object.keys(deps)).not.toContain("@c4h/teiresias");
    }

    const srcFiles = (await readdir(new URL("../src/", import.meta.url))).filter((name) => /\.(ts|js|mjs)$/.test(name));
    const teiresiasImports: string[] = [];
    for (const file of srcFiles) {
      const source = await readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
      if (/from\s+["'][^"']*teiresias[^"']*["']|import\(\s*["'][^"']*teiresias/i.test(source)) teiresiasImports.push(file);
    }
    expect(teiresiasImports).toEqual([]);

    const atlas = await import("../src/index.ts");
    expect(typeof atlas.createCandidateTransformer).toBe("function");
  });

  it("externalizes proj-wasm in the package build", () => {
    expect(shouldExternalize("proj-wasm")).toBe(true);
  });
});
