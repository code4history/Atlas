import type { CandidateCrsExtent } from "./crs-types.ts";
import { withPj } from "./proj-handle.ts";
import { projWasmExclusions } from "./proj-wasm-exclusions.ts";

export interface ProjectedCrsInfo {
  id: string;
  authority: string;
  code: string;
  name: string;
  areaName: string;
  deprecated: boolean;
  bbox: CandidateCrsExtent;
  wkt2: string | null;
  proj4: string;
  pipeline?: string;
  isApproximate?: boolean;
  source?: string[];
  definitionType?: "projdb" | "custom" | "user";
}

/** A proj.db row that matched the search but was left out of the result, with the reason. */
export interface ProjectedCrsExclusion {
  id: string;
  name: string;
  reason: string;
}

export interface ListProjectedCrsFromProjWasmOptions {
  extent: CandidateCrsExtent;
  area?: string;
  includeDeprecated?: boolean;
  onshoreOnly?: boolean;
  bboxPaddingDeg?: number;
  includeCustomProjections?: boolean;
  userProjection?: string | URL;
  /** @deprecated Use userProjection with a file://, https://, or data: URI. */
  userProjectionFile?: string;
  projWasmAssetBaseUrl?: string | URL;
  /**
   * Called once per search with the proj.db rows that matched the search but were left out
   * because their PROJ string cannot be exported by the bundled proj-wasm runtime.
   */
  onExcluded?: (excluded: ProjectedCrsExclusion[]) => void;
}

export interface InitializeProjWasmRuntimeOptions {
  projWasmAssetBaseUrl?: string | URL;
}

export interface TransformLonLatToProjectedOptions {
  projWasmAssetBaseUrl?: string | URL;
}

export interface ProjDatabaseRow {
  authName: string;
  code: string;
  name: string;
  type: number;
  deprecated: boolean;
  bboxValid: boolean;
  westLonDegree: number;
  southLatDegree: number;
  eastLonDegree: number;
  northLatDegree: number;
  areaName: string;
}

export interface CustomProjectionDefinition {
  authority: string;
  code: string;
  name: string;
  areaName: string;
  deprecated: boolean;
  bbox: CandidateCrsExtent;
  proj4?: string;
  pipeline?: string;
  wkt2?: string | null;
  isApproximate?: boolean;
  source?: string[];
}

interface CustomProjectionFile {
  projections: CustomProjectionDefinition[];
}

const PJ_TYPE_PROJECTED_CRS = 15;

/**
 * proj-wasm の実行時で書き出すと例外になる行（`scripts/generate-proj-wasm-exclusions.mjs` で実測）。
 * PROJ（C++）の例外は wasm の外へ抜け、重なると実行時が壊れて以後の呼び出しも失敗する
 * ∴ 例外になる書き出しは wasm に渡す前に避ける。
 */
const WKT2_UNAVAILABLE_IDS = new Set<string>(projWasmExclusions.wkt2Unavailable);
const PROJ4_UNAVAILABLE_REASONS = new Map<string, string>(
  projWasmExclusions.proj4Unavailable.map((entry) => [entry.id, entry.reason]),
);

/**
 * `transformLonLatArrayToProjected` の source 側 CRS（m2a-t1 設計 §4.2 step 3）。
 *
 * proj 文字列で pipeline を作ると、CRS の coordinate system 自体が `[Easting, Northing]`
 * として構築される（設計 §3.2 の実測）。authority 文字列（`EPSG:4326`）を source にすると
 * 入力が `[lat, lon]` 順を要求され、誤ると `Infinity` が返る ∴ 文字列経路に固定する。
 */
const LONLAT_WGS84_PROJ_STRING = "+proj=longlat +datum=WGS84 +no_defs +type=crs";

let initPromise: Promise<void> | undefined;
let projWasmModulePromise: Promise<typeof import("proj-wasm")> | undefined;
let builtInCustomProjectionPromise: Promise<CustomProjectionDefinition[]> | undefined;
let projWasmAssetResolverInstalled = false;

const BUILTIN_CUSTOM_PROJECTIONS_URL = new URL("../data/crs/custom-projections.json", import.meta.url);
const PROJ_WASM_RUNTIME_ASSETS = [
  "proj.db",
  "proj.ini",
  "proj-worker.mjs",
  "fetch-worker.mjs",
  "proj-emscripten.js",
  "proj-emscripten.wasm",
];

