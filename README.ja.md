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

- Node.js >= 22
- 開発時の pnpm >= 10

## インストール

<!-- release-pinned:start -->
### pnpm

```sh
pnpm add @c4h/atlas
```

### npm

```sh
npm install @c4h/atlas
```
<!-- release-pinned:end -->

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
（部分成功はしません）、および target の定義を PROJ が読めない・CRS でない・軸が east/north でない・
単位が metre でない（**単位換算はしません**）・地球の lon/lat から変換できない（月の CRS など）
場合に返します。`null` はこれら以外には使いません。
実装側の理由で変換できないとき（PROJ object を作れない、proj-wasm の呼び出しが失敗する。wasm の
メモリが尽きた場合を含む）は throw するので、変換できない target と取り違えることはありません。
入力は lon/lat の度数のみを受け付けます。

### Teiresias と組み合わせる

`createCandidateTransformer(rows)` は候補の行から、[`@c4h/teiresias`](https://github.com/code4history/Teiresias)
の `CandidateTransformer` と同じ形の関数を作ります。Atlas で引いた候補を、そのまま `estimateCrs`
で順位づけできます。Atlas は Teiresias に依存しません（型は形で合わせています）。
`geoBasis` が `{ kind: "lonlat_deg", axisOrder: "lon-lat" }` でないとき、および行に無い id のときは
`null` を返し、それ以外は `transformLonLatArrayToProjected` の結果を返します（throw もそのまま
伝えます）。行は関数を作った時点で写し取ります。

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

### 地球以外の天体の CRS

proj.db には地球以外の天体（月・火星など。`IAU_2015` の大半と `ESRI` の一部）の CRS もあり、
多くは範囲が全球です。`listProjectedCrsFromProjWasm` は既定でこれらを外します。変換は地球の
lon/lat から始まり、PROJ には別の天体への変換が無く、同梱の proj-wasm ではそのとき起きる例外が
積み重なると実行時が応答しなくなるためです。判定には proj.db が CRS ごとに持つ天体（楕円体の
`celestial_body`。PROJ が `celestialBodyName` として返す値）を使います。`IAU_2015` でも地球の行は
残します。外す行について PROJ object は作りません。

- 外した行は `onExcluded` に理由 `Not on the Earth (celestial body: <名前>)` で渡します
  （京都の範囲・`area` なしでは 2,046 行。結果は 2,213 行から 167 行になります）。
- 残したいとき（一覧を見るときなど）は `includeOtherCelestialBodies: true` を渡します。
  そうして得た行を、`transformLonLatArrayToProjected` にも、`createCandidateTransformer` を通して
  Teiresias の `estimateCrs` にも、まとめて渡さないでください。`estimateCrs` は渡された候補を全部変換
  するので、実行時が応答しなくなることがあり、変換に失敗した候補があれば推定全体が失敗になります。

### 同梱の proj-wasm で書き出せない行

proj.db の行の中には、同梱の proj-wasm で書き出すと例外になるものがあります。Atlas は実行時を
壊さないよう、その書き出しを避けます（一覧は proj-wasm の版ごとに実測しています）。

- PROJ 文字列にできない行（30 行。例: `EPSG:32600`・`ESRI:54051`）は検索結果から外します。
  `onExcluded` を渡すと、検索ごとに 1 回 `ProjectedCrsExclusion[]`（`{ id, name, reason }`）で、
  上の地球以外の天体の行といっしょに受け取れます。
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
上限です。1 つの process で object を約 20 万個作るとメモリが尽きます。そこで Atlas は PROJ object を
作り直さずに使い回します。

- 検索は展開した行を使い回します（1 つの process で 4,000 回の検索を実測）。
- `transformLonLatArrayToProjected`（と `createCandidateTransformer` が作る関数）は target の CRS
  ごとに変換を 1 つ保持します（4,096 個まで。それを越えると最も前に使ったものから解放します）。
  そのため、同じ target への呼び出しを繰り返してもメモリは尽きません（1 つの process で 21 万回を実測）。

4,096 個を越える種類の target を回し続ける process だけが、object を作り直します。それでもメモリが
尽きたときは、`null` ではなく throw します。そのときは process を作り直して（ページを開き直して）
ください。

## API

以下はすべて `@c4h/atlas` から export されます。

### 関数

| 名前 | 働き |
|---|---|
| `listProjectedCrsFromProjWasm(options)` | 適用範囲が `options.extent` を含む投影 CRS の候補を列挙します（基本的な使い方を参照）。戻り値は `ProjectedCrsInfo[]` です。 |
| `initializeProjWasmRuntime(options?)` | 同梱の proj-wasm を最初の検索より前に読み込みます。省略してよく、ほかの呼び出しが必要なときに読み込みます。 |
| `transformLonLatArrayToProjected(target, points, options?)` | 経緯度（度・lon-lat 順）を 1 つの候補の `[easting, northing]` へ変換します。 |
| `createCandidateTransformer(rows, options?)` | Teiresias の `estimateCrs` に渡す `AtlasCandidateTransformer` を作ります（Teiresias と組み合わせるを参照）。 |
| `isProjectedPrjPath(pathname)` | 同梱の日本の WKT 集の `.prj` のパスが投影 CRS かどうかを返します。 |
| `inferDatumFamily(pathname)` | そのパスから測地系の系統（`CandidateDatumFamily`）を読みます。 |
| `inferKind(pathname)` | そのパスから投影の種類（`CandidateKind`）を読みます。 |
| `isScopeIncluded(kind, scope)` | `CandidateKind` が `CandidateSeedScope`（`"core"` か `"all"`）に入るかを返します。 |
| `inferWgsEquivalent(datumFamily)` | 旧日本測地系（Tokyo）のときだけ `false` を返します。 |
| `extractAuthorityIdFromWkt(wkt)` | WKT の最後の `ID["authority","code"]` を `CandidateAuthorityId` で返します。無ければ `undefined` です。 |
| `extractWktName(wkt)` | WKT の最上位の CRS の名前を返します。 |
| `inferPriority(kind)` | `CandidateKind` の並べ順の優先度を返します（大きいほど先）。 |
| `inferApproximateBbox(pathname, kind)` | おおよその `CandidateBbox` を返します（UTM はその帯、Web メルカトルは全球、ほかは日本）。 |
| `bboxToPolygonWkt(bbox)` | `CandidateBbox` を WKT の `POLYGON` にします。 |

### 型

| 名前 | 表すもの |
|---|---|
| `ProjectedCrsInfo` | 候補 1 件。`id`・`authority`・`code`・`name`・`areaName`・`deprecated`・`bbox`・`wkt2`・`proj4` と任意の詳細。 |
| `ProjectedCrsExclusion` | 検索から外した行と理由（`onExcluded` に渡ります）。 |
| `ListProjectedCrsFromProjWasmOptions` | `listProjectedCrsFromProjWasm` の option。 |
| `InitializeProjWasmRuntimeOptions` | `initializeProjWasmRuntime` の option（`projWasmAssetBaseUrl`）。 |
| `TransformLonLatToProjectedOptions` | `transformLonLatArrayToProjected` と `createCandidateTransformer` の option。 |
| `AtlasCandidateTransformer` | `createCandidateTransformer` が返す変換関数。 |
| `AtlasGeoBasisLike` | 変換関数が受け取る座標の基準（Teiresias の `GeoBasis` と互換）。 |
| `CandidateCrsExtent` | 経緯度の範囲 `{ west, south, east, north }`。 |
| `CandidateBbox` | 経緯度の外接矩形 `{ west, south, east, north }`。 |
| `CandidateAuthorityId` | `{ authority, code }`。 |
| `CandidateDatumFamily` | `"wgs84" \| "tokyo" \| "jgd2000" \| "jgd2011" \| "jgd2024"`。 |
| `CandidateKind` | `"web_mercator" \| "utm" \| "japan_plane_rectangular" \| "japan_land_area" \| "regional_map" \| "weather_map"`。 |
| `CandidateSeedScope` | `"core" \| "all"`。 |

## 開発

- `pnpm run dev`: ローカル demo site を起動
- `pnpm run build`: 公開 package を `dist/` に build
- `pnpm run build:demo`: GitHub Pages 用 demo を `dist-demo/` に build
- `pnpm run verify:demo`: GitHub Pages 用 artifact を build して検証
- `pnpm run test`: Vitest を実行

このリポジトリだけを単独で install するとき（より大きな pnpm workspace の外）は、先に CI の設定を
写してください: `cp ci/pnpm-workspace.ci.yaml pnpm-workspace.yaml && pnpm install --frozen-lockfile`。
写した `pnpm-workspace.yaml` は commit しないでください。

## Publish

`pnpm publish` 実行前に `prepublishOnly` で以下を確認します。

- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run verify:demo`
- `pnpm run verify:packed-browser`

公開は GitHub Actions（`.github/workflows/publish.yml`）から行います。変更の記録は
[CHANGELOG.md](./CHANGELOG.md) にあります。

## Demo

- 入口ページ: `index.html`
- 実 demo: `demo/crs-candidate-lookup.html`
- benchmark のデモ: `demo/benchmark.html`（同じ地点列・同じ CRS で proj-wasm と proj4js を往復させ、時間・成功／失敗・往復誤差・2 つのエンジンの順方向の出力の差・失敗の理由を並べます。地点データとその出典は `demo/data/benchmark-places.provenance.json`）
- GitHub Pages: `https://code4history.github.io/Atlas/`

デモ画面には 3 つの対比のプリセットがあり、それぞれ A と B の 2 ボタンを持ちます。

- `place`: 同じ設定のまま京都（A）と東京（B）の範囲を比べる。候補の平面直角座標系が変わり、片方は VI 系、もう片方は VIII・IX 系になる。
- `historical-grid`: 京都の範囲で、歴史グリッドの投影を外した場合（A）と入れた場合（B）を比べる。B にだけ `UTJCP:ZONE-B` が加わり、件数が 1 つ増える。
- `area-filter`: 京都の範囲で、地域を Japan に絞った場合（A）と絞らない場合（B）を比べる。絞らないと日本以外の CRS も一覧に並ぶ。

プリセットを押すと、範囲の 4 隅にマーカーを置き、地図をその範囲へ寄せ、検索を 1 回だけ走らせ、「見え方」の 1 行を出します。押したあとも、既存のつまみ・地域の選択・地図操作はそのまま使えます。

## ライセンス

MIT License です。[LICENSE](./LICENSE) を参照してください。
