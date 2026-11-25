import { describe, expect, it } from "vitest";

import { LruMap } from "../src/lru-map.ts";

describe("LruMap", () => {
  it("rejects a capacity that is not a positive integer", () => {
    for (const capacity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => new LruMap<string, number>(capacity)).toThrow(RangeError);
    }
  });

  it("holds at most `capacity` keys and drops the least recently used one", () => {
    const map = new LruMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    expect(map.get("a")).toBe(1); // "a" is now the most recently used
    map.set("c", 3);

    expect(map.size).toBe(2);
    expect(map.has("b")).toBe(false);
    expect(map.get("a")).toBe(1);
    expect(map.get("c")).toBe(3);
  });

  it("replaces the value of a key it holds without growing", () => {
    const map = new LruMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    map.set("a", 10);
    map.set("c", 3);

    expect(map.size).toBe(2);
    expect(map.get("a")).toBe(10);
    expect(map.has("b")).toBe(false);
  });

  it("peeks without changing which key is dropped next", () => {
    const map = new LruMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    expect(map.peek("a")).toBe(1);
    map.set("c", 3);

    expect(map.has("a")).toBe(false);
    expect(map.peek("missing")).toBeUndefined();
  });

  it("deletes a key", () => {
    const map = new LruMap<string, number>(2);
    map.set("a", 1);
    expect(map.delete("a")).toBe(true);
    expect(map.delete("a")).toBe(false);
    expect(map.get("a")).toBeUndefined();
    expect(map.size).toBe(0);
  });
});