function isBrowserRuntime(): boolean {
  return typeof (globalThis as { document?: unknown }).document !== "undefined";
}

function defaultRuntimeAssetBaseUrl(): URL {
  const url = new URL(import.meta.url);
  url.pathname = url.pathname.replace(/[^/]*$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

function installProjWasmAssetResolver(assetBaseUrl: string | URL = defaultRuntimeAssetBaseUrl()): void {
  if (!isBrowserRuntime() || projWasmAssetResolverInstalled || typeof fetch !== "function") {
    return;
  }

  const baseUrl = typeof assetBaseUrl === "string"
    ? new URL(assetBaseUrl, import.meta.url)
    : assetBaseUrl;
  (globalThis as { __ATLAS_PROJ_WASM_ASSET_BASE_URL__?: string }).__ATLAS_PROJ_WASM_ASSET_BASE_URL__ = baseUrl.href;
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    const locationHref = (globalThis as { location?: { href: string } }).location?.href ?? import.meta.url;
    const pathname = new URL(url, locationHref).pathname;
    const assetName = PROJ_WASM_RUNTIME_ASSETS.find((asset) => pathname.endsWith(`/${asset}`));

    if (assetName) {
      const assetUrl = new URL(assetName, baseUrl);
      const response = await originalFetch(assetUrl, init);
      if (assetName === "proj.db") {
        const contentLength = Number(response.headers.get("content-length") ?? 0);
        const byteLength = contentLength || (await response.clone().arrayBuffer()).byteLength;
        if (byteLength < 1_000_000) {
          throw new Error(
            `Resolved proj.db from ${assetUrl.href}, but received only ${byteLength} bytes. ` +
            "Restart the Vite dev server and verify that the proj-wasm runtime assets are served from the demo assets path.",
          );
        }
      }
      return response;
    }

    return originalFetch(input, init);
  };

  projWasmAssetResolverInstalled = true;
}

function loadProjWasm(): Promise<typeof import("proj-wasm")> {
  if (!projWasmModulePromise) {
    projWasmModulePromise = import("proj-wasm");
  }

  return projWasmModulePromise;
}

async function ensureProjInitialized(options?: Pick<ListProjectedCrsFromProjWasmOptions, "projWasmAssetBaseUrl">): Promise<void> {
  if (!initPromise) {
    installProjWasmAssetResolver(options?.projWasmAssetBaseUrl);
    initPromise = loadProjWasm().then((proj) => proj.init({ workers: 1 }));
  }

  return initPromise!;
}

function normalizeLongitudeSegments(west: number, east: number): Array<[number, number]> {
  if (west <= east) {
    return [[west, east]];
  }

  return [
    [west, 180],
    [-180, east],
  ];
}

function bboxContainsExtent(bbox: CandidateCrsExtent, extent: CandidateCrsExtent): boolean {
  if (bbox.south > extent.south || bbox.north < extent.north) {
    return false;
  }

  const bboxSegments = normalizeLongitudeSegments(bbox.west, bbox.east);
  const extentSegments = normalizeLongitudeSegments(extent.west, extent.east);

  return extentSegments.every(([extentWest, extentEast]) =>
    bboxSegments.some(([bboxWest, bboxEast]) =>
      bboxWest <= extentWest && bboxEast >= extentEast
    ));
}

function padExtent(extent: CandidateCrsExtent, paddingDeg: number): CandidateCrsExtent {
  if (paddingDeg <= 0) {
    return extent;
  }

  return {
    west: Math.max(-180, extent.west - paddingDeg),
    south: Math.max(-90, extent.south - paddingDeg),
    east: Math.min(180, extent.east + paddingDeg),
    north: Math.min(90, extent.north + paddingDeg),
  };
}

async function expandProjectedCrsInfo(row: ProjDatabaseRow): Promise<ProjectedCrsInfo> {
  const proj = await loadProjWasm();
  const id = `${row.authName}:${row.code}`;
  const [wkt2, proj4] = await withPj(proj, () => proj.projCreateFromDatabase({
    auth_name: row.authName,
    code: row.code,
    category: proj.PJ_CATEGORY_CRS,
  }), (pj) => Promise.all([
    WKT2_UNAVAILABLE_IDS.has(id)
      ? null
      : proj.projAsWkt({
        pj,
        type: proj.PJ_WKT2_2019,
        options: null,
      }),
    proj.projAsProjString({
      pj,
      type: proj.PJ_PROJ_5,
      options: null,
    }),
  ]));

  return {
    id,
    authority: row.authName,
    code: row.code,
    name: row.name,
    areaName: row.areaName,
    deprecated: row.deprecated,
    bbox: {
      west: row.westLonDegree,
      south: row.southLatDegree,
      east: row.eastLonDegree,
      north: row.northLatDegree,
    },
    wkt2,
    proj4,
    definitionType: "projdb",
  };
}

function createSyntheticProjRow(definition: CustomProjectionDefinition): ProjDatabaseRow {
  return {
    authName: definition.authority,
    code: definition.code,
    name: definition.name,
    type: PJ_TYPE_PROJECTED_CRS,
    deprecated: definition.deprecated,
    bboxValid: true,
    westLonDegree: definition.bbox.west,
    southLatDegree: definition.bbox.south,
    eastLonDegree: definition.bbox.east,
    northLatDegree: definition.bbox.north,
    areaName: definition.areaName,
  };
}

function expandCustomProjectedCrsInfo(
  definition: CustomProjectionDefinition,
  definitionType: "custom" | "user",
): ProjectedCrsInfo {
  const proj4 = definition.proj4 ?? definition.pipeline;
  if (!proj4) {
    throw new Error(`Custom projection ${definition.authority}:${definition.code} is missing proj4/pipeline text`);
  }

  return {
    id: `${definition.authority}:${definition.code}`,
    authority: definition.authority,
    code: definition.code,
    name: definition.name,
    areaName: definition.areaName,
    deprecated: definition.deprecated,
    bbox: definition.bbox,
    wkt2: definition.wkt2 ?? null,
    proj4,
    pipeline: definition.pipeline,
    isApproximate: definition.isApproximate ?? false,
    source: definition.source ?? [],
    definitionType,
  };
}

export function filterProjectedCrsRows(
  rows: ProjDatabaseRow[],
  options: ListProjectedCrsFromProjWasmOptions,
): ProjDatabaseRow[] {
  const areaQuery = options.area?.trim().toLowerCase();
  const bboxPaddingDeg = options.bboxPaddingDeg ?? 0.1;
  const includeDeprecated = options.includeDeprecated ?? false;
  const onshoreOnly = options.onshoreOnly ?? false;

  return rows.filter((row) => {
    const normalizedAreaName = row.areaName.toLowerCase();

    if (row.type !== PJ_TYPE_PROJECTED_CRS) return false;
    if (!row.bboxValid) return false;
    if (!includeDeprecated && row.deprecated) return false;
    if (areaQuery && !normalizedAreaName.includes(areaQuery)) return false;
    if (onshoreOnly && (!normalizedAreaName.includes("onshore") || normalizedAreaName.includes("onshore and offshore"))) {
      return false;
    }

    return bboxContainsExtent(padExtent({
      west: row.westLonDegree,
      south: row.southLatDegree,
      east: row.eastLonDegree,
      north: row.northLatDegree,
    }, bboxPaddingDeg), options.extent);
  });
}

export async function initializeProjWasmRuntime(
  options: InitializeProjWasmRuntimeOptions = {},
): Promise<void> {
  await ensureProjInitialized(options);
}

function decodeDataUrl(href: string): string {
  const match = href.match(/^data:.*?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error(`Unsupported data URL for custom projection resource: ${href}`);
  }

  if (match[1]) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(match[2], "base64").toString("utf8");
    }

    const binary = atob(match[2]);
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  }

  return decodeURIComponent(match[2]);
}

