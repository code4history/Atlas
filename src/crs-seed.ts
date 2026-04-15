export type CandidateDatumFamily =
  | "wgs84"
  | "tokyo"
  | "jgd2000"
  | "jgd2011"
  | "jgd2024";

export type CandidateKind =
  | "web_mercator"
  | "utm"
  | "japan_plane_rectangular"
  | "japan_land_area"
  | "regional_map"
  | "weather_map";

export type CandidateSeedScope = "core" | "all";

export interface CandidateAuthorityId {
  authority: string;
  code: string;
}

export interface CandidateBbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const WORLD_WEB_MERCATOR_BBOX: CandidateBbox = {
  west: -180,
  south: -85.06,
  east: 180,
  north: 85.06,
};

const JAPAN_BBOX_4326: CandidateBbox = {
  west: 122,
  south: 20,
  east: 154,
  north: 46,
};

export function isProjectedPrjPath(pathname: string): boolean {
  return pathname.endsWith(".prj") &&
    pathname.includes("日本周辺座標系_WKT2_英語/") &&
    pathname.includes("/投影座標系/");
}

export function inferDatumFamily(pathname: string): CandidateDatumFamily {
  if (pathname.includes("/投影座標系/Web メルカトル/")) return "wgs84";
  if (pathname.includes("/WGS 1984/")) return "wgs84";
  if (pathname.includes("/日本測地系 (Tokyo)/")) return "tokyo";
  if (pathname.includes("/日本測地系2000 (JGD2000)/")) return "jgd2000";
  if (pathname.includes("/日本測地系2011 (JGD2011)/")) return "jgd2011";
  if (pathname.includes("/日本測地系2024 (JGD2024)/")) return "jgd2024";
  throw new Error(`Unsupported datum family in path: ${pathname}`);
}

export function inferKind(pathname: string): CandidateKind {
  if (pathname.includes("/投影座標系/Web メルカトル/")) return "web_mercator";
  if (pathname.includes("/投影座標系/UTM 座標系/")) return "utm";
  if (pathname.includes("/投影座標系/平面直角座標系/")) {
    return "japan_plane_rectangular";
  }
  if (pathname.includes("/投影座標系/全国都道府県市区町村面積調/")) {
    return "japan_land_area";
  }
  if (pathname.includes("/投影座標系/地方図・国際図用座標系/")) {
    return "regional_map";
  }
  if (pathname.includes("/投影座標系/天気図/")) return "weather_map";
  throw new Error(`Unsupported projected kind in path: ${pathname}`);
}

export function isScopeIncluded(
  kind: CandidateKind,
  scope: CandidateSeedScope,
): boolean {
  if (scope === "all") return true;
  return [
    "web_mercator",
    "utm",
    "japan_plane_rectangular",
  ].includes(kind);
}

export function inferWgsEquivalent(datumFamily: CandidateDatumFamily): boolean {
  return datumFamily !== "tokyo";
}

export function extractAuthorityIdFromWkt(wkt: string): CandidateAuthorityId | undefined {
  const matches = [...wkt.matchAll(/ID\["([^"]+)","([^"]+)"\]/g)];
  const last = matches.at(-1);
  if (!last) return undefined;
  return {
    authority: last[1],
    code: last[2],
  };
}

export function extractWktName(wkt: string): string {
  const match = wkt.match(/^[A-Z]+CRS\["([^"]+)"/);
  if (!match) throw new Error(`Unable to extract WKT root name from: ${wkt}`);
  return match[1];
}

export function inferPriority(kind: CandidateKind): number {
  switch (kind) {
    case "web_mercator":
      return 100;
    case "utm":
      return 90;
    case "japan_plane_rectangular":
      return 80;
    case "japan_land_area":
      return 60;
    case "regional_map":
      return 50;
    case "weather_map":
      return 40;
  }
}

function extractUtmZone(pathname: string): number {
  const match = pathname.match(/Zone[_ ](\d{2})N|第 ?(\d{2}) ?帯 ?N/u);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) throw new Error(`Unable to extract UTM zone from path: ${pathname}`);
  return Number(raw);
}

export function inferApproximateBbox(pathname: string, kind: CandidateKind): CandidateBbox {
  if (kind === "web_mercator") return WORLD_WEB_MERCATOR_BBOX;
  if (kind === "utm") {
    const zone = extractUtmZone(pathname);
    const west = (zone - 1) * 6 - 180;
    return {
      west,
      south: 0,
      east: west + 6,
      north: 84,
    };
  }
  return JAPAN_BBOX_4326;
}

export function bboxToPolygonWkt(bbox: CandidateBbox): string {
  const { west, south, east, north } = bbox;
  return `POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`;
}
