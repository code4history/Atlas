import { version as packageVersion } from "../package.json";
import * as benchmarkEngineModule from "./benchmark-engine.js";
import {
  BENCHMARK_PRESETS,
  NEUTRAL_EXPECTATION,
  presetWorkCount,
} from "./benchmark-presets.js";

const DEFAULT_CONTROLS = Object.freeze({
  category: "mountain-summit",
  pointLimit: "50",
  workCount: "100",
  scopeKind: "all",
  groupId: benchmarkEngineModule.CRS_GROUPS[0].id,
  crsId: benchmarkEngineModule.CRS_TARGET_IDS[0],
});

const state = {
  ready: false,
  running: false,
  status: "初期化中...",
  error: null,
  places: [],
  provenance: null,
  projWasm: null,
  proj4js: null,
  result: null,
  activePreset: null,
};

let dom = globalThis.document;
let injectedRuntime = null;
let injectedEngine = null;
let injectedData = null;
let injectedModules = null;
let atlasModulePromise;
let settled = Promise.resolve();

function defaultControls() {
  return { ...DEFAULT_CONTROLS };
}

/** Queue async work so tests can await everything a click started. */
function enqueue(task) {
  const next = settled.then(task);
  settled = next.then(() => undefined, () => undefined);
  return next;
}

/** The benchmark engine functions; a test can replace all of them. */
function engine() {
  return injectedEngine ?? benchmarkEngineModule;
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

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function element(id) {
  return dom.getElementById(id);
}

function text(id) {
  return element(id)?.textContent ?? "";
}

function formatMeters(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  if (value === 0) return "0";
  return value.toExponential(2);
}

function formatMilliseconds(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

function pointLimitOf(value) {
  return value === "all" ? "all" : Number(value);
}

function readControls() {
  const kind = element("crs-scope")?.value ?? "all";
  const scope = kind === "group"
    ? { kind, groupId: element("crs-group").value }
    : kind === "crs"
      ? { kind, id: element("crs-id").value }
      : { kind: "all" };
  const workCount = Math.floor(Number(element("work-count")?.value));
  return {
    category: element("category").value,
    pointLimit: pointLimitOf(element("point-limit").value),
    workCount: Number.isFinite(workCount) && workCount > 0 ? workCount : 1,
    crsScope: scope,
  };
}

function syncControls(controls) {
  const category = element("category");
  if (category) category.value = controls.category;
  const pointLimit = element("point-limit");
  if (pointLimit) pointLimit.value = String(controls.pointLimit);
  const workCount = element("work-count");
  if (workCount) workCount.value = String(controls.workCount);
  const scope = element("crs-scope");
  if (scope) scope.value = controls.scopeKind;
  const group = element("crs-group");
  if (group) group.value = controls.groupId;
  const crs = element("crs-id");
  if (crs) crs.value = controls.crsId;
  renderScopeInputs();
}

/** Only the selector that the chosen scope kind uses stays usable. */
function renderScopeInputs() {
  const kind = element("crs-scope")?.value ?? "all";
  const group = element("crs-group");
  const crs = element("crs-id");
  if (group) group.disabled = kind !== "group" || !state.ready;
  if (crs) crs.disabled = kind !== "crs" || !state.ready;
}

function renderScopeOptions() {
  const engineModule = engine();
  const group = element("crs-group");
  if (group) {
    group.innerHTML = engineModule.CRS_GROUPS
      .map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`)
      .join("");
  }
  const crs = element("crs-id");
  if (crs) {
    crs.innerHTML = engineModule.CRS_GROUPS
      .flatMap((entry) =>
        entry.ids.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`))
      .join("");
  }
}

function renderInteractivity() {
  const disabled = !state.ready || state.running;
  const run = element("run-button");
  if (run) run.disabled = disabled;
  for (const id of ["category", "point-limit", "work-count", "crs-scope", "reset-button"]) {
    const control = element(id);
    if (control) control.disabled = !state.ready;
  }
  renderScopeInputs();
  for (const button of dom.querySelectorAll("#preset-bar button")) {
    button.disabled = disabled;
  }
}

function renderStatus() {
  const status = element("init-status");
  if (!status) return;
  status.textContent = state.error ?? state.status;
}

