function isProjectedPrjPath(pathname) {
  return pathname.endsWith(".prj") &&
    pathname.includes("日本周辺座標系_WKT2_英語/") &&
    pathname.includes("/投影座標系/");
}

function inferDatumFamily(pathname) {
  if (pathname.includes("/投影座標系/Web メルカトル/")) return "wgs84";
  if (pathname.includes("/WGS 1984/")) return "wgs84";
  if (pathname.includes("/日本測地系 (Tokyo)/")) return "tokyo";
  if (pathname.includes("/日本測地系2000 (JGD2000)/")) return "jgd2000";
  if (pathname.includes("/日本測地系2011 (JGD2011)/")) return "jgd2011";
  if (pathname.includes("/日本測地系2024 (JGD2024)/")) return "jgd2024";
  throw new Error(`Unsupported datum family in path: ${pathname}`);
}

function inferKind(pathname) {
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

function isScopeIncluded(kind, scope) {
  if (scope === "all") return true;
  return [
    "web_mercator",
    "utm",
    "japan_plane_rectangular",
  ].includes(kind);
}

function inferWgsEquivalent(datumFamily) {
  return datumFamily !== "tokyo";
}

function extractAuthorityIdFromWkt(wkt) {
  const matches = [...wkt.matchAll(/ID\["([^"]+)","([^"]+)"\]/g)];
  const last = matches.at(-1);
  if (!last) return undefined;
  return {
    authority: last[1],
    code: last[2],
  };
}

function extractWktName(wkt) {
  const match = wkt.match(/^[A-Z]+CRS\["([^"]+)"/);
  if (!match) throw new Error(`Unable to extract WKT root name from: ${wkt}`);
  return match[1];
}

function inferPriority(kind) {
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

function extractUtmZone(pathname) {
  const match = pathname.match(/Zone[_ ](\d{2})N|第 ?(\d{2}) ?帯 ?N/u);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) throw new Error(`Unable to extract UTM zone from path: ${pathname}`);
  return Number(raw);
}

function inferApproximateBbox(pathname, kind) {
  if (kind === "web_mercator") {
    return {
      west: -180,
      south: -85.06,
      east: 180,
      north: 85.06,
    };
  }
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
  return {
    west: 122,
    south: 20,
    east: 154,
    north: 46,
  };
}

function bboxToPolygonWkt(bbox) {
  const { west, south, east, north } = bbox;
  return `POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`;
}

module.exports = {
  bboxToPolygonWkt,
  extractAuthorityIdFromWkt,
  extractWktName,
  inferApproximateBbox,
  inferDatumFamily,
  inferKind,
  inferPriority,
  inferWgsEquivalent,
  isProjectedPrjPath,
  isScopeIncluded,
};
