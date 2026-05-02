## ADDED Requirements

### Requirement: Benchmark Demo Must Be Included In Pages Verification

Atlas MUST include the benchmark page in the GitHub Pages build and verification flow.

#### Scenario: Benchmark page is part of the built artifact

- **WHEN** CI builds the demo artifact
- **THEN** the benchmark page is included in the built output under the `/Atlas/` base path

#### Scenario: Benchmark runtime assets resolve on Pages

- **WHEN** the benchmark page is served from a Pages-compatible build
- **THEN** the required modules and runtime assets for `proj-wasm` and benchmark data resolve successfully from the built artifact
