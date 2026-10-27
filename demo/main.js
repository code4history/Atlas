import { version as packageVersion } from "../package.json";
import {
  TILE_SIZE,
  bboxScreenRects,
  lonLatToScreen,
  lonLatToWorld,
  screenToLonLat,
  worldCopyXs,
  worldToLonLat,
} from "./map-geometry.ts";
import { wktText } from "./detail-text.ts";
import { PRESETS, buildLookupOptions } from "./presets.js";

const MAP_WIDTH = 720;
const MAP_HEIGHT = 460;
// マーカーの実体が左端 x からはみ出す分: 円の半径 7 + ラベル位置 +10 + 番号テキストの見込み幅。
// これを bleed として渡すことで、コピー境界でマーカーが早すぎる消え方をしない。
const MARKER_BLEED_PX = 48;

const COUNTRIES = {
  auto: { label: "Auto", area: undefined, bounds: null },
  japan: { label: "Japan", area: "Japan", bounds: { west: 122, south: 20, east: 154, north: 46 }, center: [137.5, 36.5], zoom: 5 },
  united_states: { label: "United States", area: "United States", bounds: { west: -125, south: 24, east: -66, north: 49 }, center: [-96, 38], zoom: 4 },
  korea: { label: "Korea", area: "Korea", bounds: { west: 124, south: 33, east: 132, north: 39.5 }, center: [128, 36.2], zoom: 6 },
  china: { label: "China", area: "China", bounds: { west: 73, south: 18, east: 135, north: 54 }, center: [104, 35], zoom: 4 },
};

const DEFAULT_STATE = Object.freeze({
  center: [...COUNTRIES.japan.center],
  zoom: COUNTRIES.japan.zoom,
  markers: [],
  rows: [],
  selectedId: null,
  runtimeReady: false,
  queryState: "idle",
  status: "Initializing PROJ runtime...",
  error: null,
  areaFilterEnabled: true,
  areaMode: "japan",
  includeDeprecated: false,
  onshoreOnly: false,
  includeCustomProjections: true,
  excludedCount: 0,
  outsideJapanCount: 0,
  activePreset: null,
});

const state = {
  ...DEFAULT_STATE,
  center: [...DEFAULT_STATE.center],
  markers: [...DEFAULT_STATE.markers],
  rows: [...DEFAULT_STATE.rows],
};

let dom = globalThis.document;
let injectedRuntime = null;
let atlasModulePromise;
let dragState = null;
let settled = Promise.resolve();

function resetState() {
  Object.assign(state, DEFAULT_STATE, {
    center: [...DEFAULT_STATE.center],
    markers: [],
    rows: [],
  });
}

/** Queue async work so tests can await everything a click started. */
function enqueue(task) {
  const next = settled.then(task);
  settled = next.then(() => undefined, () => undefined);
  return next;
}

function loadAtlasRuntime() {
  if (injectedRuntime) return Promise.resolve(injectedRuntime);
  if (!atlasModulePromise) {
    atlasModulePromise = import("@c4h/atlas");
  }
  return atlasModulePromise;
}

function projWasmAssetBaseUrl() {
  const modulePathSegments = new URL(import.meta.url).pathname.split("/");
  if (modulePathSegments.includes("assets")) {
    return new URL("./", import.meta.url);
  }

  const baseURI = dom?.baseURI && dom.baseURI !== "about:blank" ? dom.baseURI : "http://localhost/";
  const pageRoot = new URL("../", baseURI);
  return new URL("assets/", pageRoot);
}

function atlasVersion() {
  return typeof __ATLAS_VERSION__ === "string" && __ATLAS_VERSION__.length > 0
    ? __ATLAS_VERSION__
    : packageVersion;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function centerWorld() {
  return lonLatToWorld(state.center, state.zoom);
}

function view() {
  return { center: state.center, zoom: state.zoom, width: MAP_WIDTH, height: MAP_HEIGHT };
}

function createExtent(points) {
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };
}

function pointInBounds(point, bounds) {
  return point[0] >= bounds.west && point[0] <= bounds.east && point[1] >= bounds.south && point[1] <= bounds.north;
}

/** The area the `auto` mode derives from the first marker, if any. */
function deriveAutoArea() {
  if (state.areaMode !== "auto") return undefined;
  const firstMarker = state.markers[0];
  if (!firstMarker) return undefined;
  return Object.entries(COUNTRIES)
    .filter(([key]) => key !== "auto")
    .map(([, country]) => country)
    .find((country) => pointInBounds(firstMarker, country.bounds))?.area;
}

