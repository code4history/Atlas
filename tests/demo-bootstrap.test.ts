/**
 * Every demo page must actually start itself.
 *
 * The jsdom tests import the page modules and call their `init...` function by hand, so they stay
 * green even when the page stops calling it. This file reads the pages themselves: each page has
 * an inline module script that imports its entry function and calls it once.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAGES = [
  { page: "demo/crs-candidate-lookup.html", module: "./main.js", entry: "initDemo" },
  { page: "demo/benchmark.html", module: "./benchmark.js", entry: "initBenchmark" },
];

/** The bodies of the page's inline `<script type="module">` blocks. */
function inlineModuleScripts(html: string): string[] {
  return [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

describe("demo pages: the page starts itself", () => {
  for (const { page, module, entry } of PAGES) {
    it(`${page} imports ${entry} from ${module} and calls it`, () => {
      const html = readFileSync(join(root, page), "utf8");
      const scripts = inlineModuleScripts(html);

      expect(scripts.length).toBeGreaterThan(0);
      const starts = scripts.some((body) => {
        const imported = new RegExp(
          `import\\s*\\{[^}]*\\b${entry}\\b[^}]*\\}\\s*from\\s*["']${module.replace(".", "\\.")}["']`,
        ).test(body);
        const called = new RegExp(`\\b${entry}\\s*\\(`).test(body);
        return imported && called;
      });
      expect(starts, `${page} does not call ${entry}()`).toBe(true);
    });

    it(`${module} exports ${entry}`, () => {
      const source = readFileSync(join(root, "demo", module.replace("./", "")), "utf8");
      expect(source).toMatch(new RegExp(`export\\s+function\\s+${entry}\\s*\\(`));
    });
  }
});
