import * as a from "proj-wasm";
import { readFile as w } from "node:fs/promises";
import { resolve as j } from "node:path";
const M = {
  west: -180,
  south: -85.06,
  east: 180,
  north: 85.06
}, N = {
  west: 122,
  south: 20,
  east: 154,
  north: 46
};
function G(e) {
  return e.endsWith(".prj") && e.includes("日本周辺座標系_WKT2_英語/") && e.includes("/投影座標系/");
}
function R(e) {
  if (e.includes("/投影座標系/Web メルカトル/") || e.includes("/WGS 1984/")) return "wgs84";
  if (e.includes("/日本測地系 (Tokyo)/")) return "tokyo";
  if (e.includes("/日本測地系2000 (JGD2000)/")) return "jgd2000";
  if (e.includes("/日本測地系2011 (JGD2011)/")) return "jgd2011";
  if (e.includes("/日本測地系2024 (JGD2024)/")) return "jgd2024";
  throw new Error(`Unsupported datum family in path: ${e}`);
}
function Z(e) {
  if (e.includes("/投影座標系/Web メルカトル/")) return "web_mercator";
  if (e.includes("/投影座標系/UTM 座標系/")) return "utm";
  if (e.includes("/投影座標系/平面直角座標系/"))
    return "japan_plane_rectangular";
  if (e.includes("/投影座標系/全国都道府県市区町村面積調/"))
    return "japan_land_area";
  if (e.includes("/投影座標系/地方図・国際図用座標系/"))
    return "regional_map";
  if (e.includes("/投影座標系/天気図/")) return "weather_map";
  throw new Error(`Unsupported projected kind in path: ${e}`);
}
function L(e, t) {
  return t === "all" ? !0 : [
    "web_mercator",
    "utm",
    "japan_plane_rectangular"
  ].includes(e);
}
function T(e) {
  return e !== "tokyo";
}
function Y(e) {
  const r = [...e.matchAll(/ID\["([^"]+)","([^"]+)"\]/g)].at(-1);
  if (r)
    return {
      authority: r[1],
      code: r[2]
    };
}
function B(e) {
  const t = e.match(/^[A-Z]+CRS\["([^"]+)"/);
  if (!t) throw new Error(`Unable to extract WKT root name from: ${e}`);
  return t[1];
}
function O(e) {
  switch (e) {
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
function h(e) {
  const t = e.match(/Zone[_ ](\d{2})N|第 ?(\d{2}) ?帯 ?N/u), r = t?.[1] ?? t?.[2];
  if (!r) throw new Error(`Unable to extract UTM zone from path: ${e}`);
  return Number(r);
}
function K(e, t) {
  if (t === "web_mercator") return M;
  if (t === "utm") {
    const I = (h(e) - 1) * 6 - 180;
    return {
      west: I,
      south: 0,
      east: I + 6,
      north: 84
    };
  }
  return N;
}
function X(e) {
  const { west: t, south: r, east: I, north: n } = e;
  return `POLYGON((${t} ${r}, ${I} ${r}, ${I} ${n}, ${t} ${n}, ${t} ${r}))`;
}
let i, A;
const f = new URL("data:application/json;base64,ewogICJwcm9qZWN0aW9ucyI6IFsKICAgIHsKICAgICAgImF1dGhvcml0eSI6ICJVVEpDUCIsCiAgICAgICJjb2RlIjogIlpPTkUtQSIsCiAgICAgICJuYW1lIjogIkphcGFuIENpdHkgUGxhbnMgUG9seWNvbmljIEdyaWQgWm9uZSBBIiwKICAgICAgImFyZWFOYW1lIjogIkphcGFuIENpdHkgUGxhbnMgLSBIaXN0b3JpY2FsIEdyaWQgWm9uZSBBIiwKICAgICAgImRlcHJlY2F0ZWQiOiBmYWxzZSwKICAgICAgImJib3giOiB7CiAgICAgICAgIndlc3QiOiAxMzksCiAgICAgICAgInNvdXRoIjogMjQsCiAgICAgICAgImVhc3QiOiAxNDcsCiAgICAgICAgIm5vcnRoIjogNDYKICAgICAgfSwKICAgICAgInBpcGVsaW5lIjogIitwcm9qPXBpcGVsaW5lICtzdGVwICtpbnYgK3Byb2o9cG9seSArbGF0XzA9NDAuNSArbG9uXzA9MTQzICt4XzA9OTE0Mzk4LjUzMDc0NDQ0MDggK3lfMD0xODI4Nzk3LjA2MTQ4ODg4MTYgK2VsbHBzPWNscms2NiArdG9fbWV0ZXI9MC45MTQzOTg1MzA3NDQ0NDA4ICtzdGVwICtwcm9qPWNhcnQgK2VsbHBzPWJlc3NlbCArc3RlcCArcHJvaj1oZWxtZXJ0ICt4PS0xNDYuMzM2ICt5PTUwNi44MzIgK3o9NjgwLjI1NCArc3RlcCAraW52ICtwcm9qPWNhcnQgK2VsbHBzPVdHUzg0ICtzdGVwICtwcm9qPXVuaXRjb252ZXJ0ICt4eV9pbj1yYWQgK3h5X291dD1kZWciLAogICAgICAid2t0MiI6IG51bGwsCiAgICAgICJpc0FwcHJveGltYXRlIjogdHJ1ZSwKICAgICAgInNvdXJjZSI6IFsKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMjAvMTM2MTM5MDE0OCIsCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjE2LzEzNjA5NjgyMjAiCiAgICAgIF0KICAgIH0sCiAgICB7CiAgICAgICJhdXRob3JpdHkiOiAiVVRKQ1AiLAogICAgICAiY29kZSI6ICJaT05FLUIiLAogICAgICAibmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIFBvbHljb25pYyBHcmlkIFpvbmUgQiIsCiAgICAgICJhcmVhTmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIC0gSGlzdG9yaWNhbCBHcmlkIFpvbmUgQiIsCiAgICAgICJkZXByZWNhdGVkIjogZmFsc2UsCiAgICAgICJiYm94IjogewogICAgICAgICJ3ZXN0IjogMTMxLAogICAgICAgICJzb3V0aCI6IDI0LAogICAgICAgICJlYXN0IjogMTM5LAogICAgICAgICJub3J0aCI6IDQ2CiAgICAgIH0sCiAgICAgICJwaXBlbGluZSI6ICIrcHJvaj1waXBlbGluZSArc3RlcCAraW52ICtwcm9qPXBvbHkgK2xhdF8wPTQwLjUgK2xvbl8wPTEzNSAreF8wPTkxNDM5OC41MzA3NDQ0NDA4ICt5XzA9MTgyODc5Ny4wNjE0ODg4ODE2ICtlbGxwcz1jbHJrNjYgK3RvX21ldGVyPTAuOTE0Mzk4NTMwNzQ0NDQwOCArc3RlcCArcHJvaj1jYXJ0ICtlbGxwcz1iZXNzZWwgK3N0ZXAgK3Byb2o9aGVsbWVydCAreD0tMTQ2LjMzNiAreT01MDYuODMyICt6PTY4MC4yNTQgK3N0ZXAgK2ludiArcHJvaj1jYXJ0ICtlbGxwcz1XR1M4NCArc3RlcCArcHJvaj11bml0Y29udmVydCAreHlfaW49cmFkICt4eV9vdXQ9ZGVnIiwKICAgICAgIndrdDIiOiBudWxsLAogICAgICAiaXNBcHByb3hpbWF0ZSI6IHRydWUsCiAgICAgICJzb3VyY2UiOiBbCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjIwLzEzNjEzOTAxNDgiLAogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIxNi8xMzYwOTY4MjIwIgogICAgICBdCiAgICB9LAogICAgewogICAgICAiYXV0aG9yaXR5IjogIlVUSkNQIiwKICAgICAgImNvZGUiOiAiWk9ORS1DIiwKICAgICAgIm5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyBQb2x5Y29uaWMgR3JpZCBab25lIEMiLAogICAgICAiYXJlYU5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyAtIEhpc3RvcmljYWwgR3JpZCBab25lIEMiLAogICAgICAiZGVwcmVjYXRlZCI6IGZhbHNlLAogICAgICAiYmJveCI6IHsKICAgICAgICAid2VzdCI6IDEyMywKICAgICAgICAic291dGgiOiAyNCwKICAgICAgICAiZWFzdCI6IDEzMSwKICAgICAgICAibm9ydGgiOiAzMgogICAgICB9LAogICAgICAicGlwZWxpbmUiOiAiK3Byb2o9cGlwZWxpbmUgK3N0ZXAgK2ludiArcHJvaj1wb2x5ICtsYXRfMD00MC41ICtsb25fMD0xMjcgK3hfMD05MTQzOTguNTMwNzQ0NDQwOCAreV8wPTE4Mjg3OTcuMDYxNDg4ODgxNiArZWxscHM9Y2xyazY2ICt0b19tZXRlcj0wLjkxNDM5ODUzMDc0NDQ0MDggK3N0ZXAgK3Byb2o9Y2FydCArZWxscHM9YmVzc2VsICtzdGVwICtwcm9qPWhlbG1lcnQgK3g9LTE0Ni4zMzYgK3k9NTA2LjgzMiArej02ODAuMjU0ICtzdGVwICtpbnYgK3Byb2o9Y2FydCArZWxscHM9V0dTODQgK3N0ZXAgK3Byb2o9dW5pdGNvbnZlcnQgK3h5X2luPXJhZCAreHlfb3V0PWRlZyIsCiAgICAgICJ3a3QyIjogbnVsbCwKICAgICAgImlzQXBwcm94aW1hdGUiOiB0cnVlLAogICAgICAic291cmNlIjogWwogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIyMC8xMzYxMzkwMTQ4IiwKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMTYvMTM2MDk2ODIyMCIKICAgICAgXQogICAgfQogIF0KfQo=", import.meta.url);
function p() {
  return i || (i = a.init()), i;
}
function l(e, t) {
  return e <= t ? [[e, t]] : [
    [e, 180],
    [-180, t]
  ];
}
function y(e, t) {
  if (e.south > t.south || e.north < t.north)
    return !1;
  const r = l(e.west, e.east);
  return l(t.west, t.east).every(([n, s]) => r.some(
    ([o, c]) => o <= n && c >= s
  ));
}
function D(e, t) {
  return t <= 0 ? e : {
    west: Math.max(-180, e.west - t),
    south: Math.max(-90, e.south - t),
    east: Math.min(180, e.east + t),
    north: Math.min(90, e.north + t)
  };
}
async function z(e) {
  const t = await a.projCreateFromDatabase({
    auth_name: e.authName,
    code: e.code,
    category: a.PJ_CATEGORY_CRS
  }), [r, I] = await Promise.all([
    a.projAsWkt({
      pj: t,
      type: a.PJ_WKT2_2019,
      options: null
    }),
    a.projAsProjString({
      pj: t,
      type: a.PJ_PROJ_5,
      options: null
    })
  ]);
  return {
    id: `${e.authName}:${e.code}`,
    authority: e.authName,
    code: e.code,
    name: e.name,
    areaName: e.areaName,
    deprecated: e.deprecated,
    bbox: {
      west: e.westLonDegree,
      south: e.southLatDegree,
      east: e.eastLonDegree,
      north: e.northLatDegree
    },
    wkt2: r,
    proj4: I,
    definitionType: "projdb"
  };
}
function d(e) {
  return {
    authName: e.authority,
    code: e.code,
    name: e.name,
    type: a.PJ_TYPE_PROJECTED_CRS,
    deprecated: e.deprecated,
    bboxValid: !0,
    westLonDegree: e.bbox.west,
    southLatDegree: e.bbox.south,
    eastLonDegree: e.bbox.east,
    northLatDegree: e.bbox.north,
    areaName: e.areaName
  };
}
function m(e, t) {
  const r = e.proj4 ?? e.pipeline;
  if (!r)
    throw new Error(`Custom projection ${e.authority}:${e.code} is missing proj4/pipeline text`);
  return {
    id: `${e.authority}:${e.code}`,
    authority: e.authority,
    code: e.code,
    name: e.name,
    areaName: e.areaName,
    deprecated: e.deprecated,
    bbox: e.bbox,
    wkt2: e.wkt2 ?? null,
    proj4: r,
    pipeline: e.pipeline,
    isApproximate: e.isApproximate ?? !1,
    source: e.source ?? [],
    definitionType: t
  };
}
function u(e, t) {
  const r = t.area?.trim().toLowerCase(), I = t.bboxPaddingDeg ?? 0.1, n = t.includeDeprecated ?? !1, s = t.onshoreOnly ?? !1;
  return e.filter((o) => {
    const c = o.areaName.toLowerCase();
    return o.type !== a.PJ_TYPE_PROJECTED_CRS || !o.bboxValid || !n && o.deprecated || r && !c.includes(r) || s && (!c.includes("onshore") || c.includes("onshore and offshore")) ? !1 : y(D({
      west: o.westLonDegree,
      south: o.southLatDegree,
      east: o.eastLonDegree,
      north: o.northLatDegree
    }, I), t.extent);
  });
}
async function b(e) {
  const t = typeof e == "string" ? e : "href" in e ? e.href : String(e), r = t.startsWith("data:") ? (() => {
    const n = t.match(/^data:.*?(;base64)?,(.*)$/);
    if (!n)
      throw new Error(`Unsupported data URL for custom projection file: ${t}`);
    return n[1] ? Buffer.from(n[2], "base64").toString("utf8") : decodeURIComponent(n[2]);
  })() : await w(e, "utf8"), I = JSON.parse(r);
  return Array.isArray(I) ? I : I.projections;
}
async function W() {
  return A || (A = b(f)), A;
}
async function P(e) {
  await p();
  const t = await a.projGetCrsInfoListFromDatabase({}), r = u(t, e), I = /* @__PURE__ */ new Map(), n = await Promise.all(r.map((o) => z(o)));
  for (const o of n)
    I.set(o.id, o);
  if (e.includeCustomProjections) {
    const o = await W();
    for (const c of o) {
      const C = d(c);
      if (!u([C], e).length) continue;
      const g = m(c, "custom");
      I.set(g.id, g);
    }
  }
  if (e.userProjectionFile) {
    const o = await b(j(e.userProjectionFile));
    for (const c of o) {
      const C = d(c);
      if (!u([C], e).length) continue;
      const g = m(c, "user");
      I.set(g.id, g);
    }
  }
  const s = [...I.values()];
  return s.sort((o, c) => o.id.localeCompare(c.id)), s;
}
export {
  X as bboxToPolygonWkt,
  Y as extractAuthorityIdFromWkt,
  B as extractWktName,
  K as inferApproximateBbox,
  R as inferDatumFamily,
  Z as inferKind,
  O as inferPriority,
  T as inferWgsEquivalent,
  G as isProjectedPrjPath,
  L as isScopeIncluded,
  P as listProjectedCrsFromProjWasm
};
