import type { CandidateCrsExtent } from "./crs-types.ts";

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
  const pj = await proj.projCreateFromDatabase({
    auth_name: row.authName,
    code: row.code,
    category: proj.PJ_CATEGORY_CRS,
  });

  const [wkt2, proj4] = await Promise.all([
    proj.projAsWkt({
      pj,
      type: proj.PJ_WKT2_2019,
      options: null,
    }),
    proj.projAsProjString({
      pj,
      type: proj.PJ_PROJ_5,
      options: null,
    }),
  ]);

  return {
    id: `${row.authName}:${row.code}`,
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

  const projDbResults = await Promise.all(filtered.map((row) => expandProjectedCrsInfo(row)));
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
