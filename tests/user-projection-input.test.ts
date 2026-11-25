/**
 * What `userProjection` accepts: where the JSON may come from, how large it may be, and which
 * rows of it are used. The real engine runs (the search needs proj.db); `fetch` is replaced so no
 * request leaves the process.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { extractWktName } from "../src/crs-seed.ts";
import { listProjectedCrsFromProjWasm } from "../src/proj-wasm-crs.ts";

const EXTENT = { west: 135.6, south: 34.9, east: 135.9, north: 35.1 };
const AREA = "User Projection Input Test Area";
const PROJ4 = "+proj=utm +zone=53 +ellps=GRS80 +units=m +no_defs +type=crs";

const PROJ_WASM_TEST_TIMEOUT_MS = 30_000;

function row(code: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authority: "USER",
    code,
    name: `User ${code}`,
    areaName: AREA,
    deprecated: false,
    bbox: { ...EXTENT },
    proj4: PROJ4,
    ...overrides,
  };
}

function dataUrl(value: unknown): string {
  return `data:application/json,${encodeURIComponent(JSON.stringify(value))}`;
}

function search(userProjection: string | URL) {
  return listProjectedCrsFromProjWasm({ extent: EXTENT, area: AREA, bboxPaddingDeg: 0, userProjection });
}

function without(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...source };
  delete copy[key];
  return copy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("userProjection: rows", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("uses the well-formed rows and skips the others", async () => {
    const rows = await search(dataUrl({
      projections: [
        row("GOOD-1"),
        null,
        7,
        "a string",
        [],
        without(row("NO-BBOX"), "bbox"),
        row("BBOX-TEXT", { bbox: { west: "135", south: 34.9, east: 135.9, north: 35.1 } }),
        row("BBOX-NAN", { bbox: { west: null, south: 34.9, east: 135.9, north: 35.1 } }),
        without(row("NO-NAME"), "name"),
        row("EMPTY-AUTHORITY", { authority: "" }),
        without(row("NO-DEFINITION"), "proj4"),
        row("DEFINITION-NUMBER", { proj4: 4326 }),
        row("PIPELINE-OBJECT", { pipeline: { step: 1 } }),
        row("AREA-NUMBER", { areaName: 5 }),
        row("GOOD-2", { source: ["https://example.invalid/about-this-grid"], wkt2: null, isApproximate: true }),
      ],
    }));

    expect(rows.map((candidate) => candidate.id)).toEqual(["USER:GOOD-1", "USER:GOOD-2"]);
    expect(rows.every((candidate) => candidate.definitionType === "user")).toBe(true);
    expect(rows[1].source).toEqual(["https://example.invalid/about-this-grid"]);
  });

  it("accepts a bare array, and rows that leave out the optional fields", async () => {
    const minimal = { authority: "USER", code: "MINIMAL", name: "Minimal", bbox: { ...EXTENT }, proj4: PROJ4 };
    const rows = await listProjectedCrsFromProjWasm({
      extent: EXTENT,
      bboxPaddingDeg: 0,
      area: "Japan",
      userProjection: dataUrl([minimal]),
    });
    // A row without `areaName` has an empty area name, so an area filter leaves it out ...
    expect(rows.some((candidate) => candidate.id === "USER:MINIMAL")).toBe(false);
    expect(rows.length).toBeGreaterThan(0);

    // ... and a row whose area name matches is found, with the defaults filled in.
    const found = await search(dataUrl([{ ...minimal, areaName: AREA }]));
    expect(found).toEqual([{
      id: "USER:MINIMAL",
      authority: "USER",
      code: "MINIMAL",
      name: "Minimal",
      areaName: AREA,
      deprecated: false,
      bbox: EXTENT,
      wkt2: null,
      proj4: PROJ4,
      pipeline: undefined,
      isApproximate: false,
      source: [],
      definitionType: "user",
    }]);

    const pipelineRows = await search(dataUrl([row("PIPE", {
      proj4: undefined,
      pipeline: "+proj=pipeline +step +inv +proj=utm +zone=53 +ellps=GRS80 +step +proj=unitconvert +xy_in=rad +xy_out=deg",
      unit: { name: "metre", metresPerUnit: 1 },
    })]));
    expect(pipelineRows.map((candidate) => candidate.id)).toEqual(["USER:PIPE"]);
    expect(pipelineRows[0].unit).toEqual({ name: "metre", metresPerUnit: 1 });
  });

  it("rejects a file that holds no list of rows, with a message that does not echo the file", async () => {
    for (const content of [{ rows: [] }, { projections: "none" }, 42, null]) {
      const failure = await search(dataUrl(content)).then(() => undefined, (error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(TypeError);
      expect((failure as Error).message).toMatch(/array of projection definitions/);
    }

    const secret = "not-json-but-private-text";
    const failure = await search(`data:application/json,${secret}`).then(() => undefined, (error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/not valid JSON/);
    expect((failure as Error).message).not.toContain(secret);
  });
});

describe("userProjection: where it may be read from", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("reads https, and http only from this machine", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ projections: [row("FETCHED")] })),
    );

    for (const allowed of [
      "https://example.invalid/defs.json",
      "http://localhost:8080/defs.json",
      "http://127.0.0.1:8080/defs.json",
      "http://[::1]:8080/defs.json",
    ]) {
      const rows = await search(allowed);
      expect(rows.map((candidate) => candidate.id), allowed).toEqual(["USER:FETCHED"]);
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not request other schemes or plain http hosts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(JSON.stringify({ projections: [row("FETCHED")] })),
    );

    for (const refused of [
      "http://example.invalid/defs.json",
      "http://192.0.2.10/defs.json",
      "ftp://example.invalid/defs.json",
      "blob:https://example.invalid/0b1c",
      "javascript:alert(1)",
    ]) {
      await expect(search(refused), refused).rejects.toThrow(/not allowed/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps credentials and the query string out of the error message", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("", { status: 404, statusText: "Not Found" }));

    const failure = await search("https://reader:hunter2@example.invalid/defs.json?token=abcdef#frag")
      .then(() => undefined, (error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("https://example.invalid/defs.json");
    expect(message).toContain("404");
    expect(message).not.toContain("hunter2");
    expect(message).not.toContain("abcdef");
  });

  it("refuses a resource larger than the limit", async () => {
    const filler = " ".repeat(9 * 1024 * 1024);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(`${filler}${JSON.stringify({ projections: [row("HUGE")] })}`),
    );
    await expect(search("https://example.invalid/huge.json")).rejects.toThrow(/too large/);

    vi.restoreAllMocks();
    await expect(search(`data:application/json,${encodeURIComponent(filler)}[]`)).rejects.toThrow(/too large/);
  });
});

describe("extractWktName", () => {
  it("does not put the whole input into its error message", () => {
    const input = `NOT-A-CRS[${"x".repeat(100_000)}]`;
    let message = "";
    try {
      extractWktName(input);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^Unable to extract WKT root name from: NOT-A-CRS\[/);
    expect(message.length).toBeLessThan(300);
  });
});
