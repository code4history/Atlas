## ADDED Requirements

### Requirement: Atlas Must Provide A Browser Benchmark Demo

Atlas MUST provide a second browser demo that compares `proj-wasm` and `proj4js` under the same Pages-compatible runtime constraints as the main Atlas demo.

#### Scenario: Benchmark demo is reachable from the portal

- **WHEN** a user opens the demo root page
- **THEN** the portal includes an entry for the benchmark demo
- **AND** that entry navigates to the benchmark page

#### Scenario: Benchmark demo initializes both engines before execution

- **WHEN** a user opens the benchmark page
- **THEN** the page initializes the Atlas runtime, `proj-wasm`, `proj4js`, dataset, and benchmark CRS definitions before enabling benchmark execution

### Requirement: Benchmark Input Is Configurable

The benchmark page MUST allow the user to configure benchmark scope.

#### Scenario: User can choose benchmark work size

- **WHEN** a user inspects the benchmark controls
- **THEN** the page exposes an iteration count input
- **AND** the page exposes a dataset point limit input

#### Scenario: User can choose CRS scope

- **WHEN** a user inspects the benchmark controls
- **THEN** the page exposes a CRS scope selector covering supported groups and individual CRS targets

### Requirement: Benchmark Uses Bundled Japan-Focused Data

Atlas MUST bundle a Japan-focused place dataset with provenance metadata for the benchmark demo.

#### Scenario: Bundled dataset contains named point records

- **WHEN** the benchmark dataset is loaded
- **THEN** it contains named locations with longitude and latitude values
- **AND** it may include categories such as mountain summits, mountain passes, municipal offices, and railway stations

#### Scenario: Dataset provenance is available

- **WHEN** a maintainer reviews the benchmark data bundle
- **THEN** the bundled data includes source and attribution metadata

### Requirement: Benchmark Compares Identical Workloads

Atlas MUST compare `proj-wasm` and `proj4js` with the same effective point sequence and the same target CRS.

#### Scenario: Requested work exceeds dataset pool size

- **WHEN** the requested benchmark work count exceeds the selected dataset pool size
- **THEN** the benchmark cycles back to the start of the selected point set and continues until the requested work is satisfied

#### Scenario: Both engines use the same benchmark sequence

- **WHEN** a benchmark run starts for a target CRS
- **THEN** `proj-wasm` and `proj4js` execute the same forward and inverse point sequence for comparison

### Requirement: Benchmark Reports Time, Error, And Failures

Atlas MUST expose benchmark outcomes clearly.

#### Scenario: Benchmark reports elapsed time and round-trip error

- **WHEN** a benchmark run completes
- **THEN** the page reports elapsed time for each engine
- **AND** the page reports round-trip accuracy metrics for each engine

#### Scenario: Unsupported CRS behavior is visible

- **WHEN** one engine cannot evaluate a target CRS definition
- **THEN** the benchmark records that case as an explicit failure or error state
- **AND** it does not silently omit the CRS from the result set
