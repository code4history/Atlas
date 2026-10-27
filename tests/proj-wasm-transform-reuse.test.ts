/**
 * `transformLonLatArrayToProjected` keeps one pipeline per target and fails loudly.
 *
 * proj-wasm 0.1.0-alpha8 does not get back all memory when a PROJ object is released, so building
 * one pipeline per call used to fill the wasm memory after about 200,000 calls. From then on every
 * call returned `null`, which callers cannot tell apart from a target that really cannot be used.
 *
 * Here the real engine is wrapped so the tests can count pipeline creations and make the runtime
 * fail on purpose. Each target below has its own `+x_0` so no test sees another test's pipeline.
 */
import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  pipelinesCreated: 0,
  pipelineFailure: undefined as undefined | "null" | "throw",
  definitionFailure: undefined as undefined | Error,
  transformFailure: false,
}));

vi.mock("proj-wasm", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown> & {
    projCreate(args: unknown): Promise<unknown>;
    projCreateCrsToCrs(args: unknown): Promise<unknown>;
    projTransArray(args: unknown): Promise<unknown>;
  }>();
  return {
    ...actual,
    projCreate: async (args: unknown) => {
      if (runtime.definitionFailure) throw runtime.definitionFailure;
      return actual.projCreate(args);
    },
    projCreateCrsToCrs: async (args: unknown) => {
      runtime.pipelinesCreated += 1;
      if (runtime.pipelineFailure === "null") return null;
      if (runtime.pipelineFailure === "throw") throw new Error("Cannot enlarge memory (simulated)");
      return actual.projCreateCrsToCrs(args);
    },
    projTransArray: async (args: unknown) => {
      if (runtime.transformFailure) throw new Error("memory access out of bounds (simulated)");
      return actual.projTransArray(args);
    },
  };
});

const { createCandidateTransformer, transformLonLatArrayToProjected } = await import("../src/proj-wasm-crs.ts");

const KYOTO_GCPS: ReadonlyArray<readonly [number, number]> = [
  [135.6, 34.9],
  [135.9, 34.9],
  [135.9, 35.1],
  [135.6, 35.1],
  [135.75, 35.0],
];
const LONLAT = { kind: "lonlat_deg", axisOrder: "lon-lat" } as const;

/** A metre east/north CRS (JGD2011 / Japan Plane Rectangular CS VI with a test-specific false easting). */
function target(falseEasting: number) {
  return {
    id: `TEST:${falseEasting}`,
    proj4: `+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=${falseEasting} +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs`,
  };
}

async function withFailure<T>(set: () => void, run: () => Promise<T>): Promise<T> {
  set();
  try {
    return await run();
  } finally {
    runtime.pipelineFailure = undefined;
    runtime.definitionFailure = undefined;
    runtime.transformFailure = false;
  }
}

/** The real engine starts here; see the other proj-wasm test files for how the budget was measured. */
const PROJ_WASM_TEST_TIMEOUT_MS = 16_000;

describe("transformLonLatArrayToProjected reuses the pipeline of a target", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("builds the pipeline once for repeated calls to the same target", async () => {
    const crs = target(1);
    const before = runtime.pipelinesCreated;

    const first = await transformLonLatArrayToProjected(crs, KYOTO_GCPS);
    for (let i = 0; i < 50; i += 1) {
      expect(await transformLonLatArrayToProjected(crs, KYOTO_GCPS)).toEqual(first);
    }

    expect(first).not.toBeNull();
    expect(runtime.pipelinesCreated - before).toBe(1);
  });

  it("gives concurrent calls that share a pipeline the same results as calls made one by one", async () => {
    const targets = [target(2), target(3)];
    const inputs = Array.from({ length: 40 }, (_, index) => ({
      crs: targets[index % 2],
      points: KYOTO_GCPS.map(([lon, lat]) => [lon + index * 0.001, lat - index * 0.001] as const),
    }));

    const before = runtime.pipelinesCreated;
    const together = await Promise.all(inputs.map(({ crs, points }) => transformLonLatArrayToProjected(crs, points)));
    expect(runtime.pipelinesCreated - before).toBe(2);

    const oneByOne: Array<Array<[number, number]> | null> = [];
    for (const { crs, points } of inputs) {
      oneByOne.push(await transformLonLatArrayToProjected(crs, points));
    }
    expect(together.every((result) => result !== null)).toBe(true);
    expect(together).toEqual(oneByOne);
  });
});

