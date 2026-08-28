const M = {
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
function K(e) {
  if (e.includes("/投影座標系/Web メルカトル/") || e.includes("/WGS 1984/")) return "wgs84";
  if (e.includes("/日本測地系 (Tokyo)/")) return "tokyo";
  if (e.includes("/日本測地系2000 (JGD2000)/")) return "jgd2000";
  if (e.includes("/日本測地系2011 (JGD2011)/")) return "jgd2011";
  if (e.includes("/日本測地系2024 (JGD2024)/")) return "jgd2024";
  throw new Error(`Unsupported datum family in path: ${e}`);
}
function X(e) {
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
function v(e, t) {
  return t === "all" ? !0 : [
    "web_mercator",
    "utm",
    "japan_plane_rectangular"
  ].includes(e);
}
function U(e) {
  return e !== "tokyo";
}
function F(e) {
  const r = [...e.matchAll(/ID\["([^"]+)","([^"]+)"\]/g)].at(-1);
  if (r)
    return {
      authority: r[1],
      code: r[2]
    };
}
function V(e) {
  const t = e.match(/^[A-Z]+CRS\["([^"]+)"/);
  if (!t) throw new Error(`Unable to extract WKT root name from: ${e}`);
  return t[1];
}
function E(e) {
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
function R(e) {
  const t = e.match(/Zone[_ ](\d{2})N|第 ?(\d{2}) ?帯 ?N/u), r = t?.[1] ?? t?.[2];
  if (!r) throw new Error(`Unable to extract UTM zone from path: ${e}`);
  return Number(r);
}
function k(e, t) {
  if (t === "web_mercator") return M;
  if (t === "utm") {
    const o = (R(e) - 1) * 6 - 180;
    return {
      west: o,
      south: 0,
      east: o + 6,
      north: 84
    };
  }
  return W;
}
function Q(e) {
  const { west: t, south: r, east: o, north: n } = e;
  return `POLYGON((${t} ${r}, ${o} ${r}, ${o} ${n}, ${t} ${n}, ${t} ${r}))`;
}
const y = 15, D = "+proj=longlat +datum=WGS84 +no_defs +type=crs";
let l, A, d, b = !1;
const z = new URL("data:application/json;base64,ewogICJwcm9qZWN0aW9ucyI6IFsKICAgIHsKICAgICAgImF1dGhvcml0eSI6ICJVVEpDUCIsCiAgICAgICJjb2RlIjogIlpPTkUtQSIsCiAgICAgICJuYW1lIjogIkphcGFuIENpdHkgUGxhbnMgUG9seWNvbmljIEdyaWQgWm9uZSBBIiwKICAgICAgImFyZWFOYW1lIjogIkphcGFuIENpdHkgUGxhbnMgLSBIaXN0b3JpY2FsIEdyaWQgWm9uZSBBIiwKICAgICAgImRlcHJlY2F0ZWQiOiBmYWxzZSwKICAgICAgImJib3giOiB7CiAgICAgICAgIndlc3QiOiAxMzksCiAgICAgICAgInNvdXRoIjogMjQsCiAgICAgICAgImVhc3QiOiAxNDcsCiAgICAgICAgIm5vcnRoIjogNDYKICAgICAgfSwKICAgICAgInBpcGVsaW5lIjogIitwcm9qPXBpcGVsaW5lICtzdGVwICtpbnYgK3Byb2o9cG9seSArbGF0XzA9NDAuNSArbG9uXzA9MTQzICt4XzA9OTE0Mzk4LjUzMDc0NDQ0MDggK3lfMD0xODI4Nzk3LjA2MTQ4ODg4MTYgK2VsbHBzPWNscms2NiArdG9fbWV0ZXI9MC45MTQzOTg1MzA3NDQ0NDA4ICtzdGVwICtwcm9qPWNhcnQgK2VsbHBzPWJlc3NlbCArc3RlcCArcHJvaj1oZWxtZXJ0ICt4PS0xNDYuMzM2ICt5PTUwNi44MzIgK3o9NjgwLjI1NCArc3RlcCAraW52ICtwcm9qPWNhcnQgK2VsbHBzPVdHUzg0ICtzdGVwICtwcm9qPXVuaXRjb252ZXJ0ICt4eV9pbj1yYWQgK3h5X291dD1kZWciLAogICAgICAid2t0MiI6IG51bGwsCiAgICAgICJpc0FwcHJveGltYXRlIjogdHJ1ZSwKICAgICAgInNvdXJjZSI6IFsKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMjAvMTM2MTM5MDE0OCIsCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjE2LzEzNjA5NjgyMjAiCiAgICAgIF0KICAgIH0sCiAgICB7CiAgICAgICJhdXRob3JpdHkiOiAiVVRKQ1AiLAogICAgICAiY29kZSI6ICJaT05FLUIiLAogICAgICAibmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIFBvbHljb25pYyBHcmlkIFpvbmUgQiIsCiAgICAgICJhcmVhTmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIC0gSGlzdG9yaWNhbCBHcmlkIFpvbmUgQiIsCiAgICAgICJkZXByZWNhdGVkIjogZmFsc2UsCiAgICAgICJiYm94IjogewogICAgICAgICJ3ZXN0IjogMTMxLAogICAgICAgICJzb3V0aCI6IDI0LAogICAgICAgICJlYXN0IjogMTM5LAogICAgICAgICJub3J0aCI6IDQ2CiAgICAgIH0sCiAgICAgICJwaXBlbGluZSI6ICIrcHJvaj1waXBlbGluZSArc3RlcCAraW52ICtwcm9qPXBvbHkgK2xhdF8wPTQwLjUgK2xvbl8wPTEzNSAreF8wPTkxNDM5OC41MzA3NDQ0NDA4ICt5XzA9MTgyODc5Ny4wNjE0ODg4ODE2ICtlbGxwcz1jbHJrNjYgK3RvX21ldGVyPTAuOTE0Mzk4NTMwNzQ0NDQwOCArc3RlcCArcHJvaj1jYXJ0ICtlbGxwcz1iZXNzZWwgK3N0ZXAgK3Byb2o9aGVsbWVydCAreD0tMTQ2LjMzNiAreT01MDYuODMyICt6PTY4MC4yNTQgK3N0ZXAgK2ludiArcHJvaj1jYXJ0ICtlbGxwcz1XR1M4NCArc3RlcCArcHJvaj11bml0Y29udmVydCAreHlfaW49cmFkICt4eV9vdXQ9ZGVnIiwKICAgICAgIndrdDIiOiBudWxsLAogICAgICAiaXNBcHByb3hpbWF0ZSI6IHRydWUsCiAgICAgICJzb3VyY2UiOiBbCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjIwLzEzNjEzOTAxNDgiLAogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIxNi8xMzYwOTY4MjIwIgogICAgICBdCiAgICB9LAogICAgewogICAgICAiYXV0aG9yaXR5IjogIlVUSkNQIiwKICAgICAgImNvZGUiOiAiWk9ORS1DIiwKICAgICAgIm5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyBQb2x5Y29uaWMgR3JpZCBab25lIEMiLAogICAgICAiYXJlYU5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyAtIEhpc3RvcmljYWwgR3JpZCBab25lIEMiLAogICAgICAiZGVwcmVjYXRlZCI6IGZhbHNlLAogICAgICAiYmJveCI6IHsKICAgICAgICAid2VzdCI6IDEyMywKICAgICAgICAic291dGgiOiAyNCwKICAgICAgICAiZWFzdCI6IDEzMSwKICAgICAgICAibm9ydGgiOiA0NgogICAgICB9LAogICAgICAicGlwZWxpbmUiOiAiK3Byb2o9cGlwZWxpbmUgK3N0ZXAgK2ludiArcHJvaj1wb2x5ICtsYXRfMD00MC41ICtsb25fMD0xMjcgK3hfMD05MTQzOTguNTMwNzQ0NDQwOCAreV8wPTE4Mjg3OTcuMDYxNDg4ODgxNiArZWxscHM9Y2xyazY2ICt0b19tZXRlcj0wLjkxNDM5ODUzMDc0NDQ0MDggK3N0ZXAgK3Byb2o9Y2FydCArZWxscHM9YmVzc2VsICtzdGVwICtwcm9qPWhlbG1lcnQgK3g9LTE0Ni4zMzYgK3k9NTA2LjgzMiArej02ODAuMjU0ICtzdGVwICtpbnYgK3Byb2o9Y2FydCArZWxscHM9V0dTODQgK3N0ZXAgK3Byb2o9dW5pdGNvbnZlcnQgK3h5X2luPXJhZCAreHlfb3V0PWRlZyIsCiAgICAgICJ3a3QyIjogbnVsbCwKICAgICAgImlzQXBwcm94aW1hdGUiOiB0cnVlLAogICAgICAic291cmNlIjogWwogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIyMC8xMzYxMzkwMTQ4IiwKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMTYvMTM2MDk2ODIyMCIKICAgICAgXQogICAgfQogIF0KfQo=", import.meta.url), L = [
  "proj.db",
  "proj.ini",
  "proj-worker.mjs",
  "fetch-worker.mjs",
  "proj-emscripten.js",
  "proj-emscripten.wasm"
];
function T() {
  return typeof globalThis.document < "u";
}
function x() {
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/[^/]*$/, ""), e.search = "", e.hash = "", e;
}
function G(e = x()) {
  if (!T() || b || typeof fetch != "function")
    return;
  const t = typeof e == "string" ? new URL(e, import.meta.url) : e;
  globalThis.__ATLAS_PROJ_WASM_ASSET_BASE_URL__ = t.href;
  const r = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (o, n) => {
    const a = typeof o == "string" ? o : o instanceof URL ? o.href : o.url, i = globalThis.location?.href ?? import.meta.url, s = new URL(a, i).pathname, c = L.find((I) => s.endsWith(`/${I}`));
    if (c) {
      const I = new URL(c, t), u = await r(I, n);
      if (c === "proj.db") {
        const h = Number(u.headers.get("content-length") ?? 0) || (await u.clone().arrayBuffer()).byteLength;
        if (h < 1e6)
          throw new Error(
            `Resolved proj.db from ${I.href}, but received only ${h} bytes. Restart the Vite dev server and verify that the proj-wasm runtime assets are served from the demo assets path.`
          );
      }
      return u;
    }
    return r(o, n);
  }, b = !0;
}
function C() {
  return A || (A = import("proj-wasm")), A;
}
async function f(e) {
  return l || (G(e?.projWasmAssetBaseUrl), l = C().then((t) => t.init({ workers: 1 }))), l;
}
function w(e, t) {
  return e <= t ? [[e, t]] : [
    [e, 180],
    [-180, t]
  ];
}
function J(e, t) {
  if (e.south > t.south || e.north < t.north)
    return !1;
  const r = w(e.west, e.east);
  return w(t.west, t.east).every(([n, a]) => r.some(
    ([i, s]) => i <= n && s >= a
  ));
}
function P(e, t) {
  return t <= 0 ? e : {
    west: Math.max(-180, e.west - t),
    south: Math.max(-90, e.south - t),
    east: Math.min(180, e.east + t),
    north: Math.min(90, e.north + t)
  };
}
async function Z(e) {
  const t = await C(), r = await t.projCreateFromDatabase({
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
function j(e) {
  return {
    authName: e.authority,
    code: e.code,
    name: e.name,
    type: y,
    deprecated: e.deprecated,
    bboxValid: !0,
    westLonDegree: e.bbox.west,
    southLatDegree: e.bbox.south,
    eastLonDegree: e.bbox.east,
    northLatDegree: e.bbox.north,
    areaName: e.areaName
  };
}
function p(e, t) {
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
function m(e, t) {
  const r = t.area?.trim().toLowerCase(), o = t.bboxPaddingDeg ?? 0.1, n = t.includeDeprecated ?? !1, a = t.onshoreOnly ?? !1;
  return e.filter((i) => {
    const s = i.areaName.toLowerCase();
    return i.type !== y || !i.bboxValid || !n && i.deprecated || r && !s.includes(r) || a && (!s.includes("onshore") || s.includes("onshore and offshore")) ? !1 : J(P({
      west: i.westLonDegree,
      south: i.southLatDegree,
      east: i.eastLonDegree,
      north: i.northLatDegree
    }, o), t.extent);
  });
}
async function H(e = {}) {
  await f(e);
}
function B(e) {
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
async function O(e) {
  const t = typeof e == "string" ? new URL(e, import.meta.url) : e, r = t.href;
  if (r.startsWith("data:"))
    return B(r);
  if (!r.startsWith("file:") && typeof fetch == "function") {
    const a = await fetch(t);
    if (!a.ok)
      throw new Error(`Failed to load projection resource ${r}: ${a.status} ${a.statusText}`);
    return a.text();
  }
  const o = "node:fs/promises", { readFile: n } = await import(
    /* @vite-ignore */
    o
  );
  return n(t, "utf8");
}
async function N(e) {
  const t = await O(e), r = JSON.parse(t);
  return Array.isArray(r) ? r : r.projections;
}
async function S() {
  return d || (d = N(z)), d;
}
async function $(e) {
  await f(e);
  const r = await (await C()).projGetCrsInfoListFromDatabase({}), o = m(r, e), n = /* @__PURE__ */ new Map(), a = await Promise.all(o.map((c) => Z(c)));
  for (const c of a)
    n.set(c.id, c);
  if (e.includeCustomProjections) {
    const c = await S();
    for (const I of c) {
      const u = j(I);
      if (!m([u], e).length) continue;
      const g = p(I, "custom");
      n.set(g.id, g);
    }
  }
  const i = e.userProjection ?? e.userProjectionFile;
  if (i) {
    const c = await N(i);
    for (const I of c) {
      const u = j(I);
      if (!m([u], e).length) continue;
      const g = p(I, "user");
      n.set(g.id, g);
    }
  }
  const s = [...n.values()];
  return s.sort((c, I) => c.id.localeCompare(I.id)), s;
}
async function _(e, t) {
  let r;
  try {
    r = await e.projCreate({ definition: t });
  } catch {
    return !1;
  }
  if (!await e.projIsCrs({ obj: r })) return !1;
  const o = await e.projCrsGetCoordinateSystem({ crs: r });
  if (await e.projCsGetAxisCount({ cs: o }) !== 2) return !1;
  const n = [
    await e.projCsGetAxisInfo({ cs: o, index: 0 }),
    await e.projCsGetAxisInfo({ cs: o, index: 1 })
  ];
  return n[0]?.direction !== "east" || n[1]?.direction !== "north" ? !1 : n.every((a) => a.unitConvFactor === 1 && a.unitName === "metre");
}
async function q(e, t, r) {
  if (t.length === 0) return null;
  for (const s of t)
    if (!Number.isFinite(s[0]) || !Number.isFinite(s[1])) return null;
  await f(r);
  const o = await C();
  if (!await _(o, e.proj4)) return null;
  let n;
  try {
    n = await o.projCreateCrsToCrs({
      source_crs: D,
      target_crs: e.proj4
    });
  } catch {
    return null;
  }
  let a;
  try {
    a = await o.coordArray(t.length), await o.setCoords(
      a,
      t.map(([s, c]) => [s, c, 0, 0])
    ), await o.projTransArray({
      p: n,
      direction: o.PJ_FWD,
      n: t.length,
      coord: a
    });
  } catch {
    return null;
  }
  const i = [];
  for (let s = 0; s < t.length; s += 1) {
    const c = await o.getCoords(a, s), I = c?.[0], u = c?.[1];
    if (!Number.isFinite(I) || !Number.isFinite(u)) return null;
    i.push([I, u]);
  }
  return i;
}
export {
  Q as bboxToPolygonWkt,
  F as extractAuthorityIdFromWkt,
  V as extractWktName,
  k as inferApproximateBbox,
  K as inferDatumFamily,
  X as inferKind,
  E as inferPriority,
  U as inferWgsEquivalent,
  H as initializeProjWasmRuntime,
  Y as isProjectedPrjPath,
  v as isScopeIncluded,
  $ as listProjectedCrsFromProjWasm,
  q as transformLonLatArrayToProjected
};
