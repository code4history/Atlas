const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function parseProjSearchPaths(output) {
  return output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function extractProjinfoPayload(formatLabel, output) {
  const normalized = formatLabel === "PROJ" ? "PROJ(?:\\.4)?" : formatLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = output.match(new RegExp(`^${normalized} string:\\n([\\s\\S]+)$`, "u"));
  if (!match) {
    throw new Error(`Unable to extract ${formatLabel} payload from projinfo output`);
  }
  return match[1].trim();
}

function runProjinfoSingleLine(format, crsRef) {
  return execFileSync(
    "projinfo",
    ["--single-line", "-q", "-o", format, crsRef],
    { encoding: "utf-8" },
  ).trim();
}

function detectProjDbPath() {
  if (process.env.PROJ_DB_PATH && fs.existsSync(process.env.PROJ_DB_PATH)) {
    return process.env.PROJ_DB_PATH;
  }

  const output = execFileSync("projinfo", ["--searchpaths"], { encoding: "utf-8" });
  for (const directory of parseProjSearchPaths(output)) {
    const candidate = `${directory}/proj.db`;
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Unable to locate proj.db. Set PROJ_DB_PATH or install PROJ with projinfo.");
}

function readAuthorityExtent(projDbPath, authority, code) {
  if (!/^\d+$/u.test(code)) {
    throw new Error(`Unsupported authority code: ${code}`);
  }

  const query = `
SELECT
  p.name AS name,
  e.west_lon AS west_lon,
  e.south_lat AS south_lat,
  e.east_lon AS east_lon,
  e.north_lat AS north_lat
FROM projected_crs p
JOIN usage u
  ON u.object_table_name = 'projected_crs'
 AND u.object_auth_name = p.auth_name
 AND u.object_code = p.code
JOIN extent e
  ON e.auth_name = u.extent_auth_name
 AND e.code = u.extent_code
WHERE p.auth_name = '${authority}'
  AND p.code = '${code}'
LIMIT 1;
`.trim();

  const output = execFileSync(
    "sqlite3",
    ["-json", projDbPath, query],
    { encoding: "utf-8" },
  ).trim();

  const rows = JSON.parse(output);
  const row = rows[0];
  if (!row) {
    throw new Error(`No projected CRS extent found for ${authority}:${code}`);
  }

  return {
    name: row.name,
    west: Number(row.west_lon),
    south: Number(row.south_lat),
    east: Number(row.east_lon),
    north: Number(row.north_lat),
  };
}

module.exports = {
  detectProjDbPath,
  extractProjinfoPayload,
  parseProjSearchPaths,
  readAuthorityExtent,
  runProjinfoSingleLine,
};
