## 1. Package Management

- [x] 1.1 Update package metadata for public npm publication.
- [x] 1.2 Make the public Atlas lookup runtime browser-capable as well as Node-capable.
- [x] 1.3 Replace raw path-oriented custom CRS loading with URI-based loading semantics.
- [x] 1.4 Ensure browser runtime asset resolution uses package-distributed `proj-wasm` assets under the configured base path.
- [x] 1.5 Add publish-oriented scripts and prepublish verification.
- [x] 1.6 Add bilingual README files aligned with sibling repositories.

## 2. Demo Site

- [x] 2.1 Add a root demo portal page and Atlas demo entry page.
- [x] 2.2 Implement the demo UI under `demo/` only.
- [x] 2.3 Use a slippy map with external OSM tiles rather than a pseudo-map board.
- [x] 2.4 Add `Deprecated`, `Onshore only`, `Area filter`, `Area select`, `Include custom projections`, and `Clear` controls with immediate re-query semantics.
- [x] 2.5 Add marker-based CRS querying, query-bbox visualization, CRS selection overlay, and full detail inspection.
- [x] 2.6 Expose distinct empty, loading, zero-result, and error states.

## 3. CI/CD

- [x] 3.1 Add or update workflows for test/build verification.
- [x] 3.2 Add GitHub Pages deployment for the demo build output.
- [x] 3.3 Verify the built artifact resolves portal, demo page, module, worker, wasm, `proj.db`, and other runtime assets under the `/Atlas/` base path.
- [x] 3.4 Verify the GitHub Pages design does not depend on `SharedArrayBuffer`, `COOP`, `COEP`, or `coi-serviceworker`.