function renderSummary() {
  const summary = element("result-summary");
  const forward = element("forward-diff");
  const result = state.result;
  if (!result) {
    if (summary) summary.textContent = "まだ実行していません。";
    if (forward) forward.textContent = "-";
    return;
  }

  const notFound = result.rows.filter((row) => row.status === "not-found").length;
  const failed = result.rows.filter((row) => row.status === "failed").length;
  const ok = result.rows.filter((row) => row.status === "ok").length;
  if (summary) {
    summary.textContent =
      `CRS ${result.rows.length} 件（成功 ${ok}・失敗 ${failed}・見つからない ${notFound}）・` +
      `地点 ${result.pointCount} 件・作業量 ${result.workCount} 回（${result.laps} 周）・` +
      `Atlas の検索 ${result.searchCount} 回。` +
      `proj-wasm: 成功 ${result.totals.projWasm.success}・失敗 ${result.totals.projWasm.failure}・` +
      `総時間 ${formatMilliseconds(result.totals.projWasm.totalMs)} ms。` +
      `proj4js: 成功 ${result.totals.proj4js.success}・失敗 ${result.totals.proj4js.failure}・` +
      `総時間 ${formatMilliseconds(result.totals.proj4js.totalMs)} ms。`;
  }
  if (forward) forward.textContent = formatMeters(result.forwardDifferenceMaxMeters);
}

function renderTable() {
  const body = element("results-body");
  const count = element("row-count");
  const result = state.result;
  if (count) count.textContent = result ? `${result.rows.length} 件` : "";
  if (!body) return;

  if (!result) {
    body.innerHTML = '<tr><td colspan="15" class="empty">まだ実行していません。</td></tr>';
    return;
  }
  if (result.rows.length === 0) {
    body.innerHTML = '<tr><td colspan="15" class="empty">選んだ範囲に CRS がありません。</td></tr>';
    return;
  }

  body.innerHTML = result.rows.map((row) => {
    const cells = [
      row.id,
      row.name,
      String(row.workCount),
      formatMilliseconds(row.projWasm.totalMs),
      String(row.projWasm.success),
      String(row.projWasm.failure),
      formatMeters(row.projWasm.meanErrorMeters),
      formatMeters(row.projWasm.maxErrorMeters),
      formatMilliseconds(row.proj4js.totalMs),
      String(row.proj4js.success),
      String(row.proj4js.failure),
      formatMeters(row.proj4js.meanErrorMeters),
      formatMeters(row.proj4js.maxErrorMeters),
      formatMeters(row.forwardDifferenceMaxMeters),
      row.status,
    ];
    return `<tr data-id="${escapeHtml(row.id)}" class="atlas-benchmark-row-${escapeHtml(row.status)}">${
      cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")
    }</tr>`;
  }).join("");
}

/** One entry per (CRS, engine, message): the number of points and where the first few are. */
function failureLines() {
  const lines = [];
  for (const row of state.result?.rows ?? []) {
    for (const [engineName, engineResult] of [["proj-wasm", row.projWasm], ["proj4js", row.proj4js]]) {
      const byMessage = new Map();
      for (const failure of engineResult.failures) {
        const entry = byMessage.get(failure.message) ?? { message: failure.message, count: 0, first: failure };
        entry.count += 1;
        byMessage.set(failure.message, entry);
      }
      for (const entry of byMessage.values()) {
        lines.push({
          id: row.id,
          engine: engineName,
          count: entry.count,
          message: entry.message,
          first: entry.first,
          workCount: row.workCount,
        });
      }
    }
  }
  return lines;
}

function renderFailures() {
  const target = element("failure-details");
  if (!target) return;
  if (!state.result) {
    target.innerHTML = '<p class="empty">まだ失敗はありません。</p>';
    return;
  }
  const lines = failureLines();
  if (lines.length === 0) {
    target.innerHTML = '<p class="empty">失敗はありません。すべての点が両方向とも通りました。</p>';
    return;
  }
  target.innerHTML = `<ul class="atlas-benchmark-failures">${lines.map((line) => `
    <li>
      <strong>${escapeHtml(line.engine)}</strong> / ${escapeHtml(line.id)}:
      ${line.count} / ${line.workCount} 点が失敗
      <pre>${escapeHtml(line.message)}</pre>
      <span class="atlas-benchmark-failure-point">最初の点: ${escapeHtml(
        `(${line.first.lon}, ${line.first.lat})`,
      )}</span>
    </li>
  `).join("")}</ul>`;
}

