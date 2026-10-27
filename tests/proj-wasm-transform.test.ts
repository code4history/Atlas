/**
 * `transformLonLatArrayToProjected` の契約検証（m2a-t1 設計 v1.5 §4 / §7）。
 *
 * 対応 AC:
 * - m2a-t1/AC-2: 契約 (3)(4)(5)(7)(8)（空入力 / 非有限入力 / 非有限出力 / 生成不能 target /
 *   決定性 / 同数同順）
 * - m2a-t1/AC-3: 軸順を**独立な 3 証人**で示す
 * - m2a-t1/AC-4: 単位 gate（両軸が metre でない実在 CRS は `null`。単位換算しない）
 * - m2a-t1/AC-5: 非 CRS gate（Atlas custom projection の pipeline は `null`。throw しない）
 *
 * 本ファイルは PROJ の実 engine を通す。候補の `proj4` はハードコードせず、
 * `listProjectedCrsFromProjWasm`（実カタログ）と `projCreateFromDatabase`（実 DB）から取る。
 */
import { describe, expect, it } from "vitest";

import {
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
  type ProjectedCrsInfo,
} from "../src/proj-wasm-crs.ts";

/** 設計 §5.3 の GCP 5 点（京都近郊。lon/lat 度・lon-lat 順）。 */
const KYOTO_GCPS: ReadonlyArray<readonly [number, number]> = [
  [135.6, 34.9],
  [135.9, 34.9],
  [135.9, 35.1],
  [135.6, 35.1],
  [135.75, 35.0],
];

const KYOTO_EXTENT = { west: 135.6, south: 34.9, east: 135.9, north: 35.1 };

type TransformTarget = Pick<ProjectedCrsInfo, "id" | "proj4">;

let catalogDefaultPromise: Promise<ProjectedCrsInfo[]> | undefined;

/** 既定 padding の実カタログ（設計 §3.5.1 の実測では 5 件）。 */
function catalogDefault(): Promise<ProjectedCrsInfo[]> {
  if (!catalogDefaultPromise) {
    catalogDefaultPromise = listProjectedCrsFromProjWasm({
      extent: KYOTO_EXTENT,
      area: "Japan",
      onshoreOnly: true,
    });
  }
  return catalogDefaultPromise;
}

async function catalogTarget(id: string): Promise<TransformTarget> {
  const rows = await catalogDefault();
  const found = rows.find((row) => row.id === id);
  if (found === undefined) {
    throw new Error(`実カタログに ${id} が存在しない（候補: ${rows.map((r) => r.id).join(", ")}）`);
  }
  return { id: found.id, proj4: found.proj4 };
}

/** 実 proj.db から PROJ-5 文字列を取る（カタログ範囲外の CRS 用）。 */
async function databaseTarget(id: string): Promise<TransformTarget> {
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

/**
 * Tests here go through the real proj-wasm engine; the first one in a file also pays for its start-up.
 * Timeout = twice the longest test measured while Atlas, Daedalus and Teiresias ran their tests at
 * the same time (7756 ms, rounded up to whole seconds).
 */
const PROJ_WASM_TEST_TIMEOUT_MS = 16_000;

describe("m2a-t1/AC-2: transformLonLatArrayToProjected の契約 (3)(4)(5)(7)(8)", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("空入力は null を返す（契約 (4)）", async () => {
    const target = await catalogTarget("EPSG:6674");
    await expect(transformLonLatArrayToProjected(target, [])).resolves.toBeNull();
  });

  it("入力 1 点が非有限なら全体 null（部分成功なし。契約 (5)）", async () => {
    const target = await catalogTarget("EPSG:6674");
    const withNaN: ReadonlyArray<readonly [number, number]> = [
      KYOTO_GCPS[0],
      [Number.NaN, 35.0],
      KYOTO_GCPS[2],
    ];
    await expect(transformLonLatArrayToProjected(target, withNaN)).resolves.toBeNull();

    const withInfinity: ReadonlyArray<readonly [number, number]> = [
      KYOTO_GCPS[0],
      [135.7, Number.POSITIVE_INFINITY],
    ];
    await expect(transformLonLatArrayToProjected(target, withInfinity)).resolves.toBeNull();
  });

  it("出力 1 点が非有限なら全体 null（engine は部分成功を返す。契約 (5)）", async () => {
    const target = await catalogTarget("EPSG:6674");
    // lat=95 は定義域外。engine は当該要素だけ非有限にし、他 2 点は正常値を返す（設計 §3.3）。
    const outOfDomain: ReadonlyArray<readonly [number, number]> = [
      KYOTO_GCPS[0],
      [135.5, 95],
      KYOTO_GCPS[2],
    ];
    await expect(transformLonLatArrayToProjected(target, outOfDomain)).resolves.toBeNull();
  });

  it("生成不能な target は null を返し、throw しない（契約 (7)）", async () => {
    const broken: TransformTarget = { id: "TEST:BROKEN", proj4: "+proj=NOT_A_PROJ +type=crs" };
    await expect(transformLonLatArrayToProjected(broken, KYOTO_GCPS)).resolves.toBeNull();
  });

  it("同一入力を 2 回呼ぶと出力が完全一致する（決定性）", async () => {
    const target = await catalogTarget("EPSG:6674");
    const first = await transformLonLatArrayToProjected(target, KYOTO_GCPS);
    const second = await transformLonLatArrayToProjected(target, KYOTO_GCPS);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
  });

  it("出力は入力と同数・同順である（契約 (8)）", async () => {
    const target = await catalogTarget("EPSG:6674");
    const batch = await transformLonLatArrayToProjected(target, KYOTO_GCPS);
    expect(batch).not.toBeNull();
    expect(batch).toHaveLength(KYOTO_GCPS.length);

    // 1 点ずつ呼んだ結果と順序つきで完全一致する（並べ替えが起きていないことの独立確認）
    const individually: Array<[number, number]> = [];
    for (const point of KYOTO_GCPS) {
      const one = await transformLonLatArrayToProjected(target, [point]);
      expect(one).not.toBeNull();
      individually.push((one as Array<[number, number]>)[0]);
    }
    expect(batch).toEqual(individually);
  });
});

