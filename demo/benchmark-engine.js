/**
 * Benchmark engine: the arithmetic of the benchmark page (no DOM, no globals that a test cannot
 * inject).
 *
 * Both engines are driven through their own raw API, in the same shape for every CRS:
 *
 * - `proj-wasm` for a CRS row (`EPSG:...`): one `projCreateCrsToCrs` operation from WGS 84
 *   lon/lat to the row's definition, used `PJ_FWD` and then `PJ_INV`.
 * - `proj-wasm` for a pipeline row (`UTJCP:*`, its `proj4` text is a pipeline, not a CRS): one
 *   `projCreate` object, used `PJ_INV` (the pipeline runs lon/lat -> grid) and then `PJ_FWD`.
 * - `proj4js` for both kinds: `proj4(source, row.proj4)`, used `.forward` and then `.inverse`.
 *
 * Atlas' own transform helpers are deliberately not used: the page measures the engines, not
 * Atlas' wrapping of them. A definition one engine cannot read is an explicit failure with the
 * message the engine threw; it is never dropped from the result.
 *
 * Every engine call is made once per point (forward and inverse), for both engines, so the
 * elapsed times cover the same number of calls.
 */

/** The source CRS of every transformation, the same text for both engines. */
export const LONLAT_WGS84_DEFINITION = "+proj=longlat +datum=WGS84 +no_defs +type=crs";

/** Metres per degree of latitude (the scale the round-trip error is reported in). */
const METERS_PER_DEGREE = 111320;

/** Half-width of the box searched around a point (in degrees); about 55 m. */
const SEARCH_BOX_DEGREES = 0.0005;

/** How many Atlas searches one run may make to find the requested rows. */
export const DEFAULT_MAX_SEARCHES = 600;

function planeRectangularIds(firstCode, count) {
  return Object.freeze(Array.from({ length: count }, (_, index) => `EPSG:${firstCode + index}`));
}

/** The CRS the page can benchmark, in the groups the CRS scope selector offers. */
export const CRS_GROUPS = Object.freeze([
  Object.freeze({ id: "web-mercator", label: "Web メルカトル", ids: Object.freeze(["EPSG:3857"]) }),
  Object.freeze({
    id: "jgd2000-plane",
    label: "JGD2000 平面直角座標系 I〜XIX",
    ids: planeRectangularIds(2443, 19),
  }),
  Object.freeze({
    id: "tokyo-plane",
    label: "旧日本測地系 平面直角座標系 I〜XIX",
    ids: planeRectangularIds(30161, 19),
  }),
  Object.freeze({
    id: "jgd2000-utm",
    label: "JGD2000 UTM 51〜55",
    ids: Object.freeze(["EPSG:3097", "EPSG:3098", "EPSG:3099", "EPSG:3100", "EPSG:3101"]),
  }),
  Object.freeze({
    id: "historical-grid",
    label: "歴史グリッド（A・B・C 帯）",
    ids: Object.freeze(["UTJCP:ZONE-A", "UTJCP:ZONE-B", "UTJCP:ZONE-C"]),
  }),
]);

/** Every CRS the page knows, in group order. */
export const CRS_TARGET_IDS = Object.freeze(CRS_GROUPS.flatMap((group) => group.ids));

/**
 * The CRS ids of a scope: `{ kind: "all" }`, `{ kind: "group", groupId }` or
 * `{ kind: "crs", id }`.
 */
export function crsScopeIds(scope) {
  const kind = scope?.kind ?? "all";
  if (kind === "all") return [...CRS_TARGET_IDS];
  if (kind === "group") {
    const group = CRS_GROUPS.find((entry) => entry.id === scope.groupId);
    return group ? [...group.ids] : [];
  }
  if (kind === "crs") return scope.id ? [scope.id] : [];
  throw new Error(`Unknown CRS scope kind: ${String(kind)}`);
}

/**
 * The places of one category (`"all"` for every category), cut to `pointLimit` (`"all"` keeps
 * every place). The order is the order of the dataset.
 */
