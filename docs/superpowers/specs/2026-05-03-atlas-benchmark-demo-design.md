# Atlas Benchmark Demo Design

## Summary

Atlas will add a second browser demo focused on comparing coordinate transformation performance and round-trip accuracy between:

- `proj-wasm` running in browser-safe single-threaded mode
- `proj4js`

The benchmark demo must run on GitHub Pages under the same runtime constraints as the first Atlas demo. It must use the real package-distributed `proj-wasm` browser assets and must not depend on `SharedArrayBuffer`, `COOP`, `COEP`, or `coi-serviceworker`.

## Goals

- Add a second demo page for browser-side benchmark comparison.
- Compare `proj-wasm` and `proj4js` with the same input coordinates, CRS targets, and iteration counts.
- Show total elapsed time, failure counts, and round-trip accuracy in one place.
- Reuse the existing Atlas demo shell and Pages-compatible runtime rules.
- Bundle a curated Japan-focused coordinate dataset with provenance and license notes.

## Non-Goals

- No pthread or multi-thread benchmark mode.
- No server-side benchmark runner.
- No claim of absolute scientific benchmarking precision across devices or browsers.
- No attempt to make `proj4js` support CRS definitions it fundamentally cannot evaluate.

## Demo Shape

The second demo is a `single-page benchmark lab`.

- Portal entry: add a second card to root `index.html`
- Demo page: `demo/benchmark.html`
- One screen contains:
  - dataset and benchmark controls
  - benchmark execution controls
  - result summary
  - per-CRS comparison table
  - error/failure detail area

This keeps the comparison model explicit and avoids splitting the same benchmark engine across multiple scenario pages.

## Runtime Rules

This demo inherits the Pages-first rules from the first Atlas demo.

- GitHub Pages is the acceptance environment.
- `pnpm run dev` is only a development aid.
- `proj-wasm` runs in single-threaded mode.
- The demo must not require `SharedArrayBuffer`, `crossOriginIsolated`, `COOP`, `COEP`, or `coi-serviceworker`.
- Runtime assets must resolve from `import.meta.env.BASE_URL`.
- The browser demo must use the actual package-distributed `proj-wasm` runtime files, not benchmark-only substitutes.

## Dataset

### Source Shape

The benchmark dataset is a bundled static dataset distributed with the demo.

- file location: under `demo/data/`
- format: JSON
- records: `{ category, name, lon, lat, sourceId?, sourceUrl? }`

Each record is a place name plus WGS84 longitude/latitude.

### Categories

The dataset should include as many public records as practical from categories such as:

- mountain summits
- mountain passes
- municipal offices
- railway stations

The point of the dataset is not thematic purity. The point is to cover a broad geographic spread across Japan with realistic named locations.

### Provenance

The demo must ship provenance notes.

- source URL(s)
- source dataset names
- applicable license or attribution notes
- any transformation or normalization steps used when building the bundled dataset

These notes can live in a small demo-local markdown or JSON metadata file and may also be linked from the benchmark page.

## CRS Scope

The benchmark compares transformations against these target CRS groups:

- EPSG:3857
- all Japan Plane Rectangular systems for JGD2000
- all Japan Plane Rectangular systems for Tokyo datum
- all Japan domestic UTM zones
- Japan City Plan definitions

The benchmark must allow the user to select:

- all supported CRS targets
- one CRS group
- one specific CRS

`proj4js` failures for unsupported CRS, including Japan City Plan definitions, are valid benchmark outcomes and must be reported as errors rather than hidden.

## Controls

The benchmark page must expose:

- dataset category selector
- dataset point limit input
- iteration count input
- CRS scope selector
- run button
- reset button

Optional but acceptable controls:

- include/exclude categories with checkboxes
- stop/cancel button
- warm-up toggle

### Point Limit

The user requested that, when the selected dataset contains fewer points than the desired benchmark count, the benchmark must loop back to the start of the dataset and continue reusing points until the requested count is satisfied.

This means:

- dataset point limit controls the effective source pool size
- iteration count controls how many full benchmark passes are performed
- each benchmark run consumes points cyclically from the selected pool

## Benchmark Procedure

For each selected target CRS:

1. take the selected dataset pool
2. cycle through points until the requested work count is satisfied
3. run forward transformation: lon/lat -> target CRS
4. run inverse transformation: target CRS -> lon/lat
5. measure total elapsed time
6. compute round-trip error from the original lon/lat and the inverse result

The same point sequence and requested work count must be used for both engines.

### Measurement Rules

- elapsed time is measured separately for `proj-wasm` and `proj4js`
- timing unit is milliseconds
- the demo reports total elapsed time, not just per-call average
- the demo may also derive per-operation averages for display, but total elapsed time is the primary metric
- initialization time is excluded from the benchmark loop and handled before the run begins

### Accuracy Rules

Round-trip accuracy is computed in geographic coordinates.

At minimum the demo reports:

- mean error
- max error
- error unit

The error unit should be made explicit in the UI. The safest default is decimal degrees unless the implementation intentionally converts to meters with a documented method.

## Failure Semantics

Failures are first-class output.

For each engine and CRS pair, the benchmark must record:

- success count
- failure count
- representative error message when failures occur

Failure examples include:

- `proj4js` unsupported CRS definition
- runtime initialization failure
- per-point transform exception

The UI must not silently drop failures or replace them with zero values.

## Initialization

The benchmark page must not allow execution before required runtime pieces are ready.

Initialization must complete for:

- Atlas runtime
- `proj-wasm`
- `proj4js`
- bundled dataset
- target CRS definition preparation

The page should show a visible loading state until benchmark execution is possible.

## UI Requirements

The benchmark page should stay within the same visual language as the first demo:

- dark header
- compact control strip
- white result panels
- light gray background
- portal card entry on `index.html`

The page does not need a slippy map. This demo is a benchmark lab, not a spatial browsing demo.

Recommended panel structure:

- top: controls and runtime status
- middle: benchmark summary cards
- bottom: per-CRS result table and failure detail

### Result Table

Each row should correspond to one target CRS and include at least:

- CRS id
- CRS name
- engine
- total time
- work count
- success count
- failure count
- mean round-trip error
- max round-trip error
- error status

Two reasonable renderings are acceptable:

- one row per engine per CRS
- one CRS row with side-by-side `proj-wasm` / `proj4js` columns

The second is preferable if it remains readable.

## Verification

### Automated

Add benchmark-specific verification for:

- portal includes a second demo card
- benchmark page is part of the demo build inputs
- benchmark page resolves under `/Atlas/`
- benchmark page uses package-distributed runtime assets
- benchmark page initializes both engines before enabling run

### Manual

Verify on a Pages-equivalent static serving setup:

- portal shows both demo cards
- benchmark page loads without console asset errors
- `proj-wasm` initializes in single-threaded browser mode
- `proj4js` initializes
- running with small dataset and low iteration count produces timing results
- unsupported CRS rows show explicit error state for `proj4js`
- repeating point consumption works when requested work exceeds selected dataset size

## Risks And Mitigations

- browser benchmark noise across devices: position this as comparative browser demo output, not a universal benchmark certificate
- very large runs blocking the UI: constrain defaults conservatively and allow dataset size limiting
- unsupported CRS confusion: show explicit failure rows instead of hiding them
- dataset licensing ambiguity: require provenance and attribution metadata alongside the bundled dataset
