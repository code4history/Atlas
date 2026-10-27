import { describe, expect, it } from "vitest";
import { listProjectedCrsFromProjWasm, type ProjectedCrsInfo } from "../src/proj-wasm-crs.ts";

/**
 * Regression test: rows built from the bundled custom projections used to hand out the `bbox`
 * object of the definition that is loaded once per process. A caller that changed the `bbox` of
 * a result row changed the definition itself, so the next search returned the changed value and
 * filtered with it.
 */
const PROJ_WASM_TEST_TIMEOUT_MS = 16_000;

const ZONE_B_SEARCH = {
  includeCustomProjections: true,
  area: "Japan City Plans - Historical Grid",
  extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
} as const;

async function findZoneB(): Promise<ProjectedCrsInfo> {
  const rows = await listProjectedCrsFromProjWasm(ZONE_B_SEARCH);
  const zoneB = rows.find((row) => row.id === "UTJCP:ZONE-B");
  expect(zoneB).toBeDefined();
  expect(zoneB!.definitionType).toBe("custom");
  return zoneB!;
}

describe("custom projection rows", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("are not changed by a caller that changes an earlier result", async () => {
    const first = await findZoneB();
    const originalBbox = { ...first.bbox };
    expect(first.source).toBeDefined();
    const originalSource = [...first.source!];

    // Move the bbox away from the search extent and change the source list.
    first.bbox.west = 0;
    first.bbox.east = 1;
    first.bbox.south = 0;
    first.bbox.north = 1;
    first.source!.push("changed by the caller");

    const second = await findZoneB();
    expect(second.bbox).toEqual(originalBbox);
    expect(second.source).toEqual(originalSource);
    expect(second.bbox).not.toBe(first.bbox);
    expect(second.source).not.toBe(first.source);
  });
});
