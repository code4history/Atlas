import type { ListProjectedCrsFromProjWasmOptions, ProjectedCrsInfo } from "../src/proj-wasm-crs.ts";

export interface DemoRuntime {
  initializeProjWasmRuntime(options?: { projWasmAssetBaseUrl?: string | URL }): Promise<void> | void;
  listProjectedCrsFromProjWasm(options: ListProjectedCrsFromProjWasmOptions): Promise<ProjectedCrsInfo[]>;
}

export interface DemoState {
  activePreset: string | null;
  markers: [number, number][];
  rows: ProjectedCrsInfo[];
  runtimeReady: boolean;
  areaFilterEnabled: boolean;
  areaMode: string;
  includeCustomProjections: boolean;
  includeDeprecated: boolean;
  onshoreOnly: boolean;
}

export interface DemoHandle {
  whenSettled(): Promise<void>;
  getState(): DemoState;
}

export function initDemo(config?: { runtime?: DemoRuntime; doc?: unknown }): DemoHandle;
