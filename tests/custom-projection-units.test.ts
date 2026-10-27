/**
 * 同梱の custom projection の定義（`data/crs/custom-projections.json`）と、その行の `unit`。
 *
 * 定義ファイルは利用者が読む。pipeline の格子の単位は定義の `unit` でだけ決まるので、
 * pipeline のある行には `unit` を必ず置き、pipeline に書かれた `+to_meter` と一致させる。
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { listProjectedCrsFromProjWasm, type ProjectedCrsInfo } from "../src/proj-wasm-crs.ts";

const YARD_OF_THE_HISTORICAL_GRID = 0.9143985307444408;
const PROJ_WASM_TEST_TIMEOUT_MS = 16_000;

interface UnitInFile {
  name: string;
  metresPerUnit: number;
}

interface ProjectionInFile {
  authority: string;
  code: string;
  proj4?: string;
  pipeline?: string;
  unit?: UnitInFile;
}

async function loadDefinitions(): Promise<ProjectionInFile[]> {
  const raw = await readFile(new URL("../data/crs/custom-projections.json", import.meta.url), "utf8");
  const parsed = JSON.parse(raw) as { projections?: ProjectionInFile[] } | ProjectionInFile[];
  return Array.isArray(parsed) ? parsed : (parsed.projections ?? []);
}

function idOf(definition: ProjectionInFile): string {
  return `${definition.authority}:${definition.code}`;
}

describe("units of the bundled custom projections", () => {
  it("gives every row that has a pipeline a unit", async () => {
    const definitions = await loadDefinitions();
    expect(definitions.length).toBeGreaterThan(0);

    for (const definition of definitions) {
      if (definition.proj4 === undefined && definition.pipeline === undefined) continue;
      const unit = definition.unit;
      expect(unit, `${idOf(definition)} has no unit`).toBeDefined();
      expect(typeof unit!.name).toBe("string");
      expect(unit!.name.length).toBeGreaterThan(0);
      expect(Number.isFinite(unit!.metresPerUnit)).toBe(true);
      expect(unit!.metresPerUnit).toBeGreaterThan(0);
    }
  });

  it("agrees with the +to_meter factor written in the pipeline", async () => {
    const definitions = await loadDefinitions();

    for (const definition of definitions) {
      const text = definition.pipeline ?? definition.proj4;
      if (text === undefined) continue;
      const found = text.match(/(?:^| )\+to_meter=([^ ]+)/);
      if (found === null) continue;
      expect(definition.unit, `${idOf(definition)} has no unit`).toBeDefined();
      expect(definition.unit!.metresPerUnit).toBe(Number(found[1]));
    }
  });

  it("declares the yard of the Japan city plans for the three historical grid zones", async () => {
    const definitions = await loadDefinitions();
    const zones = definitions.filter((definition) => definition.authority === "UTJCP");

    expect(zones.map(idOf).sort()).toEqual(["UTJCP:ZONE-A", "UTJCP:ZONE-B", "UTJCP:ZONE-C"]);
    for (const zone of zones) {
      expect(zone.pipeline).toContain(`+to_meter=${YARD_OF_THE_HISTORICAL_GRID}`);
      expect(zone.unit).toEqual({
        name: "yard (Japan City Plans)",
        metresPerUnit: YARD_OF_THE_HISTORICAL_GRID,
      });
    }
  });
});

describe("units of the rows built from those definitions", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  const KYOTO_EXTENT = { west: 135.6, south: 34.9, east: 135.9, north: 35.1 };

  async function zoneBRows(): Promise<ProjectedCrsInfo[]> {
    return listProjectedCrsFromProjWasm({
      extent: KYOTO_EXTENT,
      area: "Japan City Plans - Historical Grid",
      includeCustomProjections: true,
    });
  }

  it("hands out a copy of the unit of the definition", async () => {
    const first = (await zoneBRows()).find((row) => row.id === "UTJCP:ZONE-B");
    expect(first).toBeDefined();
    const originalUnit = { ...first!.unit! };

    expect(first!.unit!.name).toBe("yard (Japan City Plans)");
    first!.unit!.name = "changed by the caller";
    first!.unit!.metresPerUnit = 42;

    const second = (await zoneBRows()).find((row) => row.id === "UTJCP:ZONE-B");
    expect(second!.unit).toEqual(originalUnit);
    expect(second!.unit).not.toBe(first!.unit);
  });

  it("does not attach a unit to the rows of proj.db", async () => {
    const rows = await listProjectedCrsFromProjWasm({
      extent: KYOTO_EXTENT,
      area: "Japan",
      onshoreOnly: true,
    });
    const fromProjDb = rows.filter((row) => row.definitionType === "projdb");
    expect(fromProjDb.length).toBeGreaterThan(0);
    expect(fromProjDb.filter((row) => row.unit !== undefined)).toEqual([]);
  });
});
