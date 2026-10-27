## 1. Benchmark Page

- [x] 1.1 Add a second portal card for the benchmark demo. — `index.html`; `tests/publish-and-demo.test.ts` › "uses the C4H demo boilerplate shell"
- [x] 1.2 Add `demo/benchmark.html` within the existing demo shell. — `demo/benchmark.html`, `demo/benchmark.js`, `demo/benchmark.css`, `demo/benchmark.d.ts`; `tests/benchmark-wiring.test.ts` › "keeps the run button disabled until every initialization has finished"; `tests/demo-bootstrap.test.ts` › "demo/benchmark.html imports initBenchmark from ./benchmark.js and calls it"
- [x] 1.3 Add controls for dataset category, point limit, iteration count, CRS scope, run, and reset. — `demo/benchmark.html`, `demo/benchmark.js` (`readControls`, `syncControls`), `demo/benchmark-engine.js` (`CRS_GROUPS`, `crsScopeIds`); `tests/benchmark-wiring.test.ts` › "button engine-coverage:a fills the controls with the preset input and runs once"

## 2. Benchmark Engine

- [x] 2.1 Bundle a Japan-focused coordinate dataset with provenance metadata. — `demo/data/benchmark-places.json`, `demo/data/benchmark-places.provenance.json`, `demo/benchmark-engine.js` (`selectPoints`); `tests/benchmark-engine.test.ts` › "A fails nowhere on proj4js" (reads the bundled dataset); `scripts/verify-demo-pages-build.mjs` (both data assets)
- [x] 2.2 Initialize Atlas runtime, `proj-wasm`, `proj4js`, dataset, and CRS definitions before enabling execution. — `demo/benchmark.js` (`initialize`); `tests/benchmark-wiring.test.ts` › "keeps the run button disabled until every initialization has finished"
- [x] 2.3 Compare forward and inverse round trips for `proj-wasm` and `proj4js` using the same point sequence. — `demo/benchmark-engine.js` (`buildWorkSequence`, `runProjWasmEngine`, `runProj4Engine`, `runBenchmark`); `tests/benchmark-engine.test.ts` › "cycles back to the first point until the requested work is done"
- [x] 2.4 Report total elapsed time, success count, failure count, mean error, and max error. — `demo/benchmark-engine.js` (per-engine statistics), `demo/benchmark.js` (`renderSummary`, `renderTable`); `tests/benchmark-engine.test.ts` › "finishes every point on both engines with a round-trip error below 1e-6 m"; `tests/benchmark-wiring.test.ts` › "shows the summary, the row of every CRS and the forward difference"
- [x] 2.5 Treat unsupported CRS behavior as explicit benchmark failures. — `demo/benchmark-engine.js` (failure records with the engine's message), `demo/benchmark.js` (`renderFailures`); `tests/benchmark-engine.test.ts` › "keeps proj4js failures explicit with the message the engine throws"; `tests/benchmark-wiring.test.ts` › "lists the failure message of an engine that could not read a definition"

## 3. Verification

- [x] 3.1 Include the benchmark page in demo build verification. — `vite.config.ts` (build input `benchmark`), `scripts/verify-demo-pages-build.mjs`; `tests/publish-and-demo.test.ts` › "has artifact-level Pages verification"
- [x] 3.2 Verify the benchmark page resolves under the `/Atlas/` base path. — `scripts/verify-demo-pages-build.mjs` (built page under `/Atlas/assets/`, portal cards); `tests/publish-and-demo.test.ts` › "builds the portal, the CRS subpage and the benchmark subpage"
- [x] 3.3 Verify benchmark runtime initialization and asset loading on a Pages-compatible static build. — `scripts/verify-demo-pages-build.mjs` (both data assets are referenced by the built scripts and exist); `tests/benchmark-wiring.test.ts` › "keeps the run button disabled until every initialization has finished"