async function loadTextResource(resource: string | URL): Promise<string> {
  const url = typeof resource === "string"
    ? new URL(resource, import.meta.url)
    : resource;
  const href = url.href;

  if (href.startsWith("data:")) {
    return decodeDataUrl(href);
  }

  if (!href.startsWith("file:") && typeof fetch === "function") {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load projection resource ${href}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  const nodeFsPromises = "node:fs/promises";
  const { readFile } = await import(/* @vite-ignore */ nodeFsPromises) as typeof import("node:fs/promises");
  return readFile(url, "utf8");
}

async function loadCustomProjectionFile(resource: string | URL): Promise<CustomProjectionDefinition[]> {
  const raw = await loadTextResource(resource);
  const parsed = JSON.parse(raw) as CustomProjectionDefinition[] | CustomProjectionFile;
  return Array.isArray(parsed) ? parsed : parsed.projections;
}

async function loadBuiltInCustomProjections(): Promise<CustomProjectionDefinition[]> {
  if (!builtInCustomProjectionPromise) {
    builtInCustomProjectionPromise = loadCustomProjectionFile(BUILTIN_CUSTOM_PROJECTIONS_URL);
  }

  return builtInCustomProjectionPromise;
}

export async function listProjectedCrsFromProjWasm(
  options: ListProjectedCrsFromProjWasmOptions,
): Promise<ProjectedCrsInfo[]> {
  await ensureProjInitialized(options);
  const proj = await loadProjWasm();

  const rows = (await proj.projGetCrsInfoListFromDatabase({})) as ProjDatabaseRow[];
  const filtered = filterProjectedCrsRows(rows, options);
  const resultMap = new Map<string, ProjectedCrsInfo>();

  const excluded: ProjectedCrsExclusion[] = [];
  const expandable = filtered.filter((row) => {
    const id = `${row.authName}:${row.code}`;
    const reason = PROJ4_UNAVAILABLE_REASONS.get(id);
    if (reason === undefined) return true;
    excluded.push({ id, name: row.name, reason });
    return false;
  });
  options.onExcluded?.(excluded);

  const projDbResults = await Promise.all(expandable.map((row) => expandProjectedCrsInfo(row)));
  for (const row of projDbResults) {
    resultMap.set(row.id, row);
  }

  if (options.includeCustomProjections) {
    const builtIns = await loadBuiltInCustomProjections();
    for (const definition of builtIns) {
      const syntheticRow = createSyntheticProjRow(definition);
      if (!filterProjectedCrsRows([syntheticRow], options).length) continue;
      const expanded = expandCustomProjectedCrsInfo(definition, "custom");
      resultMap.set(expanded.id, expanded);
    }
  }

  const userProjectionResource = options.userProjection ?? options.userProjectionFile;
  if (userProjectionResource) {
    const userDefinitions = await loadCustomProjectionFile(userProjectionResource);
    for (const definition of userDefinitions) {
      const syntheticRow = createSyntheticProjRow(definition);
      if (!filterProjectedCrsRows([syntheticRow], options).length) continue;
      const expanded = expandCustomProjectedCrsInfo(definition, "user");
      resultMap.set(expanded.id, expanded);
    }
  }

  const results = [...resultMap.values()];
  results.sort((left, right) => left.id.localeCompare(right.id));
  return results;
}

/** `projCsGetAxisInfo` の返却（proj-wasm 0.1.0-alpha8 の実測形状）。 */
interface ProjAxisInfo {
  name: string;
  abbreviation: string;
  direction: string;
  unitConvFactor: number;
  unitName: string;
  unitAuthName: string;
  unitCode: string;
}

/**
 * target が「軸が east / north の順で、両軸とも metre の 2 次元 CRS」であるかを機構で検証する
 * （m2a-t1 設計 §4.2 step 2 / DEV-1）。
 *
 * - pipeline（CoordinateOperation）を `projCreateCrsToCrs` の target に渡しても **throw しない**。
 *   コンソールエラーだけを出して `undefined` を resolve し、それを `projTransArray` へ渡すと
 *   wasm ヒープ故障になる（設計 §3.3 の実測）∴ 生成前に弾く必要がある。
 * - native 単位が metre でない候補は単位換算せず変換不能へ落とす（m1-t1 からの申し送り）。
 */
async function isEastNorthMetreCrs(
  proj: typeof import("proj-wasm"),
  definition: string,
): Promise<boolean> {
  try {
    return await withPj(proj, () => proj.projCreate({ definition }), async (pj) => {
      if (!(await proj.projIsCrs({ obj: pj }))) return false;

      return withPj(proj, () => proj.projCrsGetCoordinateSystem({ crs: pj }), async (cs) => {
        if ((await proj.projCsGetAxisCount({ cs })) !== 2) return false;

        const axes: ProjAxisInfo[] = [
          (await proj.projCsGetAxisInfo({ cs, index: 0 })) as ProjAxisInfo,
          (await proj.projCsGetAxisInfo({ cs, index: 1 })) as ProjAxisInfo,
        ];

        if (axes[0]?.direction !== "east" || axes[1]?.direction !== "north") return false;

        return axes.every((axis) => axis.unitConvFactor === 1 && axis.unitName === "metre");
      });
    });
  } catch {
    return false;
  }
}

/**
 * lon/lat（度・lon-lat 順）の点列を、target CRS の投影座標 `[easting, northing]` へ一括変換する。
 *
 * m2a-t1 設計 §4 の契約:
 * - (3) 返却は常に `[easting, northing]` 順である（proj 文字列 pipeline により機構で保証する）。
 * - (4) 空入力・業務的に変換不能な target は `null`。
 * - (5) 部分成功はしない。入力または出力に非有限成分が 1 つでもあれば全体 `null`。
 * - (7) throw は実装 bug のときだけ。業務的失敗はすべて `null` へ落ちる。
 * - (8) 出力は入力と同数・同順。
 *
 * 本 export は **`lonlat_deg` / lon-lat 順の入力専用**である（設計 K3）。`planar_xy` 入力の
 * 実 engine 経路は本サイクルの範囲外である。
 */
export async function transformLonLatArrayToProjected(
  target: Pick<ProjectedCrsInfo, "id" | "proj4">,
  points: ReadonlyArray<readonly [number, number]>,
  options?: TransformLonLatToProjectedOptions,
): Promise<Array<[number, number]> | null> {
  // step 1: 入力検査（契約 (4)(5)）
  if (points.length === 0) return null;
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
  }

  await ensureProjInitialized(options);
  const proj = await loadProjWasm();

  // step 2: target 検証（DEV-1。CRS であること・軸順 east/north・両軸 metre）
  if (!(await isEastNorthMetreCrs(proj, target.proj4))) return null;

  // step 3: pipeline 生成（proj 文字列 → proj 文字列。軸順は生成方法で決まる。設計 §3.2）
  // step 4: 一括変換（座標配列は JS 側の Float64Array で、wasm 側の解放は要らない）
  // step 5: 出力検査（1 点でも非有限なら全体 null。契約 (5)）
  // pipeline の PJ は成功・失敗のどちらでも withPj が解放する。
  let result: Array<[number, number]> | null;
  try {
    result = await withPj(proj, () => proj.projCreateCrsToCrs({
      source_crs: LONLAT_WGS84_PROJ_STRING,
      target_crs: target.proj4,
    }), async (operation) => {
      const coords = await proj.coordArray(points.length);
      await proj.setCoords(
        coords,
        points.map(([lon, lat]) => [lon, lat, 0, 0] as const),
      );
      await proj.projTransArray({
        p: operation,
        direction: proj.PJ_FWD,
        n: points.length,
        coord: coords,
      });

      const transformed: Array<[number, number]> = [];
      for (let index = 0; index < points.length; index += 1) {
        const coordinate = await proj.getCoords(coords, index);
        const easting = coordinate?.[0];
        const northing = coordinate?.[1];
        if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
        transformed.push([easting as number, northing as number]);
      }
      return transformed;
    });
  } catch {
    return null;
  }

  // step 6: 入力と同数・同順で返却（契約 (8)）
  return result;
}

