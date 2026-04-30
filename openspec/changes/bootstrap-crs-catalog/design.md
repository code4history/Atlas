## Context

Atlas is the first-stage CRS helper for Maplat V3.1. It receives `4326`-normalized geometry and returns candidate CRS records. It does not fit world-file parameters.

## Decisions

- Support both Node.js and browser runtimes through runtime-safe asset and URI loading.
- Use `proj.db` as the primary standard CRS catalog.
- Load built-in and user-managed custom projected CRS definitions from JSON.
- Filter candidates by `bbox_4326 contains` semantics.
- Treat local Japanese discovery sources as discovery aids, not the persisted authority source.
