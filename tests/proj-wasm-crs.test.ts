import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  filterProjectedCrsRows,
  listProjectedCrsFromProjWasm,
  type ProjDatabaseRow,
} from "../src/proj-wasm-crs.ts";

describe("proj-wasm projected CRS lookup", () => {
  it("excludes deprecated rows by default in pure filtering", () => {
    const rows: ProjDatabaseRow[] = [
      {
        authName: "EPSG",
        code: "1000",
        name: "Active CRS",
        type: 15,
        deprecated: false,
        bboxValid: true,
        westLonDegree: 130,
        southLatDegree: 30,
        eastLonDegree: 140,
        northLatDegree: 40,
        areaName: "Japan - onshore.",
      },
      {
        authName: "ESRI",
        code: "2000",
        name: "Deprecated CRS",
        type: 15,
        deprecated: true,
        bboxValid: true,
        westLonDegree: 130,
        southLatDegree: 30,
        eastLonDegree: 140,
        northLatDegree: 40,
        areaName: "Japan - onshore.",
      },
    ];

    const filtered = filterProjectedCrsRows(rows, {
      extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
    });

    expect(filtered.map((row) => `${row.authName}:${row.code}`)).toEqual(["EPSG:1000"]);
  });

  it("includes deprecated rows when includeDeprecated is true in pure filtering", () => {
    const rows: ProjDatabaseRow[] = [
      {
        authName: "EPSG",
        code: "1000",
        name: "Active CRS",
        type: 15,
        deprecated: false,
        bboxValid: true,
        westLonDegree: 130,
        southLatDegree: 30,
        eastLonDegree: 140,
        northLatDegree: 40,
        areaName: "Japan - onshore.",
      },
      {
        authName: "ESRI",
        code: "2000",
        name: "Deprecated CRS",
        type: 15,
        deprecated: true,
        bboxValid: true,
        westLonDegree: 130,
        southLatDegree: 30,
        eastLonDegree: 140,
        northLatDegree: 40,
        areaName: "Japan - onshore.",
      },
    ];

    const filtered = filterProjectedCrsRows(rows, {
      includeDeprecated: true,
      extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
    });

    expect(filtered.map((row) => `${row.authName}:${row.code}`)).toEqual([
      "EPSG:1000",
      "ESRI:2000",
    ]);
  });

  it("applies default bbox padding during pure filtering", () => {
    const rows: ProjDatabaseRow[] = [
      {
        authName: "EPSG",
        code: "1000",
        name: "Nearly Matching CRS",
        type: 15,
        deprecated: false,
        bboxValid: true,
        westLonDegree: 135.45,
        southLatDegree: 34.6,
        eastLonDegree: 135.6,
        northLatDegree: 34.75,
        areaName: "Japan - onshore.",
      },
    ];

    const filtered = filterProjectedCrsRows(rows, {
      extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
    });

    expect(filtered.map((row) => `${row.authName}:${row.code}`)).toEqual(["EPSG:1000"]);
  });

  it("allows bbox padding to be disabled during pure filtering", () => {
    const rows: ProjDatabaseRow[] = [
      {
        authName: "EPSG",
        code: "1000",
        name: "Nearly Matching CRS",
        type: 15,
        deprecated: false,
        bboxValid: true,
        westLonDegree: 135.45,
        southLatDegree: 34.6,
        eastLonDegree: 135.6,
        northLatDegree: 34.75,
        areaName: "Japan - onshore.",
      },
    ];

    const filtered = filterProjectedCrsRows(rows, {
      bboxPaddingDeg: 0,
      extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
    });

    expect(filtered).toEqual([]);
  });

  it("exposes projCreate in proj-wasm", async () => {
    const proj = await import("proj-wasm");
    expect(typeof (proj as { projCreate?: unknown }).projCreate).toBe("function");
  });

  it("round-trips a Zone B pipeline transform with projCreate", async () => {
    const proj = await import("proj-wasm");
    await proj.init();

    const pipeline =
      "+proj=pipeline " +
      "+step +inv +proj=poly +lat_0=40.5 +lon_0=135 " +
      "+x_0=914398.5307444408 +y_0=1828797.0614888816 " +
      "+ellps=clrk66 +to_meter=0.9143985307444408 " +
      "+step +proj=cart +ellps=bessel " +
      "+step +proj=helmert +x=-146.336 +y=506.832 +z=680.254 " +
      "+step +inv +proj=cart +ellps=WGS84 " +
      "+step +proj=unitconvert +xy_in=rad +xy_out=deg";

    const op = await proj.projCreate({ definition: pipeline });
    const coords = await proj.coordArray(1);
    const input = [889000, 1296000, 0, 0] as const;

    await proj.setCoords(coords, [input]);
    await proj.projTransArray({
      p: op,
      direction: proj.PJ_FWD,
      n: 1,
      coord: coords,
    });
    const forward = await proj.getCoords(coords, 0);

    await proj.projTransArray({
      p: op,
      direction: proj.PJ_INV,
      n: 1,
      coord: coords,
    });
    const inverse = await proj.getCoords(coords, 0);

    expect(forward[0]).toBeCloseTo(133.8895712888, 10);
    expect(forward[1]).toBeCloseTo(34.6980491704, 10);
    expect(inverse[0]).toBeCloseTo(input[0], 6);
    expect(inverse[1]).toBeCloseTo(input[1], 6);
  });

  it("matches the two-stage proj-wasm transform within floating-point tolerance", async () => {
    const proj = await import("proj-wasm");
    await proj.init();

    const zoneB =
      "+proj=poly +lat_0=40.5 +lon_0=135 " +
      "+x_0=914398.5307444408 +y_0=1828797.0614888816 " +
      "+ellps=clrk66 +to_meter=0.9143985307444408 +no_defs +type=crs";
    const nad27Longlat =
      "+proj=longlat +ellps=clrk66 +datum=NAD27 +no_defs +type=crs";
    const tokyoLonglat =
      "+proj=longlat +ellps=bessel " +
      "+towgs84=-146.336,506.832,680.254 +no_defs +type=crs";
    const pipeline =
      "+proj=pipeline " +
      "+step +inv +proj=poly +lat_0=40.5 +lon_0=135 " +
      "+x_0=914398.5307444408 +y_0=1828797.0614888816 " +
      "+ellps=clrk66 +to_meter=0.9143985307444408 " +
      "+step +proj=cart +ellps=bessel " +
      "+step +proj=helmert +x=-146.336 +y=506.832 +z=680.254 " +
      "+step +inv +proj=cart +ellps=WGS84 " +
      "+step +proj=unitconvert +xy_in=rad +xy_out=deg";

    const stage1 = await proj.projCreateCrsToCrs({
      source_crs: zoneB,
      target_crs: nad27Longlat,
    });
    const stage2 = await proj.projCreateCrsToCrs({
      source_crs: tokyoLonglat,
      target_crs: "EPSG:4326",
    });
    const direct = await proj.projCreate({ definition: pipeline });

    const input = [889000, 1296000, 0, 0] as const;

    const step1Coords = await proj.coordArray(1);
    await proj.setCoords(step1Coords, [input]);
    await proj.projTransArray({
      p: stage1,
      direction: proj.PJ_FWD,
      n: 1,
      coord: step1Coords,
    });
    const after1 = await proj.getCoords(step1Coords, 0);

    const step2Coords = await proj.coordArray(1);
    await proj.setCoords(step2Coords, [after1]);
    await proj.projTransArray({
      p: stage2,
      direction: proj.PJ_FWD,
      n: 1,
      coord: step2Coords,
    });
    const after2 = await proj.getCoords(step2Coords, 0);

    const directCoords = await proj.coordArray(1);
    await proj.setCoords(directCoords, [input]);
    await proj.projTransArray({
      p: direct,
      direction: proj.PJ_FWD,
      n: 1,
      coord: directCoords,
    });
    const directResult = await proj.getCoords(directCoords, 0);

    // projCreate outputs lon/lat here, while EPSG:4326 from projCreateCrsToCrs came back as lat/lon.
    expect(directResult[0]).toBeCloseTo(after2[1], 10);
    expect(directResult[1]).toBeCloseTo(after2[0], 10);
  });

  it("returns projected CRS metadata filtered by area and within extent", async () => {
    const rows = await listProjectedCrsFromProjWasm({
      includeDeprecated: true,
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
      area: "Japan",
      onshoreOnly: true,
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.id === "EPSG:2448")).toBe(true);
    expect(rows.some((row) => row.id === "EPSG:6674")).toBe(true);
    expect(rows.every((row) => row.areaName.includes("Japan - onshore"))).toBe(true);
    expect(rows.every((row) => row.bbox.west <= 135.4)).toBe(true);
    expect(rows.every((row) => row.bbox.south <= 34.55)).toBe(true);
    expect(rows.every((row) => row.bbox.east >= 135.65)).toBe(true);
    expect(rows.every((row) => row.bbox.north >= 34.8)).toBe(true);
    expect(rows.every((row) => typeof row.wkt2 === "string" && row.wkt2.startsWith("PROJCRS["))).toBe(true);
    expect(rows.every((row) => row.proj4.includes("+type=crs"))).toBe(true);
  });

  it("excludes deprecated projected CRS by default", async () => {
    const rows = await listProjectedCrsFromProjWasm({
      area: "Pacific Ocean",
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.deprecated === false)).toBe(true);
  });

  it("does not reduce integration results when includeDeprecated is true", async () => {
    const withoutDeprecated = await listProjectedCrsFromProjWasm({
      area: "Japan",
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
    });

    const withDeprecated = await listProjectedCrsFromProjWasm({
      area: "Japan",
      includeDeprecated: true,
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
    });

    expect(withDeprecated.length).toBeGreaterThanOrEqual(withoutDeprecated.length);
  });

  it("keeps offshore results when onshoreOnly is false", async () => {
    const rows = await listProjectedCrsFromProjWasm({
      area: "Japan",
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
    });

    expect(rows.some((row) => row.id === "EPSG:3099")).toBe(true);
    expect(rows.some((row) => row.areaName.includes("onshore and offshore"))).toBe(true);
  });

  it("uses proj.db only by default", async () => {
    const rows = await listProjectedCrsFromProjWasm({
      area: "Japan City Plans - Historical Grid",
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
    });

    expect(rows).toEqual([]);
  });

  it("includes built-in custom projections when requested", async () => {
    const rows = await listProjectedCrsFromProjWasm({
      includeCustomProjections: true,
      area: "Japan City Plans - Historical Grid",
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
    });

    expect(rows.map((row) => row.id)).toContain("UTJCP:ZONE-B");
    expect(rows.every((row) => row.definitionType === "custom")).toBe(true);
  });

  it("includes user projection JSON when requested", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "atlas-user-proj-"));
    const filePath = join(tempDir, "user-projections.json");
    await writeFile(filePath, JSON.stringify({
      projections: [
        {
          authority: "USER",
          code: "TEST-1",
          name: "User Projection Test",
          areaName: "User Projection Test Area",
          deprecated: false,
          bbox: {
            west: 135.45,
            south: 34.6,
            east: 135.6,
            north: 34.75,
          },
          proj4: "+proj=longlat +datum=WGS84 +type=crs",
          wkt2: null,
          isApproximate: true,
          source: [
            "https://example.invalid/user-projection-test",
          ],
        },
      ],
    }), "utf8");

    const rows = await listProjectedCrsFromProjWasm({
      area: "User Projection Test Area",
      userProjectionFile: filePath,
      extent: {
        west: 135.4,
        south: 34.55,
        east: 135.65,
        north: 34.8,
      },
    });

    expect(rows.map((row) => row.id)).toContain("USER:TEST-1");
    expect(rows.every((row) => row.definitionType === "user")).toBe(true);
  });
});
