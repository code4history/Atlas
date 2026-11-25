/**
 * Notices that must travel with what Atlas shows and ships: the attribution of the map tiles in
 * the demo, the licences of the PROJ runtime files copied into the npm tarball, and the notes on
 * network access and on the pinned prerelease dependency.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const require = createRequire(import.meta.url);

const NOTICES = "THIRD-PARTY-NOTICES.md";

/** Whitespace differs between a licence file and its quotation; compare the words. */
function words(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

describe("demo map attribution", () => {
  it("credits OpenStreetMap next to the tiles it loads", () => {
    const mainJs = read("demo/main.js");
    expect(mainJs).toContain("tile.openstreetmap.org");

    const page = read("demo/crs-candidate-lookup.html");
    const board = /<div id="map-board"[\s\S]*?<canvas id="map-canvas"[^>]*><\/canvas>([\s\S]*?)<\/div>/.exec(page);
    expect(board, "the map board holds the attribution").not.toBeNull();
    expect(board![1]).toContain('href="https://www.openstreetmap.org/copyright"');
    expect(board![1]).toMatch(/©\s*<a [^>]*>OpenStreetMap<\/a> contributors/);
    expect(read("demo/style.css")).toContain(".atlas-map-attribution");
  });
});

describe("third-party notices in the tarball", () => {
  it("lists the notices file in package.json `files`", () => {
    const packageJson = JSON.parse(read("package.json")) as { files: string[] };
    expect(packageJson.files).toContain(NOTICES);
  });

  it("carries the licence of proj-wasm as shipped in the pinned version", () => {
    const projWasmRoot = join(dirname(require.resolve("proj-wasm")), "..");
    const licence = readFileSync(join(projWasmRoot, "LICENSE"), "utf8");
    expect(words(read(NOTICES))).toContain(words(licence));
  });

  it("names every component of the redistributed runtime files", () => {
    const notices = read(NOTICES);
    for (const component of ["proj-wasm", "PROJ", "EPSG", "ESRI", "IGNF", "SQLite", "libtiff", "zlib", "Emscripten"]) {
      expect(notices, component).toContain(component);
    }
    for (const file of ["proj-emscripten.wasm", "proj-emscripten.js", "proj-worker.mjs", "fetch-worker.mjs", "proj.db", "proj.ini"]) {
      expect(notices, file).toContain(file);
    }
    expect(notices).toContain("Frank Warmerdam");
    expect(notices).toContain("Sam Leffler");
    expect(notices).toContain("Jean-loup Gailly and Mark Adler");
    expect(notices).toContain("https://epsg.org/terms-of-use.html");
  });

  it("carries the copyright notice and permission text of Emscripten and of the JSON library in PROJ", () => {
    const notices = read(NOTICES);
    const section = (title: string) => notices.split(new RegExp(`^## ${title}\\s*$`, "m"))[1]?.split(/^## /m)[0] ?? "";

    const emscripten = words(section("Emscripten"));
    expect(emscripten).toContain("Copyright (c) 2010-2014 Emscripten authors, see AUTHORS file.");
    expect(emscripten).toContain("Permission is hereby granted, free of charge, to any person obtaining a copy");
    expect(emscripten).toContain("University of Illinois/NCSA Open Source License");

    const json = words(section("JSON for Modern C\\+\\+ \\(nlohmann/json\\)"));
    expect(json).toContain("Copyright (c) 2013-2019 Niels Lohmann");
    expect(json).toContain("Permission is hereby granted, free of charge, to any person obtaining a copy");
  });

  for (const readme of ["README.md", "README.ja.md"]) {
    it(`${readme} points at the notices from its License section`, () => {
      const text = read(readme);
      const licence = text.slice(text.search(/^## (License|ライセンス)\s*$/m));
      expect(licence).toContain(`./${NOTICES}`);
    });
  }
});

describe("network access and untrusted input in the README files", () => {
  for (const readme of ["README.md", "README.ja.md"]) {
    it(`${readme} says when Atlas contacts another host and how to control it`, () => {
      const text = read(readme);
      expect(text).toContain("enableNetwork");
      expect(text).toContain("cdn.proj.org");
      expect(text).toContain("userProjection");
      expect(text).toContain("projWasmAssetBaseUrl");
      expect(text).toContain("://");
      expect(text).toContain("PROJJSON");
    });
  }
});

describe("changelog", () => {
  it("says why the runtime dependency stays on a prerelease", () => {
    const unreleased = read("CHANGELOG.md").split(/^## \[Unreleased\]\s*$/m)[1]?.split(/^## \[/m)[0] ?? "";
    const lines = unreleased.split("\n").filter((line) => line.includes("0.1.0-alpha8") && /proj-wasm 0\.1\.0(?!-)/.test(line));
    // One line per language.
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
