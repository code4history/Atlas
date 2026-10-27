/**
 * `transformLonLatToCandidate` と、単位つきの返却に対応した `createCandidateTransformer`。
 *
 * 実 engine（proj-wasm）を通す。候補の `proj4` はハードコードせず、実カタログ
 * （`listProjectedCrsFromProjWasm`）と実 DB（`projCreateFromDatabase`）から取る。
 */
import { describe, expect, it } from "vitest";

import {
  createCandidateTransformer,
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
  transformLonLatToCandidate,
  type LinearUnit,
  type ProjectedCrsInfo,
} from "../src/proj-wasm-crs.ts";

/** 京都近郊（lon/lat 度・lon-lat 順）。 */
const KYOTO_GCPS: ReadonlyArray<readonly [number, number]> = [
  [135.6, 34.9],
  [135.9, 34.9],
  [135.9, 35.1],
  [135.6, 35.1],
  [135.75, 35.0],
];
const KYOTO_THREE: ReadonlyArray<readonly [number, number]> = [
  [135.7, 34.98],
  [135.75, 35.02],
  [135.79, 34.96],
];
/** カリフォルニアの 3 点（lon/lat 度・lon-lat 順）。 */
const CALIFORNIA_THREE: ReadonlyArray<readonly [number, number]> = [
  [-121.5, 40.5],
  [-120.0, 38.0],
  [-118.5, 35.5],
];

const LONLAT = { kind: "lonlat_deg", axisOrder: "lon-lat" } as const;
const KYOTO_EXTENT = { west: 135.6, south: 34.9, east: 135.9, north: 35.1 };

const YARD_OF_THE_HISTORICAL_GRID = 0.9143985307444408;
/** 1 m を 1e-6 m 以内で見る（m 単位の値どうしの比較）。 */
const METRE_TOLERANCE = 1e-6;

/**
 * Tests here go through the real proj-wasm engine; the first one in a file also pays for its start-up.
 */
const PROJ_WASM_TEST_TIMEOUT_MS = 16_000;

let catalogPromise: Promise<ProjectedCrsInfo[]> | undefined;

/** 京都の範囲の候補（同梱の custom projection を含む）。 */
function kyotoCatalog(): Promise<ProjectedCrsInfo[]> {
  catalogPromise ??= listProjectedCrsFromProjWasm({
    extent: KYOTO_EXTENT,
    area: "Japan",
    onshoreOnly: false,
    includeCustomProjections: true,
  });
  return catalogPromise;
}

async function catalogRow(id: string): Promise<ProjectedCrsInfo> {
  const rows = await kyotoCatalog();
  const found = rows.find((row) => row.id === id);
  if (found === undefined) {
    throw new Error(`${id} is not in the catalog (candidates: ${rows.map((row) => row.id).join(", ")})`);
  }
  return found;
}

/** 実 proj.db から PROJ 文字列を取る（検索の範囲の外にある CRS 用）。 */
async function databaseTarget(id: string): Promise<Pick<ProjectedCrsInfo, "id" | "proj4">> {
  const [authority, code] = id.split(":");
  const proj = await import("proj-wasm");
  await proj.init();
  const pj = await proj.projCreateFromDatabase({
    auth_name: authority,
    code,
    category: proj.PJ_CATEGORY_CRS,
  });
  const proj4 = await proj.projAsProjString({ pj, type: proj.PJ_PROJ_5, options: null });
  return { id, proj4 };
}

/** 定義を `data:` URL にして `userProjection` へ渡す（ファイルを書かずに user の行を作る）。 */
function dataUrl(value: unknown): string {
  return `data:application/json,${encodeURIComponent(JSON.stringify({ projections: [value] }))}`;
}

function expectFinitePoints(points: ReadonlyArray<readonly [number, number]>, expectedCount: number): void {
  expect(points).toHaveLength(expectedCount);
  for (const point of points) {
    expect(Number.isFinite(point[0])).toBe(true);
    expect(Number.isFinite(point[1])).toBe(true);
  }
}

