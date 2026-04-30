## Context

Atlas already provides the candidate CRS lookup logic needed for Maplat V3.1. The remaining work is release standardization and demo delivery alignment with sibling repositories such as MaplatTransform and MaplatTin. The current gap is not only packaging; it is also runtime discipline. The demo must work within GitHub Pages constraints and must not drift away from the public Atlas lookup behavior.

## Decisions

- keep `src/` reserved for publishable library code
- make the publishable Atlas library usable from both Node.js and browsers
- place demo logic and resources under `demo/`
- keep root `index.html` as the GitHub Pages entry page
- use one Vite config with package mode and demo mode
- treat GitHub Pages under `/Atlas/` as the acceptance environment for the demo
- route browser demo lookup through the public Atlas API rather than a demo-local lookup clone
- require real slippy-map interaction with external OSM tiles
- keep `proj-wasm` single-threaded for demo compatibility and forbid demo requirements that depend on `SharedArrayBuffer` or isolation headers
- load runtime assets from the package-distributed `proj-wasm` files under the Pages base path
- use a lightweight table plus full detail panel instead of a spreadsheet framework
- implement “all clicked points are within the CRS” by querying with the bbox enclosing all clicked points

## Consequences

- package and demo concerns stay separated without splitting into multiple projects
- GitHub Pages compatibility constrains runtime design more strongly than local dev
- Atlas avoids gaining demo-only lookup logic in the public runtime surface by reusing one public API
- runtime asset resolution must be verified against built output under `/Atlas/`
