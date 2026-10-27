import type { CandidateCrsExtent } from "./crs-types.ts";
import { PjCache, withPj } from "./proj-handle.ts";
import { projWasmExclusions } from "./proj-wasm-exclusions.ts";

/** 座標の線形単位。`metresPerUnit` は 1 単位が何 metre か。 */
export interface LinearUnit {
  name: string;
  metresPerUnit: number;
}

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
  /**
   * 格子の単位（定義ファイルの `unit`）。custom / user の pipeline の行にだけ付き、
   * proj.db の行には付かない（proj.db の行の単位は PROJ の軸情報から取る）。
   */
  unit?: LinearUnit;
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
  /**
   * Keep proj.db rows whose CRS is defined on another celestial body (the Moon, Mars, ... :
   * most of the IAU_2015 authority and a few ESRI rows). Default `false`.
   *
   * They are left out by default because the source of every transformation is WGS 84 (the Earth):
   * PROJ has no operation from the Earth to them, and with the bundled proj-wasm runtime the
   * exceptions this raises pile up until the runtime stops answering. The test uses the celestial
   * body proj.db gives for the CRS (`ellipsoid.celestial_body_auth_name/code` -> `celestial_body.name`,
   * reported as `celestialBodyName`), so no PROJ object is created for the rows left out.
   *
   * When you keep them, do not pass such rows in bulk to `transformLonLatArrayToProjected`, nor
   * through `createCandidateTransformer` to the `estimateCrs` of Teiresias (`estimateCrs` transforms
   * every candidate it is given).
   */
  includeOtherCelestialBodies?: boolean;
  onshoreOnly?: boolean;
  bboxPaddingDeg?: number;
  includeCustomProjections?: boolean;
  userProjection?: string | URL;
  /** @deprecated Use userProjection with a file://, https://, or data: URI. */
  userProjectionFile?: string;
  projWasmAssetBaseUrl?: string | URL;
  /**
   * Called once per search with the proj.db rows that matched the search but were left out:
   * rows of another celestial body (reason `Not on the Earth (celestial body: <name>)`, unless
   * `includeOtherCelestialBodies` is set) and rows whose PROJ string cannot be exported by the
   * bundled proj-wasm runtime (reason `Unsupported conversion method: ...`).
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
  /**
   * Name of the celestial body of the CRS (from proj.db: ellipsoid -> celestial_body), e.g. `Earth`, `Moon`.
   * A row without it (a synthetic row of a custom projection) is treated as on the Earth.
   */
  celestialBodyName?: string | null;
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
  /** 格子の単位。pipeline の行には必須（無いと変換できない）。 */
  unit?: LinearUnit;
}

interface CustomProjectionFile {
  projections: CustomProjectionDefinition[];
}

const PJ_TYPE_PROJECTED_CRS = 15;
/** `celestial_body.name` of the Earth in proj.db (PROJ's `Ellipsoid::EARTH`). */
const EARTH_CELESTIAL_BODY_NAME = "Earth";

function otherCelestialBodyName(row: ProjDatabaseRow): string | undefined {
  const name = row.celestialBodyName;
  if (typeof name !== "string" || name.length === 0) return undefined;
  return name === EARTH_CELESTIAL_BODY_NAME ? undefined : name;
}

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
 * `transformLonLatArrayToProjected` の source 側 CRS。
 *
 * proj 文字列で pipeline を作ると、CRS の coordinate system 自体が `[Easting, Northing]`
 * として構築される（proj-wasm で実測）。authority 文字列（`EPSG:4326`）を source にすると
 * 入力が `[lat, lon]` 順を要求され、誤ると `Infinity` が返る ∴ 文字列経路に固定する。
 */
const LONLAT_WGS84_PROJ_STRING = "+proj=longlat +datum=WGS84 +no_defs +type=crs";

let initPromise: Promise<void> | undefined;
let projWasmModulePromise: Promise<typeof import("proj-wasm")> | undefined;
let builtInCustomProjectionPromise: Promise<CustomProjectionDefinition[]> | undefined;
let projWasmAssetResolverInstalled = false;

