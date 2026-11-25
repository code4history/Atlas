import { describe, expect, it } from "vitest";

import { MAX_DEFINITION_LENGTH, isUsableDefinition } from "../src/definition-guard.ts";

describe("isUsableDefinition", () => {
  it("accepts PROJ strings, pipelines and WKT", () => {
    for (const definition of [
      "+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs",
      "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
      "+proj=pipeline +step +inv +proj=utm +zone=53 +ellps=GRS80 +step +proj=unitconvert +xy_in=rad +xy_out=deg",
      'PROJCRS["A \"\"quoted\"\" name",BASEGEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563]]],CONVERSION["UTM zone 53N",METHOD["Transverse Mercator"]],CS[Cartesian,2],ID["EPSG",32653]]',
      "EPSG:6674",
    ]) {
      expect(isUsableDefinition(definition), definition).toBe(true);
    }
  });

  it("refuses what is not a non-empty string within the length limit", () => {
    for (const definition of [undefined, null, 4326, {}, [], "", "x".repeat(MAX_DEFINITION_LENGTH + 1)]) {
      expect(isUsableDefinition(definition)).toBe(false);
    }
    expect(isUsableDefinition("x".repeat(MAX_DEFINITION_LENGTH))).toBe(true);
  });

  it("refuses a definition with a URL, a backslash, or in a JSON form", () => {
    for (const definition of [
      "+proj=utm +zone=53 +ellps=bessel +nadgrids=https://example.invalid/a.gsb +type=crs",
      "+proj=utm +zone=53 +ellps=GRS80 +title=a\\b +type=crs",
      '{"type":"GeographicCRS","name":"WGS 84"}',
      '  \n{"type":"GeographicCRS","name":"WGS 84"}',
      '[{"type":"GeographicCRS"}]',
    ]) {
      expect(isUsableDefinition(definition), definition).toBe(false);
    }
  });
});