function currentLookupInput() {
  return {
    extent: createExtent(state.markers),
    areaFilterEnabled: state.areaFilterEnabled,
    areaMode: state.areaMode,
    includeCustomProjections: state.includeCustomProjections,
    onshoreOnly: state.onshoreOnly,
    includeDeprecated: state.includeDeprecated,
  };
}

function renderTiles() {
  const layer = dom.getElementById("tile-layer");
  const center = centerWorld();
  const topLeft = { x: center.x - MAP_WIDTH / 2, y: center.y - MAP_HEIGHT / 2 };
  const minTileX = Math.floor(topLeft.x / TILE_SIZE);
  const maxTileX = Math.floor((topLeft.x + MAP_WIDTH) / TILE_SIZE);
  const minTileY = Math.floor(topLeft.y / TILE_SIZE);
  const maxTileY = Math.floor((topLeft.y + MAP_HEIGHT) / TILE_SIZE);
  const maxTile = 2 ** state.zoom;
  const tiles = [];

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      if (tileY < 0 || tileY >= maxTile) continue;
      const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;
      const left = tileX * TILE_SIZE - topLeft.x;
      const top = tileY * TILE_SIZE - topLeft.y;
      tiles.push(`<img src="https://tile.openstreetmap.org/${state.zoom}/${wrappedX}/${tileY}.png" alt="" style="left:${left}px;top:${top}px;">`);
    }
  }

  layer.innerHTML = tiles.join("");
}

