# Project Context

## Purpose
Atlas provides candidate CRS lookup for Maplat. It is the catalog and filtering layer used before CRS/world-file fitting.

## Tech Stack
- TypeScript (planned)
- `proj-wasm`-backed `proj.db` lookup plus optional JSON-defined custom projections
- Node.js and browser runtime support

## Domain Context
- Inputs are `4326`-normalized map-side GCP extents.
- Outputs are candidate CRS records suitable for later fitting and ranking.
- This package does not estimate world-file parameters.
