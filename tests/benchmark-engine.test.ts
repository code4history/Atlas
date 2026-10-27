/**
 * Benchmark engine: the real `proj-wasm` and `proj4js` engines over real Atlas rows.
 *
 * The points are real summits from `demo/data/benchmark-places.json` (written out here so this
 * file does not depend on the dataset changing). They are the mountains of Yamanashi and
 * Shizuoka prefectures (the region of plane rectangular CS VIII), such as 大菩薩嶺 and 富士山.
 * Both of the CRS used below are found by the Atlas search around these points: `EPSG:2451`
 * (plane rectangular IX) and `UTJCP:ZONE-B` (historical grid zone B).
 *
 * The Atlas rows come from `listProjectedCrsFromProjWasm` through the same `runBenchmark` the
 * page calls, so a definition taken from somewhere else would show up here as a different row.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import proj4 from "proj4";

import { initializeProjWasmRuntime, listProjectedCrsFromProjWasm } from "../src/proj-wasm-crs.ts";
import {
  crsScopeIds,
  runBenchmark,
  selectPoints,
  type BenchmarkPlace,
  type BenchmarkResult,
} from "../demo/benchmark-engine.js";
import { findBenchmarkPreset, presetWorkCount } from "../demo/benchmark-presets.js";

/** Real summits (the same values as in the bundled dataset). */
const KANTO_SUMMITS: BenchmarkPlace[] = [
  { category: "mountain-summit", name: "小楢山", lon: 138.664198, lat: 35.781533 },
  { category: "mountain-summit", name: "茅ヶ岳", lon: 138.513772, lat: 35.795014 },
  { category: "mountain-summit", name: "鶏冠山", lon: 138.835644, lat: 35.788483 },
  { category: "mountain-summit", name: "大菩薩嶺", lon: 138.845506, lat: 35.748762 },
  { category: "mountain-summit", name: "小金沢山", lon: 138.856623, lat: 35.716946 },
  { category: "mountain-summit", name: "雁ケ腹摺山", lon: 138.884831, lat: 35.686789 },
  { category: "mountain-summit", name: "御正体山", lon: 138.931607, lat: 35.486924 },
  { category: "mountain-summit", name: "三ツ峠山", lon: 138.809204, lat: 35.549272 },
  { category: "mountain-summit", name: "節刀ヶ岳", lon: 138.683427, lat: 35.52849 },
  { category: "mountain-summit", name: "富士山＜剣ヶ峯＞", lon: 138.727373, lat: 35.360738 },
];

/**
 * These tests go through the real engines; the first one in the file also pays for the start-up
 * of `proj-wasm` and for expanding the Atlas rows they ask for.
 */
const ENGINE_TEST_TIMEOUT_MS = 120_000;

let runtimePromise: Promise<{ listProjectedCrsFromProjWasm: typeof listProjectedCrsFromProjWasm }> | undefined;
let projWasmPromise: Promise<typeof import("proj-wasm")> | undefined;

function atlasRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await initializeProjWasmRuntime();
      return { listProjectedCrsFromProjWasm };
    })();
  }
  return runtimePromise;
}

function projWasmModule() {
  if (!projWasmPromise) projWasmPromise = import("proj-wasm");
  return projWasmPromise;
}

async function run(
  places: BenchmarkPlace[],
  workCount: number,
  targetIds: string[],
): Promise<BenchmarkResult> {
  return runBenchmark({
    places,
    workCount,
    targetIds,
    runtime: await atlasRuntime(),
    projWasm: await projWasmModule(),
    proj4js: proj4,
  });
}

function rowOf(result: BenchmarkResult, id: string) {
  const row = result.rows.find((entry) => entry.id === id);
  if (row === undefined) throw new Error(`${id} is missing from the result (${result.rows.map((entry) => entry.id).join(", ")})`);
  return row;
}

describe("benchmark engine: plane rectangular IX (EPSG:2451)", { timeout: ENGINE_TEST_TIMEOUT_MS }, () => {
  it("finishes every point on both engines with a round-trip error below 1e-6 m", async () => {
    const result = await run(KANTO_SUMMITS, 10, ["EPSG:2451"]);
    const row = rowOf(result, "EPSG:2451");

    console.info(
      `[benchmark-engine] EPSG:2451 proj-wasm round trip mean ${row.projWasm.meanErrorMeters} m, ` +
      `max ${row.projWasm.maxErrorMeters} m; proj4js mean ${row.proj4js.meanErrorMeters} m, ` +
      `max ${row.proj4js.maxErrorMeters} m; forward difference max ${row.forwardDifferenceMaxMeters} m`,
    );

    expect(row.found).toBe(true);
    expect(row.projWasm.success).toBe(10);
    expect(row.projWasm.failure).toBe(0);
    expect(row.proj4js.success).toBe(10);
    expect(row.proj4js.failure).toBe(0);
    expect(row.projWasm.maxErrorMeters).toBeLessThan(1e-6);
    expect(row.proj4js.maxErrorMeters).toBeLessThan(1e-6);
    // The two engines compute the projection separately, so their forward outputs are close but
    // not identical.
    expect(row.forwardDifferenceMaxMeters).toBeGreaterThan(0);
    expect(row.forwardDifferenceMaxMeters).toBeLessThan(1e-6);
    expect(row.status).toBe("ok");
  });
});