/** The URL of the provenance JSON, as the bundler resolves it for this build. */
function provenanceUrl() {
  return new URL("./data/benchmark-places.provenance.json", import.meta.url).href;
}

function renderProvenance() {
  const target = element("provenance");
  if (!target) return;
  const provenance = state.provenance;
  if (!provenance) {
    target.innerHTML = '<p class="empty">出典を読み込んでいます。</p>';
    return;
  }
  const sources = (provenance.sources ?? []).map((source) => `
    <li>
      <strong>${escapeHtml(source.name)}</strong>（${escapeHtml(source.version ?? "")}）
      <a href="${escapeHtml(source.pageUrl ?? "")}" rel="noopener noreferrer" target="_blank">${escapeHtml(source.pageUrl ?? "")}</a>
      <br>${escapeHtml(source.attribution ?? "")}
    </li>
  `).join("");
  target.innerHTML = `
    <p>${escapeHtml(provenance.summary ?? "")}</p>
    <p><strong>出典の記載:</strong> ${escapeHtml(provenance.processedNotice ?? provenance.attribution ?? "")}</p>
    <p><strong>利用条件:</strong> 国土地理院コンテンツ利用規約（公共データ利用規約（第1.0版。PDL1.0。CC BY 4.0 互換））
      <a href="https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html" rel="noopener noreferrer" target="_blank">https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html</a></p>
    <p><strong>取得日:</strong> ${escapeHtml(provenance.retrievedAt ?? "")}</p>
    <ul>${sources}</ul>
    <p><a href="${escapeHtml(provenanceUrl())}" rel="noopener noreferrer">加工の記録（provenance JSON）</a></p>
  `;
}

function renderVersion() {
  const target = element("version");
  if (!target) return;
  target.textContent = `使っている版: @c4h/atlas ${atlasVersion()}`;
}

function render() {
  renderInteractivity();
  renderStatus();
  renderSummary();
  renderTable();
  renderFailures();
  renderProvenance();
}

function markPressed(activeId) {
  for (const button of dom.querySelectorAll("#preset-bar button")) {
    const pressed = button.dataset.preset === activeId;
    button.setAttribute("aria-pressed", String(pressed));
    button.classList.toggle("active", pressed);
  }
}

function renderPresetBar() {
  const bar = element("preset-bar");
  if (!bar) return;
  while (bar.firstChild) bar.removeChild(bar.firstChild);
  for (const preset of BENCHMARK_PRESETS) {
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

function setExpectation(line) {
  const expectation = element("preset-expectation");
  if (expectation) expectation.textContent = line;
}

/**
 * Once a control changes the input by hand, the pressed preset no longer describes what is on
 * screen. Nothing is re-run: the run is explicit on this page.
 */
function leavePreset() {
  if (!state.activePreset) return;
  state.activePreset = null;
  markPressed(null);
  setExpectation(NEUTRAL_EXPECTATION);
}

async function applyPreset(preset, option) {
  const input = option.input;
  const engineModule = engine();
  const points = engineModule.selectPoints(state.places, input);
  const workCount = presetWorkCount(input, points.length);
  state.activePreset = `${preset.id}:${option.id}`;
  syncControls({
    category: input.category,
    pointLimit: input.pointLimit,
    workCount,
    scopeKind: input.crsScope.kind,
    groupId: element("crs-group")?.value ?? DEFAULT_CONTROLS.groupId,
    crsId: input.crsScope.id ?? DEFAULT_CONTROLS.crsId,
  });
  markPressed(state.activePreset);
  setExpectation(option.expectation);
  render();
  await runOnce();
}

async function runOnce() {
  if (!state.ready || state.running) return;
  const controls = readControls();
  const engineModule = engine();
  const places = engineModule.selectPoints(state.places, controls);
  const targetIds = engineModule.crsScopeIds(controls.crsScope);

  state.running = true;
  state.error = null;
  state.status = `実行中... （${places.length} 地点・作業量 ${controls.workCount} 回・CRS ${targetIds.length} 件）`;
  render();

  try {
    const runtime = await loadAtlasRuntime();
    state.result = await engineModule.runBenchmark({
      places,
      catalogPlaces: state.places,
      workCount: controls.workCount,
      targetIds,
      runtime,
      projWasm: state.projWasm,
      proj4js: state.proj4js,
    });
    state.status = "実行が終わりました。";
  } catch (error) {
    state.error = messageOf(error);
  } finally {
    state.running = false;
    render();
  }
}

function reset() {
  state.result = null;
  state.error = null;
  state.activePreset = null;
  state.status = state.ready ? "準備完了。" : state.status;
  syncControls(defaultControls());
  markPressed(null);
  setExpectation(NEUTRAL_EXPECTATION);
  render();
}

function bindControls() {
  for (const id of ["category", "point-limit", "work-count", "crs-scope", "crs-group", "crs-id"]) {
    const control = element(id);
    if (!control) continue;
    control.addEventListener("change", () => {
      if (id === "crs-scope") renderScopeInputs();
      leavePreset();
    });
  }
  const run = element("run-button");
  if (run) run.addEventListener("click", () => enqueue(runOnce));
  const resetButton = element("reset-button");
  if (resetButton) resetButton.addEventListener("click", () => reset());
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`データを読めません: ${url.href} (${response.status} ${response.statusText})`);
  }
  return response.json();
}

