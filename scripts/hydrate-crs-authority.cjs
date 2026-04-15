#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { bboxToPolygonWkt } = require("./lib/crs-seed-helpers.cjs");
const {
  detectProjDbPath,
  readAuthorityExtent,
  runProjinfoSingleLine,
} = require("./lib/crs-authority-helpers.cjs");

function usage() {
  console.log(
    "Usage: node scripts/hydrate-crs-authority.cjs <manifest-json> <output-seed-json> [proj-db-path]",
  );
}

async function main() {
  const [manifestJson, outputSeedJson, explicitProjDbPath] = process.argv.slice(2);
  if (!manifestJson || !outputSeedJson) {
    throw new Error("manifest-json and output-seed-json are required");
  }

  const manifestPath = path.resolve(manifestJson);
  const outputPath = path.resolve(outputSeedJson);
  const projDbPath = explicitProjDbPath
    ? path.resolve(explicitProjDbPath)
    : detectProjDbPath();

  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf-8"));
  const rows = manifest.map((entry) => {
    const authority = entry.authority ?? "EPSG";
    const code = entry.epsg_code ?? entry.code.replace(/^EPSG:/u, "");
    const crsRef = `${authority}:${code}`;

    const extent = readAuthorityExtent(projDbPath, authority, code);
    const crsText = runProjinfoSingleLine("WKT2:2019", crsRef);
    const projText = runProjinfoSingleLine("PROJ", crsRef);

    return {
      code: crsRef,
      name: extent.name,
      authority,
      crs_text: crsText,
      proj_text: projText,
      bbox_west: extent.west,
      bbox_south: extent.south,
      bbox_east: extent.east,
      bbox_north: extent.north,
      bbox_geom: bboxToPolygonWkt(extent),
      datum_family: entry.datum_family,
      wgs_equivalent: entry.wgs_equivalent,
      kind: entry.kind,
      priority: entry.priority,
      country: entry.country,
      source: "PROJ proj.db",
    };
  });

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(`${outputPath}`, JSON.stringify(rows, null, 2) + "\n");

  console.log(`Hydrated ${rows.length} candidate rows to ${outputPath}`);
  console.log(`Authority source: ${projDbPath}`);
}

main().catch((error) => {
  usage();
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
