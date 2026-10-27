/**
 * Benchmark engine arithmetic with stub engines.
 *
 * The real engines are covered by `tests/benchmark-engine.test.ts`; here the engines are stubs, so
 * the counts, the status and the reported errors can be pinned without starting proj-wasm.
 */
import { describe, expect, it } from "vitest";

import type {
  BenchmarkPlace,
  BenchmarkResult,
  BenchmarkRuntime,
} from "../demo/benchmark-engine.js";
import { runBenchmark } from "../demo/benchmark-engine.js";
import type { ProjectedCrsInfo } from "../src/proj-wasm-crs.ts";

const MERCATOR_DEFINITION = "+proj=merc +datum=WGS84 +units=m +no_defs";
const FAILING_CRS_DEFINITION = "+proj=merc +datum=WGS84 +units=m +no_defs +stub=fail";
const FAILING_PIPELINE_DEFINITION =
  "+proj=pipeline +step +proj=longlat +step +proj=merc +datum=WGS84 +units=m +no_defs +stub=fail";

interface StubRow {
  id: string;
  name: string;
  proj4: string;
}

/** A runtime that answers every search with the same rows (the search itself is not under test). */
function makeRuntime(rows: StubRow[]): BenchmarkRuntime {
  return {
    listProjectedCrsFromProjWasm: async () => rows as unknown as ProjectedCrsInfo[],
  };
}

/**
 * A proj-wasm stub that scales degrees to metres by 1000 (so the forward output is easy to
 * recognise) and refuses the definitions in `failing`.
 */
function makeProjWasmStub(failing: readonly string[] = []) {
  const refused = new Set(failing);
  const refuse = (definition: string) => {
    if (refused.has(definition)) throw new Error("stub: the engine refused the definition");
  };
  return {
    PJ_FWD: 1,
    PJ_INV: -1,
    async projCreate({ definition }: { definition: string }) {
      refuse(definition);
      return { definition };
    },
    async projCreateCrsToCrs({ target_crs }: { target_crs: string }) {
      refuse(target_crs);
      return { definition: target_crs };
    },
    async coordArray() {
      return {} as { values?: number[]; out?: number[] };
    },
    async setCoords(coord: { values?: number[] }, values: number[][]) {
      coord.values = values[0];
    },
    async projTransArray({ coord, direction }: {
      coord: { values?: number[]; out?: number[] };
      direction: number;
    }) {
      const [x, y] = coord.values ?? [];
      // PJ_FWD scales degrees to metres; PJ_INV scales them back.
      coord.out = direction === 1 ? [x * 1000, y * 1000] : [x / 1000, y / 1000];
    },
    async getCoords(coord: { out?: number[] }) {
      return coord.out ?? [];
    },
    async projDestroy() {},
  };
}

function rowOf(result: BenchmarkResult, id: string) {
  const row = result.rows.find((entry) => entry.id === id);
  if (row === undefined) throw new Error(`${id} is missing from the result`);
  return row;
}

function placesOf(count: number): BenchmarkPlace[] {
  return Array.from({ length: count }, (_, index) => ({
    category: "mountain-summit",
    name: `stub point ${index + 1}`,
    lon: 138.6 + index * 0.01,
    lat: 35.7 + index * 0.01,
  }));
}

describe("benchmark engine: an engine that cannot create an operation", () => {
  it("keeps the run going, marks the row failed and counts every point as a failure", async () => {
    const rows: StubRow[] = [
      { id: "EPSG:2451", name: "plane rectangular IX", proj4: FAILING_CRS_DEFINITION },
      { id: "UTJCP:ZONE-B", name: "historical grid zone B", proj4: FAILING_PIPELINE_DEFINITION },
      { id: "EPSG:2449", name: "plane rectangular VII", proj4: MERCATOR_DEFINITION },
    ];
    const places = placesOf(3);
    const proj4js = () => ({
      forward: ([lon, lat]: [number, number]) => [lon * 1000, lat * 1000],
      inverse: ([x, y]: [number, number]) => [x / 1000, y / 1000],
    });

    const result = await runBenchmark({
      places,
      workCount: 3,
      targetIds: rows.map((row) => row.id),
      runtime: makeRuntime(rows),
      projWasm: makeProjWasmStub([FAILING_CRS_DEFINITION, FAILING_PIPELINE_DEFINITION]),
      proj4js,
    });

    for (const id of ["EPSG:2451", "UTJCP:ZONE-B"]) {
      const failed = rowOf(result, id);
      expect(failed.status).toBe("failed");
      expect(failed.projWasm.success).toBe(0);
      expect(failed.projWasm.failure).toBe(3);
      expect(failed.projWasm.failures).toHaveLength(3);
      expect(failed.projWasm.failures[0].message).toContain("refused the definition");
      expect(failed.forwardDifferenceMaxMeters).toBeNull();
    }

    const computed = rowOf(result, "EPSG:2449");
    expect(computed.status).toBe("ok");
    expect(computed.projWasm.success).toBe(3);
    expect(computed.projWasm.failure).toBe(0);
    expect(computed.proj4js.success).toBe(3);
    expect(computed.forwardDifferenceMaxMeters).toBe(0);

    expect(result.totals.projWasm.failure).toBe(6);
    expect(result.totals.projWasm.success).toBe(3);
  });
});

