import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { withPj } from "../src/proj-handle.ts";

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
          // 呼び出しは withPj の第 2 引数（create）の中に置く: `withPj(proj, () => proj.X(...)`
          const window = lines.slice(Math.max(0, index - 1), index + 1).join("\n");
          if (!new RegExp(`withPj\\(\\s*proj,\\s*\\(\\)\\s*=>\\s*proj\\.${creator}\\(`).test(window)) {
            offenders.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
