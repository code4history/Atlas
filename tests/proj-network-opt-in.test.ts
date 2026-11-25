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

const { initializeProjWasmRuntime, transformLonLatArrayToProjected, transformLonLatToCandidate } = await import(
  "../src/proj-wasm-crs.ts"
);

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
});