function drawRect(ctx, bbox, style) {
  ctx.save();
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth ?? 2;
  if (style.dash) ctx.setLineDash(style.dash);
  for (const rect of bboxScreenRects(bbox, view())) {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
}

function renderMap() {
  const canvas = dom.getElementById("map-canvas");
  dom.getElementById("map-label").textContent = `Slippy map - zoom ${state.zoom}`;
  renderTiles();

  // jsdom has no 2D canvas; the rest of the page must still work without a context.
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  if (state.markers.length) {
    drawRect(ctx, createExtent(state.markers), {
      fill: "rgba(192, 57, 43, 0.08)",
      stroke: "#c0392b",
      dash: [6, 6],
    });
  }

  const selected = state.rows.find((row) => row.id === state.selectedId);
  if (selected) {
    drawRect(ctx, selected.bbox, {
      fill: "rgba(58, 123, 213, 0.16)",
      stroke: "#3a7bd5",
    });
  }

  state.markers.forEach((point, index) => {
    const [x, y] = lonLatToScreen(point, view());
    for (const copyX of worldCopyXs(x, 0, view(), MARKER_BLEED_PX)) {
      ctx.fillStyle = "#e74c3c";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(copyX, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1a2744";
      ctx.font = "bold 13px Helvetica Neue";
      ctx.fillText(String(index + 1), copyX + 10, y - 10);
    }
  });
}

function resultCaption() {
  if (state.queryState === "idle") return "No query yet.";
  if (state.queryState === "loading") return "Querying...";
  if (state.queryState === "error") return "Query failed.";
  if (!state.rows.length) return "No candidates";
  return `${state.rows.length} candidates`;
}

function renderTable() {
  const body = dom.getElementById("candidate-body");
  if (state.queryState === "idle") {
    body.innerHTML = '<tr><td colspan="3" class="empty">Click the map to start a query.</td></tr>';
  } else if (state.queryState === "loading") {
    body.innerHTML = '<tr><td colspan="3" class="empty">Loading CRS candidates...</td></tr>';
  } else if (state.queryState === "error") {
    body.innerHTML = `<tr><td colspan="3" class="error">${escapeHtml(state.error)}</td></tr>`;
  } else if (!state.rows.length) {
    body.innerHTML = '<tr><td colspan="3" class="empty">No CRS candidates match the current filters.</td></tr>';
  } else {
    body.innerHTML = state.rows.map((row) => `
      <tr data-id="${escapeHtml(row.id)}" class="${row.id === state.selectedId ? "selected" : ""}">
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.areaName)}</td>
      </tr>
    `).join("");
  }

  for (const row of body.querySelectorAll("tr[data-id]")) {
    row.onclick = () => {
      state.selectedId = row.dataset.id;
      render();
    };
  }

  dom.getElementById("result-count").textContent = resultCaption();

  const summary = dom.getElementById("result-summary");
  if (summary) {
    summary.textContent = state.queryState === "ready"
      ? `地域名に Japan を含まない候補 ${state.outsideJapanCount} 件`
      : "";
  }

  const excluded = dom.getElementById("excluded-summary");
  if (excluded) {
    excluded.textContent = state.queryState === "ready"
      ? `除外 ${state.excludedCount} 件（地球外・PROJ 文字列にできない行）`
      : "";
  }
}

function renderDetail() {
  const target = dom.getElementById("detail-body");
  const row = state.rows.find((item) => item.id === state.selectedId);

  if (state.queryState === "error") {
    target.innerHTML = `<p class="error">${escapeHtml(state.error)}</p>`;
    return;
  }

  if (!row) {
    target.innerHTML = '<p class="empty">Select a candidate to inspect bbox, projection text, and WKT text.</p>';
    return;
  }

  target.innerHTML = `
    <dl>
      <dt>ID</dt><dd>${escapeHtml(row.id)}</dd>
      <dt>Name</dt><dd>${escapeHtml(row.name)}</dd>
      <dt>Area</dt><dd>${escapeHtml(row.areaName)}</dd>
      <dt>Deprecated</dt><dd>${row.deprecated ? "yes" : "no"}</dd>
      <dt>Type</dt><dd>${escapeHtml(row.definitionType)}</dd>
      <dt>BBox</dt><dd>${escapeHtml(`${row.bbox.west}, ${row.bbox.south}, ${row.bbox.east}, ${row.bbox.north}`)}</dd>
      <dt>Approx</dt><dd>${row.isApproximate ? "yes" : "no"}</dd>
      <dt>Source</dt><dd>${escapeHtml((row.source ?? []).join("\n") || "proj.db").replaceAll("\n", "<br>")}</dd>
    </dl>
    <strong>Projection Text</strong>
    <pre>${escapeHtml(row.pipeline ?? row.proj4)}</pre>
    <strong>WKT</strong>
    <pre>${escapeHtml(wktText(row))}</pre>
  `;
}

function renderStatus() {
  dom.getElementById("status").textContent = state.error ?? state.status;
}

function renderInteractivity() {
  const disabled = !state.runtimeReady;
  dom.getElementById("map-board").classList.toggle("is-disabled", disabled);
  for (const element of dom.querySelectorAll("#area-enabled, #deprecated-enabled, #onshore-only, #custom-enabled, #area-mode, #clear-button")) {
    element.disabled = disabled;
  }
  for (const button of dom.querySelectorAll("#preset-bar button")) {
    button.disabled = disabled;
  }
}

function render() {
  renderInteractivity();
  renderMap();
  renderTable();
  renderDetail();
  renderStatus();
}

async function runLookup() {
  state.selectedId = null;
  state.error = null;

  state.excludedCount = 0;
  state.outsideJapanCount = 0;

  if (!state.markers.length) {
    state.rows = [];
    state.queryState = "idle";
    state.status = "Click the map to add markers. Drag to pan, wheel to zoom.";
    render();
    return;
  }

  const options = buildLookupOptions(currentLookupInput(), { autoArea: deriveAutoArea() });
  const area = options.area;
  state.queryState = "loading";
  state.status = area ? `Querying with area filter: ${area}` : "Querying without area filter.";
  render();

  try {
    const { listProjectedCrsFromProjWasm } = await loadAtlasRuntime();
    const excluded = [];
    state.rows = await listProjectedCrsFromProjWasm({
      ...options,
      projWasmAssetBaseUrl: projWasmAssetBaseUrl(),
      onExcluded: (entries) => excluded.push(...entries),
    });
    state.excludedCount = excluded.length;
    state.outsideJapanCount = state.rows.filter((row) => !String(row.areaName).includes("Japan")).length;
    state.queryState = "ready";
    state.status = area ? `Queried with area filter: ${area}.` : "Queried without area filter.";
  } catch (error) {
    state.rows = [];
    state.queryState = "error";
    state.error = error instanceof Error ? error.message : String(error);
  }

  render();
}

function eventToCanvasPoint(event) {
  const canvas = dom.getElementById("map-canvas");
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * MAP_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT,
  };
}

function bindMap() {
  const canvas = dom.getElementById("map-canvas");
  canvas.onpointerdown = (event) => {
    if (!state.runtimeReady) return;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add("dragging");
    dragState = {
      pointerId: event.pointerId,
      startClient: [event.clientX, event.clientY],
      lastClient: [event.clientX, event.clientY],
      moved: false,
    };
  };

  canvas.onpointermove = (event) => {
    if (!state.runtimeReady) return;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const [lastX, lastY] = dragState.lastClient;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const [startX, startY] = dragState.startClient;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
      dragState.moved = true;
    }
    const center = centerWorld();
    state.center = worldToLonLat({ x: center.x - dx, y: center.y - dy }, state.zoom);
    dragState.lastClient = [event.clientX, event.clientY];
    renderMap();
  };

  canvas.onpointerup = (event) => {
    if (!state.runtimeReady) return;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove("dragging");
    const wasClick = !dragState.moved;
    dragState = null;
    if (wasClick) {
      state.markers.push(screenToLonLat(eventToCanvasPoint(event), view()));
      leavePreset();
      enqueue(runLookup);
    }
  };

  canvas.onwheel = (event) => {
    if (!state.runtimeReady) return;
    event.preventDefault();
    const beforePoint = eventToCanvasPoint(event);
    const beforeLonLat = screenToLonLat(beforePoint, view());
    const nextZoom = Math.max(2, Math.min(12, state.zoom + (event.deltaY < 0 ? 1 : -1)));
    if (nextZoom === state.zoom) return;
    state.zoom = nextZoom;
    const targetWorld = lonLatToWorld(beforeLonLat, state.zoom);
    const centerWorldAfter = {
      x: targetWorld.x - beforePoint.x + MAP_WIDTH / 2,
      y: targetWorld.y - beforePoint.y + MAP_HEIGHT / 2,
    };
    state.center = worldToLonLat(centerWorldAfter, state.zoom);
    renderMap();
  };
}