describe("transformLonLatArrayToProjected throws when the runtime fails", { timeout: PROJ_WASM_TEST_TIMEOUT_MS }, () => {
  it("throws when the pipeline cannot be created (no object), and builds it again on the next call", async () => {
    const crs = target(10);
    await expect(withFailure(() => { runtime.pipelineFailure = "null"; }, () => transformLonLatArrayToProjected(crs, KYOTO_GCPS)))
      .rejects.toThrow(/could not be created/);
    await expect(transformLonLatArrayToProjected(crs, KYOTO_GCPS)).resolves.not.toBeNull();
  });

  it("throws when creating the pipeline throws (for example when the wasm memory is full)", async () => {
    const crs = target(11);
    await expect(withFailure(() => { runtime.pipelineFailure = "throw"; }, () => transformLonLatArrayToProjected(crs, KYOTO_GCPS)))
      .rejects.toThrow("Cannot enlarge memory");
    await expect(transformLonLatArrayToProjected(crs, KYOTO_GCPS)).resolves.not.toBeNull();
  });

  it("throws when the transformation itself fails", async () => {
    const crs = target(12);
    await expect(withFailure(() => { runtime.transformFailure = true; }, () => transformLonLatArrayToProjected(crs, KYOTO_GCPS)))
      .rejects.toThrow("memory access out of bounds");
    await expect(transformLonLatArrayToProjected(crs, KYOTO_GCPS)).resolves.not.toBeNull();
  });

  it("throws when the target cannot be checked, and does not remember the target as unusable", async () => {
    const crs = target(13);
    await expect(withFailure(() => { runtime.definitionFailure = new Error("Cannot enlarge memory (simulated)"); }, () => transformLonLatArrayToProjected(crs, KYOTO_GCPS)))
      .rejects.toThrow("Cannot enlarge memory");
    await expect(transformLonLatArrayToProjected(crs, KYOTO_GCPS)).resolves.not.toBeNull();
  });

  it("passes the failure through the candidate transformer", async () => {
    const crs = target(14);
    const transformer = createCandidateTransformer([crs]);
    await expect(withFailure(() => { runtime.pipelineFailure = "throw"; }, () => transformer(crs.id, KYOTO_GCPS, LONLAT)))
      .rejects.toThrow("Cannot enlarge memory");
    await expect(transformer(crs.id, KYOTO_GCPS, LONLAT)).resolves.not.toBeNull();
  });

  it("throws when PROJ fails for a reason other than the definition (SQLite out of memory)", async () => {
    const crs = target(15);
    const failure = new Error("SQLite error [ out of memory ]");
    failure.stack = "osgeo::proj::io::FactoryException: SQLite error [ out of memory ]\n    at ___cxa_throw (proj-emscripten.js)";
    await expect(withFailure(() => { runtime.definitionFailure = failure; }, () => transformLonLatArrayToProjected(crs, KYOTO_GCPS)))
      .rejects.toThrow("out of memory");
    await expect(transformLonLatArrayToProjected(crs, KYOTO_GCPS)).resolves.not.toBeNull();
  });

  it.each([
    ["an unknown projection", "+proj=NOT_A_PROJ +type=crs"],
    ["an invalid parameter value", "+proj=tmerc +k=abc +type=crs"],
    ["text that is not a definition", "not a definition"],
    ["an unknown authority code", "EPSG:999999"],
  ])("still returns null for a definition PROJ cannot read (%s)", async (_, proj4) => {
    await expect(transformLonLatArrayToProjected({ id: "TEST:BROKEN", proj4 }, KYOTO_GCPS)).resolves.toBeNull();
  });

  it("still returns null for a target on another celestial body (PROJ has no operation from the Earth to it)", async () => {
    // ESRI:103880 (a Lambert azimuthal equal-area projection of the Moon)
    const moon = { id: "ESRI:103880", proj4: "+proj=laea +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs +type=crs" };
    const before = runtime.pipelinesCreated;
    await expect(transformLonLatArrayToProjected(moon, KYOTO_GCPS)).resolves.toBeNull();
    await expect(transformLonLatArrayToProjected(moon, KYOTO_GCPS)).resolves.toBeNull();
    // The answer is remembered, so the pipeline is not tried again.
    expect(runtime.pipelinesCreated - before).toBe(1);
  });

  it("still returns null for a CRS that is not a plain projected CRS (a bound CRS)", async () => {
    const bound = {
      id: "TEST:BOUND",
      proj4: target(16).proj4.replace("+units=m", "+towgs84=0,0,0,0,0,0,0 +units=m"),
    };
    await expect(transformLonLatArrayToProjected(bound, KYOTO_GCPS)).resolves.toBeNull();
  });
});