export function selectPoints(places, { category = "all", pointLimit = "all" } = {}) {
  const matching = (places ?? []).filter((place) => category === "all" || place.category === category);
  if (pointLimit === "all" || pointLimit === undefined || pointLimit === null) {
    return matching.map((place) => ({ ...place }));
  }
  const limit = Math.floor(Number(pointLimit));
  const kept = Number.isFinite(limit) && limit >= 0 ? matching.slice(0, limit) : matching;
  return kept.map((place) => ({ ...place }));
}

/**
 * The points one run transforms: `workCount` of them, going back to the first point when the
 * requested work is larger than the point set.
 */
export function buildWorkSequence(places, workCount) {
  const points = places ?? [];
  if (points.length === 0) return [];
  const total = Math.floor(Number(workCount));
  if (!Number.isFinite(total) || total <= 0) return [];
  return Array.from({ length: total }, (_, index) => points[index % points.length]);
}

/** How many times the point set is walked for a given work count. */
export function lapsFor(pointCount, workCount) {
  if (pointCount <= 0) return 0;
  return Math.ceil(Math.floor(Number(workCount)) / pointCount);
}

function clock() {
  const source = globalThis.performance;
  if (source && typeof source.now === "function") return () => source.now();
  return () => Date.now();
}

function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** The distance in metres between two lon/lat points, the same way the page reports error. */
export function distanceMeters(from, to) {
  const latRad = (from[1] * Math.PI) / 180;
  const dx = (to[0] - from[0]) * METERS_PER_DEGREE * Math.cos(latRad);
  const dy = (to[1] - from[1]) * METERS_PER_DEGREE;
  return Math.hypot(dx, dy);
}

/**
 * Atlas' search is bbox-based: a row comes back only when the requested extent fits inside the
 * row's bbox, so one Japan-wide extent would never return a plane rectangular zone. The rows are
 * therefore looked up with one search per probe point (a small box around it, custom projections
 * on, `onshoreOnly: false`), and the searches stop early once every requested id is found.
 *
 * The probe points spread over the map first: one point per 1-degree cell, then one per
 * remaining 0.5-degree cell, then one per remaining 0.25-degree cell. A row is found as soon as
 * one probe falls inside its bbox, so a coarse sweep finds most rows in a few searches and the
 * finer sweeps only run for rows that are still missing.
 */
const PROBE_CELL_DEGREES = [1, 0.5, 0.25];

export function searchPlaces(places, maxSearches = DEFAULT_MAX_SEARCHES) {
  const points = places ?? [];
  const limit = Math.max(1, Math.floor(Number(maxSearches)));
  const picked = [];
  const used = new Set();
  for (const size of PROBE_CELL_DEGREES) {
    const cells = new Set();
    points.forEach((place, index) => {
      if (used.has(index)) return;
      const cell = `${Math.floor(place.lon / size)}:${Math.floor(place.lat / size)}`;
      if (cells.has(cell)) return;
      if (picked.some((other) => Math.floor(other.lon / size) === Math.floor(place.lon / size)
        && Math.floor(other.lat / size) === Math.floor(place.lat / size))) return;
      cells.add(cell);
      used.add(index);
      picked.push(place);
    });
  }
  return picked.slice(0, limit);
}

/** Find the Atlas rows of `targetIds` by searching around the given places. */
export async function findCrsRows({ runtime, places, targetIds, maxSearches = DEFAULT_MAX_SEARCHES }) {
  const wanted = new Set(targetIds ?? []);
  const found = new Map();
  let searches = 0;
  for (const place of searchPlaces(places, maxSearches)) {
    if (found.size >= wanted.size) break;
    const extent = {
      west: place.lon - SEARCH_BOX_DEGREES,
      south: place.lat - SEARCH_BOX_DEGREES,
      east: place.lon + SEARCH_BOX_DEGREES,
      north: place.lat + SEARCH_BOX_DEGREES,
    };
    const rows = await runtime.listProjectedCrsFromProjWasm({
      extent,
      includeCustomProjections: true,
      onshoreOnly: false,
    });
    searches += 1;
    for (const row of rows) {
      if (wanted.has(row.id) && !found.has(row.id)) found.set(row.id, row);
    }
  }
  return { rows: found, searches };
}

function emptyStats() {
  return { totalMs: 0, success: 0, failure: 0, meanErrorMeters: null, maxErrorMeters: null, failures: [] };
}

