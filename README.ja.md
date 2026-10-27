# Atlas

[![CI](https://github.com/code4history/Atlas/actions/workflows/test.yml/badge.svg)](https://github.com/code4history/Atlas/actions/workflows/test.yml)

Maplat 向けの candidate CRS lookup ライブラリです。Node.js とブラウザ runtime の両方から利用できます。
`proj-wasm` 経由で `proj.db` を検索し、UTJCP のような JSON 定義の追加投影系も統合できます。

English README is [here](./README.md).

## 主な機能

- 地理 extent から投影 CRS 候補を検索
- area 文字列、deprecated、onshore-only で絞り込み
- bbox contains 判定に padding を適用
- built-in / user JSON の追加投影系を統合
- ブラウザ用デモは公開 package の runtime surface から分離

## 要件

- Node.js >= 20
- 開発時の pnpm >= 10

## インストール

### pnpm

```sh
pnpm add @c4h/atlas
```

### npm

```sh
npm install @c4h/atlas
```

## 基本的な使い方

```ts
import { listProjectedCrsFromProjWasm } from "@c4h/atlas";

const rows = await listProjectedCrsFromProjWasm({
  extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
  area: "Japan",
  onshoreOnly: true,
});

console.log(rows.map((row) => row.id));
```

`transformLonLatArrayToProjected` は lon/lat（度・lon-lat 順）の点列を候補 CRS の投影座標へ
変換します。返り値は常に `[easting, northing]` 順で、入力と同数・同順の配列か `null` です。

```ts
import { listProjectedCrsFromProjWasm, transformLonLatArrayToProjected } from "@c4h/atlas";

const [target] = await listProjectedCrsFromProjWasm({
  extent: { west: 135.6, south: 34.9, east: 135.9, north: 35.1 },
  area: "Japan",
  onshoreOnly: true,
});

const projected = await transformLonLatArrayToProjected(target, [
  [135.6, 34.9],
  [135.9, 35.1],
]);

console.log(projected); // [[easting, northing], [easting, northing]] または null
```

`null` は「業務的に変換不能」を意味します。空入力、入力または出力に非有限成分がある場合
（部分成功はしません）、および target の定義が CRS でない・軸が east/north でない・単位が
metre でない場合に返します（**単位換算はしません**）。throw は実装 bug のときだけです。
入力は lon/lat の度数のみを受け付けます。

### Teiresias と組み合わせる

`createCandidateTransformer(rows)` は候補の行から、[`@c4h/teiresias`](https://github.com/code4history/Teiresias)
の `CandidateTransformer` と同じ形の関数を作ります。Atlas で引いた候補を、そのまま `estimateCrs`
で順位づけできます。Atlas は Teiresias に依存しません（型は形で合わせています）。
`geoBasis` が `{ kind: "lonlat_deg", axisOrder: "lon-lat" }` でないとき、および行に無い id のときは
`null` を返し、それ以外は `transformLonLatArrayToProjected` の結果を返します。行は関数を作った
時点で写し取ります。

```ts
import { createCandidateTransformer, listProjectedCrsFromProjWasm } from "@c4h/atlas";
import { estimateCrs } from "@c4h/teiresias";

const rows = await listProjectedCrsFromProjWasm({
  extent: { west: 135.6, south: 34.9, east: 135.9, north: 35.1 },
  area: "Japan",
});

const result = await estimateCrs(gcps, rows, {
  transformer: createCandidateTransformer(rows),
});
```

### 同梱の proj-wasm で書き出せない行

proj.db の行の中には、同梱の proj-wasm で書き出すと例外になるものがあります。Atlas は実行時を
壊さないよう、その書き出しを避けます（一覧は proj-wasm の版ごとに実測しています）。

- PROJ 文字列にできない行（30 行。例: `EPSG:32600`・`ESRI:54051`）は検索結果から外します。
  `onExcluded` を渡すと、検索ごとに 1 回 `ProjectedCrsExclusion[]`（`{ id, name, reason }`）で
  受け取れます。
- WKT2 にできない行（992 行。`IGNF` の全行と `IAU_2015` の一部）は `wkt2: null` で結果に残します。
  そのため `wkt2` は custom projection だけでなく proj.db の行でも `null` になりえます。

```ts
const rows = await listProjectedCrsFromProjWasm({
  extent,
  onExcluded: (excluded) => console.log(excluded.map(({ id, reason }) => `${id}: ${reason}`)),
});
```

1 つの process の中では、proj.db の一覧と行ごとの WKT2・PROJ 文字列を 1 回だけ作り、以後の検索で
使い回します。

### proj-wasm 0.1.0-alpha8 の既知の上限

proj-wasm 0.1.0-alpha8 は PROJ object を解放してもメモリを全部は返さず、wasm のメモリは 2 GiB が
上限です。検索は PROJ object を使い回すので影響を受けません（1 つの process で 4,000 回の検索を実測）。
`transformLonLatArrayToProjected`（と `createCandidateTransformer` が作る関数）は呼び出しごとに
PROJ object を 1 つ作るので、1 つの process で約 20 万回（実測 199,698 回）呼ぶとメモリが尽き、
以後は `null` を返します。その前に process を作り直して（ページを開き直して）ください。

## 開発

- `pnpm run dev`: ローカル demo site を起動
- `pnpm run build`: 公開 package を `dist/` に build
- `pnpm run build:demo`: GitHub Pages 用 demo を `dist-demo/` に build
- `pnpm run verify:demo`: GitHub Pages 用 artifact を build して検証
- `pnpm run test`: Vitest を実行

## Publish

`pnpm publish` 実行前に `prepublishOnly` で以下を確認します。

- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run verify:demo`

## Demo

- 入口ページ: `index.html`
- 実 demo: `demo/crs-candidate-lookup.html`
- GitHub Pages: `https://code4history.github.io/Atlas/`

## ライセンス

MIT License です。[LICENSE](./LICENSE) を参照してください。
