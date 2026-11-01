import type { ListProjectedCrsFromProjWasmOptions, ProjectedCrsInfo } from "../src/proj-wasm-crs.ts";

/** One point of the bundled dataset. */
export interface BenchmarkPlace {
  category: string;
  name: string;
  lon: number;
  lat: number;
  sourceId?: string;
  sourceUrl?: string;
}

/** The CRS to benchmark: everything, one group, or one CRS. */
export interface CrsScope {
  kind: "all" | "group" | "crs";
  groupId?: string;
  id?: string;
}

export interface CrsGroup {
  id: string;
  label: string;
  ids: readonly string[];
}

/** One point that did not go through both directions. */
export interface BenchmarkFailure {
  index: number;
  lon: number;
  lat: number;
  message: string;
}

/** What one engine did on one CRS. */
export interface BenchmarkEngineStats {
  totalMs: number;
  success: number;
  failure: number;
  meanErrorMeters: number | null;
  maxErrorMeters: number | null;
  failures: BenchmarkFailure[];
}

/** One row of the result table. */
export interface BenchmarkRowResult {
  id: string;
  name: string;
  found: boolean;
  status: "ok" | "failed" | "not-found";
  workCount: number;
  projWasm: BenchmarkEngineStats;
  proj4js: BenchmarkEngineStats;
  forwardDifferenceMaxMeters: number | null;
}

export interface BenchmarkResult {
  pointCount: number;
  workCount: number;
  laps: number;
  targetIds: string[];
  searchCount: number;
  forwardDifferenceMaxMeters: number | null;
  rows: BenchmarkRowResult[];
  totals: {
    projWasm: { totalMs: number; success: number; failure: number };
    proj4js: { totalMs: number; success: number; failure: number };
  };
}

/** The part of the Atlas runtime the benchmark needs. */
export interface BenchmarkRuntime {
  listProjectedCrsFromProjWasm(options: ListProjectedCrsFromProjWasmOptions): Promise<ProjectedCrsInfo[]>;
}

export interface BenchmarkRowLookup {
  rows: Map<string, ProjectedCrsInfo>;
  searches: number;
}

export const LONLAT_WGS84_DEFINITION: string;
export const DEFAULT_MAX_SEARCHES: number;
export const CRS_GROUPS: readonly CrsGroup[];
export const CRS_TARGET_IDS: readonly string[];

export function crsScopeIds(scope?: CrsScope | null): string[];
export function selectPoints(
  places: readonly BenchmarkPlace[],
  options?: { category?: string; pointLimit?: number | "all" },
): BenchmarkPlace[];
export function buildWorkSequence<T>(places: readonly T[], workCount: number): T[];
export function lapsFor(pointCount: number, workCount: number): number;
export function distanceMeters(
  from: readonly [number, number],
  to: readonly [number, number],
): number;
export function searchPlaces<T>(places: readonly T[], maxSearches?: number): T[];
export function findCrsRows(options: {
  runtime: BenchmarkRuntime;
  places: readonly BenchmarkPlace[];
  targetIds: readonly string[];
  maxSearches?: number;
}): Promise<BenchmarkRowLookup>;

export function runProjWasmEngine(options: {
  projWasm: unknown;
  row: Pick<ProjectedCrsInfo, "id" | "proj4">;
  sequence: readonly BenchmarkPlace[];
  now?: () => number;
}): Promise<{ stats: BenchmarkEngineStats; forward: Array<[number, number] | null> }>;

export function runProj4Engine(options: {
  proj4js: unknown;
  row: Pick<ProjectedCrsInfo, "id" | "proj4">;
  sequence: readonly BenchmarkPlace[];
  now?: () => number;
}): { stats: BenchmarkEngineStats; forward: Array<[number, number] | null> };

export function runBenchmark(options: {
  places: readonly BenchmarkPlace[];
  /** Where to search for the Atlas rows (defaults to `places`); the page passes the whole dataset. */
  catalogPlaces?: readonly BenchmarkPlace[];
  workCount: number;
  targetIds: readonly string[];
  runtime: BenchmarkRuntime;
  projWasm: unknown;
  proj4js: unknown;
  maxSearches?: number;
  now?: () => number;
}): Promise<BenchmarkResult>;