describe("transformLonLatToCandidate", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("returns the grid points with the unit of the historical Japan city plans grid", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");
    expect(zoneB.unit).toBeDefined();

    const converted = await transformLonLatToCandidate(zoneB, KYOTO_THREE);
    expect(converted).not.toBeNull();
    expect(converted!.unit).toEqual({
      name: "yard (Japan City Plans)",
      metresPerUnit: YARD_OF_THE_HISTORICAL_GRID,
    });
    expectFinitePoints(converted!.points, KYOTO_THREE.length);

    // 同じ pipeline から `+to_meter=…` だけを外すと、格子ではなく metre の座標が返る。
    // 格子の値に 1 単位が何 metre かを掛けた値と 1e-6 m 以内で一致する。
    const proj = await import("proj-wasm");
    await proj.init();
    const definitionInMetres = zoneB.proj4.replace(/ \+to_meter=[^ ]+/, "");
    expect(definitionInMetres).not.toBe(zoneB.proj4);

    const pipeline = await proj.projCreate({ definition: definitionInMetres });
    const coords = await proj.coordArray(KYOTO_THREE.length);
    await proj.setCoords(
      coords,
      KYOTO_THREE.map(([lon, lat]) => [lon, lat, 0, 0] as const),
    );
    await proj.projTransArray({
      p: pipeline,
      direction: proj.PJ_INV,
      n: KYOTO_THREE.length,
      coord: coords,
    });

    for (let index = 0; index < KYOTO_THREE.length; index += 1) {
      const [easting, northing] = await proj.getCoords(coords, index);
      const [ourEasting, ourNorthing] = converted!.points[index];
      expect(Math.abs(ourEasting * YARD_OF_THE_HISTORICAL_GRID - easting)).toBeLessThan(METRE_TOLERANCE);
      expect(Math.abs(ourNorthing * YARD_OF_THE_HISTORICAL_GRID - northing)).toBeLessThan(METRE_TOLERANCE);
    }
  });

  it("returns the axis unit of a CRS that is not in metres", async () => {
    const target = await databaseTarget("EPSG:2227");
    expect(target.proj4).toContain("+units=us-ft");

    const converted = await transformLonLatToCandidate(target, CALIFORNIA_THREE);
    expect(converted).not.toBeNull();
    expect(converted!.unit.name).toBe("US survey foot");

    const expected = 1200 / 3937;
    expect(Math.abs(converted!.unit.metresPerUnit - expected) / expected).toBeLessThan(1e-12);
    expectFinitePoints(converted!.points, CALIFORNIA_THREE.length);
  });

  it("returns metres for a CRS in metres, with the same points as transformLonLatArrayToProjected", async () => {
    const row = await catalogRow("EPSG:6674");

    const converted = await transformLonLatToCandidate(row, KYOTO_GCPS);
    expect(converted).not.toBeNull();
    expect(converted!.unit).toEqual({ name: "metre", metresPerUnit: 1 });
    expect(converted!.points).toEqual(await transformLonLatArrayToProjected(row, KYOTO_GCPS));
  });

  it("returns null for a geographic CRS, whose axes are in degrees and not in a linear unit", async () => {
    // 地理座標系の 2 軸はどちらも degree で、換算係数は「1 度が何ラジアンか」である。
    // これは metre への倍率ではないので、線形単位として返してはならない。
    for (const definition of ["OGC:CRS84", "+proj=longlat +datum=WGS84 +type=crs"]) {
      const target = { id: definition, proj4: definition };
      await expect(transformLonLatToCandidate(target, KYOTO_THREE)).resolves.toBeNull();
      await expect(transformLonLatArrayToProjected(target, KYOTO_THREE)).resolves.toBeNull();
    }
  });

  it("returns null for a pipeline row that declares no unit", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");
    const withoutUnit = { id: zoneB.id, proj4: zoneB.proj4 };

    await expect(transformLonLatToCandidate(withoutUnit, KYOTO_THREE)).resolves.toBeNull();
    await expect(transformLonLatArrayToProjected(withoutUnit, KYOTO_THREE)).resolves.toBeNull();
  });

  it("carries the unit of a user projection definition", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");
    const [row] = await listProjectedCrsFromProjWasm({
      extent: KYOTO_EXTENT,
      area: "Atlas test grid",
      userProjection: dataUrl({
        authority: "ATLAS-TEST",
        code: "GRID",
        name: "Atlas test grid zone",
        areaName: "Atlas test grid zone",
        deprecated: false,
        bbox: { west: 131, south: 24, east: 139, north: 46 },
        pipeline: zoneB.proj4,
        unit: { name: "yard (Japan City Plans)", metresPerUnit: YARD_OF_THE_HISTORICAL_GRID },
      }),
    });
    expect(row?.definitionType).toBe("user");
    expect(row?.unit).toEqual({
      name: "yard (Japan City Plans)",
      metresPerUnit: YARD_OF_THE_HISTORICAL_GRID,
    });

    const converted = await transformLonLatToCandidate(row!, KYOTO_THREE);
    const builtIn = await transformLonLatToCandidate(zoneB, KYOTO_THREE);
    expect(converted).not.toBeNull();
    expect(converted!.unit).toEqual({
      name: "yard (Japan City Plans)",
      metresPerUnit: YARD_OF_THE_HISTORICAL_GRID,
    });
    expect(converted!.points).toEqual(builtIn!.points);

    // 正しい `unit` の行は、transformer でも今までどおり点列と単位を返す。
    const transformer = createCandidateTransformer([row!]);
    const transformed = await transformer(row!.id, KYOTO_THREE, LONLAT);
    expect(transformed).not.toBeNull();
    expect(Array.isArray(transformed)).toBe(false);
    expect((transformed as { unit: LinearUnit }).unit).toEqual(converted!.unit);
  });

  it("returns null for a user projection definition without a unit", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");
    const [row] = await listProjectedCrsFromProjWasm({
      extent: KYOTO_EXTENT,
      area: "Atlas test grid",
      userProjection: dataUrl({
        authority: "ATLAS-TEST",
        code: "NO-UNIT",
        name: "Atlas test grid without a unit",
        areaName: "Atlas test grid zone",
        deprecated: false,
        bbox: { west: 131, south: 24, east: 139, north: 46 },
        pipeline: zoneB.proj4,
      }),
    });
    expect(row?.definitionType).toBe("user");
    expect(row?.unit).toBeUndefined();

    await expect(transformLonLatToCandidate(row!, KYOTO_THREE)).resolves.toBeNull();
  });

  it("returns null for a user pipeline row whose unit is not a linear unit", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");
    // JSON には NaN と Infinity が無い（どちらも `null` として書かれる）。有限性の検査は、
    // 行を直接渡す下の 2 回で確かめる。
    const units = [
      { name: "", metresPerUnit: -1 },
      { name: "yard", metresPerUnit: 0 },
      { name: "yard", metresPerUnit: "0.9144" },
    ];

    for (const [index, unit] of units.entries()) {
      const [row] = await listProjectedCrsFromProjWasm({
        extent: KYOTO_EXTENT,
        area: "Atlas test grid",
        userProjection: dataUrl({
          authority: "ATLAS-TEST",
          code: `BAD-UNIT-${index}`,
          name: `Atlas test grid with a unit ${index}`,
          areaName: "Atlas test grid zone",
          deprecated: false,
          bbox: { west: 131, south: 24, east: 139, north: 46 },
          pipeline: zoneB.proj4,
          unit,
        }),
      });
      expect(row?.definitionType).toBe("user");

      await expect(transformLonLatToCandidate(row!, KYOTO_THREE)).resolves.toBeNull();

      const transformer = createCandidateTransformer([row!]);
      await expect(transformer(row!.id, KYOTO_THREE, LONLAT)).resolves.toBeNull();
    }

    // `metresPerUnit` が number でない・有限でない場合も線形単位ではない。
    for (const metresPerUnit of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const row = { id: "ATLAS-TEST:BAD-UNIT", proj4: zoneB.proj4, unit: { name: "yard", metresPerUnit } };
      await expect(transformLonLatToCandidate(row, KYOTO_THREE)).resolves.toBeNull();
      const transformer = createCandidateTransformer([row]);
      await expect(transformer(row.id, KYOTO_THREE, LONLAT)).resolves.toBeNull();
    }
  });

  it("returns null for an empty list, a non-finite point and a definition that cannot be read", async () => {
    const row = await catalogRow("EPSG:6674");

    await expect(transformLonLatToCandidate(row, [])).resolves.toBeNull();
    await expect(
      transformLonLatToCandidate(row, [KYOTO_THREE[0], [Number.NaN, 35.0]]),
    ).resolves.toBeNull();
    await expect(
      transformLonLatToCandidate({ id: "missing", proj4: "+proj=not-a-projection" }, KYOTO_THREE),
    ).resolves.toBeNull();
  });

  it("hands out a unit a caller can change without changing the next result", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");

    const first = await transformLonLatToCandidate(zoneB, KYOTO_THREE);
    first!.unit.name = "changed by the caller";
    first!.unit.metresPerUnit = 42;
    first!.points[0][0] = 0;

    const second = await transformLonLatToCandidate(zoneB, KYOTO_THREE);
    expect(second!.unit).toEqual({
      name: "yard (Japan City Plans)",
      metresPerUnit: YARD_OF_THE_HISTORICAL_GRID,
    });
    expect(second!.points[0][0]).not.toBe(0);
  });
});

