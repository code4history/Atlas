# Atlas

[![CI](https://github.com/code4history/Atlas/actions/workflows/test.yml/badge.svg)](https://github.com/code4history/Atlas/actions/workflows/test.yml)

Candidate CRS lookup for Maplat, usable from Node.js and browser runtimes.
Atlas searches `proj.db` through `proj-wasm` and can optionally merge JSON-defined custom projections such as UTJCP historical zones.

日本語のREADMEは[こちら](./README.ja.md)。

## Features

- Lookup projected CRS candidates from a geographic extent
- Filter by area string, deprecated flag, and onshore-only preference
- Apply configurable bbox padding during containment tests
- Merge built-in or user-provided JSON projection definitions
- Keep browser demo logic outside the published package surface

## Requirements

- Node.js >= 20
- pnpm >= 10 for development

## Installation

### pnpm

```sh
pnpm add @c4h/atlas
```

### npm

```sh
npm install @c4h/atlas
```

## Basic Usage

```ts
import { listProjectedCrsFromProjWasm } from "@c4h/atlas";

const rows = await listProjectedCrsFromProjWasm({
  extent: { west: 135.4, south: 34.55, east: 135.65, north: 34.8 },
  area: "Japan",
  onshoreOnly: true,
});

console.log(rows.map((row) => row.id));
```

`transformLonLatArrayToProjected` converts a lon/lat array (degrees, lon-lat order) into the
projected coordinates of a candidate CRS. The return value is always `[easting, northing]`,
in the same order and count as the input, or `null`.

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

console.log(projected); // [[easting, northing], [easting, northing]] or null
```

`null` means "not transformable as a business outcome". It is returned for an empty input,
for a non-finite input or output component (no partial success), and for a target whose
definition is not a CRS, whose axes are not east/north, or whose units are not metres
(units are never converted). Exceptions are reserved for implementation bugs.
The function accepts lon/lat degree input only.

### Using Atlas with Teiresias

`createCandidateTransformer(rows)` turns candidate rows into a transformer with the same shape as
the `CandidateTransformer` of [`@c4h/teiresias`](https://github.com/code4history/Teiresias), so the
candidates found by Atlas can be ranked by `estimateCrs`. Atlas does not depend on Teiresias; the
types match by shape. The transformer returns `null` for a geo basis other than
`{ kind: "lonlat_deg", axisOrder: "lon-lat" }` and for an id that is not among the rows; otherwise it
returns what `transformLonLatArrayToProjected` returns. The rows are copied when the transformer is
created.

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

### Rows the bundled proj-wasm cannot export

Some proj.db rows throw inside the bundled proj-wasm when they are exported. Atlas avoids those
exports instead of letting the runtime break (the list is measured per proj-wasm version):

- Rows whose PROJ string cannot be produced (30 rows, for example `EPSG:32600` and `ESRI:54051`)
  are left out of the search result. Pass `onExcluded` to receive them once per search as
  `ProjectedCrsExclusion[]` (`{ id, name, reason }`).
- Rows whose WKT2 cannot be produced (992 rows: all `IGNF` rows and part of `IAU_2015`) stay in the
  result with `wkt2: null`. `wkt2` can therefore be `null` for proj.db rows as well as for custom
  projections.

```ts
const rows = await listProjectedCrsFromProjWasm({
  extent,
  onExcluded: (excluded) => console.log(excluded.map(({ id, reason }) => `${id}: ${reason}`)),
});
```

Within one process, the proj.db listing and each row's WKT2 and PROJ string are built once and reused
by later searches.

### Known limit of proj-wasm 0.1.0-alpha8

proj-wasm 0.1.0-alpha8 does not get back all memory when a PROJ object is released, and the wasm
memory is capped at 2 GiB. Searches reuse their PROJ objects, so they are not affected (4,000
searches in one process were measured). `transformLonLatArrayToProjected` (and the transformer from
`createCandidateTransformer`) still builds one PROJ object per call: about 200,000 calls in one
process (199,698 measured) fill the memory, after which calls return `null`. Start a new process
(or reload the page) before that.

## Development

- `pnpm run dev`: start the local demo site
- `pnpm run build`: build the published package into `dist/`
- `pnpm run build:demo`: build the GitHub Pages demo into `dist-demo/`
- `pnpm run verify:demo`: build and verify the GitHub Pages artifact
- `pnpm run test`: run the Vitest suite

## Publish

`pnpm publish` is guarded by `prepublishOnly`, which runs:

- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run verify:demo`

## Demo

- Root portal: `index.html`
- Demo app: `demo/crs-candidate-lookup.html`
- GitHub Pages target: `https://code4history.github.io/Atlas/`

## License

MIT License. See [LICENSE](./LICENSE).
