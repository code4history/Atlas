/**
 * Atlas keeps PROJ off the network unless the caller asks for it, and never hands PROJ a
 * definition that names a resource by URL.
 *
 * The real engine (proj-wasm) runs here. The module is wrapped only to record the context every
 * object is created in. A listener on the loopback interface stands in for "somewhere else": the
 * tests pass when it receives nothing.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const recorded = vi.hoisted(() => ({
  /** One entry per PROJ object created: the function and whether network was enabled in its context. */
  creations: [] as Array<{ fn: string; hasContext: boolean; networkEnabled: number | undefined }>,
}));

vi.mock("proj-wasm", async (importOriginal) => {
  const actual = await importOriginal<Record<string, (args: { context?: unknown }) => Promise<unknown>>>();
  const record = (fn: string) => async (args: { context?: unknown }) => {
    const hasContext = args?.context !== undefined && args.context !== null;
    const networkEnabled = hasContext
      ? (await actual.projContextIsNetworkEnabled({ context: args.context })) as number
      : undefined;
    recorded.creations.push({ fn, hasContext, networkEnabled });
    return actual[fn](args);
  };
  return {
    ...actual,
    projCreate: record("projCreate"),
    projCreateCrsToCrs: record("projCreateCrsToCrs"),
    projCreateFromDatabase: record("projCreateFromDatabase"),
    projGetCrsInfoListFromDatabase: record("projGetCrsInfoListFromDatabase"),
  };
});

const {
  initializeProjWasmRuntime,
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
  transformLonLatToCandidate,
} = await import("../src/proj-wasm-crs.ts");

const KYOTO: ReadonlyArray<readonly [number, number]> = [
  [135.7, 34.98],
  [135.75, 35.02],
  [135.79, 34.96],
];
const KYOTO_EXTENT = { west: 135.6, south: 34.9, east: 135.9, north: 35.1 };

/** The real engine starts here; the first test also pays for its start-up. */
const PROJ_WASM_TEST_TIMEOUT_MS = 30_000;

let server: Server;
let received: string[];
let base: string;

beforeAll(async () => {
  received = [];
  server = createServer((request, response) => {
    received.push(request.url ?? "");
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  received.length = 0;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("PROJ stays off the network by default", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("creates every PROJ object in a context that has network access disabled", async () => {
    const rows = await listProjectedCrsFromProjWasm({ extent: KYOTO_EXTENT, area: "Japan" });
    const planeRectangular = rows.find((row) => row.id === "EPSG:6674");
    expect(planeRectangular).toBeDefined();

    const projected = await transformLonLatArrayToProjected(planeRectangular!, KYOTO);
    expect(projected).not.toBeNull();

    expect(recorded.creations.length).toBeGreaterThan(0);
    expect(new Set(recorded.creations.map((creation) => creation.fn))).toEqual(new Set([
      "projGetCrsInfoListFromDatabase",
      "projCreateFromDatabase",
      "projCreate",
      "projCreateCrsToCrs",
    ]));
    expect(recorded.creations.filter((creation) => !creation.hasContext)).toEqual([]);
    expect(recorded.creations.filter((creation) => creation.networkEnabled !== 0)).toEqual([]);
  });

  it("refuses to turn network access on once the runtime has started without it", async () => {
    await expect(initializeProjWasmRuntime({ enableNetwork: true })).rejects.toThrow(/enableNetwork/);
    // Asking for what is already in effect, or for nothing, stays fine.
    await expect(initializeProjWasmRuntime({ enableNetwork: false })).resolves.toBeUndefined();
    await expect(initializeProjWasmRuntime()).resolves.toBeUndefined();
  });
});

describe("definitions that name a resource by URL", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("gives null for a CRS definition with a URL and contacts nobody", async () => {
    const before = recorded.creations.length;
    const converted = await transformLonLatToCandidate({
      id: "TEST:REMOTE-CRS",
      proj4: `+proj=utm +zone=53 +ellps=bessel +nadgrids=${base}/crs.gsb +units=m +no_defs +type=crs`,
    }, KYOTO);

    expect(converted).toBeNull();
    expect(received).toEqual([]);
    // The definition never reaches PROJ.
    expect(recorded.creations.length).toBe(before);
  });

  it("gives null for a pipeline definition with a URL and contacts nobody", async () => {
    const before = recorded.creations.length;
    const converted = await transformLonLatToCandidate({
      id: "TEST:REMOTE-PIPELINE",
      proj4: `+proj=pipeline +step +proj=hgridshift +grids=${base}/pipeline.tif +step +proj=unitconvert +xy_in=rad +xy_out=deg`,
      unit: { name: "metre", metresPerUnit: 1 },
    }, KYOTO);

    expect(converted).toBeNull();
    expect(received).toEqual([]);
    expect(recorded.creations.length).toBe(before);
  });

  it("leaves a user projection row with a URL in its definition out of the search", async () => {
    const row = (code: string, proj4: string) => ({
      authority: "USER",
      code,
      name: `User ${code}`,
      areaName: "Remote Reference Test Area",
      deprecated: false,
      bbox: KYOTO_EXTENT,
      proj4,
    });
    const rows = await listProjectedCrsFromProjWasm({
      extent: KYOTO_EXTENT,
      area: "Remote Reference Test Area",
      bboxPaddingDeg: 0,
      userProjection: `data:application/json,${encodeURIComponent(JSON.stringify({
        projections: [
          row("REMOTE", `+proj=utm +zone=53 +ellps=bessel +nadgrids=${base}/user.gsb +units=m +no_defs +type=crs`),
          row("LOCAL", "+proj=utm +zone=53 +ellps=bessel +units=m +no_defs +type=crs"),
        ],
      }))}`,
    });

    expect(rows.map((candidate) => candidate.id)).toEqual(["USER:LOCAL"]);
    expect(received).toEqual([]);
  });

  it("still converts definitions that name no URL, the `@null` grid included", async () => {
    // The classic spelling of the spherical Mercator: `+nadgrids=@null` names no file at all.
    const webMercator = await transformLonLatArrayToProjected({
      id: "TEST:WEB-MERCATOR",
      proj4: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
    }, [[135, 35]]);

    expect(webMercator).not.toBeNull();
    expect(webMercator![0][0]).toBeCloseTo(15028131.257, 2);
    expect(webMercator![0][1]).toBeCloseTo(4163881.144, 2);
    expect(received).toEqual([]);
  });
});