describe("createCandidateTransformer with units", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("returns the points and the unit for a row whose unit is not metre", async () => {
    const rows = await kyotoCatalog();
    const transformer = createCandidateTransformer(rows);

    const result = await transformer("UTJCP:ZONE-B", KYOTO_THREE, LONLAT);
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(false);
    const converted = result as { points: Array<[number, number]>; unit: LinearUnit };
    expect(converted.unit).toEqual({
      name: "yard (Japan City Plans)",
      metresPerUnit: YARD_OF_THE_HISTORICAL_GRID,
    });
    expectFinitePoints(converted.points, KYOTO_THREE.length);
  });

  it("returns a plain point list for a row in metres", async () => {
    const rows = await kyotoCatalog();
    const transformer = createCandidateTransformer(rows);
    const row = rows.find((candidate) => candidate.id === "EPSG:6674")!;

    const result = await transformer("EPSG:6674", KYOTO_GCPS, LONLAT);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(await transformLonLatArrayToProjected(row, KYOTO_GCPS));
  });

  it("returns null for a geographic CRS row, whose axes are in degrees", async () => {
    const transformer = createCandidateTransformer([{ id: "geographic", proj4: "OGC:CRS84" }]);
    await expect(transformer("geographic", KYOTO_GCPS, LONLAT)).resolves.toBeNull();
  });

  it("is not changed by a caller that changes an earlier result", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");
    const transformer = createCandidateTransformer([zoneB]);

    const first = await transformer("UTJCP:ZONE-B", KYOTO_THREE, LONLAT) as {
      points: Array<[number, number]>;
      unit: LinearUnit;
    };
    const originalUnit = { ...first.unit };
    const originalFirstPoint = [...first.points[0]] as [number, number];
    first.unit.name = "changed by the caller";
    first.unit.metresPerUnit = 42;
    first.points[0][0] = 0;

    const second = await transformer("UTJCP:ZONE-B", KYOTO_THREE, LONLAT) as {
      points: Array<[number, number]>;
      unit: LinearUnit;
    };
    expect(second.unit).toEqual(originalUnit);
    expect(second.points[0]).toEqual(originalFirstPoint);
    expect(second.points).not.toBe(first.points);
  });

  it("keeps the unit it was created with when the caller changes the rows later", async () => {
    const zoneB = await catalogRow("UTJCP:ZONE-B");
    const rows = [{ id: zoneB.id, proj4: zoneB.proj4, unit: { ...zoneB.unit! } }];
    const transformer = createCandidateTransformer(rows);

    rows[0].unit.name = "changed by the caller";
    rows[0].unit.metresPerUnit = 42;

    const result = await transformer("UTJCP:ZONE-B", KYOTO_THREE, LONLAT) as {
      points: Array<[number, number]>;
      unit: LinearUnit;
    };
    expect(result.unit).toEqual({
      name: "yard (Japan City Plans)",
      metresPerUnit: YARD_OF_THE_HISTORICAL_GRID,
    });
  });
});

