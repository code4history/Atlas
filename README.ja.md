# Atlas

[![CI](https://github.com/code4history/Atlas/actions/workflows/test.yml/badge.svg)](https://github.com/code4history/Atlas/actions/workflows/test.yml)

Maplat V3.1 向けの candidate CRS lookup ライブラリです。Node.js とブラウザ runtime の両方から利用できます。
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

Maplat Limited License 1.1