function bindControls() {
  dom.getElementById("area-enabled").onchange = (event) => {
    state.areaFilterEnabled = event.currentTarget.checked;
    leavePreset();
    enqueue(runLookup);
  };
  dom.getElementById("deprecated-enabled").onchange = (event) => {
    state.includeDeprecated = event.currentTarget.checked;
    leavePreset();
    enqueue(runLookup);
  };
  dom.getElementById("onshore-only").onchange = (event) => {
    state.onshoreOnly = event.currentTarget.checked;
    leavePreset();
    enqueue(runLookup);
  };
  dom.getElementById("custom-enabled").onchange = (event) => {
    state.includeCustomProjections = event.currentTarget.checked;
    leavePreset();
    enqueue(runLookup);
  };
  dom.getElementById("area-mode").onchange = (event) => {
    state.areaMode = event.currentTarget.value;
    const country = COUNTRIES[state.areaMode];
    if (country.center) {
      state.center = [...country.center];
      state.zoom = country.zoom;
    }
    leavePreset();
    enqueue(runLookup);
  };
  dom.getElementById("clear-button").onclick = () => {
    state.markers = [];
    state.rows = [];
    state.selectedId = null;
    state.queryState = "idle";
    state.error = null;
    state.excludedCount = 0;
    state.outsideJapanCount = 0;
    state.status = "Cleared.";
    leavePreset();
    render();
  };
}

async function initializeRuntime() {
  try {
    const { initializeProjWasmRuntime } = await loadAtlasRuntime();
    await initializeProjWasmRuntime({
      projWasmAssetBaseUrl: projWasmAssetBaseUrl(),
    });
    state.runtimeReady = true;
    state.status = "Ready. Click the map to add markers. Drag to pan, wheel to zoom.";
  } catch (error) {
    state.runtimeReady = false;
    state.queryState = "error";
    state.error = error instanceof Error ? error.message : String(error);
  }

  render();
}

function cornersOf(extent) {
  return [
    [extent.west, extent.south],
    [extent.east, extent.south],
    [extent.east, extent.north],
    [extent.west, extent.north],
  ];
}

/** A zoom at which the extent fits inside the map board with a little room around it. */
function fitZoom(extent) {
  const lonSpan = Math.max(extent.east - extent.west, 0.01);
  const latSpan = Math.max(extent.north - extent.south, 0.01);
  const midLatRad = (((extent.north + extent.south) / 2) * Math.PI) / 180;
  const zoomForWidth = Math.log2((MAP_WIDTH * 0.8 * 360) / (TILE_SIZE * lonSpan));
  const zoomForHeight = Math.log2(
    (MAP_HEIGHT * 0.8 * 360 * Math.cos(midLatRad)) / (TILE_SIZE * latSpan),
  );
  return Math.max(2, Math.min(12, Math.floor(Math.min(zoomForWidth, zoomForHeight))));
}