/**
 * proj.db の行の一覧と、行ごとの展開結果（WKT2・PROJ 文字列）を 1 process の中で使い回す。
 *
 * proj-wasm 0.1.0-alpha8 では、PROJ object を `proj_destroy` で解放しても取り戻せない資源が
 * 作成のたびに残り、約 22 万回で wasm のメモリ上限（2 GiB）に当たって以後の検索が
 * `SQLite error [ out of memory ]` で落ちる。`area` なしの検索は 1 回で数百〜約 2,200 行（地球以外の天体を含めたとき）を展開するので、
 * 毎回作り直すと約 100 回の検索で落ちる。展開結果は proj.db と proj-wasm の版で決まる
 * （同じ process の中では変わらない）ので、同じ行の PJ は 1 回しか作らない。
 * 作成の回数は proj.db の投影 CRS の行数（8,820）で頭打ちになる。
 */
let crsInfoListPromise: Promise<ProjDatabaseRow[]> | undefined;
const expandedProjectedCrsCache = new Map<string, Promise<ProjectedCrsInfo>>();

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

function copyProjectedCrsInfo(info: ProjectedCrsInfo): ProjectedCrsInfo {
  return { ...info, bbox: { ...info.bbox } };
}

/** 行の展開結果を使い回す。失敗した行は覚えず、次の呼び出しで作り直す。 */
async function expandProjectedCrsInfoOnce(row: ProjDatabaseRow): Promise<ProjectedCrsInfo> {
  const id = `${row.authName}:${row.code}`;
  let pending = expandedProjectedCrsCache.get(id);
  if (pending === undefined) {
    pending = expandProjectedCrsInfo(row);
    expandedProjectedCrsCache.set(id, pending);
    pending.catch(() => {
      if (expandedProjectedCrsCache.get(id) === pending) expandedProjectedCrsCache.delete(id);
    });
  }
  return copyProjectedCrsInfo(await pending);
}