async function loadData() {
  if (injectedData) return injectedData;
  const [places, provenance] = await Promise.all([
    loadJson(new URL("./data/benchmark-places.json", import.meta.url)),
    loadJson(new URL("./data/benchmark-places.provenance.json", import.meta.url)),
  ]);
  return { places, provenance };
}

async function loadModules() {
  if (injectedModules) return injectedModules;
  const [projWasm, proj4js] = await Promise.all([
    import("proj-wasm"),
    import("proj4"),
  ]);
  return { projWasm, proj4js: proj4js.default ?? proj4js };
}

async function initialize() {
  try {
    state.status = "初期化中: proj-wasm の実行時...";
    render();
    const runtime = await loadAtlasRuntime();
    await runtime.initializeProjWasmRuntime({ projWasmAssetBaseUrl: projWasmAssetBaseUrl() });

    state.status = "初期化中: エンジン...";
    render();
    const modules = await loadModules();
    state.projWasm = modules.projWasm;
    state.proj4js = modules.proj4js;

    state.status = "初期化中: 地点データと出典..."
    render();
    const data = await loadData();
    state.places = data.places ?? [];
    state.provenance = data.provenance ?? null;

    state.ready = true;
    state.status = `準備完了。地点 ${state.places.length} 件を読み込みました。`;
  } catch (error) {
    state.ready = false;
    state.error = `初期化に失敗しました: ${messageOf(error)}`;
  }
  render();
}

/**
 * Wire the benchmark page and return a small handle for tests.
 *
 * `runtime` is the same object shape as `@c4h/atlas` (`initializeProjWasmRuntime` and
 * `listProjectedCrsFromProjWasm`); by default it is the dynamic import of the package.
 * `engine` replaces the functions of `demo/benchmark-engine.js` (the benchmark arithmetic), and
 * `data`/`modules` replace the fetched dataset and the loaded engines. The page calls this once;
 * importing this module does nothing by itself.
 */
export function initBenchmark({ runtime, doc, engine: injected, data, modules } = {}) {
  dom = doc ?? globalThis.document;
  injectedRuntime = runtime ?? null;
  injectedEngine = injected ?? null;
  injectedData = data ?? null;
  injectedModules = modules ?? null;
  atlasModulePromise = undefined;
  settled = Promise.resolve();
  Object.assign(state, {
    ready: false,
    running: false,
    status: "初期化中...",
    error: null,
    places: [],
    provenance: null,
    projWasm: null,
    proj4js: null,
    result: null,
    activePreset: null,
  });

  renderScopeOptions();
  renderPresetBar();
  renderVersion();
  bindControls();
  syncControls(defaultControls());
  markPressed(null);
  setExpectation(NEUTRAL_EXPECTATION);
  render();
  enqueue(initialize);

  return {
    whenSettled: () => settled,
    getState: () => ({
      ready: state.ready,
      running: state.running,
      activePreset: state.activePreset,
      placeCount: state.places.length,
      result: state.result,
      error: state.error,
      status: text("init-status"),
    }),
  };
}
