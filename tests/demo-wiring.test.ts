// @vitest-environment jsdom
/// <reference lib="dom" />
/**
 * Demo page wiring (jsdom, injected stub runtime).
 *
 * The DOM is built by reading `demo/crs-candidate-lookup.html` itself, so renamed ids in the
 * page break this test. The lookup runtime is injected, so no proj-wasm work happens here;
 * the real engine is covered by `tests/demo-presets.test.ts`.
 *
 * jsdom has no 2D canvas (`getContext` returns `null`), so the page must keep working without
 * a drawing context. Only `getBoundingClientRect` is given a size, because jsdom has no layout.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { initDemo } from "../demo/main.js";
import { PRESETS, buildLookupOptions } from "../demo/presets.js";
import { version as packageVersion } from "../package.json";

const testsDir = dirname(fileURLToPath(import.meta.url));
const pageHtml = readFileSync(join(testsDir, "..", "demo", "crs-candidate-lookup.html"), "utf8");
const bodyInner = /<body[^>]*>([\s\S]*)<\/body>/i.exec(pageHtml)?.[1];

const MAP = { width: 720, height: 460 };

function mountPage(): void {
  if (bodyInner === undefined) throw new Error("cannot read <body> of crs-candidate-lookup.html");
  document.body.innerHTML = bodyInner.replace(/<script[\s\S]*?<\/script>/gi, "");
  const canvas = document.getElementById("map-canvas") as HTMLCanvasElement;
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: MAP.width, bottom: MAP.height, ...MAP, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
}

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "EPSG:6674",
    authority: "EPSG",
    code: "6674",
    name: "JGD2011 / Japan Plane Rectangular CS VI",
    areaName: "Japan - onshore",
    deprecated: false,
    bbox: { west: 134, south: 33, east: 138, north: 37 },
    wkt2: null,
    proj4: "+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
    ...overrides,
  };
}

function makeRuntime(rows: ReturnType<typeof fakeRow>[] = [fakeRow()]) {
  const listProjectedCrsFromProjWasm = vi.fn(async (_options: unknown) => rows);
  return {
    listProjectedCrsFromProjWasm,
    runtime: {
      initializeProjWasmRuntime: vi.fn(async () => undefined),
      listProjectedCrsFromProjWasm,
    },
  };
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

async function start(runtime: ReturnType<typeof makeRuntime>["runtime"]) {
  const demo = initDemo({ runtime, doc: document });
  await demo.whenSettled();
  return demo;
}

const allOptions = PRESETS.flatMap((preset) =>
  preset.options.map((option) => ({ presetId: preset.id, optionId: option.id, option })),
);

describe("demo wiring: preset buttons", () => {
  beforeEach(() => {
    mountPage();
  });

  it("renders one button per preset option with the labels from presets.js", async () => {
    const { runtime } = makeRuntime();
    await start(runtime);
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("#preset-bar button")];
    expect(buttons.map((button) => button.dataset.preset)).toEqual(
      allOptions.map(({ presetId, optionId }) => `${presetId}:${optionId}`),
    );
    expect(buttons.map((button) => button.textContent)).toEqual(allOptions.map(({ option }) => option.label));
    expect(document.querySelectorAll("#preset-bar button[aria-pressed='true']")).toHaveLength(0);
  });

  for (const { presetId, optionId, option } of allOptions) {
    it(`button ${presetId}:${optionId} calls the lookup once with the preset input and shows its line`, async () => {
      const { runtime, listProjectedCrsFromProjWasm } = makeRuntime();
      const demo = await start(runtime);
      expect(listProjectedCrsFromProjWasm).not.toHaveBeenCalled();

      clickPreset(presetId, optionId);
      await demo.whenSettled();

      expect(listProjectedCrsFromProjWasm).toHaveBeenCalledTimes(1);
      const options = listProjectedCrsFromProjWasm.mock.calls[0][0] as ReturnType<typeof buildLookupOptions>;
      const expected = buildLookupOptions(option.input);
      expect(options.extent).toEqual(expected.extent);
      expect(options.area).toBe(expected.area);
      expect(options.includeCustomProjections).toBe(expected.includeCustomProjections);
      expect(options.includeDeprecated).toBe(false);
      expect(options.onshoreOnly).toBe(false);

      expect(pressedButtons()).toEqual([`${presetId}:${optionId}`]);
      expect(text("preset-expectation")).toBe(option.expectation);
    });
  }

  it("goes back to area: 'Japan' after pressing the no-filter button", async () => {
    const { runtime, listProjectedCrsFromProjWasm } = makeRuntime();
    const demo = await start(runtime);

    clickPreset("area-filter", "b");
    await demo.whenSettled();
    const withoutArea = listProjectedCrsFromProjWasm.mock.calls[0][0] as { area?: string };
    expect(withoutArea.area).toBeUndefined();

    clickPreset("area-filter", "a");
    await demo.whenSettled();
    expect(listProjectedCrsFromProjWasm).toHaveBeenCalledTimes(2);
    const withArea = listProjectedCrsFromProjWasm.mock.calls[1][0] as { area?: string };
    expect(withArea.area).toBe("Japan");
    expect(pressedButtons()).toEqual(["area-filter:a"]);
  });
});

describe("demo wiring: defaults and footer", () => {
  beforeEach(() => {
    mountPage();
  });

  it("keeps the opening defaults (Japan, custom on, onshore off) on the first lookup", async () => {
    const { runtime, listProjectedCrsFromProjWasm } = makeRuntime();
    const demo = await start(runtime);
    expect(listProjectedCrsFromProjWasm).not.toHaveBeenCalled();

    const canvas = document.getElementById("map-canvas") as HTMLCanvasElement;
    canvas.dispatchEvent(new MouseEvent("pointerdown", { clientX: 360, clientY: 230, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("pointerup", { clientX: 360, clientY: 230, bubbles: true }));
    await demo.whenSettled();

    expect(listProjectedCrsFromProjWasm).toHaveBeenCalledTimes(1);
    const options = listProjectedCrsFromProjWasm.mock.calls[0][0] as {
      area?: string;
      includeCustomProjections?: boolean;
      includeDeprecated?: boolean;
      onshoreOnly?: boolean;
    };
    expect(options.area).toBe("Japan");
    expect(options.includeCustomProjections).toBe(true);
    expect(options.includeDeprecated).toBe(false);
    expect(options.onshoreOnly).toBe(false);

    const state = demo.getState();
    expect(state.areaMode).toBe("japan");
    expect(state.areaFilterEnabled).toBe(true);
    expect(state.includeCustomProjections).toBe(true);
    expect(state.onshoreOnly).toBe(false);
  });

  it("shows the package version in the footer", async () => {
    const { runtime } = makeRuntime();
    await start(runtime);
    expect(text("version")).toContain(`@c4h/atlas ${packageVersion}`);
  });

  it("shows how many candidates are outside Japan and how many rows were excluded", async () => {
    const rows = [
      fakeRow(),
      fakeRow({ id: "EPSG:32633", name: "WGS 84 / UTM 33N", areaName: "World" }),
      fakeRow({ id: "EPSG:3857", name: "Web Mercator", areaName: "World" }),
    ];
    const { runtime } = makeRuntime(rows);
    const demo = await start(runtime);

    clickPreset("area-filter", "a");
    await demo.whenSettled();

    expect(text("result-summary")).toBe("地域名に Japan を含まない候補 2 件");
    expect(text("excluded-summary")).toContain("0");
  });

  it("shows the excluded count reported by onExcluded", async () => {
    const listProjectedCrsFromProjWasm = vi.fn(
      async (options: { onExcluded?: (entries: { id: string; name: string; reason: string }[]) => void }) => {
        options.onExcluded?.([
          { id: "EPSG:32600", name: "Mars", reason: "Not on the Earth" },
          { id: "EPSG:9999", name: "Broken method", reason: "Unsupported conversion method" },
        ]);
        return [fakeRow()];
      },
    );
    const demo = initDemo({
      runtime: {
        initializeProjWasmRuntime: vi.fn(async () => undefined),
        listProjectedCrsFromProjWasm,
      },
      doc: document,
    });
    await demo.whenSettled();

    clickPreset("area-filter", "a");
    await demo.whenSettled();

    expect(text("excluded-summary")).toContain("2");
    expect(text("excluded-summary")).toContain("地球外");
  });
});
