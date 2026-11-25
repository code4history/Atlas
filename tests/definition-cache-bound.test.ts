/**
 * What Atlas remembers per definition string is bounded.
 *
 * proj-wasm is replaced by a counting fake here: the point is how many times Atlas asks for an
 * object, not what PROJ answers. (The real engine is covered by the other proj-wasm test files.)
 */
import { describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  inspections: new Map<string, number>(),
  operations: new Map<string, number>(),
  /** Definitions for which PROJ reports "no operation". */
  noOperation: new Set<string>(),
}));

vi.mock("proj-wasm", () => {
  const count = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  const noOperationError = () => {
    const error = new Error("no operation (simulated)");
    error.stack = `osgeo::proj::util::UnsupportedOperationException: no operation (simulated)\n${error.stack ?? ""}`;
    return error;
  };
  return {
    PJ_FWD: 1,
    PJ_INV: -1,
    PJ_CS_TYPE_CARTESIAN: 2,
    init: async () => undefined,
    contextCreate: async () => ({ type: "proj-context", ptr: 1, enabled: 1 }),
    projContextSetEnableNetwork: async ({ context, enabled }: { context: { enabled: number }; enabled: number }) => {
      context.enabled = enabled;
      return 1;
    },
    projContextIsNetworkEnabled: async ({ context }: { context: { enabled: number } }) => context.enabled,
    projCreate: async ({ definition }: { definition: string }) => {
      count(fake.inspections, definition);
      return { kind: "crs", definition };
    },
    projIsCrs: async () => 1,
    projCrsGetCoordinateSystem: async () => ({ kind: "cs" }),
    projCsGetType: async () => 2,
    projCsGetAxisCount: async () => 2,
    projCsGetAxisInfo: async ({ index }: { index: number }) => ({
      direction: index === 0 ? "east" : "north",
      unitConvFactor: 1,
      unitName: "metre",
    }),
    projDestroy: async () => undefined,
    projCreateCrsToCrs: async ({ target_crs: definition }: { target_crs: string }) => {
      count(fake.operations, definition);
      if (fake.noOperation.has(definition)) throw noOperationError();
      return { kind: "operation", definition };
    },
    coordArray: async (n: number) => ({ points: new Array<readonly number[]>(n) }),
    setCoords: async (coords: { points: Array<readonly number[]> }, points: Array<readonly number[]>) => {
      coords.points = points;
    },
    projTransArray: async () => undefined,
    getCoords: async (coords: { points: Array<readonly number[]> }, index: number) => coords.points[index],
  };
});

const { transformLonLatArrayToProjected } = await import("../src/proj-wasm-crs.ts");

const POINT: ReadonlyArray<readonly [number, number]> = [[135.75, 35]];
/** The documented number of definitions Atlas remembers. */
const CAPACITY = 4096;

function definition(index: number): string {
  return `+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=${index} +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs`;
}

/** Each test makes about 4,100 calls through the fake; the budget leaves room for a loaded machine. */
const MANY_CALLS_TIMEOUT_MS = 30_000;

describe("per-definition memory is bounded", { timeout: MANY_CALLS_TIMEOUT_MS }, () => {
  it("reads a definition once while it is among the most recent 4,096, and again after that", async () => {
    const first = definition(0);
    expect(await transformLonLatArrayToProjected({ id: "T:0", proj4: first }, POINT)).toEqual([[135.75, 35]]);
    expect(await transformLonLatArrayToProjected({ id: "T:0", proj4: first }, POINT)).toEqual([[135.75, 35]]);
    expect(fake.inspections.get(first)).toBe(1);

    for (let index = 1; index <= CAPACITY; index += 1) {
      await transformLonLatArrayToProjected({ id: `T:${index}`, proj4: definition(index) }, POINT);
    }

    // `first` has left the memory, so it is read again; the most recent one has not.
    await transformLonLatArrayToProjected({ id: "T:0", proj4: first }, POINT);
    await transformLonLatArrayToProjected({ id: `T:${CAPACITY}`, proj4: definition(CAPACITY) }, POINT);
    expect(fake.inspections.get(first)).toBe(2);
    expect(fake.inspections.get(definition(CAPACITY))).toBe(1);
  });

  it("forgets a target without an operation once 4,096 newer ones have been seen", async () => {
    const lost = (index: number) => `${definition(index)} +lost`;
    for (let index = 0; index <= CAPACITY; index += 1) fake.noOperation.add(lost(index));

    expect(await transformLonLatArrayToProjected({ id: "L:0", proj4: lost(0) }, POINT)).toBeNull();
    expect(await transformLonLatArrayToProjected({ id: "L:0", proj4: lost(0) }, POINT)).toBeNull();
    expect(fake.operations.get(lost(0))).toBe(1);

    for (let index = 1; index <= CAPACITY; index += 1) {
      expect(await transformLonLatArrayToProjected({ id: `L:${index}`, proj4: lost(index) }, POINT)).toBeNull();
    }

    expect(await transformLonLatArrayToProjected({ id: "L:0", proj4: lost(0) }, POINT)).toBeNull();
    expect(fake.operations.get(lost(0))).toBe(2);
  });

  it("gives null for an overlong definition, or one that is not a string, without asking PROJ", async () => {
    const overlong = `${definition(-1)} ${"+no_defs ".repeat(4000)}`;
    expect(overlong.length).toBeGreaterThan(16_384);

    expect(await transformLonLatArrayToProjected({ id: "T:LONG", proj4: overlong }, POINT)).toBeNull();
    expect(await transformLonLatArrayToProjected({ id: "T:NUMBER", proj4: 4326 as unknown as string }, POINT)).toBeNull();
    expect(fake.inspections.has(overlong)).toBe(false);
    expect([...fake.inspections.keys()].some((key) => typeof key !== "string")).toBe(false);
  });
});
