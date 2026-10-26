import { describe, expect, it } from "vitest";
import { listProjectedCrsFromProjWasm } from "../src/proj-wasm-crs.ts";

/**
 * 回帰テスト: proj-wasm 0.1.0-alpha8 では、PROJ object を作って `proj_destroy` で解放しても
 * 取り戻せない資源が残り、作成が約 22 万回に達すると wasm のメモリ上限（2 GiB）で
 * `SQLite error [ out of memory ]` になる。`area` なしの検索は 1 回で約 2,200 行を展開するので、
 * 以前は 1 つの process で約 100 回検索すると落ちた（デモで Area filter を外したまま操作を続けた場合）。
 *
 * 同じ行の展開結果は 1 process の中で使い回すので、検索を何回続けても作成は行の数で頭打ちになる。
 * ここでは落ちていた回数を十分に越える 150 回を、1 つの process で続けて呼ぶ。
 */
const KYOTO_EXTENT = { west: 135.70, south: 34.95, east: 135.80, north: 35.05 };
const ROUNDS = 150;
const CALL_TIMEOUT_MS = 60_000;

describe("repeated searches without an area filter", () => {
  it(`answers ${ROUNDS} consecutive searches in one process with the same result`, async () => {
    let firstIds: string[] | undefined;
    for (let round = 1; round <= ROUNDS; round += 1) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const rows = await Promise.race([
        listProjectedCrsFromProjWasm({ extent: KYOTO_EXTENT, includeCustomProjections: true }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`search ${round} did not answer within ${CALL_TIMEOUT_MS} ms`)), CALL_TIMEOUT_MS);
        }),
      ]).finally(() => clearTimeout(timer));

      const ids = rows.map((row) => row.id);
      if (firstIds === undefined) {
        firstIds = ids;
        expect(ids).toContain("EPSG:6674");
        expect(ids).toContain("UTJCP:ZONE-B");
      } else if (ids.length !== firstIds.length || ids.some((id, index) => id !== firstIds![index])) {
        throw new Error(`search ${round} returned a different result (${ids.length} rows, first ${firstIds.length})`);
      }
    }
  }, 600_000);
});
