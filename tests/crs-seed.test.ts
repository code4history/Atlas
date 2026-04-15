import { describe, expect, it } from "vitest";
import {
  bboxToPolygonWkt,
  extractAuthorityIdFromWkt,
  extractWktName,
  inferApproximateBbox,
  inferDatumFamily,
  inferKind,
  inferWgsEquivalent,
  isProjectedPrjPath,
  isScopeIncluded,
} from "../src/crs-seed.ts";

describe("CRS seed helpers", () => {
  it("recognizes projected English PRJ paths", () => {
    expect(isProjectedPrjPath(
      "日本周辺座標系_WKT2_英語/日本周辺座標系/投影座標系/UTM 座標系/WGS 1984/WGS_1984_UTM_Zone_54N.prj",
    )).toBe(true);
    expect(isProjectedPrjPath(
      "日本周辺座標系_WKT2_日本語/日本周辺座標系/地理座標系/WGS 1984.prj",
    )).toBe(false);
  });

  it("infers datum family and wgs-equivalent flag", () => {
    expect(inferDatumFamily("/日本測地系2024 (JGD2024)/x.prj")).toBe("jgd2024");
    expect(inferDatumFamily("/投影座標系/Web メルカトル/x.prj")).toBe("wgs84");
    expect(inferWgsEquivalent("wgs84")).toBe(true);
    expect(inferWgsEquivalent("tokyo")).toBe(false);
  });

  it("infers projected kinds and scope inclusion", () => {
    expect(inferKind("/投影座標系/UTM 座標系/WGS 1984/x.prj")).toBe("utm");
    expect(inferKind("/投影座標系/平面直角座標系/日本測地系2000 (JGD2000)/x.prj"))
      .toBe("japan_plane_rectangular");
    expect(isScopeIncluded("japan_plane_rectangular", "core")).toBe(true);
    expect(isScopeIncluded("regional_map", "core")).toBe(false);
  });

  it("extracts authority ids and root names from WKT", () => {
    const wkt = 'PROJCRS["JGD_2000_Japan_Zone_9",BASEGEOGCRS["GCS_JGD_2000"],ID["EPSG","2451"]]';
    expect(extractWktName(wkt)).toBe("JGD_2000_Japan_Zone_9");
    expect(extractAuthorityIdFromWkt(wkt)).toEqual({
      authority: "EPSG",
      code: "2451",
    });
  });

  it("creates approximate bbox values and WKT polygons", () => {
    const bbox = inferApproximateBbox(
      "/投影座標系/UTM 座標系/WGS 1984/WGS_1984_UTM_Zone_54N.prj",
      "utm",
    );
    expect(bbox).toEqual({
      west: 138,
      south: 0,
      east: 144,
      north: 84,
    });
    expect(bboxToPolygonWkt(bbox)).toBe(
      "POLYGON((138 0, 144 0, 144 84, 138 84, 138 0))",
    );
  });
});
