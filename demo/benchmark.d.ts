import type {
  BenchmarkPlace,
  BenchmarkResult,
  BenchmarkRuntime,
  CrsGroup,
  CrsScope,
} from "./benchmark-engine.js";

/** The benchmark arithmetic the page calls (a test can replace it). */
export interface BenchmarkEngineModule {
  CRS_GROUPS: readonly CrsGroup[];
  CRS_TARGET_IDS: readonly string[];
  crsScopeIds(scope?: CrsScope | null): string[];
  selectPoints(
    places: readonly BenchmarkPlace[],
    options?: { category?: string; pointLimit?: number | "all" },
  ): BenchmarkPlace[];
  runBenchmark(options: {
    places: readonly BenchmarkPlace[];
    workCount: number;
    targetIds: readonly string[];
    runtime: BenchmarkRuntime;
    projWasm: unknown;
    proj4js: unknown;
  }): Promise<BenchmarkResult>;
}

export interface BenchmarkProvenance {
  title?: string;
  summary?: string;
  attribution?: string;
  processedNotice?: string;
  retrievedAt?: string;
  sources?: Array<{
    name?: string;
    version?: string;
    pageUrl?: string;
    attribution?: string;
  }>;
}

export interface BenchmarkState {
  ready: boolean;
  running: boolean;
  activePreset: string | null;
  placeCount: number;
  result: BenchmarkResult | null;
  error: string | null;
  status: string;
}

export interface BenchmarkHandle {
  whenSettled(): Promise<void>;
  getState(): BenchmarkState;
}

export function initBenchmark(config?: {
  runtime?: BenchmarkRuntime & { initializeProjWasmRuntime(options?: { projWasmAssetBaseUrl?: string | URL }): Promise<void> | void };
  doc?: unknown;
  engine?: BenchmarkEngineModule;
  data?: { places: BenchmarkPlace[]; provenance: BenchmarkProvenance };
  modules?: { projWasm: unknown; proj4js: unknown };
}): BenchmarkHandle;