function syncControls() {
  const setChecked = (id, checked) => {
    const element = dom.getElementById(id);
    if (element) element.checked = checked;
  };
  setChecked("area-enabled", state.areaFilterEnabled);
  setChecked("deprecated-enabled", state.includeDeprecated);
  setChecked("onshore-only", state.onshoreOnly);
  setChecked("custom-enabled", state.includeCustomProjections);
  const areaMode = dom.getElementById("area-mode");
  if (areaMode) areaMode.value = state.areaMode;
}

function markPressed(activeId) {
  for (const button of dom.querySelectorAll("#preset-bar button")) {
    const pressed = button.dataset.preset === activeId;
    button.setAttribute("aria-pressed", String(pressed));
    button.classList.toggle("active", pressed);
  }
}

function renderPresetBar() {
  const bar = dom.getElementById("preset-bar");
  if (!bar) return;
  while (bar.firstChild) bar.removeChild(bar.firstChild);
  for (const preset of PRESETS) {
    const group = dom.createElement("div");
    group.className = "atlas-preset-group";
    const title = dom.createElement("span");
    title.className = "atlas-preset-title";
    title.textContent = preset.title;
    group.appendChild(title);
    for (const option of preset.options) {
      const button = dom.createElement("button");
      button.type = "button";
      button.className = "atlas-preset-btn";
      button.dataset.preset = `${preset.id}:${option.id}`;
      button.textContent = option.label;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => enqueue(() => applyPreset(preset, option)));
      group.appendChild(button);
    }
    bar.appendChild(group);
  }
}

async function applyPreset(preset, option) {
  const input = option.input;
  state.activePreset = `${preset.id}:${option.id}`;
  state.areaFilterEnabled = input.areaFilterEnabled;
  state.areaMode = input.areaMode;
  state.includeCustomProjections = input.includeCustomProjections;
  state.onshoreOnly = input.onshoreOnly;
  state.includeDeprecated = input.includeDeprecated;
  state.markers = cornersOf(input.extent);
  state.center = [
    (input.extent.west + input.extent.east) / 2,
    (input.extent.south + input.extent.north) / 2,
  ];
  state.zoom = fitZoom(input.extent);
  state.selectedId = null;
  syncControls();
  markPressed(state.activePreset);
  const expectation = dom.getElementById("preset-expectation");
  if (expectation) expectation.textContent = option.expectation;
  await runLookup();
}

/**
 * Once a control or the map changes the input by hand, the pressed preset and its one-line
 * description no longer describe what is on screen.
 */
function leavePreset() {
  if (!state.activePreset) return;
  state.activePreset = null;
  markPressed(null);
  const expectation = dom.getElementById("preset-expectation");
  if (expectation) {
    expectation.textContent =
      "手で変えた入力（プリセットではない）。プリセットのボタンを押すと戻る。";
  }
}

function renderVersion() {
  const target = dom.getElementById("version");
  if (!target) return;
  target.textContent = `使っている版: @c4h/atlas ${atlasVersion()}`;
}

/**
 * Wire the demo page and return a small handle for tests.
 *
 * `runtime` is the same object shape as `@c4h/atlas` (`initializeProjWasmRuntime` and
 * `listProjectedCrsFromProjWasm`); by default it is the dynamic import of the package.
 * The page calls this once; importing this module does nothing by itself.
 */
export function initDemo({ runtime, doc } = {}) {
  dom = doc ?? globalThis.document;
  injectedRuntime = runtime ?? null;
  atlasModulePromise = undefined;
  dragState = null;
  settled = Promise.resolve();
  resetState();

  renderPresetBar();
  renderVersion();
  bindMap();
  bindControls();
  render();
  enqueue(initializeRuntime);

  return {
    whenSettled: () => settled,
    getState: () => ({
      activePreset: state.activePreset,
      markers: state.markers.map((point) => [...point]),
      rows: [...state.rows],
      runtimeReady: state.runtimeReady,
      areaFilterEnabled: state.areaFilterEnabled,
      areaMode: state.areaMode,
      includeCustomProjections: state.includeCustomProjections,
      includeDeprecated: state.includeDeprecated,
      onshoreOnly: state.onshoreOnly,
    }),
  };
}
