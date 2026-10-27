// @vitest-environment jsdom
/// <reference lib="dom" />
/**
 * Benchmark page wiring (jsdom, injected runtime, injected engines, injected dataset).
 *
 * The DOM is built by reading `demo/benchmark.html` itself, so renamed ids in the page break
 * this test. `runBenchmark` is a stub, so no proj-wasm work happens here; the real engines are
 * covered by `tests/benchmark-engine.test.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { initBenchmark } from "../demo/benchmark.js";
import * as benchmarkEngine from "../demo/benchmark-engine.js";
import type { BenchmarkResult, BenchmarkPlace } from "../demo/benchmark-engine.js";
import { ENGINE_COVERAGE_EXPECTATION, NEUTRAL_EXPECTATION } from "../demo/benchmark-presets.js";
import { version as packageVersion } from "../package.json";

const testsDir = dirname(fileURLToPath(import.meta.url));
const pageHtml = readFileSync(join(testsDir, "..", "demo", "benchmark.html"), "utf8");
const bodyInner = /<body[^>]*>([\s\S]*)<\/body>/i.exec(pageHtml)?.[1];

const PLACES: BenchmarkPlace[] = [
  { category: "mountain-summit", name: "小楢山", lon: 138.664198, lat: 35.781533 },
  { category: "mountain-summit", name: "茅ヶ岳", lon: 138.513772, lat: 35.795014 },
  { category: "mountain-summit", name: "鶏冠山", lon: 138.835644, lat: 35.788483 },
  { category: "mountain-summit", name: "大菩薩嶺", lon: 138.845506, lat: 35.748762 },
  { category: "mountain-summit", name: "小金沢山", lon: 138.856623, lat: 35.716946 },
  { category: "mountain-summit", name: "富士山＜剣ヶ峯＞", lon: 138.727373, lat: 35.360738 },
  { category: "extreme-point", name: "最東端（東京都 南鳥島）", lon: 153.986667, lat: 24.283056 },
  { category: "extreme-point", name: "最西端（沖縄県 与那国島）", lon: 122.9325, lat: 24.451389 },
];

const PROVENANCE = { title: "テスト用の出典", attribution: "出典：テスト" };

function mountPage(): void {
  if (bodyInner === undefined) throw new Error("cannot read <body> of benchmark.html");
  document.body.innerHTML = bodyInner.replace(/<script[\s\S]*?<\/script>/gi, "");
}

function fakeResult(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  const stats = { totalMs: 1.5, success: 6, failure: 0, meanErrorMeters: 1e-9, maxErrorMeters: 2e-9, failures: [] };
  return {
    pointCount: 6,
    workCount: 6,
    laps: 1,
    targetIds: ["EPSG:2451"],
    searchCount: 1,
    forwardDifferenceMaxMeters: 1e-7,
    rows: [
      {
        id: "EPSG:2451",
        name: "JGD2000 / Japan Plane Rectangular CS IX",
        found: true,
        status: "ok",
        workCount: 6,
        projWasm: { ...stats },
        proj4js: { ...stats },
        forwardDifferenceMaxMeters: 1e-7,
      },
    ],
    totals: {
      projWasm: { totalMs: 1.5, success: 6, failure: 0 },
      proj4js: { totalMs: 1.5, success: 6, failure: 0 },
    },
    ...overrides,
  };
}

function makeRuntime() {
  return {
    initializeProjWasmRuntime: vi.fn<() => Promise<void>>(async () => undefined),
    listProjectedCrsFromProjWasm: vi.fn(async () => []),
  };
}

/** The arguments the page hands to the benchmark arithmetic. */
interface RunOptions {
  places: readonly BenchmarkPlace[];
  workCount: number;
  targetIds: readonly string[];
  runtime?: unknown;
  projWasm?: unknown;
  proj4js?: unknown;
}

function makeEngine() {
  const runBenchmark = vi.fn(async (_options: RunOptions): Promise<BenchmarkResult> => fakeResult());
  return { ...benchmarkEngine, runBenchmark };
}

type Engine = ReturnType<typeof makeEngine>;

function value(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "";
}

function text(id: string): string {
  return document.getElementById(id)?.textContent ?? "";
}

function pressedButtons(): string[] {
  return [...document.querySelectorAll<HTMLButtonElement>("#preset-bar button[aria-pressed='true']")].map(
    (button) => button.dataset.preset ?? "",
  );
}

function clickPreset(preset: string, option: string): void {
  const button = document.querySelector<HTMLButtonElement>(`[data-preset="${preset}:${option}"]`);
  if (!button) throw new Error(`preset button ${preset}:${option} is missing`);
  button.click();
}

async function start(options: {
  runtime?: ReturnType<typeof makeRuntime>;
  engine?: Engine;
} = {}) {
  const runtime = options.runtime ?? makeRuntime();
  const engine = options.engine ?? makeEngine();
  const benchmark = initBenchmark({
    runtime,
    doc: document,
    engine,
    data: { places: PLACES, provenance: PROVENANCE },
    modules: { projWasm: {}, proj4js: () => undefined },
  });
  await benchmark.whenSettled();
  return { benchmark, engine, runtime };
}