describe("benchmark engine: the forward difference", () => {
  it("reports the largest distance between the two forward outputs in metres", async () => {
    const rows: StubRow[] = [{ id: "EPSG:2451", name: "plane rectangular IX", proj4: MERCATOR_DEFINITION }];
    const proj4js = () => ({
      // One metre to the east of the proj-wasm output, for every point.
      forward: ([lon, lat]: [number, number]) => [lon * 1000 + 1, lat * 1000],
      inverse: ([x, y]: [number, number]) => [(x - 1) / 1000, y / 1000],
    });

    const result = await runBenchmark({
      places: placesOf(2),
      workCount: 2,
      targetIds: ["EPSG:2451"],
      runtime: makeRuntime(rows),
      projWasm: makeProjWasmStub(),
      proj4js,
    });

    const row = rowOf(result, "EPSG:2451");
    expect(row.forwardDifferenceMaxMeters).toBeCloseTo(1, 9);
    expect(result.forwardDifferenceMaxMeters).toBeCloseTo(1, 9);
  });
});

describe("benchmark engine: the round-trip error", () => {
  it("reports the error of each engine in metres", async () => {
    const rows: StubRow[] = [{ id: "EPSG:2451", name: "plane rectangular IX", proj4: MERCATOR_DEFINITION }];
    const longitudeShiftDegrees = 0.01;
    const places: BenchmarkPlace[] = [
      { category: "mountain-summit", name: "stub point", lon: 138.6, lat: 35.7 },
    ];
    const proj4js = () => ({
      forward: ([lon, lat]: [number, number]) => [lon * 1000, lat * 1000],
      // Only proj4js comes back shifted, so its round trip carries a known error.
      inverse: ([x, y]: [number, number]) => [x / 1000 + longitudeShiftDegrees, y / 1000],
    });

    const result = await runBenchmark({
      places,
      workCount: 2,
      targetIds: ["EPSG:2451"],
      runtime: makeRuntime(rows),
      projWasm: makeProjWasmStub(),
      proj4js,
    });

    const expectedMeters =
      longitudeShiftDegrees * 111320 * Math.cos((places[0].lat * Math.PI) / 180);
    const row = rowOf(result, "EPSG:2451");
    expect(expectedMeters).toBeGreaterThan(0);
    expect(row.proj4js.meanErrorMeters).toBeCloseTo(expectedMeters, 6);
    expect(row.proj4js.maxErrorMeters).toBeCloseTo(expectedMeters, 6);
    expect(row.projWasm.meanErrorMeters).toBeCloseTo(0, 9);
    expect(row.projWasm.maxErrorMeters).toBeCloseTo(0, 9);
  });
});

describe("benchmark engine: a point that fails on one engine", () => {
  it("counts a non-finite proj4js result as a failure and keeps the other points", async () => {
    const rows: StubRow[] = [{ id: "EPSG:2451", name: "plane rectangular IX", proj4: MERCATOR_DEFINITION }];
    let calls = 0;
    const proj4js = () => ({
      forward: ([lon, lat]: [number, number]) => {
        calls += 1;
        if (calls === 2) return [Number.NaN, Number.NaN];
        return [lon * 1000, lat * 1000];
      },
      inverse: ([x, y]: [number, number]) => [x / 1000, y / 1000],
    });

    const result = await runBenchmark({
      places: placesOf(4),
      workCount: 4,
      targetIds: ["EPSG:2451"],
      runtime: makeRuntime(rows),
      projWasm: makeProjWasmStub(),
      proj4js,
    });

    const row = rowOf(result, "EPSG:2451");
    expect(row.proj4js.success).toBe(3);
    expect(row.proj4js.failure).toBe(1);
    expect(row.proj4js.failures).toHaveLength(1);
    expect(row.proj4js.failures[0].message).toContain("non-finite");
    expect(row.projWasm.success).toBe(4);
    expect(row.projWasm.failure).toBe(0);
    expect(row.status).toBe("failed");
    expect(result.totals.proj4js.failure).toBe(1);
    expect(result.totals.proj4js.success).toBe(3);
  });

  it("counts a thrown proj4js error as a failure and keeps the other points", async () => {
    const rows: StubRow[] = [{ id: "EPSG:2451", name: "plane rectangular IX", proj4: MERCATOR_DEFINITION }];
    let calls = 0;
    const proj4js = () => ({
      forward: ([lon, lat]: [number, number]) => {
        calls += 1;
        if (calls === 2) throw new Error("stub: the engine threw on one point");
        return [lon * 1000, lat * 1000];
      },
      inverse: ([x, y]: [number, number]) => [x / 1000, y / 1000],
    });

    const result = await runBenchmark({
      places: placesOf(4),
      workCount: 4,
      targetIds: ["EPSG:2451"],
      runtime: makeRuntime(rows),
      projWasm: makeProjWasmStub(),
      proj4js,
    });

    const row = rowOf(result, "EPSG:2451");
    expect(row.proj4js.success).toBe(3);
    expect(row.proj4js.failure).toBe(1);
    expect(row.proj4js.failures).toHaveLength(1);
    expect(row.proj4js.failures[0].message).toContain("stub: the engine threw on one point");
    expect(row.projWasm.success).toBe(4);
    expect(row.status).toBe("failed");
  });
});