describe("benchmark engine: historical grid zone B (UTJCP:ZONE-B)", { timeout: ENGINE_TEST_TIMEOUT_MS }, () => {
  it("keeps proj4js failures explicit with the message the engine throws", async () => {
    const result = await run(KANTO_SUMMITS, 10, ["UTJCP:ZONE-B"]);
    const row = rowOf(result, "UTJCP:ZONE-B");

    console.info(
      `[benchmark-engine] UTJCP:ZONE-B proj-wasm round trip max ${row.projWasm.maxErrorMeters} m; ` +
      `proj4js failures ${row.proj4js.failure}, message ${row.proj4js.failures[0]?.message}`,
    );

    expect(row.projWasm.success).toBe(10);
    expect(row.projWasm.failure).toBe(0);
    expect(row.proj4js.success).toBe(0);
    expect(row.proj4js.failure).toBe(10);
    expect(row.proj4js.failures).toHaveLength(10);
    expect(row.proj4js.failures[0].message).toContain("pipeline");
    expect(row.status).toBe("failed");
  });
});

describe("benchmark engine: work larger than the point set", { timeout: ENGINE_TEST_TIMEOUT_MS }, () => {
  it("cycles back to the first point until the requested work is done", async () => {
    const result = await run(KANTO_SUMMITS, 25, ["EPSG:2451"]);
    const row = rowOf(result, "EPSG:2451");

    expect(result.pointCount).toBe(10);
    expect(result.workCount).toBe(25);
    expect(result.laps).toBe(3);
    expect(row.workCount).toBe(25);
    expect(row.projWasm.success).toBe(25);
    expect(row.proj4js.success).toBe(25);
  });
});

describe("benchmark engine: ids that are not in the catalog", { timeout: ENGINE_TEST_TIMEOUT_MS }, () => {
  it("keeps an unknown id in the result as not found", async () => {
    const result = await run(KANTO_SUMMITS, 3, ["EPSG:2451", "EPSG:9999"]);
    const missing = rowOf(result, "EPSG:9999");

    expect(missing.found).toBe(false);
    expect(missing.status).toBe("not-found");
    expect(missing.projWasm.success).toBe(0);
    expect(missing.proj4js.success).toBe(0);
    expect(rowOf(result, "EPSG:2451").found).toBe(true);
  });
});

describe("benchmark engine: the engine-coverage contrast", { timeout: ENGINE_TEST_TIMEOUT_MS }, () => {
  const places = JSON.parse(
    readFileSync(new URL("../demo/data/benchmark-places.json", import.meta.url), "utf8"),
  ) as BenchmarkPlace[];

  async function runPreset(optionId: "a" | "b"): Promise<BenchmarkResult> {
    const option = findBenchmarkPreset("engine-coverage", optionId);
    if (option === undefined) throw new Error(`engine-coverage:${optionId} is missing`);
    const selected = selectPoints(places, option.input);
    return run(selected, presetWorkCount(option.input, selected.length), crsScopeIds(option.input.crsScope));
  }

  it("A fails nowhere on proj4js", async () => {
    const result = await runPreset("a");
    const row = rowOf(result, "EPSG:2451");

    console.info(
      `[benchmark-engine] engine-coverage A: ${result.workCount} points, ` +
      `proj-wasm failures ${row.projWasm.failure}, proj4js failures ${row.proj4js.failure}, ` +
      `forward difference max ${row.forwardDifferenceMaxMeters} m`,
    );

    expect(row.proj4js.failure).toBe(0);
    expect(row.projWasm.failure).toBe(0);
  });

  it("B fails on every proj4js point and nowhere on proj-wasm", async () => {
    const result = await runPreset("b");
    const row = rowOf(result, "UTJCP:ZONE-B");

    console.info(
      `[benchmark-engine] engine-coverage B: ${result.workCount} points, ` +
      `proj-wasm failures ${row.projWasm.failure}, proj4js successes ${row.proj4js.success}, ` +
      `proj4js message ${row.proj4js.failures[0]?.message}`,
    );

    expect(row.proj4js.success).toBe(0);
    expect(row.projWasm.failure).toBe(0);
    expect(row.projWasm.success).toBe(result.workCount);
  });
});

describe("benchmark engine: the CRS rows do not depend on the points of the run", { timeout: 300_000 }, () => {
  it("finds every target CRS from the whole dataset even when the run uses only northern points", async () => {
    const dataset = JSON.parse(
      readFileSync(new URL("../demo/data/benchmark-places.json", import.meta.url), "utf8"),
    ) as BenchmarkPlace[];
    const northern = selectPoints(dataset, { category: "mountain-summit", pointLimit: 10 });
    expect(Math.min(...northern.map((place) => place.lat))).toBeGreaterThan(43);

    const result = await runBenchmark({
      places: northern,
      catalogPlaces: dataset,
      workCount: 10,
      targetIds: crsScopeIds({ kind: "all" }),
      runtime: await atlasRuntime(),
      projWasm: await projWasmModule(),
      proj4js: proj4,
    });

    // Zones far from the run's points are found through the rest of the dataset.
    const southern = ["EPSG:2443", "EPSG:2451", "EPSG:2457", "EPSG:30161", "EPSG:3097", "UTJCP:ZONE-B", "UTJCP:ZONE-C"];
    for (const id of southern) {
      expect(result.rows.find((row) => row.id === id)?.found, id).toBe(true);
    }
    // Plane rectangular XVII (the Daito Islands, both datums) is the only zone without a place of
    // the dataset inside it, so it is the only one left "not found", with the reason in its name.
    const missing = result.rows.filter((row) => !row.found);
    expect(missing.map((row) => row.id)).toEqual(["EPSG:2459", "EPSG:30177"]);
    for (const row of missing) expect(row.name).toContain("データのどの地点も");
    expect(result.workCount).toBe(10);
  });
});
