# candidate-crs-catalog Specification

## ADDED Requirements
### Requirement: Atlas SHALL Provide Candidate CRS Lookup From 4326-Normalized Input
Atlas SHALL accept `4326`-normalized GCP geometry or extent and return candidate CRS records independently of any world-file fitting workflow.

#### Scenario: Candidate lookup is requested
- **GIVEN** a `4326`-normalized input extent
- **WHEN** Atlas performs candidate lookup
- **THEN** it SHALL return candidate CRS records without performing world-file fitting

### Requirement: Candidate CRS Records SHALL Be Loaded From `proj.db` And Optional JSON Sources
Atlas SHALL source standard candidate CRS records from `proj.db` via `proj-wasm`, and MAY add built-in or user-provided JSON projection definitions to the search set.

#### Scenario: Standard candidate source is loaded
- **GIVEN** built-in candidate CRS records are needed
- **WHEN** Atlas loads the standard catalog
- **THEN** it SHALL read from `proj.db` through `proj-wasm`

#### Scenario: Built-in custom projections are requested
- **GIVEN** built-in custom projected CRS records are enabled
- **WHEN** Atlas performs candidate lookup
- **THEN** it SHALL add built-in JSON projection definitions to the search set

#### Scenario: User projection file is provided
- **GIVEN** user-defined candidate CRS records are needed
- **WHEN** Atlas loads custom candidates
- **THEN** it SHALL add the user-provided JSON projection definitions to the search set without mutating `proj.db`

#### Scenario: Browser callers use the same lookup semantics
- **GIVEN** a browser caller uses Atlas candidate lookup
- **WHEN** Atlas loads `proj.db` and optional JSON sources
- **THEN** it SHALL use runtime-safe asset loading rather than Node-only filesystem APIs

#### Scenario: User-defined resources are identified by URI
- **GIVEN** user-defined candidate CRS records are needed
- **WHEN** Atlas loads custom candidates
- **THEN** it SHALL accept URI-based resource identifiers instead of only raw local path strings

### Requirement: Candidate Filtering SHALL Use bbox_4326 Contains Semantics
Atlas SHALL filter candidate CRS records by requiring the input extent to be fully contained by the candidate CRS area-of-use extent.

#### Scenario: Input extent is fully covered
- **GIVEN** a candidate CRS whose `bbox_4326` fully contains the input extent
- **WHEN** Atlas filters candidates
- **THEN** that candidate SHALL remain in the result set

#### Scenario: Input extent exceeds the candidate area of use
- **GIVEN** a candidate CRS whose `bbox_4326` does not fully contain the input extent
- **WHEN** Atlas filters candidates
- **THEN** that candidate SHALL be excluded
