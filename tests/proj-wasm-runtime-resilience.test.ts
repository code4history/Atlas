import { describe, expect, it } from "vitest";
import {
  listProjectedCrsFromProjWasm,
  type ListProjectedCrsFromProjWasmOptions,
  type ProjectedCrsExclusion,
  type ProjectedCrsInfo,
} from "../src/proj-wasm-crs.ts";

/**
 * 回帰テスト: `area` を指定しない検索は、範囲を覆う全球の投影や PROJ 文字列にできない方式に当たる。
 * 以前はそこで例外になり、1 つの process で例外が重なると wasm の実行時が壊れて、
 * 以後の正しい検索まで `memory access out of bounds` で失敗するか応答しなくなった。
 *
 * このファイルは 1 つの process（vitest のファイル単位の隔離）の中で、壊れた順番どおりに
 * 4 回続けて呼び、全部が成功することを確かめる。各呼び出しには打ち切りの時間を置き、
 * 止まったら偽にする。
 */
const KYOTO_EXTENT = { west: 135.70, south: 34.95, east: 135.80, north: 35.05 };
const CALL_TIMEOUT_MS = 60_000;

async function listWithTimeout(options: ListProjectedCrsFromProjWasmOptions): Promise<ProjectedCrsInfo[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      listProjectedCrsFromProjWasm(options),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`listProjectedCrsFromProjWasm did not answer within ${CALL_TIMEOUT_MS} ms`)),
          CALL_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe("proj-wasm runtime stays usable after searches without an area filter", () => {
  it(
    "answers four consecutive searches (no area, no area + custom, Japan + custom, no area) in one process",
    async () => {
      const excludedByCall: ProjectedCrsExclusion[][] = [];
      const calls: ListProjectedCrsFromProjWasmOptions[] = [
        { extent: KYOTO_EXTENT },
        { extent: KYOTO_EXTENT, includeCustomProjections: true },
        { extent: KYOTO_EXTENT, area: "Japan", includeCustomProjections: true },
        { extent: KYOTO_EXTENT },
      ];

      const results: ProjectedCrsInfo[][] = [];
      for (const options of calls) {
        const excluded: ProjectedCrsExclusion[] = [];
        results.push(await listWithTimeout({ ...options, onExcluded: (entries) => excluded.push(...entries) }));
        excludedByCall.push(excluded);
      }

      const [noArea, noAreaCustom, japanCustom, noAreaAgain] = results;
      console.info(
        `[runtime-resilience] counts: no area ${noArea.length}, no area + custom ${noAreaCustom.length}, ` +
        `Japan + custom ${japanCustom.length}, no area again ${noAreaAgain.length}; ` +
        `excluded (no area) ${excludedByCall[0].length}`,
      );

      for (const rows of [noArea, noAreaCustom, japanCustom, noAreaAgain]) {
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => typeof row.proj4 === "string" && row.proj4.length > 0)).toBe(true);
      }

      // 3 回目（地域で絞る検索）が、例外の後でも新しい process と同じ答えを返す
      const japanIds = japanCustom.map((row) => row.id);
      expect(japanIds).toContain("EPSG:6674");
      expect(japanIds).toContain("UTJCP:ZONE-B");

      // 地域で絞らない検索は日本の CRS も含み、地域で絞る検索より広い
      expect(noArea.map((row) => row.id)).toContain("EPSG:6674");
      expect(noArea.length).toBeGreaterThan(japanCustom.length);
      expect(noAreaCustom.map((row) => row.id)).toContain("UTJCP:ZONE-B");

      // 同じ呼び出しは同じ答えを返す（実行時が壊れていない）
      expect(noAreaAgain.map((row) => row.id)).toEqual(noArea.map((row) => row.id));

      // PROJ 文字列にできない行は黙って消さず、理由つきで知らせる
      const excludedIds = excludedByCall[0].map((entry) => entry.id);
      expect(excludedIds).toContain("EPSG:32600");
      expect(excludedByCall[0].every((entry) => entry.reason.length > 0)).toBe(true);
      expect(noArea.map((row) => row.id)).not.toContain("EPSG:32600");
    },
    CALL_TIMEOUT_MS * 4 + 30_000,
  );
});
