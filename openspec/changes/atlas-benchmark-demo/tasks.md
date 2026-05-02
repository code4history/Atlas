## 1. Benchmark Page

- [ ] 1.1 Add a second portal card for the benchmark demo.
- [ ] 1.2 Add `demo/benchmark.html` within the existing demo shell.
- [ ] 1.3 Add controls for dataset category, point limit, iteration count, CRS scope, run, and reset.

## 2. Benchmark Engine

- [ ] 2.1 Bundle a Japan-focused coordinate dataset with provenance metadata.
- [ ] 2.2 Initialize Atlas runtime, `proj-wasm`, `proj4js`, dataset, and CRS definitions before enabling execution.
- [ ] 2.3 Compare forward and inverse round trips for `proj-wasm` and `proj4js` using the same point sequence.
- [ ] 2.4 Report total elapsed time, success count, failure count, mean error, and max error.
- [ ] 2.5 Treat unsupported CRS behavior as explicit benchmark failures.

## 3. Verification

- [ ] 3.1 Include the benchmark page in demo build verification.
- [ ] 3.2 Verify the benchmark page resolves under the `/Atlas/` base path.
- [ ] 3.3 Verify benchmark runtime initialization and asset loading on a Pages-compatible static build.
