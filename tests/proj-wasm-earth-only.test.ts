import { describe, expect, it } from "vitest";
import {
  filterProjectedCrsRows,
  initializeProjWasmRuntime,
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
  type ProjDatabaseRow,
  type ProjectedCrsExclusion,
} from "../src/proj-wasm-crs.ts";

/**
 * Regression test: a search without `area` used to return about 2,000 CRS of other celestial
 * bodies (IAU_2015 and a few ESRI rows). Creating an Earth-to-them transformation throws inside
 * proj-wasm 0.1.0-alpha8, and after a few hundred such exceptions the runtime breaks and its
 * promises never settle. The search now leaves those rows out by default, using the celestial
 * body proj.db gives for each CRS (ellipsoid -> celestial_body).
 */
const KYOTO_EXTENT = { west: 135.70, south: 34.95, east: 135.80, north: 35.05 };
const KYOTO_GCPS: Array<[number, number]> = [[135.7681, 35.0116], [135.7585, 34.9858]];
const CALL_TIMEOUT_MS = 60_000;

/** Earth rows of the Kyoto search without `area`, measured before the change (proj.db of proj-wasm 0.1.0-alpha8). */
const EARTH_ROWS_BY_AUTHORITY = { EPSG: 22, ESRI: 106, IAU_2015: 34, IGNF: 5 };
const EARTH_ROW_COUNT = 167;
/** Rows of other celestial bodies the same search matched before the change (IAU_2015 2,040 + ESRI 6). */
const NON_EARTH_ROW_COUNT = 2046;
/** Rows left out because their PROJ string cannot be exported (unchanged by this fix). */
const PROJ4_UNAVAILABLE_COUNT = 8;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} did not answer within ${CALL_TIMEOUT_MS} ms`)), CALL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function celestialBodyById(): Promise<Map<string, string | null | undefined>> {
  await initializeProjWasmRuntime();
  const proj = await import("proj-wasm");
  const rows = await proj.projGetCrsInfoListFromDatabase({}) as ProjDatabaseRow[];
  return new Map(rows.map((row) => [`${row.authName}:${row.code}`, row.celestialBodyName]));
}

function countByAuthority(ids: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const authority = id.slice(0, id.indexOf(":"));
    counts[authority] = (counts[authority] ?? 0) + 1;
  }
  return counts;
}

function row(authName: string, code: string, celestialBodyName?: string | null): ProjDatabaseRow {
  return {
    authName,
    code,
    name: `${authName} ${code}`,
    type: 15,
    deprecated: false,
    bboxValid: true,
    westLonDegree: -180,
    southLatDegree: -90,
    eastLonDegree: 180,
    northLatDegree: 90,
    areaName: "World",
    celestialBodyName,
  };
}

describe("filterProjectedCrsRows leaves out CRS of other celestial bodies", () => {
  const rows = [
    row("EPSG", "3857", "Earth"),
    row("IAU_2015", "30120", "Moon"),
    row("ESRI", "103880", "Moon"),
    row("IAU_2015", "39920", "Earth"),
    row("TEST", "NO-BODY", undefined),
    row("TEST", "NULL-BODY", null),
  ];

  it("keeps only Earth rows (and rows with no celestial body) by default", () => {
    const ids = filterProjectedCrsRows(rows, { extent: KYOTO_EXTENT }).map((r) => `${r.authName}:${r.code}`);
    expect(ids).toEqual(["EPSG:3857", "IAU_2015:39920", "TEST:NO-BODY", "TEST:NULL-BODY"]);
  });

  it("keeps every row with includeOtherCelestialBodies: true", () => {
    expect(filterProjectedCrsRows(rows, { extent: KYOTO_EXTENT, includeOtherCelestialBodies: true })).toHaveLength(rows.length);
  });
});

describe("a search without area returns only CRS on the Earth", () => {
  it("returns no CRS of another celestial body, keeps every Earth row, and reports the rows it left out", async () => {
    const bodies = await celestialBodyById();
    const excluded: ProjectedCrsExclusion[] = [];
    const result = await withTimeout(
      listProjectedCrsFromProjWasm({ extent: KYOTO_EXTENT, onExcluded: (entries) => excluded.push(...entries) }),
      "listProjectedCrsFromProjWasm",
    );
    const ids = result.map((r) => r.id);

    expect(ids.filter((id) => bodies.get(id) !== "Earth")).toEqual([]);
    expect(ids.filter((id) => id.startsWith("IAU_2015:")).every((id) => bodies.get(id) === "Earth")).toBe(true);
    expect(ids).toHaveLength(EARTH_ROW_COUNT);
    expect(countByAuthority(ids)).toEqual(EARTH_ROWS_BY_AUTHORITY);
    expect(ids).toContain("EPSG:6674");

    const notOnEarth = excluded.filter((entry) => entry.reason.startsWith("Not on the Earth"));
    expect(notOnEarth).toHaveLength(NON_EARTH_ROW_COUNT);
    expect(notOnEarth.every((entry) => bodies.get(entry.id) !== "Earth")).toBe(true);
    // ESRI:103881 = Moon_2000_Equidistant_Cylindrical
    expect(notOnEarth.find((entry) => entry.id === "ESRI:103881")?.reason).toBe("Not on the Earth (celestial body: Moon)");
    expect(excluded).toHaveLength(NON_EARTH_ROW_COUNT + PROJ4_UNAVAILABLE_COUNT);
  }, 120_000);

  it("transforms every returned candidate without stalling", async () => {
    const result = await listProjectedCrsFromProjWasm({ extent: KYOTO_EXTENT });
    let answered = 0;
    for (const candidate of result) {
      await withTimeout(transformLonLatArrayToProjected(candidate, KYOTO_GCPS), `transform to ${candidate.id}`);
      answered += 1;
    }
    expect(answered).toBe(EARTH_ROW_COUNT);
  }, 300_000);

  it("still returns the other celestial bodies with includeOtherCelestialBodies: true", async () => {
    const bodies = await celestialBodyById();
    const result = await listProjectedCrsFromProjWasm({ extent: KYOTO_EXTENT, includeOtherCelestialBodies: true });
    expect(result).toHaveLength(EARTH_ROW_COUNT + NON_EARTH_ROW_COUNT);
    expect(result.filter((r) => bodies.get(r.id) !== "Earth")).toHaveLength(NON_EARTH_ROW_COUNT);
  }, 120_000);
});
