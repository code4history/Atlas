/**
 * デモ地図の座標変換と、日付変更線を跨ぐ bbox の描画幾何。
 *
 * 本モジュールは **DOM を参照しない / `@c4h/atlas` を参照しない純関数だけ**を置く
 * （`demo/main.js` から結線し、`tests/demo-map-geometry.test.ts` から直接呼んで検査するため）。
 *
 * 本モジュールが解く欠陥: 経度写像 `x = ((lon + 180) / 360) * scale` は
 * **巡回性を持たない** ∴ west / east を独立に写して差を取ると、`west > east`（跨ぎ）の bbox で
 * **補集合**が描かれる（EPSG:3832 では正しい幅 193.31° に対し 166.69°。和は 360.00°）。
 */

export interface LonLatBBox { west: number; south: number; east: number; north: number; }
export interface MapView { center: [number, number]; zoom: number; width: number; height: number; }
export interface ScreenRect { x: number; y: number; width: number; height: number; }

/** G1: タイル 1 枚の辺長（px）。`demo/main.js` はこれを import して使う（定義を 2 箇所に置かない）。 */
export const TILE_SIZE = 256;

/** G2: 当該 zoom における世界全体の幅（px）。 */
export function worldSizePx(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/** G3: 経緯度 → 世界座標（Web メルカトル）。緯度は ±85.05112878 でクランプする。 */
export function lonLatToWorld([lon, lat]: [number, number], zoom: number): { x: number; y: number } {
  const scale = worldSizePx(zoom);
  const latRad = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI)) * scale,
  };
}

/** G4: 世界座標 → 経緯度。G3 の逆写像。 */
export function worldToLonLat(point: { x: number; y: number }, zoom: number): [number, number] {
  const scale = worldSizePx(zoom);
  const lon = (point.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [lon, lat];
}

/** G5: 経緯度 → 画面座標。視点は `view` として引数で受け取る（モジュールは状態を持たない）。 */
export function lonLatToScreen(point: [number, number], view: MapView): [number, number] {
  const center = lonLatToWorld(view.center, view.zoom);
  const world = lonLatToWorld(point, view.zoom);
  return [
    world.x - center.x + view.width / 2,
    world.y - center.y + view.height / 2,
  ];
}

/** G6: 画面座標 → 経緯度。G5 の逆写像。 */
export function screenToLonLat(point: { x: number; y: number }, view: MapView): [number, number] {
  const center = lonLatToWorld(view.center, view.zoom);
  return worldToLonLat({
    x: center.x + point.x - view.width / 2,
    y: center.y + point.y - view.height / 2,
  }, view.zoom);
}

/**
 * G7: 経度幅を**巡回で**測る。
 *
 * 分岐条件（`west <= east` か否か）は既存前例 `src/proj-wasm-crs.ts` の
 * `normalizeLongitudeSegments` と**同一**にしてある（返す形だけが違う）。
 *
 * ⚠️ 剰余（`%`）で書いてはならない — `((east - west) % 360 + 360) % 360` は
 * 全世界 bbox（`-180, 180`）を `0` にする。
 */
export function lonSpanDegrees(west: number, east: number): number {
  if (west <= east) {
    return east - west;
  }

  return east + 360 - west;
}

/**
 * G8: 幅 `width` の図形を左端 `x` に置いたとき、**視野に掛かる世界コピーの左端 x** を昇順で返す。
 *
 * タイル層（`renderTiles` の `wrappedX`）が経度方向に世界を無限反復しているため、
 * 図形も同じ規則で反復しないと、パンで世界コピーを 1 つずれた視点から消えてしまう。
 *
 * `bleedPx` は図形の実体が左端 x・幅 width の矩形からはみ出す分（マーカーの円やラベル）。
 *
 * 反復回数は、デモの拘束下（zoom 2〜12・幅 720 px・図形の幅が世界の幅以下）で最大 2 になる。
 * `tests/demo-map-geometry.test.ts` がその上限を検査する。
 */
export function worldCopyXs(x: number, width: number, view: MapView, bleedPx = 0): number[] {
  const worldWidth = worldSizePx(view.zoom);
  const first = Math.ceil((-(width + bleedPx) - x) / worldWidth);
  const last = Math.floor((view.width + bleedPx - x) / worldWidth);

  const xs: number[] = [];
  for (let k = first; k <= last; k += 1) {
    xs.push(x + k * worldWidth);
  }
  return xs;
}

/**
 * G9: bbox を画面上の矩形群へ変換する。
 *
 * 幅は G7 の巡回幅から直接求める（west / east を独立に写した差を取らない）∴
 * 跨ぎ・非跨ぎを**同じ 1 本の式**で扱える。可視性は G8 の世界コピー反復が担う。
 *
 * 緯度側は `Math.min` / `Math.abs` のまま残す — 緯度に巡回は無く、`proj.db` は
 * `south_lat <= north_lat` を CHECK 制約で保証しているが、壊れたデータへの防御として残す。
 */
export function bboxScreenRects(bbox: LonLatBBox, view: MapView): ScreenRect[] {
  const [left, top] = lonLatToScreen([bbox.west, bbox.north], view);
  const [, bottom] = lonLatToScreen([bbox.east, bbox.south], view);

  const width = Math.max(1, (lonSpanDegrees(bbox.west, bbox.east) / 360) * worldSizePx(view.zoom));
  const y = Math.min(top, bottom);
  const height = Math.max(1, Math.abs(bottom - top));

  return worldCopyXs(left, width, view).map((x) => ({ x, y, width, height }));
}