function finishStats(stats) {
  const errors = stats.errors ?? [];
  stats.meanErrorMeters = errors.length
    ? errors.reduce((sum, value) => sum + value, 0) / errors.length
    : null;
  stats.maxErrorMeters = errors.length ? Math.max(...errors) : null;
  delete stats.errors;
  return stats;
}

function fail(stats, index, place, message) {
  stats.failure += 1;
  stats.failures.push({ index, lon: place.lon, lat: place.lat, message });
}

/**
 * Round trip through `proj-wasm`'s raw API. Returns the per-engine statistics and the forward
 * outputs (CRS units, metres) of the points that succeeded.
 */
export async function runProjWasmEngine({ projWasm, row, sequence, now = clock() }) {
  const stats = emptyStats();
  stats.errors = [];
  const forward = new Array(sequence.length).fill(null);
  const definition = row.proj4;
  const isPipeline = definition.includes("+proj=pipeline");

  let operation;
  let forwardDirection;
  let inverseDirection;
  try {
    operation = isPipeline
      ? await projWasm.projCreate({ definition })
      : await projWasm.projCreateCrsToCrs({
        source_crs: LONLAT_WGS84_DEFINITION,
        target_crs: definition,
      });
    if (operation === undefined || operation === null) {
      throw new Error(`proj-wasm could not create an operation for ${row.id}`);
    }
    forwardDirection = isPipeline ? projWasm.PJ_INV : projWasm.PJ_FWD;
    inverseDirection = isPipeline ? projWasm.PJ_FWD : projWasm.PJ_INV;
  } catch (error) {
    const message = messageOf(error);
    sequence.forEach((place, index) => fail(stats, index, place, message));
    return { stats: finishStats(stats), forward };
  }

  const startedAt = now();
  try {
    for (let index = 0; index < sequence.length; index += 1) {
      const place = sequence[index];
      try {
        const forwardCoords = await projWasm.coordArray(1);
        await projWasm.setCoords(forwardCoords, [[place.lon, place.lat, 0, 0]]);
        const forwardErrors = await projWasm.projTransArray({
          p: operation,
          direction: forwardDirection,
          n: 1,
          coord: forwardCoords,
        });
        const [x, y] = await projWasm.getCoords(forwardCoords, 0);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error(
            `proj-wasm returned a non-finite coordinate (projTransArray reported ${String(forwardErrors)} error(s))`,
          );
        }

        const inverseCoords = await projWasm.coordArray(1);
        await projWasm.setCoords(inverseCoords, [[x, y, 0, 0]]);
        await projWasm.projTransArray({
          p: operation,
          direction: inverseDirection,
          n: 1,
          coord: inverseCoords,
        });
        const back = await projWasm.getCoords(inverseCoords, 0);
        if (!Number.isFinite(back[0]) || !Number.isFinite(back[1])) {
          throw new Error("proj-wasm returned a non-finite coordinate from the inverse step");
        }

        stats.errors.push(distanceMeters([place.lon, place.lat], [back[0], back[1]]));
        stats.success += 1;
        forward[index] = [x, y];
      } catch (error) {
        fail(stats, index, place, messageOf(error));
      }
    }
  } finally {
    stats.totalMs = now() - startedAt;
    if (operation !== undefined && operation !== null) {
      try {
        await projWasm.projDestroy({ pj: operation });
      } catch {
        // The object is gone either way; keep the measured result.
      }
    }
  }

  finishStats(stats);
  return { stats, forward };
}

/** Round trip through `proj4js`. */
export function runProj4Engine({ proj4js, row, sequence, now = clock() }) {
  const stats = emptyStats();
  stats.errors = [];
  const forward = new Array(sequence.length).fill(null);

  let converter;
  try {
    converter = proj4js(LONLAT_WGS84_DEFINITION, row.proj4);
  } catch (error) {
    const message = messageOf(error);
    sequence.forEach((place, index) => fail(stats, index, place, message));
    return { stats: finishStats(stats), forward };
  }

  const startedAt = now();
  for (let index = 0; index < sequence.length; index += 1) {
    const place = sequence[index];
    try {
      const projected = converter.forward([place.lon, place.lat]);
      const x = projected?.[0];
      const y = projected?.[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("proj4js returned a non-finite coordinate from the forward step");
      }
      const back = converter.inverse([x, y]);
      if (!Number.isFinite(back?.[0]) || !Number.isFinite(back?.[1])) {
        throw new Error("proj4js returned a non-finite coordinate from the inverse step");
      }
      stats.errors.push(distanceMeters([place.lon, place.lat], [back[0], back[1]]));
      stats.success += 1;
      forward[index] = [x, y];
    } catch (error) {
      fail(stats, index, place, messageOf(error));
    }
  }
  stats.totalMs = now() - startedAt;

  finishStats(stats);
  return { stats, forward };
}

