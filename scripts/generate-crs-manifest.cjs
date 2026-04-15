#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");

const {
  extractAuthorityIdFromWkt,
  extractWktName,
  inferDatumFamily,
  inferKind,
  inferPriority,
  inferWgsEquivalent,
  isProjectedPrjPath,
  isScopeIncluded,
} = require("./lib/crs-seed-helpers.cjs");

function usage() {
  console.log(
    "Usage: node scripts/generate-crs-manifest.cjs <zip-path> [--scope=core|all] [--out-dir=path]",
  );
}

function parseArgs(argv) {
  const options = {
    scope: "core",
    outDir: "data/crs-manifests",
  };
  let zipPath;

  for (const arg of argv) {
    if (arg.startsWith("--scope=")) {
      options.scope = arg.slice("--scope=".length);
    } else if (arg.startsWith("--out-dir=")) {
      options.outDir = arg.slice("--out-dir=".length);
    } else if (!zipPath) {
      zipPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!zipPath) throw new Error("zip-path is required");
  if (!["core", "all"].includes(options.scope)) {
    throw new Error(`Unsupported scope: ${options.scope}`);
  }

  return { zipPath, ...options };
}

async function loadZip(zipPath) {
  const buffer = await fs.promises.readFile(zipPath);
  return JSZip.loadAsync(buffer);
}

function listZipEntries(zip) {
  return Object.keys(zip.files);
}

async function readZipEntry(zip, entry) {
  return (await zip.file(entry).async("string")).trim();
}

async function main() {
  const { zipPath, scope, outDir } = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, "..");
  const resolvedZipPath = path.resolve(zipPath);
  const resolvedOutDir = path.resolve(root, outDir);

  fs.mkdirSync(resolvedOutDir, { recursive: true });
  const zip = await loadZip(resolvedZipPath);

  const entries = listZipEntries(zip)
    .filter((entry) => isProjectedPrjPath(entry))
    .filter((entry) => isScopeIncluded(inferKind(entry), scope));

  const records = [];
  for (const entry of entries) {
    const crsText = await readZipEntry(zip, entry);
    const authorityId = extractAuthorityIdFromWkt(crsText);
    if (!authorityId || authorityId.authority !== "EPSG") continue;

    const datumFamily = inferDatumFamily(entry);
    const kind = inferKind(entry);

    records.push({
      code: `${authorityId.authority}:${authorityId.code}`,
      epsg_code: authorityId.code,
      authority: authorityId.authority,
      discovered_name: extractWktName(crsText),
      datum_family: datumFamily,
      wgs_equivalent: inferWgsEquivalent(datumFamily),
      kind,
      priority: inferPriority(kind),
      country: "JP",
      discovery_source: "PRJFiles_JapanV4",
      discovery_path: entry,
    });
  }

  records.sort((left, right) => {
    return left.kind.localeCompare(right.kind) ||
      left.datum_family.localeCompare(right.datum_family) ||
      left.code.localeCompare(right.code);
  });

  const jsonPath = path.join(resolvedOutDir, `system_crs_manifest.${scope}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(records, null, 2)}\n`);

  console.log(`Wrote ${records.length} manifest rows`);
  console.log(jsonPath);
}

main().catch((error) => {
  usage();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
