/**
 * Preset values for the benchmark demo (data only — this module never touches the DOM).
 *
 * The page (`demo/benchmark.js`) and the tests (`tests/benchmark-engine.test.ts`,
 * `tests/benchmark-wiring.test.ts`) import these values, so the numbers and the expectation line
 * live here and nowhere else.
 *
 * An option's `input` is what the controls of the page show: a dataset category, a point limit
 * (`"all"` or a number), the number of laps through that point set (`laps`) and a CRS scope. The
 * work count of a run is `laps` times the number of points selected, which is why it is written
 * as laps here instead of a raw number.
 */

export const ENGINE_COVERAGE_EXPECTATION =
  "エンジンの対応範囲で結果が分かれる。A は proj-wasm も proj4js も全点成功し、順方向の差は小さい（値は画面に出る）。B は proj-wasm だけが成功し、proj4js は全点が「pipeline を読めない」失敗になる（失敗が表に明示される）。";

function presetInput(crsScope) {
  return Object.freeze({
    category: "mountain-summit",
    pointLimit: "all",
    laps: 1,
    crsScope: Object.freeze(crsScope),
  });
}

export const BENCHMARK_PRESETS = Object.freeze([
  {
    id: "engine-coverage",
    title: "エンジンの対応範囲",
    options: [
      {
        id: "a",
        label: "A: 平面直角座標系 IX 系（EPSG:2451）・全地点",
        expectation: ENGINE_COVERAGE_EXPECTATION,
        input: presetInput({ kind: "crs", id: "EPSG:2451" }),
      },
      {
        id: "b",
        label: "B: 歴史グリッド B 帯（UTJCP:ZONE-B）・同じ地点",
        expectation: ENGINE_COVERAGE_EXPECTATION,
        input: presetInput({ kind: "crs", id: "UTJCP:ZONE-B" }),
      },
    ],
  },
]);

/** The one-line description shown while no preset is pressed. */
export const NEUTRAL_EXPECTATION = "手で変えた入力（プリセットではない）。プリセットのボタンを押すと戻る。";

/** Find one preset option by contrast id and option id. */
export function findBenchmarkPreset(presetId, optionId) {
  return BENCHMARK_PRESETS.find((preset) => preset.id === presetId)?.options.find(
    (option) => option.id === optionId,
  );
}

/** The work count of a run: one lap is one pass through the selected point set. */
export function presetWorkCount(input, pointCount) {
  const laps = Math.max(1, Math.floor(Number(input?.laps ?? 1)));
  return Math.max(0, Math.floor(Number(pointCount)) * laps);
}
