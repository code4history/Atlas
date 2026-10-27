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

- Node.js >= 22
- pnpm >= 10 for development

## Installation

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
definition PROJ cannot read, is not a CRS, has axes that are not east/north, has units that are
not metres (units are never converted), or cannot be reached from lon/lat on the Earth (for
example a CRS of the Moon). `null` is used for nothing else: when the
transformation fails on the implementation side (a PROJ object cannot be created, or a proj-wasm
call fails, for example because the wasm memory is full), the function throws, so such a failure is
never mistaken for an untransformable target.
The function accepts lon/lat degree input only.

### Using Atlas with Teiresias

`createCandidateTransformer(rows)` turns candidate rows into a transformer with the same shape as
the `CandidateTransformer` of [`@c4h/teiresias`](https://github.com/code4history/Teiresias), so the
candidates found by Atlas can be ranked by `estimateCrs`. Atlas does not depend on Teiresias; the
types match by shape. The transformer returns `null` for a geo basis other than
`{ kind: "lonlat_deg", axisOrder: "lon-lat" }` and for an id that is not among the rows; otherwise it
returns what `transformLonLatArrayToProjected` returns, and throws what it throws. The rows are copied
when the transformer is created.

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

### CRS of other celestial bodies

proj.db also holds CRS of other celestial bodies (the Moon, Mars, ...: most of the `IAU_2015`
authority and a few `ESRI` rows), many with a world-wide extent. `listProjectedCrsFromProjWasm`
leaves them out by default: transformations start from lon/lat on the Earth, PROJ has no operation
to another body, and with the bundled proj-wasm the exceptions this raises pile up until the runtime
stops answering. The test uses the celestial body proj.db gives for each CRS (its ellipsoid's
`celestial_body`, reported by PROJ as `celestialBodyName`); `IAU_2015` rows of the Earth stay.
No PROJ object is created for the rows left out.

- The rows left out are reported through `onExcluded` with the reason
  `Not on the Earth (celestial body: <name>)` (for a Kyoto extent without `area`: 2,046 rows, and
  the result goes from 2,213 to 167 rows).
- Pass `includeOtherCelestialBodies: true` to keep them (for example to list them). Do not pass such
  rows in bulk to `transformLonLatArrayToProjected`, nor through `createCandidateTransformer` to the
  `estimateCrs` of Teiresias: `estimateCrs` transforms every candidate it is given, so the runtime can
  stop answering, and a candidate whose transformation fails makes the whole estimate fail.

### Rows the bundled proj-wasm cannot export

Some proj.db rows throw inside the bundled proj-wasm when they are exported. Atlas avoids those
exports instead of letting the runtime break (the list is measured per proj-wasm version):

- Rows whose PROJ string cannot be produced (30 rows, for example `EPSG:32600` and `ESRI:54051`)
  are left out of the search result. Pass `onExcluded` to receive them once per search as
  `ProjectedCrsExclusion[]` (`{ id, name, reason }`), together with the rows of other celestial
  bodies above.
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
memory is capped at 2 GiB: about 200,000 objects created in one process fill it. Atlas therefore
keeps its PROJ objects instead of creating them again:

- Searches reuse the expanded rows (4,000 searches in one process were measured).
- `transformLonLatArrayToProjected` (and the transformer from `createCandidateTransformer`) keeps one
  transformation per target CRS, for up to 4,096 targets; beyond that the least recently used one is
  released. Repeated calls therefore do not use up the memory (210,000 calls in one process were
  measured).

Only a process that keeps cycling through more than 4,096 different targets creates objects again.
If the memory does run out, the calls throw instead of returning `null`; start a new process (or
reload the page) then.

## API

Everything below is exported from `@c4h/atlas`.

### Functions

| Name | What it does |
|---|---|
| `listProjectedCrsFromProjWasm(options)` | Lists projected CRS candidates whose area of use contains `options.extent` (see Basic Usage). Returns `ProjectedCrsInfo[]`. |
| `initializeProjWasmRuntime(options?)` | Loads the bundled proj-wasm runtime ahead of the first search. Optional; the other calls load it on demand. |
| `transformLonLatArrayToProjected(target, points, options?)` | Transforms lon/lat degrees (lon-lat order) into `[easting, northing]` of one candidate. |
| `createCandidateTransformer(rows, options?)` | Builds an `AtlasCandidateTransformer` for Teiresias' `estimateCrs` (see Using Atlas with Teiresias). |
| `isProjectedPrjPath(pathname)` | Tells whether a `.prj` path of the bundled Japanese WKT collection is a projected CRS. |
| `inferDatumFamily(pathname)` | Reads the datum family (`CandidateDatumFamily`) from such a path. |
| `inferKind(pathname)` | Reads the kind of projection (`CandidateKind`) from such a path. |
| `isScopeIncluded(kind, scope)` | Tells whether a `CandidateKind` belongs to a `CandidateSeedScope` (`"core"` or `"all"`). |
| `inferWgsEquivalent(datumFamily)` | `true` unless the datum family is the old Tokyo datum. |
| `extractAuthorityIdFromWkt(wkt)` | Returns the last `ID["authority","code"]` of a WKT string as a `CandidateAuthorityId`, or `undefined`. |
| `extractWktName(wkt)` | Returns the name of the root CRS of a WKT string. |
| `inferPriority(kind)` | Returns the sort priority of a `CandidateKind` (higher comes first). |
| `inferApproximateBbox(pathname, kind)` | Returns an approximate `CandidateBbox` (the UTM zone, the world for Web Mercator, Japan otherwise). |
| `bboxToPolygonWkt(bbox)` | Writes a `CandidateBbox` as a WKT `POLYGON`. |

### Types

| Name | What it describes |
|---|---|
| `ProjectedCrsInfo` | One candidate: `id`, `authority`, `code`, `name`, `areaName`, `deprecated`, `bbox`, `wkt2`, `proj4` and optional details. |
| `ProjectedCrsExclusion` | A row left out of a search, with the reason (given to `onExcluded`). |
| `ListProjectedCrsFromProjWasmOptions` | Options of `listProjectedCrsFromProjWasm`. |
| `InitializeProjWasmRuntimeOptions` | Options of `initializeProjWasmRuntime` (`projWasmAssetBaseUrl`). |
| `TransformLonLatToProjectedOptions` | Options of `transformLonLatArrayToProjected` and `createCandidateTransformer`. |
| `AtlasCandidateTransformer` | The transformer `createCandidateTransformer` returns. |
| `AtlasGeoBasisLike` | The geo basis a transformer receives (compatible with Teiresias' `GeoBasis`). |
| `CandidateCrsExtent` | A lon/lat extent `{ west, south, east, north }`. |
| `CandidateBbox` | A lon/lat bounding box `{ west, south, east, north }`. |
| `CandidateAuthorityId` | `{ authority, code }`. |
| `CandidateDatumFamily` | `"wgs84" \| "tokyo" \| "jgd2000" \| "jgd2011" \| "jgd2024"`. |
| `CandidateKind` | `"web_mercator" \| "utm" \| "japan_plane_rectangular" \| "japan_land_area" \| "regional_map" \| "weather_map"`. |
| `CandidateSeedScope` | `"core" \| "all"`. |

## Development

- `pnpm run dev`: start the local demo site
- `pnpm run build`: build the published package into `dist/`
- `pnpm run build:demo`: build the GitHub Pages demo into `dist-demo/`
- `pnpm run verify:demo`: build and verify the GitHub Pages artifact
- `pnpm run test`: run the Vitest suite

For an install of this repository on its own (outside a larger pnpm workspace), copy the CI
settings first: `cp ci/pnpm-workspace.ci.yaml pnpm-workspace.yaml && pnpm install --frozen-lockfile`.
Do not commit the copied `pnpm-workspace.yaml`.

## Publish

`pnpm publish` is guarded by `prepublishOnly`, which runs:

- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run verify:demo`
- `pnpm run verify:packed-browser`

Releases are published from GitHub Actions (`.github/workflows/publish.yml`). Changes are listed
in [CHANGELOG.md](./CHANGELOG.md).

## Demo

- Root portal: `index.html`
- Demo app: `demo/crs-candidate-lookup.html`
- GitHub Pages target: `https://code4history.github.io/Atlas/`

The demo page has three preset contrasts. Each contrast has an A and a B button:

- `place`: the same filters over Kyoto (A) and over Tokyo (B), so the candidate plane rectangular systems change (VI on one side, VIII and IX on the other).
- `historical-grid`: the Kyoto extent with the historical grid projections off (A) and on (B). B adds `UTJCP:ZONE-B` and exactly one row.
- `area-filter`: the Kyoto extent with the Japan area filter on (A) and off (B). Without the filter, CRSs from outside Japan join the list.

Pressing a preset puts markers on the four corners of its extent, fits the map to it, runs one lookup, and writes a one-line description of what should be visible. The existing toggles, area select and map controls keep working afterwards.

## License

MIT License. See [LICENSE](./LICENSE).
