import { describe, expect, it } from "vitest";

import {
  bboxScreenRects,
  lonLatToScreen,
  lonSpanDegrees,
  worldCopyXs,
  worldSizePx,
  type MapView,
} from "../demo/map-geometry.ts";

/**
 * m3-t3: Atlas デモの日付変更線跨ぎ bbox 描画の是正。
 *
 * 設計正本: `docs/superpowers/specs/2026-08-29-m3-t3-maplat-v4-crs-libs-task-design.md`
 * §6.1（公開関数の契約）／ §9.1（m3-t3/AC-1〜AC-5）。
 *
 * 本ファイルは「算術そのもの」を守る層 1 である（設計 §9.2）。
 * DOM も `@c4h/atlas` も参照しない純関数だけを対象とする。
 */

/** 観測に使う視野。デモの実寸（`MAP_WIDTH` 720 / `MAP_HEIGHT` 460）に合わせる。 */
function viewAt(center: [number, number], zoom: number): MapView {
  return { center, zoom, width: 720, height: 460 };
}

/** 浮動小数の比較。設計 m3-t3/AC-2 が定める許容差 1e-9 を全 AC で共通に使う。 */
function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

describe("m3-t3/AC-1 lonSpanDegrees は経度幅を巡回で測る", () => {
  it("(a) west < east では east - west を返す", () => {
    expectClose(lonSpanDegrees(122, 154), 32);
    expectClose(lonSpanDegrees(-125, -66), 59);
  });

  it("(b) west > east（日付変更線跨ぎ）では east + 360 - west を返す", () => {
    // EPSG:3832 の実 bbox。補集合の 166.69 ではないことが本タスクの中心である。
    expectClose(lonSpanDegrees(98.69, -68), 193.31);
    expect(lonSpanDegrees(98.69, -68)).toBeGreaterThan(180);
  });

  it("(c) west === east では 0 を返す", () => {
    expect(lonSpanDegrees(0, 0)).toBe(0);
    expect(lonSpanDegrees(180, 180)).toBe(0);
  });

  it("(d) (-180, 180) では 360 を返す（剰余で書くと 0 になる誤り。設計 §6.1 G7）", () => {
    expect(lonSpanDegrees(-180, 180)).toBe(360);
  });
});

describe("m3-t3/AC-2 bboxScreenRects は跨ぎ bbox を巡回幅で描く", () => {
  it("EPSG:3832 の実 bbox で幅が 193.31/360 になり、補集合の 166.69/360 にならない", () => {
    const bbox = { west: 98.69, south: -60, east: -68, north: 66.67 };
    const view = viewAt([-170, 0], 5);
    const rects = bboxScreenRects(bbox, view);

    expect(rects.length).toBeGreaterThanOrEqual(1);

    const expected = (193.31 / 360) * worldSizePx(5);
    const complement = (166.69 / 360) * worldSizePx(5);
    // 和が 360.00° になる 2 値であり、取り違えると補集合が描かれる（設計 §2.2）。
    expectClose(expected + complement, worldSizePx(5));

    for (const rect of rects) {
      expectClose(rect.width, expected);
      expect(Math.abs(rect.width - complement)).toBeGreaterThan(1e-9);
    }
  });
});

describe("m3-t3/AC-3 非跨ぎ bbox は是正前と同じ結果になる（回帰）", () => {
  it("デモの Japan bounds で x と width が旧実装と一致する", () => {
    const bbox = { west: 122, south: 20, east: 154, north: 46 };
    const view = viewAt([137.5, 36.5], 5);
    const rects = bboxScreenRects(bbox, view);

    expect(rects).toHaveLength(1);
    expectClose(rects[0]!.x, lonLatToScreen([122, 46], view)[0]);
    expectClose(rects[0]!.width, (32 / 360) * worldSizePx(5));
  });
});

describe("m3-t3/AC-4 極端例（幅 359.98° の bbox）が 1px の線にならない", () => {
  it("EPSG:8858 の bbox（west 90.01 / east 89.99）で幅が 359.98/360 になる", () => {
    const bbox = { west: 90.01, south: -90, east: 89.99, north: 90 };
    const view = viewAt([0, 0], 4);
    const rects = bboxScreenRects(bbox, view);

    expect(rects.length).toBeGreaterThanOrEqual(1);
    for (const rect of rects) {
      expectClose(rect.width, (359.98 / 360) * worldSizePx(4));
      expect(rect.width).toBeGreaterThan(1);
    }
  });
});

describe("m3-t3/AC-5 worldCopyXs は視野に掛かる世界コピーだけを昇順で返す", () => {
  const view = viewAt([0, 0], 2); // worldSizePx = 1024（デモの下限 zoom）

  it("(a) 視野に掛かるコピーだけを返す — 右端でちょうど接する場合は含む", () => {
    expect(worldCopyXs(720, 0, view)).toEqual([720]);
    expect(worldCopyXs(721, 0, view)).toEqual([]);
  });

  it("(a) 左端でちょうど接する場合も含む", () => {
    expect(worldCopyXs(-100, 100, view)).toEqual([-100]);
    expect(worldCopyXs(-101, 100, view)).toEqual([]);
  });

  it("(a) 視野外のコピーは、世界幅ぶん平行移動した位置で拾われる", () => {
    // x = -1024 は視野外だが、+1 コピー（x = 0）が視野に掛かる。
    expect(worldCopyXs(-1024, 0, view)).toEqual([0]);
  });

  it("(a) bleedPx を与えると、その分だけ判定域が広がる", () => {
    expect(worldCopyXs(760, 0, view)).toEqual([]);
    expect(worldCopyXs(760, 0, view, 48)).toEqual([760]);
  });

  it("(b) 返り値は昇順である", () => {
    for (let zoom = 2; zoom <= 12; zoom += 1) {
      const v = viewAt([0, 0], zoom);
      const w = worldSizePx(zoom);
      for (const x of [-2 * w, -w, -w / 3, 0, 360, w / 2, w, 2 * w]) {
        const xs = worldCopyXs(x, w / 2, v, 48);
        for (let i = 1; i < xs.length; i += 1) {
          expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
        }
      }
    }
  });

  it("(c) zoom 2..12・view.width 720・width <= worldSizePx の全域で件数が 2 以下（設計 §6.3）", () => {
    for (let zoom = 2; zoom <= 12; zoom += 1) {
      const v = viewAt([0, 0], zoom);
      const w = worldSizePx(zoom);
      for (const width of [0, 1, w / 4, w / 2, w]) {
        for (const bleedPx of [0, 48]) {
          // 世界幅 1 周ぶんを 37 分割して走査する（境界だけでなく内部も踏む）。
          for (let i = 0; i <= 36; i += 1) {
            const x = -w + (2 * w * i) / 36;
            expect(worldCopyXs(x, width, v, bleedPx).length).toBeLessThanOrEqual(2);
          }
        }
      }
    }
  });
});
