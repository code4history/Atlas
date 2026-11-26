# Changelog

このプロジェクトの主な変更を記録します。版数は [Semantic Versioning](https://semver.org/) に従います。
Notable changes to this project are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0-rc.2] - 2026-11-26

### Added
- 初版。npm に `@c4h/atlas` として公開します。主な API は `listProjectedCrsFromProjWasm`（経緯度の範囲から投影 CRS の候補を列挙）、`transformLonLatArrayToProjected`（経緯度を候補の投影座標へ一括変換）、`createCandidateTransformer`（Teiresias の `estimateCrs` に渡す変換関数を作る）、`initializeProjWasmRuntime` です。全 export は README の API の節にあります。
- First release, published to npm as `@c4h/atlas`. The main API is `listProjectedCrsFromProjWasm` (lists projected CRS candidates for a lon/lat extent), `transformLonLatArrayToProjected` (transforms lon/lat points into a candidate's projected coordinates), `createCandidateTransformer` (builds the transformer Teiresias' `estimateCrs` takes) and `initializeProjWasmRuntime`. Every export is listed in the API section of the README.
- 既知の制約は README の「[同梱の proj-wasm で書き出せない行](./README.ja.md#同梱の-proj-wasm-で書き出せない行)」と「[proj-wasm 0.1.0-alpha8 の既知の上限](./README.ja.md#proj-wasm-010-alpha8-の既知の上限)」にあります。
- Known limitations are described in "[Rows the bundled proj-wasm cannot export](./README.md#rows-the-bundled-proj-wasm-cannot-export)" and "[Known limit of proj-wasm 0.1.0-alpha8](./README.md#known-limit-of-proj-wasm-010-alpha8)" in the README.
- PROJ は既定で通信しません。格子ファイルの取得（`https://cdn.proj.org`）は `initializeProjWasmRuntime({ enableNetwork: true })` で有効にしたときだけ行います。URL を含む定義は PROJ に渡しません。詳しくは README の「[通信と信頼できない入力](./README.ja.md#通信と信頼できない入力)」にあります。
- PROJ does not use the network by default. Grid files are fetched (from `https://cdn.proj.org`) only after `initializeProjWasmRuntime({ enableNetwork: true })`, and a definition that contains a URL is never handed to PROJ. See "[Network access and untrusted input](./README.md#network-access-and-untrusted-input)" in the README.
- npm の tarball に、再配布している PROJ の実行時ファイルの著作権表示（`THIRD-PARTY-NOTICES.md`）を入れました。
- The npm tarball now carries the notices of the PROJ runtime files it redistributes (`THIRD-PARTY-NOTICES.md`).
- 実行時の依存 `proj-wasm` は prerelease の `0.1.0-alpha8` に厳密に固定したままです。proj-wasm 0.1.0 は実行時ファイルの構成が変わり（Atlas はこれらを再配布し、ブラウザ向けに読み込み元を差し替えています）、同時に生かせる PROJ object の数に上限が付いて `area` なしの検索が失敗するため、移行は別の変更として行います。
- The runtime dependency `proj-wasm` stays pinned exactly to the prerelease `0.1.0-alpha8`. proj-wasm 0.1.0 changes the set of runtime files (which Atlas redistributes, and whose location it sets for browsers) and caps the number of live PROJ objects, which makes a search without `area` fail; moving to it is a change of its own.
