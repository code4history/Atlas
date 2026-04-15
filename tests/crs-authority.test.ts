import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  extractProjinfoPayload,
  parseProjSearchPaths,
} = require("../scripts/lib/crs-authority-helpers.cjs");

describe("CRS authority helpers", () => {
  it("extracts WKT2 and PROJ payloads from projinfo output", () => {
    expect(extractProjinfoPayload("WKT2:2019", `WKT2:2019 string:
PROJCRS["JGD2000 / Japan Plane Rectangular CS I",ID["EPSG",2443]]`)).toBe(
      'PROJCRS["JGD2000 / Japan Plane Rectangular CS I",ID["EPSG",2443]]',
    );
    expect(extractProjinfoPayload("PROJ.4", `PROJ.4 string:
+proj=tmerc +lat_0=33 +lon_0=129.5 +type=crs`)).toBe(
      "+proj=tmerc +lat_0=33 +lon_0=129.5 +type=crs",
    );
  });

  it("parses proj search paths as newline-separated directories", () => {
    expect(parseProjSearchPaths(`/tmp/proj
/opt/homebrew/share/proj

/usr/local/share/proj
`)).toEqual([
      "/tmp/proj",
      "/opt/homebrew/share/proj",
      "/usr/local/share/proj",
    ]);
  });
});