function forwardDifferenceMax(wasmForward, proj4Forward) {
  let max = null;
  for (let index = 0; index < wasmForward.length; index += 1) {
    const wasm = wasmForward[index];
    const js = proj4Forward[index];
    if (!wasm || !js) continue;
    const distance = Math.hypot(wasm[0] - js[0], wasm[1] - js[1]);
    if (max === null || distance > max) max = distance;
  }
  return max;
}

function rowStatus(row) {
  if (!row.found) return "not-found";
  return row.projWasm.failure === 0 && row.proj4js.failure === 0 ? "ok" : "failed";
}

/**
 * Run one benchmark: the same point sequence and the same CRS rows for both engines.
 *
 * `places` are the points of the run (their order is the order of the sequence), `workCount` the
 * requested work, `targetIds` the CRS to compare. `runtime` is the Atlas runtime
 * (`listProjectedCrsFromProjWasm`), `projWasm` the loaded `proj-wasm` module and `proj4js` the
 * `proj4js` function. Initialization is the caller's job and is not timed.
 */
export async function runBenchmark({
  places,
  catalogPlaces,
  workCount,
  targetIds,
  runtime,
  projWasm,
  proj4js,
  maxSearches = DEFAULT_MAX_SEARCHES,
  now = clock(),
}) {
  const pointCount = (places ?? []).length;
  const sequence = buildWorkSequence(places, workCount);
  const ids = [...(targetIds ?? [])];
  // The rows are a property of the CRS, not of the run: search around the whole dataset when the
  // caller gives it, so a run over a few northern points still finds the southern zones.
  const lookup = await findCrsRows({ runtime, places: catalogPlaces ?? places ?? [], targetIds: ids, maxSearches });

  const resultRows = [];
  for (const id of ids) {
    const row = lookup.rows.get(id);
    if (row === undefined) {
      resultRows.push({
        id,
        // Either the id is not in the catalog, or no place of the dataset lies inside its area of
        // use (the search can only find a row around a point).
        name: "見つからない（カタログに無いか、データのどの地点もこの CRS の範囲に入らない）",
        found: false,
        status: "not-found",
        workCount: sequence.length,
        projWasm: emptyStats(),
        proj4js: emptyStats(),
        forwardDifferenceMaxMeters: null,
      });
      continue;
    }

    const wasm = await runProjWasmEngine({ projWasm, row, sequence, now });
    const js = runProj4Engine({ proj4js, row, sequence, now });
    const entry = {
      id,
      name: row.name,
      found: true,
      workCount: sequence.length,
      projWasm: wasm.stats,
      proj4js: js.stats,
      forwardDifferenceMaxMeters: forwardDifferenceMax(wasm.forward, js.forward),
    };
    entry.status = rowStatus(entry);
    resultRows.push(entry);
  }

  const totals = {
    projWasm: { totalMs: 0, success: 0, failure: 0 },
    proj4js: { totalMs: 0, success: 0, failure: 0 },
  };
  let forwardDifferenceMaxMeters = null;
  for (const entry of resultRows) {
    for (const engine of ["projWasm", "proj4js"]) {
      totals[engine].totalMs += entry[engine].totalMs;
      totals[engine].success += entry[engine].success;
      totals[engine].failure += entry[engine].failure;
    }
    const difference = entry.forwardDifferenceMaxMeters;
    if (difference !== null && (forwardDifferenceMaxMeters === null || difference > forwardDifferenceMaxMeters)) {
      forwardDifferenceMaxMeters = difference;
    }
  }

  return {
    pointCount,
    workCount: sequence.length,
    laps: lapsFor(pointCount, sequence.length),
    targetIds: ids,
    searchCount: lookup.searches,
    forwardDifferenceMaxMeters,
    rows: resultRows,
    totals,
  };
}
