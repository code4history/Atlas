import { describe, expect, it } from "vitest";
import { listProjectedCrsFromProjWasm, transformLonLatArrayToProjected } from "../src/proj-wasm-crs.ts";

/**
 * Regression test: proj-wasm 0.1.0-alpha8 does not get back all memory when a PROJ object is
 * released. When `transformLonLatArrayToProjected` built one pipeline per call, the wasm memory was
 * full after about 200,000 calls in one process (199,698 measured) and every later call returned
 * `null`. The pipeline of each target is now kept, so the number of calls no longer matters.
 *
 * The loop goes past that point (210,000 calls took about 30 s on a developer machine). Set
 * ATLAS_TRANSFORM_CALLS to change the number of calls.
 */
const CALLS = Number(process.env.ATLAS_TRANSFORM_CALLS ?? 210_000);

const KYOTO_EXTENT = { west: 135.6, south: 34.9, east: 135.9, north: 35.1 };
const KYOTO_GCPS: ReadonlyArray<readonly [number, number]> = [
  [135.6, 34.9],
  [135.9, 34.9],
  [135.9, 35.1],
  [135.6, 35.1],
  [135.75, 35.0],
];

describe("many transformations in one process", () => {
  it(`keeps answering ${CALLS} calls with the same results`, async () => {
    const targets = await listProjectedCrsFromProjWasm({ extent: KYOTO_EXTENT, area: "Japan", onshoreOnly: true });
    expect(targets.length).toBeGreaterThan(0);

    const expected = await Promise.all(targets.map((target) => transformLonLatArrayToProjected(target, KYOTO_GCPS)));
    expect(expected.some((result) => result !== null)).toBe(true);

    for (let call = 0; call < CALLS; call += 1) {
      const index = call % targets.length;
      const result = await transformLonLatArrayToProjected(targets[index], KYOTO_GCPS);
      if (JSON.stringify(result) !== JSON.stringify(expected[index])) {
        throw new Error(`call ${call + 1} (${targets[index].id}) returned ${JSON.stringify(result)}`);
      }
    }
  }, Math.max(60_000, CALLS * 3));
});
