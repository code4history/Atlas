/**
 * `createCandidateTransformer` — 候補の行から、Teiresias の `CandidateTransformer` と同じ形の
 * 関数を作る adapter。実 engine（proj-wasm）を通す。
 */
import { describe, expect, it } from "vitest";

import {
  createCandidateTransformer,
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
  type ProjectedCrsInfo,
} from "../src/proj-wasm-crs.ts";

const KYOTO_GCPS: ReadonlyArray<readonly [number, number]> = [
  [135.6, 34.9],
  [135.9, 34.9],
  [135.9, 35.1],
  [135.6, 35.1],
  [135.75, 35.0],
];
const LONLAT = { kind: "lonlat_deg", axisOrder: "lon-lat" } as const;

let catalogPromise: Promise<ProjectedCrsInfo[]> | undefined;
function catalog(): Promise<ProjectedCrsInfo[]> {
  catalogPromise ??= listProjectedCrsFromProjWasm({
    extent: { west: 135.6, south: 34.9, east: 135.9, north: 35.1 },
    area: "Japan",
    onshoreOnly: true,
  });
  return catalogPromise;
}

describe("createCandidateTransformer", () => {
  it("returns exactly what transformLonLatArrayToProjected returns for a catalog row", async () => {
    const rows = await catalog();
    const row = rows.find((candidate) => candidate.id === "EPSG:6674");
    expect(row).toBeDefined();

    const transformer = createCandidateTransformer(rows);
    const viaAdapter = await transformer("EPSG:6674", KYOTO_GCPS, LONLAT);
    const direct = await transformLonLatArrayToProjected(row!, KYOTO_GCPS);

    expect(viaAdapter).not.toBeNull();
    expect(viaAdapter).toEqual(direct);
  });

  it("returns null for a geo basis that is not lon/lat degrees in lon-lat order", async () => {
    const transformer = createCandidateTransformer(await catalog());

    await expect(transformer("EPSG:6674", KYOTO_GCPS, { kind: "planar_xy" })).resolves.toBeNull();
    await expect(transformer("EPSG:6674", KYOTO_GCPS, { kind: "lonlat_deg", axisOrder: "lat-lon" })).resolves.toBeNull();
    await expect(transformer("EPSG:6674", KYOTO_GCPS, { kind: "lonlat_deg" })).resolves.toBeNull();
  });

  it("returns null for an id that is not among the rows", async () => {
    const transformer = createCandidateTransformer(await catalog());

    await expect(transformer("EPSG:999999", KYOTO_GCPS, LONLAT)).resolves.toBeNull();
  });

  it("returns null for an empty point list", async () => {
    const transformer = createCandidateTransformer(await catalog());

    await expect(transformer("EPSG:6674", [], LONLAT)).resolves.toBeNull();
  });

  it("keeps the rows it was created with when the caller changes them later", async () => {
    const original = (await catalog()).find((candidate) => candidate.id === "EPSG:6674")!;
    const rows = [{ id: original.id, proj4: original.proj4 }];
    const transformer = createCandidateTransformer(rows);
    const before = await transformer("EPSG:6674", KYOTO_GCPS, LONLAT);

    rows[0].proj4 = "+proj=longlat +datum=WGS84 +no_defs +type=crs";
    rows.push({ id: "EPSG:2448", proj4: original.proj4 });

    await expect(transformer("EPSG:6674", KYOTO_GCPS, LONLAT)).resolves.toEqual(before);
    await expect(transformer("EPSG:2448", KYOTO_GCPS, LONLAT)).resolves.toBeNull();
  });
});
