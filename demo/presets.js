/**
 * Preset values for the candidate CRS demo (data only — this module never touches the DOM).
 *
 * The demo page (`demo/main.js`) and the tests (`tests/demo-presets.test.ts`,
 * `tests/demo-wiring.test.ts`) import these values, so the numbers and the expectation lines
 * live here and nowhere else. A typo shows up as a test whose contrast no longer splits.
 *
 * `buildLookupOptions` is the single place that copies a preset input onto the arguments of
 * `listProjectedCrsFromProjWasm`; the demo and the tests both use it so the copy cannot drift.
 */

const KYOTO = Object.freeze({ west: 135.6, south: 34.9, east: 135.9, north: 35.1 });
const TOKYO = Object.freeze({ west: 139.6, south: 35.6, east: 139.85, north: 35.75 });

/**
 * Area names accepted by the proj.db `area` filter, keyed by the demo's select values.
 *
 * This is the single place the mapping is written down: `demo/main.js` reads it for the `auto`
 * area it derives from a marker as well, so the select values, the derived area and the preset
 * lookup can never disagree.
 */
export const AREA_BY_MODE = Object.freeze({
  japan: "Japan",
  united_states: "United States",
  korea: "Korea",
  china: "China",
});

/** The line shown when the input was changed by hand and no preset is pressed. */
export const NEUTRAL_EXPECTATION =
  "手で変えた入力（プリセットではない）。プリセットのボタンを押すと戻る。";

function presetInput(extent, { areaFilterEnabled, includeCustomProjections }) {
  return Object.freeze({
    extent,
    areaFilterEnabled,
    areaMode: "japan",
    includeCustomProjections,
    onshoreOnly: false,
    includeDeprecated: false,
  });
}

export const PRESETS = Object.freeze([
  {
    id: "place",
    title: "場所による違い",
    options: [
      {
        id: "a",
        label: "京都の範囲",
        expectation:
          "場所で候補の平面直角座標系が分かれる。A は VI 系（EPSG:6674）と歴史グリッド B 帯、B は VIII・IX 系（EPSG:6676・EPSG:6677）と A 帯。A に IX 系は無く、B に VI 系は無い",
        input: presetInput(KYOTO, { areaFilterEnabled: true, includeCustomProjections: true }),
      },
      {
        id: "b",
        label: "東京の範囲",
        expectation:
          "場所で候補の平面直角座標系が分かれる。A は VI 系（EPSG:6674）と歴史グリッド B 帯、B は VIII・IX 系（EPSG:6676・EPSG:6677）と A 帯。A に IX 系は無く、B に VI 系は無い",
        input: presetInput(TOKYO, { areaFilterEnabled: true, includeCustomProjections: true }),
      },
    ],
  },
  {
    id: "historical-grid",
    title: "歴史グリッドの有無",
    options: [
      {
        id: "a",
        label: "京都・歴史グリッドなし",
        expectation:
          "歴史グリッドの候補が出るか出ないかが分かれる。B にだけ UTJCP:ZONE-B が加わり、件数が 1 つ増える",
        input: presetInput(KYOTO, { areaFilterEnabled: true, includeCustomProjections: false }),
      },
      {
        id: "b",
        label: "京都・歴史グリッドあり",
        expectation:
          "歴史グリッドの候補が出るか出ないかが分かれる。B にだけ UTJCP:ZONE-B が加わり、件数が 1 つ増える",
        input: presetInput(KYOTO, { areaFilterEnabled: true, includeCustomProjections: true }),
      },
    ],
  },
  {
    id: "area-filter",
    title: "地域で絞るかどうか",
    options: [
      {
        id: "a",
        label: "京都・地域で絞る（Japan）",
        expectation:
          "地域で絞るかどうかで候補の広さが分かれる。B では日本以外の CRS も並び、件数が大きく増える。どちらでもエラーにならず、A に戻すと A の一覧に戻る",
        input: presetInput(KYOTO, { areaFilterEnabled: true, includeCustomProjections: true }),
      },
      {
        id: "b",
        label: "京都・地域で絞らない",
        expectation:
          "地域で絞るかどうかで候補の広さが分かれる。B では日本以外の CRS も並び、件数が大きく増える。どちらでもエラーにならず、A に戻すと A の一覧に戻る",
        input: presetInput(KYOTO, { areaFilterEnabled: false, includeCustomProjections: true }),
      },
    ],
  },
]);

/** Find one preset option by contrast id and option id. */
export function findPreset(presetId, optionId) {
  return PRESETS.find((preset) => preset.id === presetId)?.options.find((option) => option.id === optionId);
}

/**
 * Copy one preset input (or the current control state) onto the lookup arguments.
 *
 * `areaFilterEnabled: false` leaves `area` out entirely rather than passing `undefined`, so the
 * no-filter case is the same object shape the engine has always received.
 * For `areaMode: 'auto'` the caller supplies the area it derived from the markers as `autoArea`.
 */
export function buildLookupOptions(input, { autoArea } = {}) {
  const area = input.areaFilterEnabled
    ? input.areaMode === "auto"
      ? autoArea
      : AREA_BY_MODE[input.areaMode]
    : undefined;

  const options = {
    extent: {
      west: input.extent.west,
      south: input.extent.south,
      east: input.extent.east,
      north: input.extent.north,
    },
    includeDeprecated: input.includeDeprecated ?? false,
    onshoreOnly: input.onshoreOnly ?? false,
    includeCustomProjections: input.includeCustomProjections ?? false,
  };
  if (area !== undefined) options.area = area;
  return options;
}
