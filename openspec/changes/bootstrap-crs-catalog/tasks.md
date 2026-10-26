## 1. Specification
- [x] 1.1 Define candidate CRS lookup inputs and outputs.
- [x] 1.2 Define `proj.db` plus JSON-backed standard and user projection sources.
- [x] 1.3 Define `bbox_4326` filtering semantics.
- [x] 1.4 Define authority-source ingestion rules.

> Implemented.
> - 1.1: `listProjectedCrsFromProjWasm` and the pure filtering helpers (`src/proj-wasm-crs.ts`, exported from `src/index.ts`).
>   Test: `tests/proj-wasm-crs.test.ts` "returns projected CRS metadata filtered by area and within extent".
> - 1.2: `proj.db` through proj-wasm by default, plus the built-in custom projections and user projection JSON
>   (`src/proj-wasm-crs.ts`, `src/crs-seed.ts`). Tests: `tests/proj-wasm-crs.test.ts` "uses proj.db only by default",
>   "includes built-in custom projections when requested", "includes user projection JSON when requested".
> - 1.3: containment filtering by `bbox_4326` (`src/proj-wasm-crs.ts`). Tests: `tests/proj-wasm-crs.test.ts`
>   "applies default bbox padding during pure filtering" and "returns projected CRS metadata filtered by area and within extent".
> - 1.4: authority-source ingestion (`scripts/hydrate-crs-authority.cjs`). Test: `tests/crs-authority.test.ts` "CRS authority helpers".