describe("benchmark wiring: initialization", () => {
  beforeEach(() => {
    mountPage();
  });

  it("keeps the run button disabled until every initialization has finished", async () => {
    let finishInit: (() => void) | undefined;
    const runtime = makeRuntime();
    runtime.initializeProjWasmRuntime.mockImplementation(
      () => new Promise<void>((resolve) => { finishInit = resolve; }),
    );
    const engine = makeEngine();
    const benchmark = initBenchmark({
      runtime,
      doc: document,
      engine,
      data: { places: PLACES, provenance: PROVENANCE },
      modules: { projWasm: {}, proj4js: () => undefined },
    });

    const runButton = document.getElementById("run-button") as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);
    expect(text("init-status")).not.toBe("");

    // Let the page reach its first `await` before answering the pending initialization.
    await new Promise((resolve) => setTimeout(resolve, 0));
    finishInit?.();
    await benchmark.whenSettled();

    expect(runButton.disabled).toBe(false);
    expect(engine.runBenchmark).not.toHaveBeenCalled();
  });

  it("shows the package version in the footer", async () => {
    await start();
    expect(text("version")).toContain(`@c4h/atlas ${packageVersion}`);
  });
});

describe("benchmark wiring: preset buttons", () => {
  beforeEach(() => {
    mountPage();
  });

  it("button engine-coverage:a fills the controls with the preset input and runs once", async () => {
    const { benchmark, engine } = await start();

    clickPreset("engine-coverage", "a");
    await benchmark.whenSettled();

    expect(value("category")).toBe("mountain-summit");
    expect(value("point-limit")).toBe("all");
    expect(value("crs-scope")).toBe("crs");
    expect(value("crs-id")).toBe("EPSG:2451");
    expect(value("work-count")).toBe("6");

    expect(engine.runBenchmark).toHaveBeenCalledTimes(1);
    const call = engine.runBenchmark.mock.calls[0][0];
    expect(call.workCount).toBe(6);
    expect(call.targetIds).toEqual(["EPSG:2451"]);
    expect(call.places).toHaveLength(6);
    expect(call.places.every((place: BenchmarkPlace) => place.category === "mountain-summit")).toBe(true);

    expect(pressedButtons()).toEqual(["engine-coverage:a"]);
    expect(text("preset-expectation")).toBe(ENGINE_COVERAGE_EXPECTATION);
  });

  it("button engine-coverage:b uses the same points and the historical grid", async () => {
    const { benchmark, engine } = await start();

    clickPreset("engine-coverage", "b");
    await benchmark.whenSettled();

    expect(value("category")).toBe("mountain-summit");
    expect(value("point-limit")).toBe("all");
    expect(value("crs-scope")).toBe("crs");
    expect(value("crs-id")).toBe("UTJCP:ZONE-B");
    expect(value("work-count")).toBe("6");

    expect(engine.runBenchmark).toHaveBeenCalledTimes(1);
    const call = engine.runBenchmark.mock.calls[0][0];
    expect(call.targetIds).toEqual(["UTJCP:ZONE-B"]);
    expect(call.places).toHaveLength(6);
    expect(pressedButtons()).toEqual(["engine-coverage:b"]);
  });

  it("goes back to neutral when a control is changed by hand", async () => {
    const { benchmark, engine } = await start();

    clickPreset("engine-coverage", "a");
    await benchmark.whenSettled();
    expect(pressedButtons()).toEqual(["engine-coverage:a"]);

    const category = document.getElementById("category") as HTMLSelectElement;
    category.value = "extreme-point";
    category.dispatchEvent(new Event("change", { bubbles: true }));

    expect(pressedButtons()).toEqual([]);
    expect(text("preset-expectation")).toBe(NEUTRAL_EXPECTATION);
    expect(engine.runBenchmark).toHaveBeenCalledTimes(1);
  });
});

describe("benchmark wiring: results", () => {
  beforeEach(() => {
    mountPage();
  });

  it("shows the summary, the row of every CRS and the forward difference", async () => {
    const { benchmark } = await start();

    clickPreset("engine-coverage", "a");
    await benchmark.whenSettled();

    expect(text("results-body")).toContain("EPSG:2451");
    expect(text("results-body")).toContain("JGD2000 / Japan Plane Rectangular CS IX");
    expect(text("result-summary")).toContain("6");
    expect(text("forward-diff")).not.toBe("-");
  });

  it("lists the failure message of an engine that could not read a definition", async () => {
    const engine = makeEngine();
    engine.runBenchmark.mockResolvedValue(fakeResult({
      rows: [
        {
          id: "UTJCP:ZONE-B",
          name: "Japan City Plans Polyconic Grid Zone B",
          found: true,
          status: "failed",
          workCount: 2,
          projWasm: { totalMs: 1, success: 2, failure: 0, meanErrorMeters: 0.002, maxErrorMeters: 0.003, failures: [] },
          proj4js: {
            totalMs: 0,
            success: 0,
            failure: 2,
            meanErrorMeters: null,
            maxErrorMeters: null,
            failures: [
              { index: 0, lon: 138.7, lat: 35.3, message: "Could not get projection name from: +proj=pipeline ..." },
              { index: 1, lon: 138.8, lat: 35.4, message: "Could not get projection name from: +proj=pipeline ..." },
            ],
          },
          forwardDifferenceMaxMeters: null,
        },
      ],
      workCount: 2,
      targetIds: ["UTJCP:ZONE-B"],
    }));
    const { benchmark } = await start({ engine });

    clickPreset("engine-coverage", "b");
    await benchmark.whenSettled();

    expect(text("failure-details")).toContain("proj4js");
    expect(text("failure-details")).toContain("Could not get projection name from");
    expect(text("results-body")).toContain("failed");
  });
});
