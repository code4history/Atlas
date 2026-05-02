const N = {
  west: -180,
  south: -85.06,
  east: 180,
  north: 85.06
}, W = {
  west: 122,
  south: 20,
  east: 154,
  north: 46
};
function Y(e) {
  return e.endsWith(".prj") && e.includes("日本周辺座標系_WKT2_英語/") && e.includes("/投影座標系/");
}
function S(e) {
  if (e.includes("/投影座標系/Web メルカトル/") || e.includes("/WGS 1984/")) return "wgs84";
  if (e.includes("/日本測地系 (Tokyo)/")) return "tokyo";
  if (e.includes("/日本測地系2000 (JGD2000)/")) return "jgd2000";
  if (e.includes("/日本測地系2011 (JGD2011)/")) return "jgd2011";
  if (e.includes("/日本測地系2024 (JGD2024)/")) return "jgd2024";
  throw new Error(`Unsupported datum family in path: ${e}`);
}
function K(e) {
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
function X(e, t) {
  return t === "all" ? !0 : [
    "web_mercator",
    "utm",
    "japan_plane_rectangular"
  ].includes(e);
}
function U(e) {
  return e !== "tokyo";
}
function v(e) {
  const r = [...e.matchAll(/ID\["([^"]+)","([^"]+)"\]/g)].at(-1);
  if (r)
    return {
      authority: r[1],
      code: r[2]
    };
}
function _(e) {
  const t = e.match(/^[A-Z]+CRS\["([^"]+)"/);
  if (!t) throw new Error(`Unable to extract WKT root name from: ${e}`);
  return t[1];
}
function V(e) {
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
function D(e) {
  const t = e.match(/Zone[_ ](\d{2})N|第 ?(\d{2}) ?帯 ?N/u), r = t?.[1] ?? t?.[2];
  if (!r) throw new Error(`Unable to extract UTM zone from path: ${e}`);
  return Number(r);
}
function k(e, t) {
  if (t === "web_mercator") return N;
  if (t === "utm") {
    const o = (D(e) - 1) * 6 - 180;
    return {
      west: o,
      south: 0,
      east: o + 6,
      north: 84
    };
  }
  return W;
}
function E(e) {
  const { west: t, south: r, east: o, north: n } = e;
  return `POLYGON((${t} ${r}, ${o} ${r}, ${o} ${n}, ${t} ${n}, ${t} ${r}))`;
}
const p = 15;
let C, A, l, b = !1;
const R = new URL("data:application/json;base64,ewogICJwcm9qZWN0aW9ucyI6IFsKICAgIHsKICAgICAgImF1dGhvcml0eSI6ICJVVEpDUCIsCiAgICAgICJjb2RlIjogIlpPTkUtQSIsCiAgICAgICJuYW1lIjogIkphcGFuIENpdHkgUGxhbnMgUG9seWNvbmljIEdyaWQgWm9uZSBBIiwKICAgICAgImFyZWFOYW1lIjogIkphcGFuIENpdHkgUGxhbnMgLSBIaXN0b3JpY2FsIEdyaWQgWm9uZSBBIiwKICAgICAgImRlcHJlY2F0ZWQiOiBmYWxzZSwKICAgICAgImJib3giOiB7CiAgICAgICAgIndlc3QiOiAxMzksCiAgICAgICAgInNvdXRoIjogMjQsCiAgICAgICAgImVhc3QiOiAxNDcsCiAgICAgICAgIm5vcnRoIjogNDYKICAgICAgfSwKICAgICAgInBpcGVsaW5lIjogIitwcm9qPXBpcGVsaW5lICtzdGVwICtpbnYgK3Byb2o9cG9seSArbGF0XzA9NDAuNSArbG9uXzA9MTQzICt4XzA9OTE0Mzk4LjUzMDc0NDQ0MDggK3lfMD0xODI4Nzk3LjA2MTQ4ODg4MTYgK2VsbHBzPWNscms2NiArdG9fbWV0ZXI9MC45MTQzOTg1MzA3NDQ0NDA4ICtzdGVwICtwcm9qPWNhcnQgK2VsbHBzPWJlc3NlbCArc3RlcCArcHJvaj1oZWxtZXJ0ICt4PS0xNDYuMzM2ICt5PTUwNi44MzIgK3o9NjgwLjI1NCArc3RlcCAraW52ICtwcm9qPWNhcnQgK2VsbHBzPVdHUzg0ICtzdGVwICtwcm9qPXVuaXRjb252ZXJ0ICt4eV9pbj1yYWQgK3h5X291dD1kZWciLAogICAgICAid2t0MiI6IG51bGwsCiAgICAgICJpc0FwcHJveGltYXRlIjogdHJ1ZSwKICAgICAgInNvdXJjZSI6IFsKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMjAvMTM2MTM5MDE0OCIsCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjE2LzEzNjA5NjgyMjAiCiAgICAgIF0KICAgIH0sCiAgICB7CiAgICAgICJhdXRob3JpdHkiOiAiVVRKQ1AiLAogICAgICAiY29kZSI6ICJaT05FLUIiLAogICAgICAibmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIFBvbHljb25pYyBHcmlkIFpvbmUgQiIsCiAgICAgICJhcmVhTmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIC0gSGlzdG9yaWNhbCBHcmlkIFpvbmUgQiIsCiAgICAgICJkZXByZWNhdGVkIjogZmFsc2UsCiAgICAgICJiYm94IjogewogICAgICAgICJ3ZXN0IjogMTMxLAogICAgICAgICJzb3V0aCI6IDI0LAogICAgICAgICJlYXN0IjogMTM5LAogICAgICAgICJub3J0aCI6IDQ2CiAgICAgIH0sCiAgICAgICJwaXBlbGluZSI6ICIrcHJvaj1waXBlbGluZSArc3RlcCAraW52ICtwcm9qPXBvbHkgK2xhdF8wPTQwLjUgK2xvbl8wPTEzNSAreF8wPTkxNDM5OC41MzA3NDQ0NDA4ICt5XzA9MTgyODc5Ny4wNjE0ODg4ODE2ICtlbGxwcz1jbHJrNjYgK3RvX21ldGVyPTAuOTE0Mzk4NTMwNzQ0NDQwOCArc3RlcCArcHJvaj1jYXJ0ICtlbGxwcz1iZXNzZWwgK3N0ZXAgK3Byb2o9aGVsbWVydCAreD0tMTQ2LjMzNiAreT01MDYuODMyICt6PTY4MC4yNTQgK3N0ZXAgK2ludiArcHJvaj1jYXJ0ICtlbGxwcz1XR1M4NCArc3RlcCArcHJvaj11bml0Y29udmVydCAreHlfaW49cmFkICt4eV9vdXQ9ZGVnIiwKICAgICAgIndrdDIiOiBudWxsLAogICAgICAiaXNBcHByb3hpbWF0ZSI6IHRydWUsCiAgICAgICJzb3VyY2UiOiBbCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjIwLzEzNjEzOTAxNDgiLAogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIxNi8xMzYwOTY4MjIwIgogICAgICBdCiAgICB9LAogICAgewogICAgICAiYXV0aG9yaXR5IjogIlVUSkNQIiwKICAgICAgImNvZGUiOiAiWk9ORS1DIiwKICAgICAgIm5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyBQb2x5Y29uaWMgR3JpZCBab25lIEMiLAogICAgICAiYXJlYU5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyAtIEhpc3RvcmljYWwgR3JpZCBab25lIEMiLAogICAgICAiZGVwcmVjYXRlZCI6IGZhbHNlLAogICAgICAiYmJveCI6IHsKICAgICAgICAid2VzdCI6IDEyMywKICAgICAgICAic291dGgiOiAyNCwKICAgICAgICAiZWFzdCI6IDEzMSwKICAgICAgICAibm9ydGgiOiAzMgogICAgICB9LAogICAgICAicGlwZWxpbmUiOiAiK3Byb2o9cGlwZWxpbmUgK3N0ZXAgK2ludiArcHJvaj1wb2x5ICtsYXRfMD00MC41ICtsb25fMD0xMjcgK3hfMD05MTQzOTguNTMwNzQ0NDQwOCAreV8wPTE4Mjg3OTcuMDYxNDg4ODgxNiArZWxscHM9Y2xyazY2ICt0b19tZXRlcj0wLjkxNDM5ODUzMDc0NDQ0MDggK3N0ZXAgK3Byb2o9Y2FydCArZWxscHM9YmVzc2VsICtzdGVwICtwcm9qPWhlbG1lcnQgK3g9LTE0Ni4zMzYgK3k9NTA2LjgzMiArej02ODAuMjU0ICtzdGVwICtpbnYgK3Byb2o9Y2FydCArZWxscHM9V0dTODQgK3N0ZXAgK3Byb2o9dW5pdGNvbnZlcnQgK3h5X2luPXJhZCAreHlfb3V0PWRlZyIsCiAgICAgICJ3a3QyIjogbnVsbCwKICAgICAgImlzQXBwcm94aW1hdGUiOiB0cnVlLAogICAgICAic291cmNlIjogWwogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIyMC8xMzYxMzkwMTQ4IiwKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMTYvMTM2MDk2ODIyMCIKICAgICAgXQogICAgfQogIF0KfQo=", import.meta.url), z = [
  "proj.db",
  "proj.ini",
  "proj-worker.mjs",
  "fetch-worker.mjs",
  "proj-emscripten.js",
  "proj-emscripten.wasm"
];
function L() {
  return typeof globalThis.document < "u";
}
function T() {
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/[^/]*$/, ""), e.search = "", e.hash = "", e;
}
function x(e = T()) {
  if (!L() || b || typeof fetch != "function")
    return;
  const t = typeof e == "string" ? new URL(e, import.meta.url) : e;
  globalThis.__ATLAS_PROJ_WASM_ASSET_BASE_URL__ = t.href;
  const r = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (o, n) => {
    const c = typeof o == "string" ? o : o instanceof URL ? o.href : o.url, s = globalThis.location?.href ?? import.meta.url, I = new URL(c, s).pathname, a = z.find((i) => I.endsWith(`/${i}`));
    if (a) {
      const i = new URL(a, t), g = await r(i, n);
      if (a === "proj.db") {
        const f = Number(g.headers.get("content-length") ?? 0) || (await g.clone().arrayBuffer()).byteLength;
        if (f < 1e6)
          throw new Error(
            `Resolved proj.db from ${i.href}, but received only ${f} bytes. Restart the Vite dev server and verify that the proj-wasm runtime assets are served from the demo assets path.`
          );
      }
      return g;
    }
    return r(o, n);
  }, b = !0;
}
function m() {
  return A || (A = import("proj-wasm")), A;
}
async function M(e) {
  return C || (x(e?.projWasmAssetBaseUrl), C = m().then((t) => t.init({ workers: 1 }))), C;
}
function h(e, t) {
  return e <= t ? [[e, t]] : [
    [e, 180],
    [-180, t]
  ];
}
function J(e, t) {
  if (e.south > t.south || e.north < t.north)
    return !1;
  const r = h(e.west, e.east);
  return h(t.west, t.east).every(([n, c]) => r.some(
    ([s, I]) => s <= n && I >= c
  ));
}
function G(e, t) {
  return t <= 0 ? e : {
    west: Math.max(-180, e.west - t),
    south: Math.max(-90, e.south - t),
    east: Math.min(180, e.east + t),
    north: Math.min(90, e.north + t)
  };
}
async function P(e) {
  const t = await m(), r = await t.projCreateFromDatabase({
    auth_name: e.authName,
    code: e.code,
    category: t.PJ_CATEGORY_CRS
  }), [o, n] = await Promise.all([
    t.projAsWkt({
      pj: r,
      type: t.PJ_WKT2_2019,
      options: null
    }),
    t.projAsProjString({
      pj: r,
      type: t.PJ_PROJ_5,
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
    wkt2: o,
    proj4: n,
    definitionType: "projdb"
  };
}
function w(e) {
  return {
    authName: e.authority,
    code: e.code,
    name: e.name,
    type: p,
    deprecated: e.deprecated,
    bboxValid: !0,
    westLonDegree: e.bbox.west,
    southLatDegree: e.bbox.south,
    eastLonDegree: e.bbox.east,
    northLatDegree: e.bbox.north,
    areaName: e.areaName
  };
}
function j(e, t) {
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
function d(e, t) {
  const r = t.area?.trim().toLowerCase(), o = t.bboxPaddingDeg ?? 0.1, n = t.includeDeprecated ?? !1, c = t.onshoreOnly ?? !1;
  return e.filter((s) => {
    const I = s.areaName.toLowerCase();
    return s.type !== p || !s.bboxValid || !n && s.deprecated || r && !I.includes(r) || c && (!I.includes("onshore") || I.includes("onshore and offshore")) ? !1 : J(G({
      west: s.westLonDegree,
      south: s.southLatDegree,
      east: s.eastLonDegree,
      north: s.northLatDegree
    }, o), t.extent);
  });
}
async function Q(e = {}) {
  await M(e);
}
function Z(e) {
  const t = e.match(/^data:.*?(;base64)?,(.*)$/);
  if (!t)
    throw new Error(`Unsupported data URL for custom projection resource: ${e}`);
  if (t[1]) {
    if (typeof Buffer < "u")
      return Buffer.from(t[2], "base64").toString("utf8");
    const r = atob(t[2]);
    return new TextDecoder().decode(Uint8Array.from(r, (o) => o.charCodeAt(0)));
  }
  return decodeURIComponent(t[2]);
}
async function B(e) {
  const t = typeof e == "string" ? new URL(e, import.meta.url) : e, r = t.href;
  if (r.startsWith("data:"))
    return Z(r);
  if (!r.startsWith("file:") && typeof fetch == "function") {
    const c = await fetch(t);
    if (!c.ok)
      throw new Error(`Failed to load projection resource ${r}: ${c.status} ${c.statusText}`);
    return c.text();
  }
  const o = "node:fs/promises", { readFile: n } = await import(
    /* @vite-ignore */
    o
  );
  return n(t, "utf8");
}
async function y(e) {
  const t = await B(e), r = JSON.parse(t);
  return Array.isArray(r) ? r : r.projections;
}
async function O() {
  return l || (l = y(R)), l;
}
async function F(e) {
  await M(e);
  const r = await (await m()).projGetCrsInfoListFromDatabase({}), o = d(r, e), n = /* @__PURE__ */ new Map(), c = await Promise.all(o.map((a) => P(a)));
  for (const a of c)
    n.set(a.id, a);
  if (e.includeCustomProjections) {
    const a = await O();
    for (const i of a) {
      const g = w(i);
      if (!d([g], e).length) continue;
      const u = j(i, "custom");
      n.set(u.id, u);
    }
  }
  const s = e.userProjection ?? e.userProjectionFile;
  if (s) {
    const a = await y(s);
    for (const i of a) {
      const g = w(i);
      if (!d([g], e).length) continue;
      const u = j(i, "user");
      n.set(u.id, u);
    }
  }
  const I = [...n.values()];
  return I.sort((a, i) => a.id.localeCompare(i.id)), I;
}
export {
  E as bboxToPolygonWkt,
  v as extractAuthorityIdFromWkt,
  _ as extractWktName,
  k as inferApproximateBbox,
  S as inferDatumFamily,
  K as inferKind,
  V as inferPriority,
  U as inferWgsEquivalent,
  Q as initializeProjWasmRuntime,
  Y as isProjectedPrjPath,
  X as isScopeIncluded,
  F as listProjectedCrsFromProjWasm
};
