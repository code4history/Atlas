const w = {
  west: -180,
  south: -85.06,
  east: 180,
  north: 85.06
}, P = {
  west: 122,
  south: 20,
  east: 154,
  north: 46
};
function s0(I) {
  return I.endsWith(".prj") && I.includes("日本周辺座標系_WKT2_英語/") && I.includes("/投影座標系/");
}
function a0(I) {
  if (I.includes("/投影座標系/Web メルカトル/") || I.includes("/WGS 1984/")) return "wgs84";
  if (I.includes("/日本測地系 (Tokyo)/")) return "tokyo";
  if (I.includes("/日本測地系2000 (JGD2000)/")) return "jgd2000";
  if (I.includes("/日本測地系2011 (JGD2011)/")) return "jgd2011";
  if (I.includes("/日本測地系2024 (JGD2024)/")) return "jgd2024";
  throw new Error(`Unsupported datum family in path: ${I}`);
}
function i0(I) {
  if (I.includes("/投影座標系/Web メルカトル/")) return "web_mercator";
  if (I.includes("/投影座標系/UTM 座標系/")) return "utm";
  if (I.includes("/投影座標系/平面直角座標系/"))
    return "japan_plane_rectangular";
  if (I.includes("/投影座標系/全国都道府県市区町村面積調/"))
    return "japan_land_area";
  if (I.includes("/投影座標系/地方図・国際図用座標系/"))
    return "regional_map";
  if (I.includes("/投影座標系/天気図/")) return "weather_map";
  throw new Error(`Unsupported projected kind in path: ${I}`);
}
function c0(I, A) {
  return A === "all" ? !0 : [
    "web_mercator",
    "utm",
    "japan_plane_rectangular"
  ].includes(I);
}
function G0(I) {
  return I !== "tokyo";
}
function N0(I) {
  const e = [...I.matchAll(/ID\["([^"]+)","([^"]+)"\]/g)].at(-1);
  if (e)
    return {
      authority: e[1],
      code: e[2]
    };
}
function F0(I) {
  const A = I.match(/^[A-Z]+CRS\["([^"]+)"/);
  if (!A) throw new Error(`Unable to extract WKT root name from: ${I}`);
  return A[1];
}
function u0(I) {
  switch (I) {
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
function j(I) {
  const A = I.match(/Zone[_ ](\d{2})N|第 ?(\d{2}) ?帯 ?N/u), e = A?.[1] ?? A?.[2];
  if (!e) throw new Error(`Unable to extract UTM zone from path: ${I}`);
  return Number(e);
}
function d0(I, A) {
  if (A === "web_mercator") return w;
  if (A === "utm") {
    const U = (j(I) - 1) * 6 - 180;
    return {
      west: U,
      south: 0,
      east: U + 6,
      north: 84
    };
  }
  return P;
}
function C0(I) {
  const { west: A, south: e, east: U, north: r } = I;
  return `POLYGON((${A} ${e}, ${U} ${e}, ${U} ${r}, ${A} ${r}, ${A} ${e}))`;
}
async function S(I, A, e) {
  const U = await A();
  try {
    return await e(U);
  } finally {
    if (U != null)
      try {
        await I.projDestroy({ pj: U });
      } catch {
      }
  }
}
class O {
  entries = /* @__PURE__ */ new Map();
  capacity;
  constructor(A) {
    if (!Number.isInteger(A) || A < 1)
      throw new RangeError(`PjCache capacity must be a positive integer (got ${A})`);
    this.capacity = A;
  }
  /** The number of keys held. */
  get size() {
    return this.entries.size;
  }
  async use(A, e, U, r) {
    let t = this.entries.get(e);
    t === void 0 ? (t = { object: this.createObject(e, U), users: 0, evicted: !1, released: !1 }, this.entries.set(e, t), this.evictOverflow(A)) : (this.entries.delete(e), this.entries.set(e, t)), t.users += 1;
    try {
      let _;
      try {
        _ = await t.object;
      } catch (n) {
        throw this.entries.get(e) === t && this.entries.delete(e), t.released = !0, n;
      }
      return await r(_);
    } finally {
      t.users -= 1, t.evicted && t.users === 0 && await this.release(A, t);
    }
  }
  async createObject(A, e) {
    const U = await e();
    if (U == null)
      throw new Error(`The PROJ object for ${String(A)} could not be created`);
    return U;
  }
  evictOverflow(A) {
    for (; this.entries.size > this.capacity; ) {
      const [e, U] = this.entries.entries().next().value;
      this.entries.delete(e), U.evicted = !0, U.users === 0 && this.release(A, U);
    }
  }
  async release(A, e) {
    if (!e.released) {
      e.released = !0;
      try {
        await A.projDestroy({ pj: await e.object });
      } catch {
      }
    }
  }
}
const E = {
  wkt2Unavailable: [
    "IAU_2015:1020",
    "IAU_2015:1025",
    "IAU_2015:1040",
    "IAU_2015:1045",
    "IAU_2015:1050",
    "IAU_2015:1055",
    "IAU_2015:19920",
    "IAU_2015:19921",
    "IAU_2015:19922",
    "IAU_2015:19925",
    "IAU_2015:19926",
    "IAU_2015:19927",
    "IAU_2015:19940",
    "IAU_2015:19941",
    "IAU_2015:19942",
    "IAU_2015:19945",
    "IAU_2015:19946",
    "IAU_2015:19947",
    "IAU_2015:19950",
    "IAU_2015:19951",
    "IAU_2015:19952",
    "IAU_2015:19955",
    "IAU_2015:19956",
    "IAU_2015:19957",
    "IAU_2015:29920",
    "IAU_2015:29925",
    "IAU_2015:29940",
    "IAU_2015:29945",
    "IAU_2015:29950",
    "IAU_2015:29955",
    "IAU_2015:30120",
    "IAU_2015:30125",
    "IAU_2015:30140",
    "IAU_2015:30145",
    "IAU_2015:30150",
    "IAU_2015:30155",
    "IAU_2015:39920",
    "IAU_2015:39921",
    "IAU_2015:39925",
    "IAU_2015:39926",
    "IAU_2015:39940",
    "IAU_2015:39941",
    "IAU_2015:39945",
    "IAU_2015:39946",
    "IAU_2015:39950",
    "IAU_2015:39951",
    "IAU_2015:39955",
    "IAU_2015:39956",
    "IAU_2015:40120",
    "IAU_2015:40125",
    "IAU_2015:40140",
    "IAU_2015:40145",
    "IAU_2015:40150",
    "IAU_2015:40155",
    "IAU_2015:40220",
    "IAU_2015:40225",
    "IAU_2015:40240",
    "IAU_2015:40245",
    "IAU_2015:40250",
    "IAU_2015:40255",
    "IAU_2015:49920",
    "IAU_2015:49921",
    "IAU_2015:49922",
    "IAU_2015:49925",
    "IAU_2015:49926",
    "IAU_2015:49927",
    "IAU_2015:49940",
    "IAU_2015:49941",
    "IAU_2015:49942",
    "IAU_2015:49945",
    "IAU_2015:49946",
    "IAU_2015:49947",
    "IAU_2015:49950",
    "IAU_2015:49951",
    "IAU_2015:49952",
    "IAU_2015:49955",
    "IAU_2015:49956",
    "IAU_2015:49957",
    "IAU_2015:50120",
    "IAU_2015:50125",
    "IAU_2015:50140",
    "IAU_2015:50145",
    "IAU_2015:50150",
    "IAU_2015:50155",
    "IAU_2015:50220",
    "IAU_2015:50225",
    "IAU_2015:50240",
    "IAU_2015:50245",
    "IAU_2015:50250",
    "IAU_2015:50255",
    "IAU_2015:50320",
    "IAU_2015:50321",
    "IAU_2015:50325",
    "IAU_2015:50326",
    "IAU_2015:50340",
    "IAU_2015:50341",
    "IAU_2015:50345",
    "IAU_2015:50346",
    "IAU_2015:50350",
    "IAU_2015:50351",
    "IAU_2015:50355",
    "IAU_2015:50356",
    "IAU_2015:50420",
    "IAU_2015:50421",
    "IAU_2015:50425",
    "IAU_2015:50426",
    "IAU_2015:50440",
    "IAU_2015:50441",
    "IAU_2015:50445",
    "IAU_2015:50446",
    "IAU_2015:50450",
    "IAU_2015:50451",
    "IAU_2015:50455",
    "IAU_2015:50456",
    "IAU_2015:50520",
    "IAU_2015:50525",
    "IAU_2015:50540",
    "IAU_2015:50545",
    "IAU_2015:50550",
    "IAU_2015:50555",
    "IAU_2015:50620",
    "IAU_2015:50625",
    "IAU_2015:50640",
    "IAU_2015:50645",
    "IAU_2015:50650",
    "IAU_2015:50655",
    "IAU_2015:50720",
    "IAU_2015:50725",
    "IAU_2015:50740",
    "IAU_2015:50745",
    "IAU_2015:50750",
    "IAU_2015:50755",
    "IAU_2015:50820",
    "IAU_2015:50825",
    "IAU_2015:50840",
    "IAU_2015:50845",
    "IAU_2015:50850",
    "IAU_2015:50855",
    "IAU_2015:50920",
    "IAU_2015:50925",
    "IAU_2015:50940",
    "IAU_2015:50945",
    "IAU_2015:50950",
    "IAU_2015:50955",
    "IAU_2015:51020",
    "IAU_2015:51025",
    "IAU_2015:51040",
    "IAU_2015:51045",
    "IAU_2015:51050",
    "IAU_2015:51055",
    "IAU_2015:51120",
    "IAU_2015:51125",
    "IAU_2015:51140",
    "IAU_2015:51145",
    "IAU_2015:51150",
    "IAU_2015:51155",
    "IAU_2015:51220",
    "IAU_2015:51225",
    "IAU_2015:51240",
    "IAU_2015:51245",
    "IAU_2015:51250",
    "IAU_2015:51255",
    "IAU_2015:51320",
    "IAU_2015:51325",
    "IAU_2015:51340",
    "IAU_2015:51345",
    "IAU_2015:51350",
    "IAU_2015:51355",
    "IAU_2015:51420",
    "IAU_2015:51425",
    "IAU_2015:51440",
    "IAU_2015:51445",
    "IAU_2015:51450",
    "IAU_2015:51455",
    "IAU_2015:51520",
    "IAU_2015:51525",
    "IAU_2015:51540",
    "IAU_2015:51545",
    "IAU_2015:51550",
    "IAU_2015:51555",
    "IAU_2015:51620",
    "IAU_2015:51625",
    "IAU_2015:51640",
    "IAU_2015:51645",
    "IAU_2015:51650",
    "IAU_2015:51655",
    "IAU_2015:59920",
    "IAU_2015:59921",
    "IAU_2015:59922",
    "IAU_2015:59925",
    "IAU_2015:59926",
    "IAU_2015:59927",
    "IAU_2015:59940",
    "IAU_2015:59941",
    "IAU_2015:59942",
    "IAU_2015:59945",
    "IAU_2015:59946",
    "IAU_2015:59947",
    "IAU_2015:59950",
    "IAU_2015:59951",
    "IAU_2015:59952",
    "IAU_2015:59955",
    "IAU_2015:59956",
    "IAU_2015:59957",
    "IAU_2015:60120",
    "IAU_2015:60125",
    "IAU_2015:60140",
    "IAU_2015:60145",
    "IAU_2015:60150",
    "IAU_2015:60155",
    "IAU_2015:60220",
    "IAU_2015:60225",
    "IAU_2015:60240",
    "IAU_2015:60245",
    "IAU_2015:60250",
    "IAU_2015:60255",
    "IAU_2015:60320",
    "IAU_2015:60325",
    "IAU_2015:60340",
    "IAU_2015:60345",
    "IAU_2015:60350",
    "IAU_2015:60355",
    "IAU_2015:60420",
    "IAU_2015:60425",
    "IAU_2015:60440",
    "IAU_2015:60445",
    "IAU_2015:60450",
    "IAU_2015:60455",
    "IAU_2015:60520",
    "IAU_2015:60525",
    "IAU_2015:60540",
    "IAU_2015:60545",
    "IAU_2015:60550",
    "IAU_2015:60555",
    "IAU_2015:60620",
    "IAU_2015:60625",
    "IAU_2015:60640",
    "IAU_2015:60645",
    "IAU_2015:60650",
    "IAU_2015:60655",
    "IAU_2015:60720",
    "IAU_2015:60725",
    "IAU_2015:60740",
    "IAU_2015:60745",
    "IAU_2015:60750",
    "IAU_2015:60755",
    "IAU_2015:60820",
    "IAU_2015:60821",
    "IAU_2015:60822",
    "IAU_2015:60825",
    "IAU_2015:60826",
    "IAU_2015:60827",
    "IAU_2015:60840",
    "IAU_2015:60841",
    "IAU_2015:60842",
    "IAU_2015:60845",
    "IAU_2015:60846",
    "IAU_2015:60847",
    "IAU_2015:60850",
    "IAU_2015:60851",
    "IAU_2015:60852",
    "IAU_2015:60855",
    "IAU_2015:60856",
    "IAU_2015:60857",
    "IAU_2015:60920",
    "IAU_2015:60925",
    "IAU_2015:60940",
    "IAU_2015:60945",
    "IAU_2015:60950",
    "IAU_2015:60955",
    "IAU_2015:61020",
    "IAU_2015:61025",
    "IAU_2015:61040",
    "IAU_2015:61045",
    "IAU_2015:61050",
    "IAU_2015:61055",
    "IAU_2015:61120",
    "IAU_2015:61125",
    "IAU_2015:61140",
    "IAU_2015:61145",
    "IAU_2015:61150",
    "IAU_2015:61155",
    "IAU_2015:61220",
    "IAU_2015:61225",
    "IAU_2015:61240",
    "IAU_2015:61245",
    "IAU_2015:61250",
    "IAU_2015:61255",
    "IAU_2015:61320",
    "IAU_2015:61325",
    "IAU_2015:61340",
    "IAU_2015:61345",
    "IAU_2015:61350",
    "IAU_2015:61355",
    "IAU_2015:61420",
    "IAU_2015:61425",
    "IAU_2015:61440",
    "IAU_2015:61445",
    "IAU_2015:61450",
    "IAU_2015:61455",
    "IAU_2015:61520",
    "IAU_2015:61525",
    "IAU_2015:61540",
    "IAU_2015:61545",
    "IAU_2015:61550",
    "IAU_2015:61555",
    "IAU_2015:61620",
    "IAU_2015:61625",
    "IAU_2015:61640",
    "IAU_2015:61645",
    "IAU_2015:61650",
    "IAU_2015:61655",
    "IAU_2015:61720",
    "IAU_2015:61725",
    "IAU_2015:61740",
    "IAU_2015:61745",
    "IAU_2015:61750",
    "IAU_2015:61755",
    "IAU_2015:61820",
    "IAU_2015:61825",
    "IAU_2015:61840",
    "IAU_2015:61845",
    "IAU_2015:61850",
    "IAU_2015:61855",
    "IAU_2015:63220",
    "IAU_2015:63225",
    "IAU_2015:63240",
    "IAU_2015:63245",
    "IAU_2015:63250",
    "IAU_2015:63255",
    "IAU_2015:63320",
    "IAU_2015:63325",
    "IAU_2015:63340",
    "IAU_2015:63345",
    "IAU_2015:63350",
    "IAU_2015:63355",
    "IAU_2015:63420",
    "IAU_2015:63425",
    "IAU_2015:63440",
    "IAU_2015:63445",
    "IAU_2015:63450",
    "IAU_2015:63455",
    "IAU_2015:63520",
    "IAU_2015:63525",
    "IAU_2015:63540",
    "IAU_2015:63545",
    "IAU_2015:63550",
    "IAU_2015:63555",
    "IAU_2015:64920",
    "IAU_2015:64925",
    "IAU_2015:64940",
    "IAU_2015:64945",
    "IAU_2015:64950",
    "IAU_2015:64955",
    "IAU_2015:65320",
    "IAU_2015:65325",
    "IAU_2015:65340",
    "IAU_2015:65345",
    "IAU_2015:65350",
    "IAU_2015:65355",
    "IAU_2015:69920",
    "IAU_2015:69921",
    "IAU_2015:69922",
    "IAU_2015:69925",
    "IAU_2015:69926",
    "IAU_2015:69927",
    "IAU_2015:69940",
    "IAU_2015:69941",
    "IAU_2015:69942",
    "IAU_2015:69945",
    "IAU_2015:69946",
    "IAU_2015:69947",
    "IAU_2015:69950",
    "IAU_2015:69951",
    "IAU_2015:69952",
    "IAU_2015:69955",
    "IAU_2015:69956",
    "IAU_2015:69957",
    "IAU_2015:70120",
    "IAU_2015:70125",
    "IAU_2015:70140",
    "IAU_2015:70145",
    "IAU_2015:70150",
    "IAU_2015:70155",
    "IAU_2015:70220",
    "IAU_2015:70225",
    "IAU_2015:70240",
    "IAU_2015:70245",
    "IAU_2015:70250",
    "IAU_2015:70255",
    "IAU_2015:70320",
    "IAU_2015:70325",
    "IAU_2015:70340",
    "IAU_2015:70345",
    "IAU_2015:70350",
    "IAU_2015:70355",
    "IAU_2015:70420",
    "IAU_2015:70425",
    "IAU_2015:70440",
    "IAU_2015:70445",
    "IAU_2015:70450",
    "IAU_2015:70455",
    "IAU_2015:70520",
    "IAU_2015:70525",
    "IAU_2015:70540",
    "IAU_2015:70545",
    "IAU_2015:70550",
    "IAU_2015:70555",
    "IAU_2015:70620",
    "IAU_2015:70625",
    "IAU_2015:70640",
    "IAU_2015:70645",
    "IAU_2015:70650",
    "IAU_2015:70655",
    "IAU_2015:70720",
    "IAU_2015:70725",
    "IAU_2015:70740",
    "IAU_2015:70745",
    "IAU_2015:70750",
    "IAU_2015:70755",
    "IAU_2015:70820",
    "IAU_2015:70825",
    "IAU_2015:70840",
    "IAU_2015:70845",
    "IAU_2015:70850",
    "IAU_2015:70855",
    "IAU_2015:70920",
    "IAU_2015:70925",
    "IAU_2015:70940",
    "IAU_2015:70945",
    "IAU_2015:70950",
    "IAU_2015:70955",
    "IAU_2015:71020",
    "IAU_2015:71025",
    "IAU_2015:71040",
    "IAU_2015:71045",
    "IAU_2015:71050",
    "IAU_2015:71055",
    "IAU_2015:71120",
    "IAU_2015:71125",
    "IAU_2015:71140",
    "IAU_2015:71145",
    "IAU_2015:71150",
    "IAU_2015:71155",
    "IAU_2015:71220",
    "IAU_2015:71225",
    "IAU_2015:71240",
    "IAU_2015:71245",
    "IAU_2015:71250",
    "IAU_2015:71255",
    "IAU_2015:71320",
    "IAU_2015:71325",
    "IAU_2015:71340",
    "IAU_2015:71345",
    "IAU_2015:71350",
    "IAU_2015:71355",
    "IAU_2015:71420",
    "IAU_2015:71425",
    "IAU_2015:71440",
    "IAU_2015:71445",
    "IAU_2015:71450",
    "IAU_2015:71455",
    "IAU_2015:71520",
    "IAU_2015:71525",
    "IAU_2015:71540",
    "IAU_2015:71545",
    "IAU_2015:71550",
    "IAU_2015:71555",
    "IAU_2015:79920",
    "IAU_2015:79921",
    "IAU_2015:79925",
    "IAU_2015:79926",
    "IAU_2015:79940",
    "IAU_2015:79941",
    "IAU_2015:79945",
    "IAU_2015:79946",
    "IAU_2015:79950",
    "IAU_2015:79951",
    "IAU_2015:79955",
    "IAU_2015:79956",
    "IAU_2015:80120",
    "IAU_2015:80125",
    "IAU_2015:80140",
    "IAU_2015:80145",
    "IAU_2015:80150",
    "IAU_2015:80155",
    "IAU_2015:80220",
    "IAU_2015:80225",
    "IAU_2015:80240",
    "IAU_2015:80245",
    "IAU_2015:80250",
    "IAU_2015:80255",
    "IAU_2015:80320",
    "IAU_2015:80321",
    "IAU_2015:80325",
    "IAU_2015:80326",
    "IAU_2015:80340",
    "IAU_2015:80341",
    "IAU_2015:80345",
    "IAU_2015:80346",
    "IAU_2015:80350",
    "IAU_2015:80351",
    "IAU_2015:80355",
    "IAU_2015:80356",
    "IAU_2015:80420",
    "IAU_2015:80421",
    "IAU_2015:80425",
    "IAU_2015:80426",
    "IAU_2015:80440",
    "IAU_2015:80441",
    "IAU_2015:80445",
    "IAU_2015:80446",
    "IAU_2015:80450",
    "IAU_2015:80451",
    "IAU_2015:80455",
    "IAU_2015:80456",
    "IAU_2015:80520",
    "IAU_2015:80521",
    "IAU_2015:80525",
    "IAU_2015:80526",
    "IAU_2015:80540",
    "IAU_2015:80541",
    "IAU_2015:80545",
    "IAU_2015:80546",
    "IAU_2015:80550",
    "IAU_2015:80551",
    "IAU_2015:80555",
    "IAU_2015:80556",
    "IAU_2015:80620",
    "IAU_2015:80621",
    "IAU_2015:80625",
    "IAU_2015:80626",
    "IAU_2015:80640",
    "IAU_2015:80641",
    "IAU_2015:80645",
    "IAU_2015:80646",
    "IAU_2015:80650",
    "IAU_2015:80651",
    "IAU_2015:80655",
    "IAU_2015:80656",
    "IAU_2015:80720",
    "IAU_2015:80721",
    "IAU_2015:80722",
    "IAU_2015:80725",
    "IAU_2015:80726",
    "IAU_2015:80727",
    "IAU_2015:80740",
    "IAU_2015:80741",
    "IAU_2015:80742",
    "IAU_2015:80745",
    "IAU_2015:80746",
    "IAU_2015:80747",
    "IAU_2015:80750",
    "IAU_2015:80751",
    "IAU_2015:80752",
    "IAU_2015:80755",
    "IAU_2015:80756",
    "IAU_2015:80757",
    "IAU_2015:80820",
    "IAU_2015:80825",
    "IAU_2015:80840",
    "IAU_2015:80845",
    "IAU_2015:80850",
    "IAU_2015:80855",
    "IAU_2015:89920",
    "IAU_2015:89921",
    "IAU_2015:89922",
    "IAU_2015:89925",
    "IAU_2015:89926",
    "IAU_2015:89927",
    "IAU_2015:89940",
    "IAU_2015:89941",
    "IAU_2015:89942",
    "IAU_2015:89945",
    "IAU_2015:89946",
    "IAU_2015:89947",
    "IAU_2015:89950",
    "IAU_2015:89951",
    "IAU_2015:89952",
    "IAU_2015:89955",
    "IAU_2015:89956",
    "IAU_2015:89957",
    "IAU_2015:90120",
    "IAU_2015:90125",
    "IAU_2015:90140",
    "IAU_2015:90145",
    "IAU_2015:90150",
    "IAU_2015:90155",
    "IAU_2015:99920",
    "IAU_2015:99925",
    "IAU_2015:99940",
    "IAU_2015:99945",
    "IAU_2015:99950",
    "IAU_2015:99955",
    "IAU_2015:100000520",
    "IAU_2015:100000525",
    "IAU_2015:100000540",
    "IAU_2015:100000545",
    "IAU_2015:100000550",
    "IAU_2015:100000555",
    "IAU_2015:100001220",
    "IAU_2015:100001225",
    "IAU_2015:100001240",
    "IAU_2015:100001245",
    "IAU_2015:100001250",
    "IAU_2015:100001255",
    "IAU_2015:100003620",
    "IAU_2015:100003621",
    "IAU_2015:100003625",
    "IAU_2015:100003626",
    "IAU_2015:100003640",
    "IAU_2015:100003641",
    "IAU_2015:100003645",
    "IAU_2015:100003646",
    "IAU_2015:100003650",
    "IAU_2015:100003651",
    "IAU_2015:100003655",
    "IAU_2015:100003656",
    "IAU_2015:100004120",
    "IAU_2015:100004125",
    "IAU_2015:100004140",
    "IAU_2015:100004145",
    "IAU_2015:100004150",
    "IAU_2015:100004155",
    "IAU_2015:100009320",
    "IAU_2015:100009325",
    "IAU_2015:100009340",
    "IAU_2015:100009345",
    "IAU_2015:100009350",
    "IAU_2015:100009355",
    "IAU_2015:100010720",
    "IAU_2015:100010725",
    "IAU_2015:100010740",
    "IAU_2015:100010745",
    "IAU_2015:100010750",
    "IAU_2015:100010755",
    "IAU_2015:200000120",
    "IAU_2015:200000121",
    "IAU_2015:200000125",
    "IAU_2015:200000126",
    "IAU_2015:200000140",
    "IAU_2015:200000141",
    "IAU_2015:200000145",
    "IAU_2015:200000146",
    "IAU_2015:200000150",
    "IAU_2015:200000151",
    "IAU_2015:200000155",
    "IAU_2015:200000156",
    "IAU_2015:200000420",
    "IAU_2015:200000425",
    "IAU_2015:200000440",
    "IAU_2015:200000445",
    "IAU_2015:200000450",
    "IAU_2015:200000455",
    "IAU_2015:200001620",
    "IAU_2015:200001625",
    "IAU_2015:200001640",
    "IAU_2015:200001645",
    "IAU_2015:200001650",
    "IAU_2015:200001655",
    "IAU_2015:200002120",
    "IAU_2015:200002125",
    "IAU_2015:200002140",
    "IAU_2015:200002145",
    "IAU_2015:200002150",
    "IAU_2015:200002155",
    "IAU_2015:200005220",
    "IAU_2015:200005225",
    "IAU_2015:200005240",
    "IAU_2015:200005245",
    "IAU_2015:200005250",
    "IAU_2015:200005255",
    "IAU_2015:200021620",
    "IAU_2015:200021625",
    "IAU_2015:200021640",
    "IAU_2015:200021645",
    "IAU_2015:200021650",
    "IAU_2015:200021655",
    "IAU_2015:200025320",
    "IAU_2015:200025325",
    "IAU_2015:200025340",
    "IAU_2015:200025345",
    "IAU_2015:200025350",
    "IAU_2015:200025355",
    "IAU_2015:200043320",
    "IAU_2015:200043321",
    "IAU_2015:200043325",
    "IAU_2015:200043326",
    "IAU_2015:200043340",
    "IAU_2015:200043341",
    "IAU_2015:200043345",
    "IAU_2015:200043346",
    "IAU_2015:200043350",
    "IAU_2015:200043351",
    "IAU_2015:200043355",
    "IAU_2015:200043356",
    "IAU_2015:200051120",
    "IAU_2015:200051125",
    "IAU_2015:200051140",
    "IAU_2015:200051145",
    "IAU_2015:200051150",
    "IAU_2015:200051155",
    "IAU_2015:200286720",
    "IAU_2015:200286725",
    "IAU_2015:200286740",
    "IAU_2015:200286745",
    "IAU_2015:200286750",
    "IAU_2015:200286755",
    "IAU_2015:200417920",
    "IAU_2015:200417925",
    "IAU_2015:200417940",
    "IAU_2015:200417945",
    "IAU_2015:200417950",
    "IAU_2015:200417955",
    "IAU_2015:202514320",
    "IAU_2015:202514325",
    "IAU_2015:202514340",
    "IAU_2015:202514345",
    "IAU_2015:202514350",
    "IAU_2015:202514355",
    "IAU_2015:243101020",
    "IAU_2015:243101025",
    "IAU_2015:243101040",
    "IAU_2015:243101045",
    "IAU_2015:243101050",
    "IAU_2015:243101055",
    "IAU_2015:951101020",
    "IAU_2015:951101025",
    "IAU_2015:951101040",
    "IAU_2015:951101045",
    "IAU_2015:951101050",
    "IAU_2015:951101055",
    "IGNF:AMANU63UTM7S",
    "IGNF:AMST63UTM43S",
    "IGNF:ANAA47UTM6S",
    "IGNF:ANAA92UTM6S",
    "IGNF:APAT80UTM6S",
    "IGNF:APAT86UTM6S",
    "IGNF:APAT86UTM7S",
    "IGNF:ATIGBONNE",
    "IGNF:ATUO63UTM7S",
    "IGNF:C67IG95UTM21",
    "IGNF:C67IG95UTM22",
    "IGNF:CAD97UTM38S",
    "IGNF:CLIP57UTM12",
    "IGNF:CLIP67UTM12",
    "IGNF:CROZ63UTM39S",
    "IGNF:CSG67UTM21",
    "IGNF:CSG67UTM22",
    "IGNF:ED50UTM30",
    "IGNF:ED50UTM31",
    "IGNF:ED50UTM32",
    "IGNF:EFAT57UTM59S",
    "IGNF:EFATE57UT59S",
    "IGNF:ETRS89LAEA",
    "IGNF:ETRS89LCC",
    "IGNF:ETRS89UTM26",
    "IGNF:ETRS89UTM27",
    "IGNF:ETRS89UTM28",
    "IGNF:ETRS89UTM29",
    "IGNF:ETRS89UTM30",
    "IGNF:ETRS89UTM31",
    "IGNF:ETRS89UTM32",
    "IGNF:ETRS89UTM33",
    "IGNF:ETRS89UTM34",
    "IGNF:ETRS89UTM35",
    "IGNF:ETRS89UTM36",
    "IGNF:ETRS89UTM37",
    "IGNF:ETRS89UTM38",
    "IGNF:EURO54UTM37S",
    "IGNF:EUROPA54MD",
    "IGNF:FAKA50UTM6S",
    "IGNF:FANG651UTM7S",
    "IGNF:FANG652UTM7S",
    "IGNF:FANGA64UTM7S",
    "IGNF:FANGA66UTM7S",
    "IGNF:FANGA84UTM7S",
    "IGNF:FANGA651U7S",
    "IGNF:FANGA652U7S",
    "IGNF:GEOPORTALANF",
    "IGNF:GEOPORTALASP",
    "IGNF:GEOPORTALCRZ",
    "IGNF:GEOPORTALFXX",
    "IGNF:GEOPORTALGUF",
    "IGNF:GEOPORTALKER",
    "IGNF:GEOPORTALMYT",
    "IGNF:GEOPORTALNCL",
    "IGNF:GEOPORTALPYF",
    "IGNF:GEOPORTALREU",
    "IGNF:GEOPORTALSPM",
    "IGNF:GEOPORTALWLF",
    "IGNF:GLOR77MD",
    "IGNF:GLOR77UTM38S",
    "IGNF:GTN51UTM58S",
    "IGNF:GUAD48UTM20",
    "IGNF:GUADANNUTM20",
    "IGNF:GUADFM49U20",
    "IGNF:GUADFMUTM20",
    "IGNF:HAO58UTM7S",
    "IGNF:HAO67UTM7S",
    "IGNF:HAOAM67UTM7S",
    "IGNF:HARA49UTM7S",
    "IGNF:HIKU50UTM7S",
    "IGNF:HIVA60UTM7S",
    "IGNF:HIVA67UTM7S",
    "IGNF:IGN63UTM7S",
    "IGNF:IGN72LAM",
    "IGNF:IGN72LAMBNC",
    "IGNF:IGN72UTM58S",
    "IGNF:KAUE70UTM6S",
    "IGNF:KERG62UTM42S",
    "IGNF:LAMB1",
    "IGNF:LAMB1C",
    "IGNF:LAMB2",
    "IGNF:LAMB2C",
    "IGNF:LAMB3",
    "IGNF:LAMB3C",
    "IGNF:LAMB4",
    "IGNF:LAMB4C",
    "IGNF:LAMB93",
    "IGNF:LAMBE",
    "IGNF:LAMBGC",
    "IGNF:LIFOU56UT58S",
    "IGNF:LNGLNG",
    "IGNF:LURESGKL",
    "IGNF:LUXGAUSSK",
    "IGNF:MAKE50UTM7S",
    "IGNF:MANGA51U8S",
    "IGNF:MANGA51UTM8S",
    "IGNF:MARE53UTM58S",
    "IGNF:MART38UTM20",
    "IGNF:MARTFDUTM20",
    "IGNF:MAUPITIUTM5S",
    "IGNF:MAYO50UTM38S",
    "IGNF:MHPF67UTM8S",
    "IGNF:MILLER",
    "IGNF:MOORE87UTM6S",
    "IGNF:MOOREA87U6S",
    "IGNF:MOP90UTM6S",
    "IGNF:MURU59UTM7S",
    "IGNF:MURU62UTM7S",
    "IGNF:MURU78UTM7S",
    "IGNF:NC51UTM58S",
    "IGNF:NEA74LBTNM2",
    "IGNF:NOVA53UTM38S",
    "IGNF:NTFLAMB1",
    "IGNF:NTFLAMB1C",
    "IGNF:NTFLAMB2",
    "IGNF:NTFLAMB2C",
    "IGNF:NTFLAMB2E",
    "IGNF:NTFLAMB3",
    "IGNF:NTFLAMB3C",
    "IGNF:NTFLAMB4",
    "IGNF:NTFLAMB4C",
    "IGNF:NTFLAMBGC",
    "IGNF:NUKU72U7S",
    "IGNF:NUKU72UTM7S",
    "IGNF:OUVE72UTM58S",
    "IGNF:OUVEA72U58S",
    "IGNF:PDN08GAUSSL",
    "IGNF:PDN92GAUSSL",
    "IGNF:PGP50STEREPS",
    "IGNF:RAIA53UTM5S",
    "IGNF:RAIV54UTM6S",
    "IGNF:RAIV66UTM6S",
    "IGNF:RANGI47U6S",
    "IGNF:RANGI47UTM6S",
    "IGNF:RANGI59U6S",
    "IGNF:RANGI59UTM6S",
    "IGNF:RANGI68U6S",
    "IGNF:RANGI68UTM6S",
    "IGNF:REUN47GAUSSL",
    "IGNF:REUN49GAUSSL",
    "IGNF:RGAF09UTM20",
    "IGNF:RGF93CC42",
    "IGNF:RGF93CC43",
    "IGNF:RGF93CC44",
    "IGNF:RGF93CC45",
    "IGNF:RGF93CC46",
    "IGNF:RGF93CC47",
    "IGNF:RGF93CC48",
    "IGNF:RGF93CC49",
    "IGNF:RGF93CC50",
    "IGNF:RGF93EQGPFR",
    "IGNF:RGF93LAMB93",
    "IGNF:RGF93UTM30",
    "IGNF:RGF93UTM31",
    "IGNF:RGF93UTM32",
    "IGNF:RGFG95EQGPGU",
    "IGNF:RGFG95UTM21",
    "IGNF:RGFG95UTM22",
    "IGNF:RGM04EQGPMYT",
    "IGNF:RGM04UTM38S",
    "IGNF:RGNC91EQGPNC",
    "IGNF:RGNCLAM",
    "IGNF:RGNCLAMBNC",
    "IGNF:RGNCUTM57S",
    "IGNF:RGNCUTM58S",
    "IGNF:RGNCUTM59S",
    "IGNF:RGPFEQGPPF",
    "IGNF:RGPFUTM5S",
    "IGNF:RGPFUTM6S",
    "IGNF:RGPFUTM7S",
    "IGNF:RGPFUTM8S",
    "IGNF:RGR92EQGPREU",
    "IGNF:RGR92UTM40S",
    "IGNF:RGSPM06EQGP",
    "IGNF:RGSPM06U21",
    "IGNF:RGTAAFUTM37S",
    "IGNF:RGTAAFUTM39S",
    "IGNF:RGTAAFUTM42S",
    "IGNF:RGTAAFUTM43S",
    "IGNF:RGTAAFUTM53S",
    "IGNF:RGWF96UTM1S",
    "IGNF:RRAFUTM20",
    "IGNF:RUSAT84UTM5S",
    "IGNF:SAT84UTM5S",
    "IGNF:ST84UTM58S",
    "IGNF:ST87UTM58S",
    "IGNF:STPL69UTM43S",
    "IGNF:STPM50UTM21",
    "IGNF:SYSLN",
    "IGNF:TAHAA53UTM5S",
    "IGNF:TAHAAUTM05S",
    "IGNF:TAHAAUTM5S",
    "IGNF:TAHI51UTM06S",
    "IGNF:TAHI51UTM6S",
    "IGNF:TAHI79UTM6S",
    "IGNF:TAKA69UTM6S",
    "IGNF:TANNAUTM59S",
    "IGNF:TERA50STEREO",
    "IGNF:TETIA90UTM6S",
    "IGNF:TIKE50UTM6S",
    "IGNF:TIKE60UTM6S",
    "IGNF:TIKE88UTM6S",
    "IGNF:TROM56MD",
    "IGNF:TUAM86UTM6S",
    "IGNF:TUAM86UTM7S",
    "IGNF:TUBU69UTM6S",
    "IGNF:TURI69UTM7S",
    "IGNF:UTM01SW84",
    "IGNF:UTM20W84MART",
    "IGNF:UTM21RGFG95",
    "IGNF:UTM22RGFG95",
    "IGNF:UTM26ETRS89",
    "IGNF:UTM27ETRS89",
    "IGNF:UTM28ETRS89",
    "IGNF:UTM29ETRS89",
    "IGNF:UTM30",
    "IGNF:UTM30ETRS89",
    "IGNF:UTM30RGF93",
    "IGNF:UTM30W72",
    "IGNF:UTM30W84",
    "IGNF:UTM31",
    "IGNF:UTM31ETRS89",
    "IGNF:UTM31RGF93",
    "IGNF:UTM31W72",
    "IGNF:UTM31W84",
    "IGNF:UTM32",
    "IGNF:UTM32ETRS89",
    "IGNF:UTM32RGF93",
    "IGNF:UTM32W72",
    "IGNF:UTM32W84",
    "IGNF:UTM33ETRS89",
    "IGNF:UTM34ETRS89",
    "IGNF:UTM35ETRS89",
    "IGNF:UTM36ETRS89",
    "IGNF:UTM37ETRS89",
    "IGNF:UTM38ETRS89",
    "IGNF:UTM39SW84",
    "IGNF:UTM42SW84",
    "IGNF:UTM43SW84",
    "IGNF:WALL76UTM1S",
    "IGNF:WALL78UTM1S",
    "IGNF:WGS72UTM1S",
    "IGNF:WGS72UTM30",
    "IGNF:WGS72UTM31",
    "IGNF:WGS72UTM32",
    "IGNF:WGS84EQGPASP",
    "IGNF:WGS84EQGPCRZ",
    "IGNF:WGS84EQGPKER",
    "IGNF:WGS84EQGPWF",
    "IGNF:WGS84GPAF",
    "IGNF:WGS84MILLGP",
    "IGNF:WGS84UTM1S",
    "IGNF:WGS84UTM30",
    "IGNF:WGS84UTM31",
    "IGNF:WGS84UTM32",
    "IGNF:WGS84UTM39S",
    "IGNF:WGS84UTM42S",
    "IGNF:WGS84UTM43S",
    "IGNF:WGS84WMSV"
  ],
  proj4Unavailable: [
    {
      id: "EPSG:2218",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2221",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2296",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2299",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2301",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2303",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2304",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2305",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2306",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2307",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:2963",
      reason: "Unsupported conversion method: Bonne (South Orientated)"
    },
    {
      id: "EPSG:2985",
      reason: "Unsupported conversion method: Polar Stereographic (variant C)"
    },
    {
      id: "EPSG:2986",
      reason: "Unsupported conversion method: Polar Stereographic (variant C)"
    },
    {
      id: "EPSG:3052",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:3053",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:3144",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:3145",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:3173",
      reason: "Unsupported conversion method: Lambert Conic Conformal (West Orientated)"
    },
    {
      id: "EPSG:5017",
      reason: "Unsupported conversion method: Bonne (South Orientated)"
    },
    {
      id: "EPSG:22300",
      reason: "Unsupported conversion method: Tunisia Mining Grid"
    },
    {
      id: "EPSG:22700",
      reason: "Unsupported conversion method: Lambert Conic Near-Conformal"
    },
    {
      id: "EPSG:32600",
      reason: "Unsupported conversion method: Transverse Mercator Zoned Grid System"
    },
    {
      id: "EPSG:32700",
      reason: "Unsupported conversion method: Transverse Mercator Zoned Grid System"
    },
    {
      id: "ESRI:53044",
      reason: "Unsupported conversion method: Hammer_Aitoff"
    },
    {
      id: "ESRI:54044",
      reason: "Unsupported conversion method: Hammer_Aitoff"
    },
    {
      id: "ESRI:54050",
      reason: "Unsupported conversion method: Fuller"
    },
    {
      id: "ESRI:54051",
      reason: "Unsupported conversion method: Cube"
    },
    {
      id: "ESRI:54100",
      reason: "Unsupported conversion method: Tobler_Cylindrical_I"
    },
    {
      id: "ESRI:54101",
      reason: "Unsupported conversion method: Tobler_Cylindrical_II"
    },
    {
      id: "ESRI:102299",
      reason: "Unsupported conversion method: Berghaus_Star"
    }
  ]
}, b = 15, W = new Set(E.wkt2Unavailable), y = new Map(
  E.proj4Unavailable.map((I) => [I.id, I.reason])
), v = "+proj=longlat +datum=WGS84 +no_defs +type=crs";
let C, T, M, m = !1, N;
const F = /* @__PURE__ */ new Map(), D = new URL("data:application/json;base64,ewogICJwcm9qZWN0aW9ucyI6IFsKICAgIHsKICAgICAgImF1dGhvcml0eSI6ICJVVEpDUCIsCiAgICAgICJjb2RlIjogIlpPTkUtQSIsCiAgICAgICJuYW1lIjogIkphcGFuIENpdHkgUGxhbnMgUG9seWNvbmljIEdyaWQgWm9uZSBBIiwKICAgICAgImFyZWFOYW1lIjogIkphcGFuIENpdHkgUGxhbnMgLSBIaXN0b3JpY2FsIEdyaWQgWm9uZSBBIiwKICAgICAgImRlcHJlY2F0ZWQiOiBmYWxzZSwKICAgICAgImJib3giOiB7CiAgICAgICAgIndlc3QiOiAxMzksCiAgICAgICAgInNvdXRoIjogMjQsCiAgICAgICAgImVhc3QiOiAxNDcsCiAgICAgICAgIm5vcnRoIjogNDYKICAgICAgfSwKICAgICAgInBpcGVsaW5lIjogIitwcm9qPXBpcGVsaW5lICtzdGVwICtpbnYgK3Byb2o9cG9seSArbGF0XzA9NDAuNSArbG9uXzA9MTQzICt4XzA9OTE0Mzk4LjUzMDc0NDQ0MDggK3lfMD0xODI4Nzk3LjA2MTQ4ODg4MTYgK2VsbHBzPWNscms2NiArdG9fbWV0ZXI9MC45MTQzOTg1MzA3NDQ0NDA4ICtzdGVwICtwcm9qPWNhcnQgK2VsbHBzPWJlc3NlbCArc3RlcCArcHJvaj1oZWxtZXJ0ICt4PS0xNDYuMzM2ICt5PTUwNi44MzIgK3o9NjgwLjI1NCArc3RlcCAraW52ICtwcm9qPWNhcnQgK2VsbHBzPVdHUzg0ICtzdGVwICtwcm9qPXVuaXRjb252ZXJ0ICt4eV9pbj1yYWQgK3h5X291dD1kZWciLAogICAgICAid2t0MiI6IG51bGwsCiAgICAgICJpc0FwcHJveGltYXRlIjogdHJ1ZSwKICAgICAgInNvdXJjZSI6IFsKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMjAvMTM2MTM5MDE0OCIsCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjE2LzEzNjA5NjgyMjAiCiAgICAgIF0KICAgIH0sCiAgICB7CiAgICAgICJhdXRob3JpdHkiOiAiVVRKQ1AiLAogICAgICAiY29kZSI6ICJaT05FLUIiLAogICAgICAibmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIFBvbHljb25pYyBHcmlkIFpvbmUgQiIsCiAgICAgICJhcmVhTmFtZSI6ICJKYXBhbiBDaXR5IFBsYW5zIC0gSGlzdG9yaWNhbCBHcmlkIFpvbmUgQiIsCiAgICAgICJkZXByZWNhdGVkIjogZmFsc2UsCiAgICAgICJiYm94IjogewogICAgICAgICJ3ZXN0IjogMTMxLAogICAgICAgICJzb3V0aCI6IDI0LAogICAgICAgICJlYXN0IjogMTM5LAogICAgICAgICJub3J0aCI6IDQ2CiAgICAgIH0sCiAgICAgICJwaXBlbGluZSI6ICIrcHJvaj1waXBlbGluZSArc3RlcCAraW52ICtwcm9qPXBvbHkgK2xhdF8wPTQwLjUgK2xvbl8wPTEzNSAreF8wPTkxNDM5OC41MzA3NDQ0NDA4ICt5XzA9MTgyODc5Ny4wNjE0ODg4ODE2ICtlbGxwcz1jbHJrNjYgK3RvX21ldGVyPTAuOTE0Mzk4NTMwNzQ0NDQwOCArc3RlcCArcHJvaj1jYXJ0ICtlbGxwcz1iZXNzZWwgK3N0ZXAgK3Byb2o9aGVsbWVydCAreD0tMTQ2LjMzNiAreT01MDYuODMyICt6PTY4MC4yNTQgK3N0ZXAgK2ludiArcHJvaj1jYXJ0ICtlbGxwcz1XR1M4NCArc3RlcCArcHJvaj11bml0Y29udmVydCAreHlfaW49cmFkICt4eV9vdXQ9ZGVnIiwKICAgICAgIndrdDIiOiBudWxsLAogICAgICAiaXNBcHByb3hpbWF0ZSI6IHRydWUsCiAgICAgICJzb3VyY2UiOiBbCiAgICAgICAgImh0dHBzOi8vYmxvZy5jb2RlNGhpc3RvcnkuZGV2L2VudHJ5LzIwMTMwMjIwLzEzNjEzOTAxNDgiLAogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIxNi8xMzYwOTY4MjIwIgogICAgICBdCiAgICB9LAogICAgewogICAgICAiYXV0aG9yaXR5IjogIlVUSkNQIiwKICAgICAgImNvZGUiOiAiWk9ORS1DIiwKICAgICAgIm5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyBQb2x5Y29uaWMgR3JpZCBab25lIEMiLAogICAgICAiYXJlYU5hbWUiOiAiSmFwYW4gQ2l0eSBQbGFucyAtIEhpc3RvcmljYWwgR3JpZCBab25lIEMiLAogICAgICAiZGVwcmVjYXRlZCI6IGZhbHNlLAogICAgICAiYmJveCI6IHsKICAgICAgICAid2VzdCI6IDEyMywKICAgICAgICAic291dGgiOiAyNCwKICAgICAgICAiZWFzdCI6IDEzMSwKICAgICAgICAibm9ydGgiOiA0NgogICAgICB9LAogICAgICAicGlwZWxpbmUiOiAiK3Byb2o9cGlwZWxpbmUgK3N0ZXAgK2ludiArcHJvaj1wb2x5ICtsYXRfMD00MC41ICtsb25fMD0xMjcgK3hfMD05MTQzOTguNTMwNzQ0NDQwOCAreV8wPTE4Mjg3OTcuMDYxNDg4ODgxNiArZWxscHM9Y2xyazY2ICt0b19tZXRlcj0wLjkxNDM5ODUzMDc0NDQ0MDggK3N0ZXAgK3Byb2o9Y2FydCArZWxscHM9YmVzc2VsICtzdGVwICtwcm9qPWhlbG1lcnQgK3g9LTE0Ni4zMzYgK3k9NTA2LjgzMiArej02ODAuMjU0ICtzdGVwICtpbnYgK3Byb2o9Y2FydCArZWxscHM9V0dTODQgK3N0ZXAgK3Byb2o9dW5pdGNvbnZlcnQgK3h5X2luPXJhZCAreHlfb3V0PWRlZyIsCiAgICAgICJ3a3QyIjogbnVsbCwKICAgICAgImlzQXBwcm94aW1hdGUiOiB0cnVlLAogICAgICAic291cmNlIjogWwogICAgICAgICJodHRwczovL2Jsb2cuY29kZTRoaXN0b3J5LmRldi9lbnRyeS8yMDEzMDIyMC8xMzYxMzkwMTQ4IiwKICAgICAgICAiaHR0cHM6Ly9ibG9nLmNvZGU0aGlzdG9yeS5kZXYvZW50cnkvMjAxMzAyMTYvMTM2MDk2ODIyMCIKICAgICAgXQogICAgfQogIF0KfQo=", import.meta.url), B = [
  "proj.db",
  "proj.ini",
  "proj-worker.mjs",
  "fetch-worker.mjs",
  "proj-emscripten.js",
  "proj-emscripten.wasm"
];
function x() {
  return typeof globalThis.document < "u";
}
function z() {
  const I = new URL(import.meta.url);
  return I.pathname = I.pathname.replace(/[^/]*$/, ""), I.search = "", I.hash = "", I;
}
function K(I = z()) {
  if (!x() || m || typeof fetch != "function")
    return;
  const A = typeof I == "string" ? new URL(I, import.meta.url) : I;
  globalThis.__ATLAS_PROJ_WASM_ASSET_BASE_URL__ = A.href;
  const e = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (U, r) => {
    const t = typeof U == "string" ? U : U instanceof URL ? U.href : U.url, _ = globalThis.location?.href ?? import.meta.url, n = new URL(t, _).pathname, a = B.find((i) => n.endsWith(`/${i}`));
    if (a) {
      const i = new URL(a, A), o = await e(i, r);
      if (a === "proj.db") {
        const c = Number(o.headers.get("content-length") ?? 0) || (await o.clone().arrayBuffer()).byteLength;
        if (c < 1e6)
          throw new Error(
            `Resolved proj.db from ${i.href}, but received only ${c} bytes. Restart the Vite dev server and verify that the proj-wasm runtime assets are served from the demo assets path.`
          );
      }
      return o;
    }
    return e(U, r);
  }, m = !0;
}
function d() {
  return T || (T = import("proj-wasm")), T;
}
async function g(I) {
  return C || (K(I?.projWasmAssetBaseUrl), C = d().then((A) => A.init({ workers: 1 }))), C;
}
function R(I, A) {
  return I <= A ? [[I, A]] : [
    [I, 180],
    [-180, A]
  ];
}
function J(I, A) {
  if (I.south > A.south || I.north < A.north)
    return !1;
  const e = R(I.west, I.east);
  return R(A.west, A.east).every(([r, t]) => e.some(
    ([_, n]) => _ <= r && n >= t
  ));
}
function Z(I, A) {
  return A <= 0 ? I : {
    west: Math.max(-180, I.west - A),
    south: Math.max(-90, I.south - A),
    east: Math.min(180, I.east + A),
    north: Math.min(90, I.north + A)
  };
}
function Y(I) {
  return { ...I, bbox: { ...I.bbox } };
}
async function H(I) {
  const A = `${I.authName}:${I.code}`;
  let e = F.get(A);
  return e === void 0 && (e = Q(I), F.set(A, e), e.catch(() => {
    F.get(A) === e && F.delete(A);
  })), Y(await e);
}
async function V(I) {
  return N || (N = I.projGetCrsInfoListFromDatabase({}), N.catch(() => {
    N = void 0;
  })), N;
}
async function Q(I) {
  const A = await d(), e = `${I.authName}:${I.code}`, [U, r] = await S(A, () => A.projCreateFromDatabase({
    auth_name: I.authName,
    code: I.code,
    category: A.PJ_CATEGORY_CRS
  }), (t) => Promise.all([
    W.has(e) ? null : A.projAsWkt({
      pj: t,
      type: A.PJ_WKT2_2019,
      options: null
    }),
    A.projAsProjString({
      pj: t,
      type: A.PJ_PROJ_5,
      options: null
    })
  ]));
  return {
    id: e,
    authority: I.authName,
    code: I.code,
    name: I.name,
    areaName: I.areaName,
    deprecated: I.deprecated,
    bbox: {
      west: I.westLonDegree,
      south: I.southLatDegree,
      east: I.eastLonDegree,
      north: I.northLatDegree
    },
    wkt2: U,
    proj4: r,
    definitionType: "projdb"
  };
}
function h(I) {
  return {
    authName: I.authority,
    code: I.code,
    name: I.name,
    type: b,
    deprecated: I.deprecated,
    bboxValid: !0,
    westLonDegree: I.bbox.west,
    southLatDegree: I.bbox.south,
    eastLonDegree: I.bbox.east,
    northLatDegree: I.bbox.north,
    areaName: I.areaName
  };
}
function f(I, A) {
  const e = I.proj4 ?? I.pipeline;
  if (!e)
    throw new Error(`Custom projection ${I.authority}:${I.code} is missing proj4/pipeline text`);
  return {
    id: `${I.authority}:${I.code}`,
    authority: I.authority,
    code: I.code,
    name: I.name,
    areaName: I.areaName,
    deprecated: I.deprecated,
    // The definitions are loaded once per process, so hand out copies: a caller that changes a
    // result row must not change the definition used by later searches.
    bbox: { ...I.bbox },
    wkt2: I.wkt2 ?? null,
    proj4: e,
    pipeline: I.pipeline,
    isApproximate: I.isApproximate ?? !1,
    source: [...I.source ?? []],
    definitionType: A
  };
}
function l(I, A) {
  const e = A.area?.trim().toLowerCase(), U = A.bboxPaddingDeg ?? 0.1, r = A.includeDeprecated ?? !1, t = A.onshoreOnly ?? !1;
  return I.filter((_) => {
    const n = _.areaName.toLowerCase();
    return _.type !== b || !_.bboxValid || !r && _.deprecated || e && !n.includes(e) || t && (!n.includes("onshore") || n.includes("onshore and offshore")) ? !1 : J(Z({
      west: _.westLonDegree,
      south: _.southLatDegree,
      east: _.eastLonDegree,
      north: _.northLatDegree
    }, U), A.extent);
  });
}
async function T0(I = {}) {
  await g(I);
}
function X(I) {
  const A = I.match(/^data:.*?(;base64)?,(.*)$/);
  if (!A)
    throw new Error(`Unsupported data URL for custom projection resource: ${I}`);
  if (A[1]) {
    if (typeof Buffer < "u")
      return Buffer.from(A[2], "base64").toString("utf8");
    const e = atob(A[2]);
    return new TextDecoder().decode(Uint8Array.from(e, (U) => U.charCodeAt(0)));
  }
  return decodeURIComponent(A[2]);
}
async function k(I) {
  const A = typeof I == "string" ? new URL(I, import.meta.url) : I, e = A.href;
  if (e.startsWith("data:"))
    return X(e);
  if (!e.startsWith("file:") && typeof fetch == "function") {
    const t = await fetch(A);
    if (!t.ok)
      throw new Error(`Failed to load projection resource ${e}: ${t.status} ${t.statusText}`);
    return t.text();
  }
  const U = "node:fs/promises", { readFile: r } = await import(
    /* @vite-ignore */
    U
  );
  return r(A, "utf8");
}
async function L(I) {
  const A = await k(I), e = JSON.parse(A);
  return Array.isArray(e) ? e : e.projections;
}
async function $() {
  return M || (M = L(D)), M;
}
async function M0(I) {
  await g(I);
  const A = await d(), e = await V(A), U = l(e, I), r = /* @__PURE__ */ new Map(), t = [], _ = U.filter((o) => {
    const s = `${o.authName}:${o.code}`, c = y.get(s);
    return c === void 0 ? !0 : (t.push({ id: s, name: o.name, reason: c }), !1);
  });
  I.onExcluded?.(t);
  const n = await Promise.all(_.map((o) => H(o)));
  for (const o of n)
    r.set(o.id, o);
  if (I.includeCustomProjections) {
    const o = await $();
    for (const s of o) {
      const c = h(s);
      if (!l([c], I).length) continue;
      const G = f(s, "custom");
      r.set(G.id, G);
    }
  }
  const a = I.userProjection ?? I.userProjectionFile;
  if (a) {
    const o = await L(a);
    for (const s of o) {
      const c = h(s);
      if (!l([c], I).length) continue;
      const G = f(s, "user");
      r.set(G.id, G);
    }
  }
  const i = [...r.values()];
  return i.sort((o, s) => o.id.localeCompare(s.id)), i;
}
const u = /* @__PURE__ */ new Map();
function q(I, A) {
  let e = u.get(A);
  if (e === void 0) {
    const U = t0(I, A);
    e = U, u.set(A, U), U.catch(() => {
      u.get(A) === U && u.delete(A);
    });
  }
  return e;
}
const I0 = /^osgeo::proj::io::(?:ParsingException|NoSuchAuthorityCodeException)\b/;
function A0(I) {
  return I instanceof Error && I0.test(I.stack ?? "");
}
const e0 = /^osgeo::proj::util::UnsupportedOperationException\b/;
function U0(I) {
  return I instanceof Error && e0.test(I.stack ?? "");
}
const p = /* @__PURE__ */ new Set();
async function t0(I, A) {
  try {
    return await r0(I, A);
  } catch (e) {
    if (A0(e)) return !1;
    throw e;
  }
}
async function r0(I, A) {
  return S(I, () => I.projCreate({ definition: A }), async (e) => e == null || !await I.projIsCrs({ obj: e }) ? !1 : S(I, () => I.projCrsGetCoordinateSystem({ crs: e }), async (U) => {
    if (U == null || await I.projCsGetAxisCount({ cs: U }) !== 2) return !1;
    const r = [
      await I.projCsGetAxisInfo({ cs: U, index: 0 }),
      await I.projCsGetAxisInfo({ cs: U, index: 1 })
    ];
    return r[0]?.direction !== "east" || r[1]?.direction !== "north" ? !1 : r.every((t) => t.unitConvFactor === 1 && t.unitName === "metre");
  }));
}
const _0 = 4096, o0 = new O(_0);
async function n0(I, A, e) {
  if (A.length === 0) return null;
  for (const t of A)
    if (!Number.isFinite(t[0]) || !Number.isFinite(t[1])) return null;
  await g(e);
  const U = await d();
  return !await q(U, I.proj4) || p.has(I.proj4) ? null : await o0.use(U, I.proj4, () => U.projCreateCrsToCrs({
    source_crs: v,
    target_crs: I.proj4
  }), async (t) => {
    const _ = await U.coordArray(A.length);
    await U.setCoords(
      _,
      A.map(([a, i]) => [a, i, 0, 0])
    ), await U.projTransArray({
      p: t,
      direction: U.PJ_FWD,
      n: A.length,
      coord: _
    });
    const n = [];
    for (let a = 0; a < A.length; a += 1) {
      const i = await U.getCoords(_, a), o = i?.[0], s = i?.[1];
      if (!Number.isFinite(o) || !Number.isFinite(s)) return null;
      n.push([o, s]);
    }
    return n;
  }).catch((t) => {
    if (!U0(t)) throw t;
    return p.add(I.proj4), null;
  });
}
function l0(I, A) {
  const e = new Map(I.map((U) => [U.id, { id: U.id, proj4: U.proj4 }]));
  return async (U, r, t) => {
    if (t.kind !== "lonlat_deg" || t.axisOrder !== "lon-lat") return null;
    const _ = e.get(U);
    return _ === void 0 ? null : n0(_, r, A);
  };
}
export {
  C0 as bboxToPolygonWkt,
  l0 as createCandidateTransformer,
  N0 as extractAuthorityIdFromWkt,
  F0 as extractWktName,
  d0 as inferApproximateBbox,
  a0 as inferDatumFamily,
  i0 as inferKind,
  u0 as inferPriority,
  G0 as inferWgsEquivalent,
  T0 as initializeProjWasmRuntime,
  s0 as isProjectedPrjPath,
  c0 as isScopeIncluded,
  M0 as listProjectedCrsFromProjWasm,
  n0 as transformLonLatArrayToProjected
};