async function listProjDatabaseRows(proj: typeof import("proj-wasm")): Promise<ProjDatabaseRow[]> {
  if (!crsInfoListPromise) {
    crsInfoListPromise = proj.projGetCrsInfoListFromDatabase({}) as Promise<ProjDatabaseRow[]>;
    crsInfoListPromise.catch(() => {
      crsInfoListPromise = undefined;
    });
  }
  return crsInfoListPromise;
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
    // The definitions are loaded once per process, so hand out copies: a caller that changes a
    // result row must not change the definition used by later searches.
    bbox: { ...definition.bbox },
    wkt2: definition.wkt2 ?? null,
    proj4,
    pipeline: definition.pipeline,
    isApproximate: definition.isApproximate ?? false,
    source: [...(definition.source ?? [])],
    ...(definition.unit === undefined ? {} : { unit: { ...definition.unit } }),
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
  const includeOtherCelestialBodies = options.includeOtherCelestialBodies ?? false;
  const onshoreOnly = options.onshoreOnly ?? false;

  return rows.filter((row) => {
    const normalizedAreaName = row.areaName.toLowerCase();

    if (row.type !== PJ_TYPE_PROJECTED_CRS) return false;
    if (!row.bboxValid) return false;
    if (!includeDeprecated && row.deprecated) return false;
    if (!includeOtherCelestialBodies && otherCelestialBodyName(row) !== undefined) return false;
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

  const rows = await listProjDatabaseRows(proj);
  const matched = filterProjectedCrsRows(rows, { ...options, includeOtherCelestialBodies: true });
  const includeOtherCelestialBodies = options.includeOtherCelestialBodies ?? false;
  const resultMap = new Map<string, ProjectedCrsInfo>();

  const excluded: ProjectedCrsExclusion[] = [];
  const expandable = matched.filter((row) => {
    const id = `${row.authName}:${row.code}`;
    const bodyName = otherCelestialBodyName(row);
    if (!includeOtherCelestialBodies && bodyName !== undefined) {
      excluded.push({ id, name: row.name, reason: `Not on the Earth (celestial body: ${bodyName})` });
      return false;
    }
    const reason = PROJ4_UNAVAILABLE_REASONS.get(id);
    if (reason === undefined) return true;
    excluded.push({ id, name: row.name, reason });
    return false;
  });
  options.onExcluded?.(excluded);

  const projDbResults = await Promise.all(expandable.map((row) => expandProjectedCrsInfoOnce(row)));
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
 * target の定義を 1 回だけ読んで、CRS かどうか・CRS なら座標の線形単位を返す。
 *
 * - CRS でない定義（pipeline。例: 同梱の custom projection の行）は `kind: "non-crs"`。
 *   その行は「格子 → lon/lat（度）」の向きの pipeline なので、逆向き（`PJ_INV`）に流す。
 * - PROJ が読めない定義は `kind: "unreadable"`（業務的に変換不能）。
 * - CRS でも、軸が east / north の 2 次元でない・両軸の単位が同じ線形単位でないときは `unit: null`。
 *   pipeline（CoordinateOperation）を `projCreateCrsToCrs` の target に渡しても **throw しない**。
 *   コンソールエラーだけを出して `undefined` を resolve し、それを `projTransArray` へ渡すと
 *   wasm ヒープ故障になる（proj-wasm で実測）∴ 生成前に弾く必要がある。
 */
type ProjTargetKind = "crs" | "non-crs" | "unreadable";

interface ProjTargetInspection {
  kind: ProjTargetKind;
  /** east / north の 2 次元 CRS で、両軸の単位が同じ線形単位のときだけ。 */
  unit: LinearUnit | null;
}

/**
 * 定義の文字列ごとに 1 回だけ PJ を作って確かめ、単位まで覚えておく
 * （解放しても戻らない資源を、同じ target への変換のたびに使わないため）。
 * 検証が throw したとき（実行時の失敗）は結果を覚えず、次の呼び出しで確かめ直す。
 */
const targetUnitCache = new Map<string, Promise<ProjTargetInspection>>();

function inspectTargetOnce(proj: typeof import("proj-wasm"), definition: string): Promise<ProjTargetInspection> {
  let pending = targetUnitCache.get(definition);
  if (pending === undefined) {
    const created = inspectTarget(proj, definition);
    pending = created;
    targetUnitCache.set(definition, created);
    created.catch(() => {
      if (targetUnitCache.get(definition) === created) targetUnitCache.delete(definition);
    });
  }
  return pending;
}

/**
 * proj-wasm の呼び出しが「定義を読めない」以外の理由で throw したとき（メモリが尽きたなど）は、
 * そのまま throw する。
 */
async function inspectTarget(
  proj: typeof import("proj-wasm"),
  definition: string,
): Promise<ProjTargetInspection> {
  try {
    return await readTarget(proj, definition);
  } catch (error) {
    if (isUnreadableDefinitionError(error)) return { kind: "unreadable", unit: null };
    throw error;
  }
}

async function readTarget(
  proj: typeof import("proj-wasm"),
  definition: string,
): Promise<ProjTargetInspection> {
  return withPj(proj, () => proj.projCreate({ definition }), async (pj) => {
    if (pj === undefined || pj === null) return { kind: "unreadable", unit: null };
    if (!(await proj.projIsCrs({ obj: pj }))) return { kind: "non-crs", unit: null };

    return withPj(proj, () => proj.projCrsGetCoordinateSystem({ crs: pj }), async (cs) => {
      if (cs === undefined || cs === null) return { kind: "crs", unit: null };
      if ((await proj.projCsGetAxisCount({ cs })) !== 2) return { kind: "crs", unit: null };

      const axes: ProjAxisInfo[] = [
        (await proj.projCsGetAxisInfo({ cs, index: 0 })) as ProjAxisInfo,
        (await proj.projCsGetAxisInfo({ cs, index: 1 })) as ProjAxisInfo,
      ];

      if (axes[0]?.direction !== "east" || axes[1]?.direction !== "north") {
        return { kind: "crs", unit: null };
      }

      return { kind: "crs", unit: linearUnitOfAxes(axes) };
    });
  });
}

/** 同じ線形単位と見なす 2 つの換算係数の相対の許容差。同じ単位なら PROJ は同じ値を返す。 */
const UNIT_FACTOR_RELATIVE_TOLERANCE = 1e-12;

/**
 * 2 軸の単位が同じ線形単位のときだけその単位を返す。片方でも欠けている・換算係数が正の有限値で
 * ない・2 軸で違うときは `null`（業務的に変換不能）。
 */
function linearUnitOfAxes(axes: ProjAxisInfo[]): LinearUnit | null {
  const [east, north] = axes as [ProjAxisInfo, ProjAxisInfo];
  if (typeof east.unitName !== "string" || east.unitName.length === 0) return null;
  if (east.unitName !== north.unitName) return null;

  for (const axis of axes) {
    if (!Number.isFinite(axis.unitConvFactor) || axis.unitConvFactor <= 0) return null;
  }

  const larger = Math.max(Math.abs(east.unitConvFactor), Math.abs(north.unitConvFactor));
  if (Math.abs(east.unitConvFactor - north.unitConvFactor) > larger * UNIT_FACTOR_RELATIVE_TOLERANCE) return null;

  return { name: east.unitName, metresPerUnit: east.unitConvFactor };
}

/** 1 単位が 1 metre で、名前が metre の単位か（metre の候補の返却は今までと同じ形にする）。 */
function isMetreUnit(unit: LinearUnit): boolean {
  return unit.metresPerUnit === 1 && unit.name === "metre";
}

/**
 * PROJ が「定義を読めない」と答えた例外か。proj-wasm 0.1.0-alpha8 は PROJ の C++ 例外を
 * `new Error(message)` に包み、型名は worker の stack の先頭行（`osgeo::proj::io::ParsingException: …`）
 * にだけ残す。定義の誤り（構文・値・未知の authority code）を表す 2 つの型だけを業務的な失敗とみなし、
 * それ以外（SQLite の out of memory を含む FactoryException、wasm のメモリの枯渇など）は実装側の失敗とする。
 * 型名が stack に無い実行環境では、読めない定義も throw になる（黙って null にするより安全な側）。
 */
const UNREADABLE_DEFINITION_ERROR = /^osgeo::proj::io::(?:ParsingException|NoSuchAuthorityCodeException)\b/;

function isUnreadableDefinitionError(error: unknown): boolean {
  return error instanceof Error && UNREADABLE_DEFINITION_ERROR.test(error.stack ?? "");
}

/**
 * PROJ が「source から target への変換が無い」と答えた例外か（例: target が月や火星の CRS で、
 * 地球の lon/lat から変換できない）。これは業務的に変換不能である。型名の読み方は上と同じ。
 */
const NO_OPERATION_ERROR = /^osgeo::proj::util::UnsupportedOperationException\b/;

function isNoOperationError(error: unknown): boolean {
  return error instanceof Error && NO_OPERATION_ERROR.test(error.stack ?? "");
}

/** pipeline を作れないと PROJ が答えた target。作り直しを試さないよう覚えておく（定義の文字列ごと）。 */
const targetsWithoutOperation = new Set<string>();

/**
 * 変換の pipeline（lon/lat → target）の PJ を target の定義の文字列ごとに保持して使い回す。
 * source は常に `LONLAT_WGS84_PROJ_STRING` なので、target の文字列だけで決まる。
 * 上限は `area` なしの検索が返しうる行の数（地球以外の天体を含めて約 2,200）を余裕をもって覆う数にしてある。
 * 上限を越えると最も古い PJ を解放する（作り直すと解放しても戻らない資源をまた使うので、
 * 普段の使い方では追い出しが起きない大きさにする）。
 */
const PIPELINE_CACHE_CAPACITY = 4096;
const pipelineCache = new PjCache<string>(PIPELINE_CACHE_CAPACITY);

/** `transformLonLatToCandidate` の返却（1 回の変換で決まる点列と単位）。 */
interface CandidateTransform {
  points: Array<[number, number]>;
  unit: LinearUnit;
}

/**
 * lon/lat（度・lon-lat 順）の点列を、候補の座標へ変換し、単位を添えて返す。
 *
 * - CRS: 軸が east / north の 2 次元で、両軸の単位が同じ線形単位（換算係数が正の有限値・単位名が
 *   同じ）のときだけ変換する。単位は PROJ の軸情報から取る（metre なら
 *   `{ name: "metre", metresPerUnit: 1 }`）。
 * - CRS でない pipeline（custom / user の行の「格子 → lon/lat（度）」の向きの定義）: 行の `unit` を
 *   添えて、pipeline を逆向き（`PJ_INV`）に流す。行に `unit` が無ければ `null`（業務的に変換不能）。
 * - 空入力・非有限の入力・非有限の出力・上の条件に合わない target は `null`（部分成功はしない）。
 *   実装側の理由で変換できないとき（PJ を作れない・proj-wasm の呼び出しが throw する。wasm の
 *   メモリが尽きた場合を含む）は `null` にせず throw する。
 * - 出力は入力と同数・同順で `[x, y]` 順（CRS なら easting / northing、pipeline なら格子の座標）。
 * - 返す `unit` は写しである。書き換えても次の呼び出しの結果は変わらない。
 *
 * 本 export は **`lonlat_deg` / lon-lat 順の入力専用**である。`planar_xy` 入力の
 * 実 engine 経路は持たない。
 */
export async function transformLonLatToCandidate(
  target: Pick<ProjectedCrsInfo, "id" | "proj4"> & Partial<Pick<ProjectedCrsInfo, "unit">>,
  points: ReadonlyArray<readonly [number, number]>,
  options?: TransformLonLatToProjectedOptions,
): Promise<{ points: Array<[number, number]>; unit: LinearUnit } | null> {
  const converted = await transformLonLatToCandidateOnce(target, points, options);
  if (converted === null) return null;
  return { points: converted.points, unit: { ...converted.unit } };
}

/**
 * lon/lat（度・lon-lat 順）の点列を、target CRS の投影座標 `[easting, northing]` へ一括変換する。
 *
 * 変換は `transformLonLatToCandidate` が行う。本 export はその結果のうち、単位が metre
 * （`name` が `metre` で `metresPerUnit` が 1）のときだけ点列を返し、それ以外は `null` を返す。
 *
 * 契約:
 * - (3) 返却は常に `[easting, northing]` 順である（proj 文字列 pipeline により機構で保証する）。
 * - (4) 空入力・業務的に変換不能な target は `null`。
 * - (5) 部分成功はしない。入力または出力に非有限成分が 1 つでもあれば全体 `null`。
 * - (7) `null` は業務的に変換不能なとき（上の (4)(5)）だけに使う。実装側の理由で変換できない
 *   とき（PJ を作れない・proj-wasm の呼び出しが throw する。wasm のメモリが尽きた場合を含む）は
 *   `null` にせず throw する。
 * - (8) 出力は入力と同数・同順。
 *
 * 本 export は **`lonlat_deg` / lon-lat 順の入力専用**である。`planar_xy` 入力の
 * 実 engine 経路は持たない。
 */
export async function transformLonLatArrayToProjected(
  target: Pick<ProjectedCrsInfo, "id" | "proj4">,
  points: ReadonlyArray<readonly [number, number]>,
  options?: TransformLonLatToProjectedOptions,
): Promise<Array<[number, number]> | null> {
  const converted = await transformLonLatToCandidate(target, points, options);
  if (converted === null) return null;
  return isMetreUnit(converted.unit) ? converted.points : null;
}

async function transformLonLatToCandidateOnce(
  target: Pick<ProjectedCrsInfo, "id" | "proj4"> & Partial<Pick<ProjectedCrsInfo, "unit">>,
  points: ReadonlyArray<readonly [number, number]>,
  options?: TransformLonLatToProjectedOptions,
): Promise<CandidateTransform | null> {
  // step 1: 入力検査（契約 (4)(5)）
  if (points.length === 0) return null;
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
  }

  await ensureProjInitialized(options);
  const proj = await loadProjWasm();

  // step 2: target の定義を読む（CRS か pipeline か・CRS なら単位）
  const inspection = await inspectTargetOnce(proj, target.proj4);

  if (inspection.kind === "unreadable") return null;

  if (inspection.kind === "crs") {
    const unit = inspection.unit;
    if (unit === null) return null;

    // step 3: pipeline 取得（proj 文字列 → proj 文字列）。target ごとに 1 つ作って使い回す。
    //   PROJ が「変換が無い」と答えた target は null（業務的に変換不能）。それ以外の理由で
    //   作れない・変換できないときは throw する（契約 (7)）。
    const transformed = await transformWithCrsOnce(proj, target.proj4, points);
    return transformed === null ? null : { points: transformed, unit };
  }

  // step 3': CRS でない pipeline。格子の単位は定義ファイルの行にしかない。
  const unit = target.unit;
  if (unit === undefined) return null;

  const transformed = await transformWithPipelineOnce(proj, target.proj4, points);
  return transformed === null ? null : { points: transformed, unit: { ...unit } };
}

/**
 * 定義の CRS へ lon/lat から変換する（`projCreateCrsToCrs` の CRS → CRS の変換を、`PJ_FWD` で流す）。
 * 変換の PJ は定義の文字列ごとに使い回す。
 */
function transformWithCrsOnce(
  proj: typeof import("proj-wasm"),
  definition: string,
  points: ReadonlyArray<readonly [number, number]>,
): Promise<Array<[number, number]> | null> {
  if (targetsWithoutOperation.has(definition)) return Promise.resolve(null);

  return pipelineCache.use(proj, definition, () => proj.projCreateCrsToCrs({
    source_crs: LONLAT_WGS84_PROJ_STRING,
    target_crs: definition,
  }), (operation) => transformPointsOnce(proj, operation, points, proj.PJ_FWD)
  ).catch((error: unknown) => {
    if (!isNoOperationError(error)) throw error;
    targetsWithoutOperation.add(definition);
    return null;
  });
}

/**
 * 定義の pipeline を逆向き（`PJ_INV`）に流す。`pipeline:` の接頭辞で、CRS → CRS の変換の key と
 * 混ざらないようにする。PROJ が定義を読めない・変換が無いと答えたときは `null`（業務的に変換不能）。
 */
function transformWithPipelineOnce(
  proj: typeof import("proj-wasm"),
  definition: string,
  points: ReadonlyArray<readonly [number, number]>,
): Promise<Array<[number, number]> | null> {
  const key = `pipeline:${definition}`;
  return pipelineCache.use(proj, key, () => proj.projCreate({ definition }),
    (operation) => transformPointsOnce(proj, operation, points, proj.PJ_INV),
  ).catch((error: unknown) => {
    if (!isUnreadableDefinitionError(error) && !isNoOperationError(error)) throw error;
    return null;
  });
}

/**
 * 一括変換（座標配列は JS 側の Float64Array で、wasm 側の解放は要らない）。
 * 1 点でも非有限なら全体 `null`（契約 (5)）。入力と同数・同順で返す（契約 (8)）。
 */
async function transformPointsOnce(
  proj: typeof import("proj-wasm"),
  operation: unknown,
  points: ReadonlyArray<readonly [number, number]>,
  direction: number,
): Promise<Array<[number, number]> | null> {
  const coords = await proj.coordArray(points.length);
  await proj.setCoords(
    coords,
    points.map(([lon, lat]) => [lon, lat, 0, 0] as const),
  );
  await proj.projTransArray({
    p: operation,
    direction,
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
}

/** The geo basis of the points given to a candidate transformer (structurally compatible with Teiresias' `GeoBasis`). */
export type AtlasGeoBasisLike = { kind: string; axisOrder?: string };

/** A transformer with the same shape as Teiresias' `CandidateTransformer`. */
export type AtlasCandidateTransformer = (
  id: string,
  points: ReadonlyArray<readonly [number, number]>,
  geoBasis: AtlasGeoBasisLike,
) => Promise<Array<[number, number]> | { points: Array<[number, number]>; unit: LinearUnit } | null>;

/** The part of a candidate row that `createCandidateTransformer` keeps. */
type CandidateTransformerRow = Pick<ProjectedCrsInfo, "id" | "proj4"> & Partial<Pick<ProjectedCrsInfo, "unit">>;

/**
 * Builds a candidate transformer from candidate rows (for example the result of
 * `listProjectedCrsFromProjWasm`), so the rows can be passed to Teiresias' `estimateCrs`
 * without Atlas depending on Teiresias.
 *
 * - Points must be lon/lat degrees in lon-lat order (`{ kind: "lonlat_deg", axisOrder: "lon-lat" }`);
 *   any other geo basis gives `null`.
 * - An id that is not among `rows` gives `null`.
 * - Otherwise the result is `transformLonLatToCandidate(row, points)`: a plain point list when the
 *   unit is metre (the same result as `transformLonLatArrayToProjected`), and `{ points, unit }`
 *   when the row gives another unit (for example the yard of a historical grid).
 * - What the conversion throws (a failure on the implementation side, never an untransformable
 *   target) is passed on.
 * - The rows are copied when the transformer is created, `unit` included; changing them later has
 *   no effect, and neither does changing an earlier result.
 */
export function createCandidateTransformer(
  rows: ReadonlyArray<CandidateTransformerRow>,
  options?: TransformLonLatToProjectedOptions,
): AtlasCandidateTransformer {
  const byId = new Map<string, CandidateTransformerRow>();
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      proj4: row.proj4,
      ...(row.unit === undefined ? {} : { unit: { ...row.unit } }),
    });
  }

  return async (id, points, geoBasis) => {
    if (geoBasis.kind !== "lonlat_deg" || geoBasis.axisOrder !== "lon-lat") return null;
    const target = byId.get(id);
    if (target === undefined) return null;

    const converted = await transformLonLatToCandidate(target, points, options);
    if (converted === null) return null;
    return isMetreUnit(converted.unit)
      ? converted.points
      : { points: converted.points, unit: converted.unit };
  };
}
