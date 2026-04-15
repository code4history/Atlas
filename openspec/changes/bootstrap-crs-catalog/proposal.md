# Change: Bootstrap Atlas CRS Catalog

## Why
Candidate CRS lookup is now being split out from `MaplatTin` into its own library so extent-based CRS discovery can evolve independently.

## What Changes
- Define Node-only `proj-wasm`/`proj.db`-backed candidate CRS lookup.
- Define built-in and user-provided JSON custom projection inputs.
- Define candidate filtering and authority-data ingestion boundaries.

## Impact
- Affected specs: `candidate-crs-catalog`
- Affected code: future catalog loading, `proj-wasm` access, custom-projection JSON loading, candidate filtering helpers
