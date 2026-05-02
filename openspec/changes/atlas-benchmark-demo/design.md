## Context

The first Atlas demo validates candidate CRS lookup and GitHub Pages packaging. The second demo is a benchmark lab that compares browser-side transformation behavior between `proj-wasm` and `proj4js`.

## Decisions

- implement the benchmark as a single-page lab at `demo/benchmark.html`
- keep GitHub Pages as the acceptance environment
- benchmark `proj-wasm` only in single-threaded browser-safe mode
- use a bundled static Japan-focused dataset with provenance metadata
- compare forward+inverse round trips for the same points, CRS targets, and requested work counts
- treat unsupported `proj4js` CRS cases as explicit failures, not hidden exclusions

## Consequences

- the benchmark remains compatible with GitHub Pages and external static hosting
- the result set is honest about unsupported CRS definitions
- benchmark output remains comparative rather than claiming machine-independent absolute precision
