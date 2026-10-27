import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { PjCache, withPj } from "../src/proj-handle.ts";

function fakeProj() {
  return { projDestroy: vi.fn(async (_args: { pj: unknown }) => undefined) };
}

describe("withPj", () => {
  it("passes the created object to use, returns its result, and destroys the object once", async () => {
    const proj = fakeProj();
    const pj = { handle: 1 };

    const result = await withPj(proj, async () => pj, async (created) => {
      expect(created).toBe(pj);
      return "done";
    });

    expect(result).toBe("done");
    expect(proj.projDestroy).toHaveBeenCalledTimes(1);
    expect(proj.projDestroy).toHaveBeenCalledWith({ pj });
  });

  it("destroys the object once when use throws, and rethrows", async () => {
    const proj = fakeProj();
    const pj = { handle: 2 };

    await expect(withPj(proj, async () => pj, async () => {
      throw new Error("use failed");
    })).rejects.toThrow("use failed");

    expect(proj.projDestroy).toHaveBeenCalledTimes(1);
    expect(proj.projDestroy).toHaveBeenCalledWith({ pj });
  });

  it("does not destroy anything when create throws or returns nothing", async () => {
    const proj = fakeProj();

    await expect(withPj(proj, async () => {
      throw new Error("create failed");
    }, async () => "unused")).rejects.toThrow("create failed");
    await expect(withPj(proj, async () => undefined, async (created) => created ?? "empty")).resolves.toBe("empty");

    expect(proj.projDestroy).not.toHaveBeenCalled();
  });
});

describe("withPj when releasing fails", () => {
  it("keeps the result of use when projDestroy throws", async () => {
    const proj = { projDestroy: vi.fn(async () => { throw new Error("destroy failed"); }) };

    await expect(withPj(proj, async () => ({ handle: 3 }), async () => "kept")).resolves.toBe("kept");
    expect(proj.projDestroy).toHaveBeenCalledTimes(1);
  });

  it("rethrows the error of use, not the error of projDestroy", async () => {
    const proj = { projDestroy: vi.fn(async () => { throw new Error("destroy failed"); }) };

    await expect(withPj(proj, async () => ({ handle: 4 }), async () => {
      throw new Error("use failed");
    })).rejects.toThrow("use failed");
    expect(proj.projDestroy).toHaveBeenCalledTimes(1);
  });
});

