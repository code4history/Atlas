import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shouldExternalize } from "../vite.config.ts";

describe("public API alignment", () => {
  it("does not export DuckDB-specific APIs", async () => {
    const atlas = await import("../src/index.ts");

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

  it("externalizes proj-wasm in the package build", () => {
    expect(shouldExternalize("proj-wasm")).toBe(true);
  });
});
