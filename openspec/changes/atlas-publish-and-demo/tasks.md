## 1. Package Management

- [ ] 1.1 Update package metadata for public npm publication.
- [ ] 1.2 Make the public Atlas lookup runtime browser-capable as well as Node-capable.
- [ ] 1.3 Replace raw path-oriented custom CRS loading with URI-based loading semantics.
- [ ] 1.4 Ensure browser runtime asset resolution uses package-distributed `proj-wasm` assets under the configured base path.
- [ ] 1.5 Add publish-oriented scripts and prepublish verification.
- [ ] 1.6 Add bilingual README files aligned with sibling repositories.

## 2. Demo Site

- [ ] 2.1 Add a root demo portal page and Atlas demo entry page.
- [ ] 2.2 Implement the demo UI under `demo/` only.
- [ ] 2.3 Use a slippy map with external OSM tiles rather than a pseudo-map board.
- [ ] 2.4 Add `Deprecated`, `Onshore only`, `Area filter`, `Area select`, `Include custom projections`, and `Clear` controls with immediate re-query semantics.
- [ ] 2.5 Add marker-based CRS querying, query-bbox visualization, CRS selection overlay, and full detail inspection.
- [ ] 2.6 Expose distinct empty, loading, zero-result, and error states.

## 3. CI/CD

- [ ] 3.1 Add or update workflows for test/build verification.
- [ ] 3.2 Add GitHub Pages deployment for the demo build output.
- [ ] 3.3 Verify the built artifact resolves portal, demo page, module, worker, wasm, `proj.db`, and other runtime assets under the `/Atlas/` base path.
- [ ] 3.4 Verify the GitHub Pages design does not depend on `SharedArrayBuffer`, `COOP`, `COEP`, or `coi-serviceworker`.
