/**
 * `initializeProjWasmRuntime({ enableNetwork: true })` is the one switch that lets PROJ fetch
 * grid files. Even then a definition that names a resource by URL is not handed to PROJ.
 *
 * The real engine runs; nothing here needs a grid, so nothing is fetched. A listener on the
 * loopback interface checks that the URL in a definition is never contacted.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const recorded = vi.hoisted(() => ({
  creations: [] as Array<{ fn: string; networkEnabled: number | undefined }>,
}));

vi.mock("proj-wasm", async (importOriginal) => {
  const actual = await importOriginal<Record<string, (args: { context?: unknown }) => Promise<unknown>>>();
  const record = (fn: string) => async (args: { context?: unknown }) => {
    const hasContext = args?.context !== undefined && args.context !== null;
    recorded.creations.push({
      fn,
      networkEnabled: hasContext
        ? (await actual.projContextIsNetworkEnabled({ context: args.context })) as number
        : undefined,
    });
    return actual[fn](args);
  };
  return { ...actual, projCreate: record("projCreate"), projCreateCrsToCrs: record("projCreateCrsToCrs") };
});

const {
  initializeProjWasmRuntime,
  listProjectedCrsFromProjWasm,
  transformLonLatArrayToProjected,
  transformLonLatToCandidate,
} = await import("../src/proj-wasm-crs.ts");

/**
 * A coordinate operation written as PROJJSON whose file parameter holds `file`, inserted as it is
 * (so `file` may use the escapes of a JSON string).
 */
function projJsonOperation(file: string): string {
  const geographic = (name: string, datum: string, ellipsoid: Record<string, unknown>) => ({
    type: "GeographicCRS",
    name,
    datum: { type: "GeodeticReferenceFrame", name: datum, ellipsoid },
    coordinate_system: {
      subtype: "ellipsoidal",
      axis: [
        { name: "Geodetic latitude", abbreviation: "Lat", direction: "north", unit: "degree" },
        { name: "Geodetic longitude", abbreviation: "Lon", direction: "east", unit: "degree" },
      ],
    },
  });
  return JSON.stringify({
    type: "Transformation",
    name: "test operation",
    source_crs: geographic("NAD27", "North American Datum 1927", {
      name: "Clarke 1866",
      semi_major_axis: 6378206.4,
      semi_minor_axis: 6356583.8,
    }),
    target_crs: geographic("NAD83", "North American Datum 1983", {
      name: "GRS 1980",
      semi_major_axis: 6378137,
      inverse_flattening: 298.257222101,
    }),
    method: { name: "NTv2", id: { authority: "EPSG", code: 9615 } },
    parameters: [{
      name: "Latitude and longitude difference file",
      value: "@@FILE@@",
      id: { authority: "EPSG", code: 8656 },
    }],
  }).replace("@@FILE@@", file);
}

/** Spellings of `base` that a JSON parser reads back as `base`. */
function jsonSpellings(url: string): string[] {
  return [url.replace("://", ":\\/\\/"), url.replace("://", "\\u003a//")];
}

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

describe("PROJ network access as an opt-in", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("enables network access in the context when the first call asks for it", async () => {
    await initializeProjWasmRuntime({ enableNetwork: true });

    const projected = await transformLonLatArrayToProjected({
      id: "TEST:PLANE-VI",
      proj4: "+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs",
    }, [[135.75, 35]]);
    expect(projected).not.toBeNull();

    expect(recorded.creations.length).toBeGreaterThan(0);
    expect(recorded.creations.filter((creation) => creation.networkEnabled !== 1)).toEqual([]);
  });

  it("refuses to turn network access off afterwards", async () => {
    await expect(initializeProjWasmRuntime({ enableNetwork: false })).rejects.toThrow(/enableNetwork/);
    await expect(initializeProjWasmRuntime()).resolves.toBeUndefined();
  });

  it("still gives null for a definition with a URL and contacts nobody", async () => {
    const before = recorded.creations.length;
    const converted = await transformLonLatToCandidate({
      id: "TEST:REMOTE-CRS",
      proj4: `+proj=utm +zone=53 +ellps=bessel +nadgrids=${base}/crs.gsb +units=m +no_defs +type=crs`,
    }, [[135.75, 35]]);

    expect(converted).toBeNull();
    expect(received).toEqual([]);
    expect(recorded.creations.length).toBe(before);
  });

  it("gives null for a definition in a JSON form, however the file name in it is spelled", async () => {
    const before = recorded.creations.length;
    for (const file of [`${base}/plain.gsb`, ...jsonSpellings(`${base}/spelled.gsb`), "relative.gsb"]) {
      const converted = await transformLonLatToCandidate({
        id: "TEST:JSON-FORM",
        proj4: projJsonOperation(file),
        unit: { name: "metre", metresPerUnit: 1 },
      }, [[-118.25, 34.05]]);
      expect(converted, file).toBeNull();
    }

    expect(received).toEqual([]);
    expect(recorded.creations.length).toBe(before);
  });

  it("leaves a user projection row with such a definition out of the search", async () => {
    const extent = { west: -119, south: 33, east: -117, north: 35 };
    const row = (code: string, definition: Record<string, unknown>) => ({
      authority: "USER",
      code,
      name: `User ${code}`,
      areaName: "JSON Form Test Area",
      bbox: extent,
      unit: { name: "metre", metresPerUnit: 1 },
      ...definition,
    });
    const [spelled] = jsonSpellings(`${base}/row.gsb`);
    const rows = await listProjectedCrsFromProjWasm({
      extent,
      area: "JSON Form Test Area",
      bboxPaddingDeg: 0,
      userProjection: `data:application/json,${encodeURIComponent(JSON.stringify([
        row("JSON-PIPELINE", { pipeline: projJsonOperation(spelled) }),
        row("JSON-PROJ4", { proj4: projJsonOperation(spelled) }),
        row("PLAIN", { proj4: "+proj=utm +zone=11 +ellps=GRS80 +units=m +no_defs +type=crs" }),
      ]))}`,
    });

    expect(rows.map((candidate) => candidate.id)).toEqual(["USER:PLAIN"]);
    for (const candidate of rows) await transformLonLatToCandidate(candidate, [[-118.25, 34.05]]);
    expect(received).toEqual([]);
  });
});
