import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../dist-demo/", import.meta.url);
const requiredFiles = [
  "index.html",
  "demo/crs-candidate-lookup.html",
  "demo/benchmark.html",
  "assets/proj.db",
  "assets/proj.ini",
  "assets/proj-worker.mjs",
  "assets/fetch-worker.mjs",
  "assets/proj-emscripten.js",
  "assets/proj-emscripten.wasm",
];

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

async function assertFile(path) {
  const info = await stat(new URL(path, root));
  if (!info.isFile()) {
    throw new Error(`${path} is not a file`);
  }
  return info;
}

async function listFiles(dirUrl = root) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      files.push(...await listFiles(url));
    } else {
      files.push(relative(root.pathname, url.pathname));
    }
  }
  return files;
}

for (const file of requiredFiles) {
  await assertFile(file);
}

const projDb = await assertFile("assets/proj.db");
if (projDb.size < 1_000_000) {
  throw new Error(`assets/proj.db is unexpectedly small (${projDb.size} bytes)`);
}

const portalHtml = await readText("index.html");
const demoHtml = await readText("demo/crs-candidate-lookup.html");
const benchmarkHtml = await readText("demo/benchmark.html");
if (/http-equiv=["']refresh/i.test(portalHtml) || /http-equiv=["']refresh/i.test(demoHtml)) {
  throw new Error("demo pages must not be redirect stubs");
}
if (!portalHtml.includes("/Atlas/assets/") || !demoHtml.includes("/Atlas/assets/")) {
  throw new Error("built HTML does not resolve bundled modules under /Atlas/assets/");
}
if (!/\/Atlas\/assets\/[^"']+\.js/.test(benchmarkHtml)) {
  throw new Error("built benchmark.html does not resolve its bundle under /Atlas/assets/");
}

// The portal links to both demo pages, each on its own card.
const portalCards = portalHtml.match(/class="c4h-demo-card"/g)?.length ?? 0;
if (portalCards < 2) {
  throw new Error(`the portal has ${portalCards} demo card(s); the benchmark demo needs its own card`);
}
for (const page of ["./demo/crs-candidate-lookup.html", "./demo/benchmark.html"]) {
  if (!portalHtml.includes(`href="${page}"`)) {
    throw new Error(`the portal does not link to ${page}`);
  }
}

// The benchmark data is bundled as two assets; the built page must point at both of them.
const builtFiles = await listFiles();
const benchmarkAssets = builtFiles.filter((file) => /^assets\/benchmark-places[^/]*\.json$/.test(file));
if (benchmarkAssets.length !== 2) {
  throw new Error(`expected the two benchmark data assets, found ${benchmarkAssets.join(", ") || "none"}`);
}
const placesAsset = benchmarkAssets.find((file) => !file.includes("provenance"));
const provenanceAsset = benchmarkAssets.find((file) => file.includes("provenance"));
if (!placesAsset || !provenanceAsset) {
  throw new Error(`benchmark data assets are not the expected pair: ${benchmarkAssets.join(", ")}`);
}
const places = JSON.parse(await readText(placesAsset));
if (!Array.isArray(places) || places.length === 0) {
  throw new Error(`${placesAsset} does not hold a non-empty array of places`);
}
const provenance = JSON.parse(await readText(provenanceAsset));
if (!Array.isArray(provenance.sources) || provenance.sources.length === 0) {
  throw new Error(`${provenanceAsset} does not hold the source records`);
}
for (const place of places) {
  if (!Number.isFinite(place.lon) || !Number.isFinite(place.lat)) {
    throw new Error(`${placesAsset} has a place without numeric lon/lat: ${JSON.stringify(place)}`);
  }
}
const benchmarkScripts = builtFiles.filter((file) => /^assets\/.*\.js$/.test(file));
const referencedAssets = new Set();
for (const file of benchmarkScripts) {
  const text = await readText(file);
  for (const match of text.matchAll(/\/Atlas\/assets\/([^"'\s)]+)/g)) {
    referencedAssets.add(`assets/${match[1]}`);
  }
}
for (const asset of [placesAsset, provenanceAsset]) {
  if (!referencedAssets.has(asset)) {
    throw new Error(`${asset} is not referenced by any built script`);
  }
}
for (const asset of referencedAssets) {
  if (/\.(?:js|mjs|json|css|wasm|db|ini)$/.test(asset)) await assertFile(asset);
}

const textFiles = (await listFiles()).filter((file) => /\.(?:html|js|mjs|css)$/.test(file));
for (const file of textFiles) {
  const text = await readText(file);
  if (text.includes("coi-serviceworker")) {
    throw new Error(`${file} references coi-serviceworker`);
  }
  if (text.includes("Cross-Origin-Opener-Policy") || text.includes("Cross-Origin-Embedder-Policy")) {
    throw new Error(`${file} injects COOP/COEP headers`);
  }
  if (/["'`](?:\/assets\/)/.test(text)) {
    throw new Error(`${file} contains an origin-rooted /assets/ URL`);
  }
}

console.log("dist-demo Pages artifact verified.");