/**
 * 逆向き（`PJ_INV`）に流した pipeline の後に、proj-wasm の実行時が答え続けるかを見る。
 * このファイルの前のテストは、同じ process で格子の変換を何度も行っている。
 */
describe("the runtime after a pipeline has been run backwards", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  const CALL_TIMEOUT_MS = 60_000;

  async function listWithTimeout(options: Parameters<typeof listProjectedCrsFromProjWasm>[0]): Promise<ProjectedCrsInfo[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        listProjectedCrsFromProjWasm(options),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`the search did not answer within ${CALL_TIMEOUT_MS} ms`)),
            CALL_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  it(
    "answers consecutive searches after the grid conversions",
    async () => {
      const calls = [
        { extent: KYOTO_EXTENT },
        { extent: KYOTO_EXTENT, area: "Japan", includeCustomProjections: true },
        { extent: KYOTO_EXTENT },
      ];

      const ids: string[][] = [];
      for (const options of calls) {
        const rows = await listWithTimeout(options);
        expect(rows.length).toBeGreaterThan(0);
        ids.push(rows.map((row) => row.id));
      }

      expect(ids[0]).toContain("EPSG:6674");
      expect(ids[1]).toContain("UTJCP:ZONE-B");
      expect(ids[2]).toEqual(ids[0]);
    },
    CALL_TIMEOUT_MS * 3 + 30_000,
  );
});
