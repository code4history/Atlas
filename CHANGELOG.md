# Changelog

このプロジェクトの主な変更を記録します。版数は [Semantic Versioning](https://semver.org/) に従います。
Notable changes to this project are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- 初版。npm に `@c4h/atlas` として公開します。主な API は `listProjectedCrsFromProjWasm`（経緯度の範囲から投影 CRS の候補を列挙）、`transformLonLatArrayToProjected`（経緯度を候補の投影座標へ一括変換）、`createCandidateTransformer`（Teiresias の `estimateCrs` に渡す変換関数を作る）、`initializeProjWasmRuntime` です。全 export は README の API の節にあります。
- First release, published to npm as `@c4h/atlas`. The main API is `listProjectedCrsFromProjWasm` (lists projected CRS candidates for a lon/lat extent), `transformLonLatArrayToProjected` (transforms lon/lat points into a candidate's projected coordinates), `createCandidateTransformer` (builds the transformer Teiresias' `estimateCrs` takes) and `initializeProjWasmRuntime`. Every export is listed in the API section of the README.
- 既知の制約は README の「[同梱の proj-wasm で書き出せない行](./README.ja.md#同梱の-proj-wasm-で書き出せない行)」と「[proj-wasm 0.1.0-alpha8 の既知の上限](./README.ja.md#proj-wasm-010-alpha8-の既知の上限)」にあります。
- Known limitations are described in "[Rows the bundled proj-wasm cannot export](./README.md#rows-the-bundled-proj-wasm-cannot-export)" and "[Known limit of proj-wasm 0.1.0-alpha8](./README.md#known-limit-of-proj-wasm-010-alpha8)" in the README.