describe("m2a-t1/AC-3: 返却が [easting, northing] 順であること（独立 3 証人）", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  /**
   * tolerance の根拠（設計 §3.5.4 の該当行を転記する。行ごとに tolerance が違う）。
   *
   * #15 AC-3(ii) authority 経路との一致
   *   基準値 = 差 `0` m（実測・全桁一致）/ 変動源 1（実装間）= `0`
   *   変動源 2（PROJ 感度・`eps=1e-6` m）= 保守モデル `2e-6` m / 必要 `2e-6` m
   *   採用 tolerance = **`1e-3` m** / 下限余裕 **2.70 桁** / 上限余裕 8.0 桁（軸順取り違え `≈1e5` m）
   *
   * #16 AC-3(iii) `projNormalizeForVisualization` との一致
   *   基準値 = 差 `0` m（実測・全桁一致）/ 変動源 1 = `0`
   *   変動源 2 = 保守モデル `2e-6` m / 必要 `2e-6` m
   *   採用 tolerance = **`1e-3` m** / 下限余裕 **2.70 桁** / 上限余裕 8.0 桁（同上）
   *
   * 3 経路はいずれも同一 DB 行由来の同一パラメータ `tmerc` を通るため、現行ビルドでは差が
   * 厳密 `0` m である。しかし `EPSG:4326 → EPSG:6674` が将来のビルドで非恒等 datum 変換に
   * なれば差は m 級へ跳ぶ ∴ 共通モードを前提にせず保守モデルで tolerance を置く。
   */
  const AXIS_WITNESS_TOLERANCE_METERS = 1e-3;

  it("(i) proj 文字列由来 CRS の第1軸は east / 第2軸は north で、両軸とも metre である", async () => {
    const target = await catalogTarget("EPSG:6674");
    const proj = await import("proj-wasm");
    await proj.init();

    const pj = await proj.projCreate({ definition: target.proj4 });
    expect(await proj.projIsCrs({ obj: pj })).toBeTruthy();

    const cs = await proj.projCrsGetCoordinateSystem({ crs: pj });
    expect(await proj.projCsGetAxisCount({ cs })).toBe(2);

    const axis0 = await proj.projCsGetAxisInfo({ cs, index: 0 });
    const axis1 = await proj.projCsGetAxisInfo({ cs, index: 1 });
    expect(axis0.direction).toBe("east");
    expect(axis1.direction).toBe("north");
    expect(axis0.unitName).toBe("metre");
    expect(axis1.unitName).toBe("metre");
    expect(axis0.unitConvFactor).toBe(1);
    expect(axis1.unitConvFactor).toBe(1);
  });

  it("(ii) authority 経路（EPSG:4326 → EPSG:6674）の成分 swap と 1e-3 m 以内で一致する", async () => {
    const target = await catalogTarget("EPSG:6674");
    const ours = await transformLonLatArrayToProjected(target, KYOTO_GCPS);
    expect(ours).not.toBeNull();

    const proj = await import("proj-wasm");
    await proj.init();
    const op = await proj.projCreateCrsToCrs({ source_crs: "EPSG:4326", target_crs: "EPSG:6674" });

    // authority 経路は source も target も DB 由来 ∴ 入力は [lat, lon]、出力は [northing, easting]
    const coords = await proj.coordArray(KYOTO_GCPS.length);
    await proj.setCoords(
      coords,
      KYOTO_GCPS.map(([lon, lat]) => [lat, lon, 0, 0] as const),
    );
    await proj.projTransArray({
      p: op,
      direction: proj.PJ_FWD,
      n: KYOTO_GCPS.length,
      coord: coords,
    });

    for (let index = 0; index < KYOTO_GCPS.length; index += 1) {
      const [northing, easting] = await proj.getCoords(coords, index);
      const [ourEasting, ourNorthing] = (ours as Array<[number, number]>)[index];
      expect(Math.abs(ourEasting - easting)).toBeLessThan(AXIS_WITNESS_TOLERANCE_METERS);
      expect(Math.abs(ourNorthing - northing)).toBeLessThan(AXIS_WITNESS_TOLERANCE_METERS);
    }
  });

  it("(iii) projNormalizeForVisualization の出力と 1e-3 m 以内で一致する", async () => {
    const target = await catalogTarget("EPSG:6674");
    const ours = await transformLonLatArrayToProjected(target, KYOTO_GCPS);
    expect(ours).not.toBeNull();

    const proj = await import("proj-wasm");
    await proj.init();
    const authorityOp = await proj.projCreateCrsToCrs({
      source_crs: "EPSG:4326",
      target_crs: "EPSG:6674",
    });
    // 引数名は `obj` でのみ動作する（設計 §3.2 の実測）
    const normalized = await proj.projNormalizeForVisualization({ obj: authorityOp });

    const coords = await proj.coordArray(KYOTO_GCPS.length);
    await proj.setCoords(
      coords,
      KYOTO_GCPS.map(([lon, lat]) => [lon, lat, 0, 0] as const),
    );
    await proj.projTransArray({
      p: normalized,
      direction: proj.PJ_FWD,
      n: KYOTO_GCPS.length,
      coord: coords,
    });

    for (let index = 0; index < KYOTO_GCPS.length; index += 1) {
      const [easting, northing] = await proj.getCoords(coords, index);
      const [ourEasting, ourNorthing] = (ours as Array<[number, number]>)[index];
      expect(Math.abs(ourEasting - easting)).toBeLessThan(AXIS_WITNESS_TOLERANCE_METERS);
      expect(Math.abs(ourNorthing - northing)).toBeLessThan(AXIS_WITNESS_TOLERANCE_METERS);
    }
  });
});

