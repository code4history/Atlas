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
