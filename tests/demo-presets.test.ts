/**
 * Demo presets: every contrast in `demo/presets.js` must split with the real lookup engine.
 *
 * This file calls `listProjectedCrsFromProjWasm` (from `src`, not `dist`) with the exact inputs
 * the demo page uses and reads the arguments through the same `buildLookupOptions` helper the
 * page uses, so a wrong number in the presets or a wrong copy in the page shows up here.
 *
 * Counts are logged, not baked: the assertions check which systems the contrast promises,
 * not the exact size of the catalog.
 */
import { describe, expect, it } from "vitest";
import {
  listProjectedCrsFromProjWasm,
  type ListProjectedCrsFromProjWasmOptions,
  type ProjectedCrsInfo,
} from "../src/proj-wasm-crs.ts";
import { buildLookupOptions, findPreset } from "../demo/presets.js";

const CALL_TIMEOUT_MS = 60_000;

async function listWithTimeout(
  options: ListProjectedCrsFromProjWasmOptions,
): Promise<ProjectedCrsInfo[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      listProjectedCrsFromProjWasm(options),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`listProjectedCrsFromProjWasm did not answer within ${CALL_TIMEOUT_MS} ms`)),
          CALL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function presetOptions(presetId: string, optionId: string): ListProjectedCrsFromProjWasmOptions {
  const preset = findPreset(presetId, optionId);
  if (preset === undefined) throw new Error(`preset ${presetId}:${optionId} is missing`);
  return buildLookupOptions(preset.input);
}

function ids(rows: ProjectedCrsInfo[]): string[] {
  return rows.map((row) => row.id);
}

function hasAreaNameWithoutJapan(rows: ProjectedCrsInfo[]): boolean {
  return rows.some((row) => !row.areaName.includes("Japan"));
}

describe("demo presets: place", () => {
  it(
    "moves the plane rectangular systems between Kyoto and Tokyo",
    async () => {
      const a = await listWithTimeout(presetOptions("place", "a"));
      const b = await listWithTimeout(presetOptions("place", "b"));
      console.info(`[demo-presets] place: A ${a.length} rows, B ${b.length} rows`);

      expect(ids(a)).toContain("EPSG:6674");
      expect(ids(a)).not.toContain("EPSG:6677");
      expect(ids(b)).toContain("EPSG:6677");
      expect(ids(b)).toContain("EPSG:6676");
      expect(ids(b)).not.toContain("EPSG:6674");
    },
    CALL_TIMEOUT_MS * 2 + 60_000,
  );
});

describe("demo presets: historical-grid", () => {
  it(
    "adds only the historical grid zone B and exactly one row",
    async () => {
      const without = await listWithTimeout(presetOptions("historical-grid", "a"));
      const withGrid = await listWithTimeout(presetOptions("historical-grid", "b"));
      console.info(
        `[demo-presets] historical-grid: A ${without.length} rows, B ${withGrid.length} rows`,
      );

      expect(ids(withGrid)).toContain("UTJCP:ZONE-B");
      expect(ids(without)).not.toContain("UTJCP:ZONE-B");
      expect(withGrid.length).toBe(without.length + 1);
    },
    CALL_TIMEOUT_MS * 2 + 60_000,
  );
});

describe("demo presets: area-filter", () => {
  it(
    "survives the no-filter sequence and returns the same A list after B and back",
    async () => {
      const a = presetOptions("area-filter", "a");
      const b = presetOptions("area-filter", "b");
      const bWithoutCustomProjections = buildLookupOptions({
        ...findPreset("area-filter", "b")!.input,
        includeCustomProjections: false,
      });

      const excludedByCall: number[] = [];
      const run = async (options: ListProjectedCrsFromProjWasmOptions) => {
        let excluded = 0;
        const rows = await listWithTimeout({
          ...options,
          onExcluded: (entries) => {
            excluded += entries.length;
          },
        });
        excludedByCall.push(excluded);
        return rows;
      };

      const noArea = await run(bWithoutCustomProjections);
      const noAreaCustom = await run(b);
      const japanCustom = await run(a);
      const noAreaAgain = await run(b);

      console.info(
        `[demo-presets] area-filter: no area ${noArea.length} rows, no area + custom ${noAreaCustom.length} rows, ` +
        `Japan + custom ${japanCustom.length} rows, no area again ${noAreaAgain.length} rows; ` +
        `excluded ${excludedByCall.join(", ")}`,
      );

      // The third call is the one that used to fail after the no-filter calls.
      expect(ids(japanCustom)).toContain("EPSG:6674");
      expect(ids(japanCustom)).toContain("UTJCP:ZONE-B");

      // A round trip through the presets must not error and must come back to the same list.
      const roundTripA = await run(a);
      const roundTripB = await run(b);
      const roundTripAAgain = await run(a);

      console.info(
        `[demo-presets] area-filter round trip: A ${roundTripA.length} rows, B ${roundTripB.length} rows, ` +
        `A again ${roundTripAAgain.length} rows`,
      );

      for (const rows of [noArea, noAreaCustom, japanCustom, noAreaAgain, roundTripA, roundTripB, roundTripAAgain]) {
        expect(rows.length).toBeGreaterThan(0);
      }
      expect(roundTripB.length).toBeGreaterThan(roundTripA.length);
      expect(hasAreaNameWithoutJapan(roundTripB)).toBe(true);
      expect(ids(roundTripAAgain)).toEqual(ids(roundTripA));
      expect(ids(japanCustom)).toEqual(ids(roundTripA));
    },
    CALL_TIMEOUT_MS * 7 + 60_000,
  );
});
