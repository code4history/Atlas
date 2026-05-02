# Change: Add Atlas Browser Benchmark Demo

## Why

Atlas now needs a second demo that compares browser-side coordinate transformation behavior between `proj-wasm` and `proj4js`. The goal is not only to show speed, but also to show round-trip accuracy and unsupported CRS behavior under the same Pages-compatible runtime constraints as the first demo.

## What Changes

- add a second demo page for browser benchmark comparison
- bundle a Japan-focused point dataset with provenance metadata
- benchmark `proj-wasm` single-thread mode against `proj4js`
- report elapsed time, round-trip error, and failure counts across multiple CRS targets

## Impact

- Affected specs: `demo-site`, `ci-cd`
- Affected code: root `index.html`, `demo/**`, benchmark verification scripts/tests, README files