/** The geo basis of the points given to a candidate transformer (structurally compatible with Teiresias' `GeoBasis`). */
export type AtlasGeoBasisLike = { kind: string; axisOrder?: string };

/** A transformer with the same shape as Teiresias' `CandidateTransformer`. */
export type AtlasCandidateTransformer = (
  id: string,
  points: ReadonlyArray<readonly [number, number]>,
  geoBasis: AtlasGeoBasisLike,
) => Promise<Array<[number, number]> | null>;

/**
 * Builds a candidate transformer from candidate rows (for example the result of
 * `listProjectedCrsFromProjWasm`), so the rows can be passed to Teiresias' `estimateCrs`
 * without Atlas depending on Teiresias.
 *
 * - Points must be lon/lat degrees in lon-lat order (`{ kind: "lonlat_deg", axisOrder: "lon-lat" }`);
 *   any other geo basis gives `null`.
 * - An id that is not among `rows` gives `null`.
 * - Otherwise the result is `transformLonLatArrayToProjected(row, points)`.
 * - The rows are copied when the transformer is created; changing them later has no effect.
 */
export function createCandidateTransformer(
  rows: ReadonlyArray<Pick<ProjectedCrsInfo, "id" | "proj4">>,
  options?: TransformLonLatToProjectedOptions,
): AtlasCandidateTransformer {
  const byId = new Map(rows.map((row) => [row.id, { id: row.id, proj4: row.proj4 }]));
  return async (id, points, geoBasis) => {
    if (geoBasis.kind !== "lonlat_deg" || geoBasis.axisOrder !== "lon-lat") return null;
    const target = byId.get(id);
    if (target === undefined) return null;
    return transformLonLatArrayToProjected(target, points, options);
  };
}
