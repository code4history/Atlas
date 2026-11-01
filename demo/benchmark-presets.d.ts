import type { CrsScope } from "./benchmark-engine.js";

export interface BenchmarkPresetInput {
  category: string;
  pointLimit: number | "all";
  laps: number;
  crsScope: CrsScope;
}

export interface BenchmarkPresetOption {
  id: string;
  label: string;
  expectation: string;
  input: BenchmarkPresetInput;
}

export interface BenchmarkPresetContrast {
  id: string;
  title: string;
  options: BenchmarkPresetOption[];
}

export const ENGINE_COVERAGE_EXPECTATION: string;
export const BENCHMARK_PRESETS: readonly BenchmarkPresetContrast[];
export const NEUTRAL_EXPECTATION: string;
export function findBenchmarkPreset(
  presetId: string,
  optionId: string,
): BenchmarkPresetOption | undefined;
export function presetWorkCount(input: BenchmarkPresetInput, pointCount: number): number;