describe("m2a-t1/AC-4: 単位 gate（metre でない実在 CRS は null）", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("EPSG:2225（US survey foot）は null を返し、単位換算した値を返さない", async () => {
    const target = await databaseTarget("EPSG:2225");
    // 実 DB 由来の proj4 が US survey foot であることを先に確かめる（gate の前提の可視化）
    expect(target.proj4).toContain("+units=us-ft");

    await expect(
      transformLonLatArrayToProjected(target, [[-121.5, 40.5]]),
    ).resolves.toBeNull();
  });
});

describe("m2a-t1/AC-5: 非 CRS gate（custom projection の pipeline は null）", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("UTJCP:ZONE-B の pipeline を target にすると null を返し、throw しない", async () => {
    const rows = await listProjectedCrsFromProjWasm({
      includeCustomProjections: true,
      area: "Japan City Plans - Historical Grid",
      extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
    });
    const zoneB = rows.find((row) => row.id === "UTJCP:ZONE-B");
    expect(zoneB).toBeDefined();
    expect((zoneB as ProjectedCrsInfo).definitionType).toBe("custom");
    // custom は proj4 に pipeline がそのまま入る（Atlas/src/proj-wasm-crs.ts:255）
    expect((zoneB as ProjectedCrsInfo).proj4).toContain("+proj=pipeline");

    await expect(
      transformLonLatArrayToProjected(zoneB as ProjectedCrsInfo, [[135.5, 34.7]]),
    ).resolves.toBeNull();
  });
});
