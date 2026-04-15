# Atlas

`@c4h/atlas` is the Node-only candidate CRS lookup library for Maplat V3.1.

- Input: `4326`-normalized GCP geometry or extent
- Output: candidate CRS records
- Sources: `proj.db` via `proj-wasm`, plus optional JSON-defined custom projections
- Scope: lookup and filtering only, not world-file fitting