describe("PjCache", () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
  }

  it("creates one object per key and hands the same object to every use", async () => {
    const proj = fakeProj();
    const cache = new PjCache<string>(4);
    const create = vi.fn(async () => ({ handle: "a" }));

    const seen: unknown[] = [];
    for (let i = 0; i < 5; i += 1) {
      await cache.use(proj, "a", create, async (pj) => { seen.push(pj); });
    }

    expect(create).toHaveBeenCalledTimes(1);
    expect(new Set(seen).size).toBe(1);
    expect(proj.projDestroy).not.toHaveBeenCalled();
  });

  it("shares one creation between uses that start at the same time", async () => {
    const proj = fakeProj();
    const cache = new PjCache<string>(4);
    const gate = deferred<{ handle: string }>();
    const create = vi.fn(() => gate.promise);

    const uses = [1, 2, 3].map((n) => cache.use(proj, "a", create, async (pj) => [n, pj] as const));
    gate.resolve({ handle: "a" });
    const results = await Promise.all(uses);

    expect(create).toHaveBeenCalledTimes(1);
    expect(results.map(([, pj]) => pj)).toEqual([{ handle: "a" }, { handle: "a" }, { handle: "a" }]);
  });

  it("releases the least recently used object when it holds more than its capacity", async () => {
    const proj = fakeProj();
    const cache = new PjCache<string>(2);
    const objects = new Map<string, { handle: string }>();
    const create = (key: string) => vi.fn(async () => {
      const pj = { handle: key };
      objects.set(key, pj);
      return pj;
    });

    const createA = create("a");
    await cache.use(proj, "a", createA, async () => undefined);
    await cache.use(proj, "b", create("b"), async () => undefined);
    await cache.use(proj, "a", createA, async () => undefined); // a is now the most recent
    await cache.use(proj, "c", create("c"), async () => undefined); // b goes

    expect(proj.projDestroy).toHaveBeenCalledTimes(1);
    expect(proj.projDestroy).toHaveBeenCalledWith({ pj: objects.get("b") });
    expect(cache.size).toBe(2);

    await cache.use(proj, "a", createA, async () => undefined);
    expect(createA).toHaveBeenCalledTimes(1);
  });

  it("keeps an object that leaves the cache until its running uses finish", async () => {
    const proj = fakeProj();
    const cache = new PjCache<string>(1);
    const running = deferred<void>();

    const first = cache.use(proj, "a", async () => ({ handle: "a" }), () => running.promise);
    await Promise.resolve();
    await cache.use(proj, "b", async () => ({ handle: "b" }), async () => undefined);
    await new Promise((r) => setTimeout(r, 0));

    expect(proj.projDestroy).not.toHaveBeenCalled();
    running.resolve();
    await first;
    expect(proj.projDestroy).toHaveBeenCalledTimes(1);
    expect(proj.projDestroy).toHaveBeenCalledWith({ pj: { handle: "a" } });
  });

  it("throws when the object cannot be created, and does not remember the failure", async () => {
    const proj = fakeProj();
    const cache = new PjCache<string>(4);

    await expect(cache.use(proj, "a", async () => { throw new Error("create failed"); }, async () => "unused"))
      .rejects.toThrow("create failed");
    await expect(cache.use(proj, "a", async () => null, async () => "unused"))
      .rejects.toThrow(/could not be created/);
    await expect(cache.use(proj, "a", async () => undefined, async () => "unused"))
      .rejects.toThrow(/could not be created/);
    expect(cache.size).toBe(0);

    await expect(cache.use(proj, "a", async () => ({ handle: "a" }), async () => "made")).resolves.toBe("made");
    expect(proj.projDestroy).not.toHaveBeenCalled();
  });

  it("rethrows the error of use and keeps the object for later uses", async () => {
    const proj = fakeProj();
    const cache = new PjCache<string>(4);
    const create = vi.fn(async () => ({ handle: "a" }));

    await expect(cache.use(proj, "a", create, async () => { throw new Error("use failed"); }))
      .rejects.toThrow("use failed");
    await expect(cache.use(proj, "a", create, async () => "again")).resolves.toBe("again");

    expect(create).toHaveBeenCalledTimes(1);
    expect(proj.projDestroy).not.toHaveBeenCalled();
  });
});

describe("PJ objects in src are always released", () => {
  it("creates PJ objects only inside withPj", async () => {
    const creators = ["projCreate", "projCreateFromDatabase", "projCreateCrsToCrs", "projCrsGetCoordinateSystem"];
    const files = (await readdir(new URL("../src/", import.meta.url))).filter((name) => name.endsWith(".ts"));
    const offenders: string[] = [];

    for (const file of files) {
      if (file === "proj-handle.ts") continue;
      const lines = (await readFile(new URL(`../src/${file}`, import.meta.url), "utf8")).split("\n");
      lines.forEach((line, index) => {
        for (const creator of creators) {
          if (!new RegExp(`\\bproj\\.${creator}\\(`).test(line)) continue;
          // 呼び出しは withPj の create（`withPj(proj, () => proj.X(...)`）か、
          // 使い終わりを PjCache が受け持つ create（`<cache>.use(proj, key, () => proj.X(...)`）の中に置く
          const window = lines.slice(Math.max(0, index - 1), index + 1).join("\n");
          const insideWithPj = new RegExp(`withPj\\(\\s*proj,\\s*\\(\\)\\s*=>\\s*proj\\.${creator}\\(`).test(window);
          const insideCache = new RegExp(`\\.use\\(\\s*proj,\\s*[\\w.]+,\\s*\\(\\)\\s*=>\\s*proj\\.${creator}\\(`).test(window);
          if (!insideWithPj && !insideCache) {
            offenders.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
